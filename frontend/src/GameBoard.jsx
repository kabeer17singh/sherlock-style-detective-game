import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { API_BASE, SOCKET_URL } from './config';
import DiscoveryToast from './components/DiscoveryToast';
import AccusationPanel from './components/AccusationPanel';

const COMBO_DISTANCE = 120;

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function getConnectionPairs(boardData) {
  const pairs = [];
  for (let i = 0; i < boardData.length; i++) {
    for (let j = i + 1; j < boardData.length; j++) {
      const c1 = boardData[i];
      const c2 = boardData[j];
      const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
      if (dist < COMBO_DISTANCE) {
        pairs.push({ c1, c2, dist });
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
  const [draggingClue, setDraggingClue] = useState(null);
  const [players, setPlayers] = useState([]);
  const [discoveries, setDiscoveries] = useState([]);
  const [gamePhase, setGamePhase] = useState('investigation');
  const [accusationResult, setAccusationResult] = useState(null);
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [loadError, setLoadError] = useState('');
  const [accuseDisabled, setAccuseDisabled] = useState(false);

  const boardRef = useRef(null);

  const clues = caseData?.clues || {};
  const totalClues = caseData ? Object.keys(caseData.clues).length : 0;
  const progress = totalClues ? Math.round((unlockedClues.length / totalClues) * 100) : 0;

  const canAccuse = useMemo(() => {
    if (!caseData?.solution?.requiredClues) return false;
    return caseData.solution.requiredClues.every((id) => unlockedClues.includes(id));
  }, [caseData, unlockedClues]);

  const connectionPairs = useMemo(() => getConnectionPairs(boardData), [boardData]);

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
        setGamePhase(roomJson.gamePhase || 'investigation');
        setAccusationResult(roomJson.accusationResult || null);
      } catch (e) {
        setLoadError(e.message || 'Failed to load investigation');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [room.roomCode, room.caseId]);

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
    newSocket.on('players_updated', setPlayers);
    newSocket.on('discovery_made', pushDiscovery);
    newSocket.on('note_added', (note) => setNotes((n) => [...n.slice(-19), note]));
    newSocket.on('accusation_result', (result) => {
      setAccusationResult(result);
      setGamePhase('solved');
      setAccuseDisabled(false);
    });
    newSocket.on('accusation_rejected', (data) => {
      alert(data.reason);
      setAccuseDisabled(false);
    });

    return () => newSocket.close();
  }, [room.roomCode, user.username, user.id, pushDiscovery]);

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

  const handleDragStart = (e, clueId, isFromInventory) => {
    if (gamePhase === 'solved') return;
    setDraggingClue({ id: clueId, isFromInventory });
    e.dataTransfer.setData('text/plain', clueId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

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

  const handleAccuse = (suspectId) => {
    if (!socket?.connected) return;
    setAccuseDisabled(true);
    socket.emit('make_accusation', {
      roomCode: room.roomCode,
      roomId: room.roomId,
      caseId: room.caseId,
      suspectId,
    });
  };

  const dismissToast = (id) => {
    setDiscoveries((d) => d.filter((t) => t.id !== id));
  };

  if (loadError) {
    return (
      <div className="lobby-container">
        <div className="panel auth-form">
          <p style={{ color: '#f88' }}>{loadError}</p>
          <button type="button" onClick={onLeave}>
            Return to Lobby
          </button>
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
      <DiscoveryToast discoveries={discoveries} onDismiss={dismissToast} />

      {gamePhase === 'solved' && accusationResult && (
        <div className={`verdict-overlay ${accusationResult.correct ? 'win' : 'lose'}`}>
          <div className="verdict-card panel">
            <h2>{accusationResult.correct ? 'Case Closed' : 'Wrong Suspect'}</h2>
            <p>
              {accusationResult.correct
                ? `${accusationResult.by} identified ${accusationResult.culpritName} as the killer.`
                : `The real culprit was ${accusationResult.culpritName}.`}
            </p>
            <p className="verdict-explanation">{accusationResult.explanation}</p>
            <button type="button" onClick={onLeave}>
              Return to Lobby
            </button>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <h2>{caseData.title}</h2>
            <span className="room-code">Room {room.roomCode}</span>
          </div>
          <button type="button" className="secondary leave-btn" onClick={onLeave}>
            Leave
          </button>
        </div>

        <p className="sidebar-intro">{caseData.description}</p>

        <div className="progress-block">
          <div className="progress-label">
            <span>Evidence gathered</span>
            <span>
              {unlockedClues.length}/{totalClues}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="players-block">
          <h4>Detectives in office</h4>
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

        <h3>Case file</h3>
        <p className="hint">Drag clues onto the corkboard. Place related cards close together to deduce new evidence.</p>

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

        <div className="divider" />

        <AccusationPanel
          suspects={caseData.suspects || []}
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
          {notes.length === 0 && <p className="hint">No notes yet. Coordinate your theory here.</p>}
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
          {connectionPairs.map(({ c1, c2 }) => (
            <line
              key={pairKey(c1.id, c2.id)}
              x1={c1.x + 100}
              y1={c1.y + 60}
              x2={c2.x + 100}
              y2={c2.y + 60}
              className="connection-line"
            />
          ))}
        </svg>

        {boardData.length === 0 && (
          <div className="board-hint">
            <h3>Evidence Board</h3>
            <p>Drag clues from the case file. When two related clues sit near each other, you may uncover new evidence.</p>
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
