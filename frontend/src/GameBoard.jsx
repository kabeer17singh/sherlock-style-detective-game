import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { API_BASE, SOCKET_URL } from './config';
import DiscoveryToast from './components/DiscoveryToast';
import AccusationPanel from './components/AccusationPanel';
import DeductionModal from './components/DeductionModal';
import LeadPanel from './components/LeadPanel';
import DebriefScreen from './components/DebriefScreen';
import HowToPlay from './components/HowToPlay';

const COMBO_DISTANCE = 120;
const HOW_TO_KEY = 'detective-how-to-seen';

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function getConnectionPairs(boardData, readyKeys) {
  const pairs = [];
  for (let i = 0; i < boardData.length; i++) {
    for (let j = i + 1; j < boardData.length; j++) {
      const c1 = boardData[i];
      const c2 = boardData[j];
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < COMBO_DISTANCE) {
        const key = [c1.id, c2.id].sort().join('+');
        const isReady = readyKeys.some((k) => {
          const parts = k.split('+');
          return parts.includes(c1.id) && parts.includes(c2.id);
        });
        pairs.push({ c1, c2, dist, isReady });
      }
    }
  }
  return pairs;
}

export default function GameBoard({ user, room, onLeave }) {
  const [socket, setSocket] = useState(null);
  const [caseData, setCaseData] = useState(null);
  const [boardData, setBoardData] = useState([]);
  const [unlockedClues, setUnlockedClues] = useState([]);
  const [leadsRemaining, setLeadsRemaining] = useState(7);
  const [investigatedLocations, setInvestigatedLocations] = useState([]);
  const [gameMode, setGameMode] = useState(room.gameMode || 'coop');
  const [stats, setStats] = useState({ wrongDeductions: 0, hintsUsed: 0 });
  const [deductionsReady, setDeductionsReady] = useState([]);
  const [activeDeduction, setActiveDeduction] = useState(null);
  const [voteStatus, setVoteStatus] = useState(null);
  const [hint, setHint] = useState(null);
  const [showIntro, setShowIntro] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [draggingClue, setDraggingClue] = useState(null);
  const [players, setPlayers] = useState([]);
  const [discoveries, setDiscoveries] = useState([]);
  const [gamePhase, setGamePhase] = useState('investigation');
  const [accusationResult, setAccusationResult] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loadError, setLoadError] = useState('');
  const [accuseDisabled, setAccuseDisabled] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const boardRef = useRef(null);

  const clues = caseData?.clues || {};
  const totalClues = caseData ? Object.keys(caseData.clues).length : 0;
  const progress = totalClues ? Math.round((unlockedClues.length / totalClues) * 100) : 0;
  const readyKeys = deductionsReady.map((d) => d.key);

  const canAccuse = useMemo(() => {
    if (!caseData?.solution?.requiredClues) return false;
    return caseData.solution.requiredClues.every((id) => unlockedClues.includes(id));
  }, [caseData, unlockedClues]);

  const connectionPairs = useMemo(
    () => getConnectionPairs(boardData, readyKeys),
    [boardData, readyKeys]
  );

  const pushDiscovery = useCallback((payload) => {
    setDiscoveries((d) => {
      if (d.some((item) => item.message === payload.message && item.title === payload.title)) {
        return d;
      }
      return [
        ...d,
        {
          id: `${payload.unlocks}-${Date.now()}`,
          title: payload.title,
          message: payload.message,
          by: payload.by,
        },
      ];
    });
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(HOW_TO_KEY)) setShowHowTo(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [roomRes, caseRes] = await Promise.all([
          fetch(`${API_BASE}/api/rooms/${room.roomCode}`),
          fetch(`${API_BASE}/api/cases/${room.caseId}`),
        ]);
        const roomJson = await roomRes.json();
        const caseJson = await caseRes.json();
        if (!roomRes.ok) throw new Error(roomJson.error || 'Room not found');
        if (!caseRes.ok) throw new Error(caseJson.error || 'Case not found');
        if (cancelled) return;

        setCaseData(caseJson);
        setBoardData(roomJson.boardData || []);
        setUnlockedClues(roomJson.unlockedClues || []);
        setLeadsRemaining(roomJson.leadsRemaining ?? caseJson.maxLeads ?? 7);
        setInvestigatedLocations(roomJson.investigatedLocations || []);
        setGameMode(roomJson.gameMode || room.gameMode || 'coop');
        setStats(roomJson.stats || {});
        setDeductionsReady(roomJson.deductionsReady || []);
        setGamePhase(roomJson.gamePhase || 'investigation');
        setAccusationResult(roomJson.accusationResult || null);
        if (caseJson.intro) setShowIntro(true);
      } catch (e) {
        setLoadError(e.message || 'Failed to load investigation');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [room.roomCode, room.caseId, room.gameMode]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { path: '/socket.io' });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', {
        roomCode: room.roomCode,
        username: user.username,
        userId: user.id,
      });
    });

    newSocket.on('board_updated', setBoardData);
    newSocket.on('clues_unlocked', setUnlockedClues);
    newSocket.on('leads_updated', (data) => {
      setLeadsRemaining(data.leadsRemaining);
      setInvestigatedLocations(data.investigatedLocations);
    });
    newSocket.on('stats_updated', setStats);
    newSocket.on('deductions_ready', setDeductionsReady);
    newSocket.on('players_updated', setPlayers);
    newSocket.on('discovery_made', pushDiscovery);
    newSocket.on('deduction_vote_update', setVoteStatus);
    newSocket.on('deduction_success', () => {
      setActiveDeduction(null);
      setVoteStatus(null);
      setHint(null);
      setStatusMsg('Breakthrough! New evidence unlocked.');
      setTimeout(() => setStatusMsg(''), 4000);
    });
    newSocket.on('deduction_failed', (data) => {
      setStatusMsg(data.reason);
      setTimeout(() => setStatusMsg(''), 4000);
    });
    newSocket.on('hint_granted', (data) => setHint(data));
    newSocket.on('action_rejected', (data) => {
      setStatusMsg(data.reason);
      setTimeout(() => setStatusMsg(''), 3000);
    });
    newSocket.on('note_added', (note) => setNotes((n) => [...n.slice(-19), note]));
    newSocket.on('accusation_result', (result) => {
      setAccusationResult(result);
      setGamePhase('solved');
      setAccuseDisabled(false);
      setActiveDeduction(null);
    });
    newSocket.on('accusation_rejected', (data) => {
      setStatusMsg(data.reason);
      setAccuseDisabled(false);
    });

    return () => newSocket.close();
  }, [room.roomCode, user.username, user.id, pushDiscovery]);

  useEffect(() => {
    if (deductionsReady.length > 0 && !activeDeduction && gamePhase !== 'solved') {
      setActiveDeduction(deductionsReady[0]);
    }
  }, [deductionsReady, activeDeduction, gamePhase]);

  const emitBoardUpdate = (newBoard) => {
    setBoardData(newBoard);
    if (!socket?.connected) return;
    socket.emit('update_board', {
      roomCode: room.roomCode,
      roomId: room.roomId,
      boardData: newBoard,
      caseId: room.caseId,
    });
  };

  const handleInvestigate = (locationId) => {
    if (!socket?.connected) return;
    socket.emit('investigate_location', {
      roomCode: room.roomCode,
      roomId: room.roomId,
      caseId: room.caseId,
      locationId,
    });
  };

  const handleSubmitDeduction = (comboKey, optionId) => {
    if (!socket?.connected) return;
    socket.emit('submit_deduction', {
      roomCode: room.roomCode,
      roomId: room.roomId,
      caseId: room.caseId,
      comboKey,
      optionId,
    });
  };

  const handleRequestHint = (comboKey) => {
    if (!socket?.connected) return;
    socket.emit('request_hint', {
      roomCode: room.roomCode,
      roomId: room.roomId,
      caseId: room.caseId,
      comboKey,
    });
  };

  const handleAccuse = (suspectId, evidenceClueIds) => {
    if (!socket?.connected) return;
    setAccuseDisabled(true);
    socket.emit('make_accusation', {
      roomCode: room.roomCode,
      roomId: room.roomId,
      caseId: room.caseId,
      suspectId,
      evidenceClueIds,
      userId: user.id,
    });
  };

  const handleDragStart = (e, clueId, isFromInventory) => {
    if (gamePhase === 'solved') return;
    setDraggingClue({ id: clueId, isFromInventory });
    e.dataTransfer.setData('text/plain', clueId);
  };

  const handleDragOver = (e) => e.preventDefault();

  const handleDropOnBoard = (e) => {
    e.preventDefault();
    if (!draggingClue || gamePhase === 'solved') return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - boardRect.left - 100);
    const y = Math.max(0, e.clientY - boardRect.top - 40);

    let newBoard = [...boardData];
    if (draggingClue.isFromInventory) {
      const existing = newBoard.find((c) => c.id === draggingClue.id);
      if (existing) {
        newBoard = newBoard.map((c) =>
          c.id === draggingClue.id ? { ...c, x, y } : c
        );
      } else {
        newBoard.push({ id: draggingClue.id, x, y });
      }
    } else {
      newBoard = newBoard.map((c) =>
        c.id === draggingClue.id ? { ...c, x, y } : c
      );
    }

    emitBoardUpdate(newBoard);
    setDraggingClue(null);
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    const text = noteText.trim();
    if (!text || !socket?.connected) return;
    socket.emit('add_note', { roomCode: room.roomCode, note: { text } });
    setNoteText('');
  };

  const dismissToast = (id) => setDiscoveries((d) => d.filter((t) => t.id !== id));

  const closeHowTo = () => {
    localStorage.setItem(HOW_TO_KEY, '1');
    setShowHowTo(false);
  };

  if (loadError) {
    return (
      <div className="lobby-container">
        <div className="panel auth-form">
          <p style={{ color: '#f88' }}>{loadError}</p>
          <button type="button" onClick={onLeave}>Return to Lobby</button>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="lobby-container">
        <div className="panel auth-form">
          <p>Opening case file...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {showHowTo && <HowToPlay onClose={closeHowTo} />}

      {showIntro && caseData.intro && (
        <div className="modal-overlay">
          <div className="modal panel intro-modal">
            <h2>{caseData.title}</h2>
            <p className="intro-text">{caseData.intro}</p>
            <p className="hint">
              Mode: {gameMode === 'solo' ? 'Solo investigation' : 'Cooperative'} ·{' '}
              {leadsRemaining} leads available
            </p>
            <button type="button" onClick={() => setShowIntro(false)}>
              Open Case File
            </button>
          </div>
        </div>
      )}

      <DiscoveryToast discoveries={discoveries} onDismiss={dismissToast} />

      {activeDeduction && gamePhase !== 'solved' && (
        <DeductionModal
          deduction={activeDeduction}
          gameMode={gameMode}
          voteStatus={voteStatus}
          wrongCount={stats.wrongDeductions || 0}
          hint={hint}
          onSubmit={handleSubmitDeduction}
          onHint={handleRequestHint}
          onClose={() => setActiveDeduction(null)}
        />
      )}

      {gamePhase === 'solved' && accusationResult && (
        <DebriefScreen result={accusationResult} caseData={caseData} onLeave={onLeave} />
      )}

      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h2>{caseData.title}</h2>
            <span className="room-code">
              {room.roomCode} · {gameMode === 'solo' ? 'Solo' : 'Co-op'}
            </span>
          </div>
          <button type="button" className="secondary leave-btn" onClick={onLeave}>
            Leave
          </button>
        </div>

        {statusMsg && <div className="status-banner">{statusMsg}</div>}

        <div className="progress-block">
          <div className="progress-label">
            <span>Evidence gathered</span>
            <span>{unlockedClues.length}/{totalClues}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="players-block">
          <h4>Detectives</h4>
          <ul>
            {players.length === 0 && <li>{user.username} (you)</li>}
            {players.map((p) => (
              <li key={p.id}>
                {p.username}
                {p.username === user.username ? ' (you)' : ''}
              </li>
            ))}
          </ul>
        </div>

        <div className="divider" />

        <LeadPanel
          locations={caseData.locations}
          leadsRemaining={leadsRemaining}
          investigatedLocations={investigatedLocations}
          unlockedClues={unlockedClues}
          gamePhase={gamePhase}
          onInvestigate={handleInvestigate}
        />

        <div className="divider" />

        <h3>Case file</h3>
        <p className="hint">
          Drag clues to the board. Red lines mean a deduction is ready—answer the challenge!
        </p>

        {unlockedClues.map((clueId) => {
          const clue = clues[clueId];
          const isOnBoard = boardData.some((c) => c.id === clueId);
          if (!clue || isOnBoard) return null;
          return (
            <div
              key={clueId}
              className={`clue-card inventory type-${clue.type}`}
              draggable={gamePhase !== 'solved'}
              onDragStart={(e) => handleDragStart(e, clueId, true)}
            >
              <span className="clue-type">{clue.type}</span>
              <div className="clue-title">{clue.title}</div>
              <div className="clue-content clipped">{clue.content}</div>
            </div>
          );
        })}

        {deductionsReady.length > 0 && gamePhase !== 'solved' && (
          <button
            type="button"
            className="deduction-alert-btn"
            onClick={() => setActiveDeduction(deductionsReady[0])}
          >
            Deduction ready ({deductionsReady.length})
          </button>
        )}

        <div className="divider" />

        <AccusationPanel
          suspects={caseData.suspects || []}
          clues={clues}
          requiredEvidenceCount={caseData.solution?.evidenceClues?.length || 2}
          canAccuse={canAccuse}
          gamePhase={gamePhase}
          onAccuse={handleAccuse}
          disabled={accuseDisabled}
        />

        <div className="divider" />

        <h3>Shared notes</h3>
        <form className="note-form" onSubmit={handleAddNote}>
          <input
            type="text"
            placeholder="Leave a note for your partner..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            disabled={gamePhase === 'solved'}
          />
          <button type="submit" className="secondary" disabled={gamePhase === 'solved'}>
            Pin note
          </button>
        </form>
        <div className="notes-feed">
          {notes.map((n) => (
            <div key={n.at} className="note-item">
              <strong>{n.by}</strong>
              <p>{n.text}</p>
            </div>
          ))}
        </div>
      </aside>

      <div
        className="board"
        ref={boardRef}
        onDragOver={handleDragOver}
        onDrop={handleDropOnBoard}
      >
        <svg className="connection-layer">
          {connectionPairs.map(({ c1, c2, isReady }) => (
            <line
              key={pairKey(c1.id, c2.id)}
              x1={c1.x + 100}
              y1={c1.y + 60}
              x2={c2.x + 100}
              y2={c2.y + 60}
              className={isReady ? 'connection-line ready' : 'connection-line'}
            />
          ))}
        </svg>

        {boardData.length === 0 && (
          <div className="board-hint">
            <h3>Evidence Board</h3>
            <p>Investigate locations, then drag clues here. Link related cards to unlock deductions.</p>
          </div>
        )}

        {boardData.map((cluePos) => {
          const clue = clues[cluePos.id];
          if (!clue) return null;
          return (
            <div
              key={cluePos.id}
              className={`clue-card type-${clue.type}`}
              style={{ left: cluePos.x, top: cluePos.y }}
              draggable={gamePhase !== 'solved'}
              onDragStart={(e) => handleDragStart(e, cluePos.id, false)}
            >
              <div className="pin" />
              <span className="clue-type">{clue.type}</span>
              <div className="clue-title">{clue.title}</div>
              <div className="clue-content">{clue.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
