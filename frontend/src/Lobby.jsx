import React, { useEffect, useState } from 'react';
import { API_BASE } from './config';
import Tutorial from './components/Tutorial';

export default function Lobby({ user, onJoinRoom, onLogout, pendingRoomCode }) {
  const [joinCode, setJoinCode] = useState(pendingRoomCode || '');
  const [error, setError] = useState('');
  const [cases, setCases] = useState([]);
  const [scores, setScores] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('case-crimson-cipher');
  const [gameMode, setGameMode] = useState('coop');
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastRoomCode, setLastRoomCode] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/cases`)
      .then((res) => res.json())
      .then((data) => {
        setCases(data);
        if (data[0]) setSelectedCaseId(data[0].id);
      })
      .catch(() => setCases([]));

    fetch(`${API_BASE}/api/scores/${user.id}`)
      .then((res) => res.json())
      .then(setScores)
      .catch(() => setScores([]));
  }, [user.id]);

  const selectedCase = cases.find((c) => c.id === selectedCaseId);

  const handleCreateCase = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: selectedCaseId, gameMode }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastRoomCode(data.roomCode);
        onJoinRoom(data);
      } else {
        setError(data.error);
      }
    } catch {
      setError('Connection failed. Is the server running?');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinCase = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setError('');

    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(`${API_BASE}/api/rooms/${code}`);
      const data = await res.json();
      if (res.ok) {
        onJoinRoom({
          roomId: data.roomId,
          roomCode: code,
          caseId: data.caseId,
          caseTitle: data.caseTitle,
          gameMode: data.gameMode,
        });
      } else {
        setError(data.error);
      }
    } catch {
      setError('Connection failed. Is the server running?');
    }
  };

  const copyRoomCode = (code) => {
    const shareUrl = `${window.location.origin}?room=${code}`;
    navigator.clipboard.writeText(`Room: ${code}\nJoin: ${shareUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const qrUrl = lastRoomCode
    ? `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
        `${window.location.origin}?room=${lastRoomCode}`
      )}`
    : null;

  return (
    <div className="lobby-container">
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      <div className="panel auth-form lobby-panel">
        <div className="lobby-header">
          <div>
            <h2>Detective {user.username}</h2>
            <p className="lobby-sub">The Agency — Investigations Desk</p>
          </div>
          <div className="lobby-header-actions">
            <button type="button" className="secondary tutorial-btn" onClick={() => setShowTutorial(true)}>
              Tutorial
            </button>
            <button type="button" className="secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <section className="tutorial-teaser panel-inner">
          <h3>Detective&apos;s Handbook</h3>
          <p className="hint">
            New to The Agency? Learn how leads, the evidence board, deduction challenges,
            and final accusations work.
          </p>
          <button type="button" className="secondary" onClick={() => setShowTutorial(true)}>
            Open full tutorial
          </button>
        </section>

        <h3>Choose a case</h3>
        <div className="case-picker">
          {cases.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`case-pick ${selectedCaseId === c.id ? 'selected' : ''}`}
              onClick={() => setSelectedCaseId(c.id)}
            >
              <strong>{c.title}</strong>
              <span>{c.clueCount} clues · {c.maxLeads} leads</span>
            </button>
          ))}
        </div>

        {selectedCase && (
          <div className="case-brief panel-inner">
            <p>{selectedCase.description}</p>
          </div>
        )}

        <h3>Play mode</h3>
        <div className="mode-toggle">
          <button
            type="button"
            className={gameMode === 'solo' ? 'selected' : 'secondary'}
            onClick={() => setGameMode('solo')}
          >
            Solo
          </button>
          <button
            type="button"
            className={gameMode === 'coop' ? 'selected' : 'secondary'}
            onClick={() => setGameMode('coop')}
          >
            Co-op
          </button>
        </div>
        <p className="hint">
          {gameMode === 'solo'
            ? 'Play alone. Earn a hint after 3 wrong deductions.'
            : 'Invite a partner—all detectives must agree on each theory.'}
        </p>

        <div className="divider" />

        <button type="button" onClick={handleCreateCase} disabled={creating}>
          {creating ? 'Preparing case file...' : 'Open New Case File'}
        </button>

        {lastRoomCode && (
          <div className="share-block">
            <p>
              Last room: <strong>{lastRoomCode}</strong>
            </p>
            <button type="button" className="secondary" onClick={() => copyRoomCode(lastRoomCode)}>
              {copied ? 'Copied!' : 'Copy invite link'}
            </button>
            {qrUrl && (
              <img src={qrUrl} alt="Room QR code" className="room-qr" width={120} height={120} />
            )}
          </div>
        )}

        <div className="divider or-divider">
          <span>or</span>
        </div>

        <h3>Join existing room</h3>
        <form onSubmit={handleJoinCase} className="join-form">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button type="submit">Enter</button>
        </form>

        {scores.length > 0 && (
          <>
            <div className="divider" />
            <h3>Your best scores</h3>
            <ul className="scores-list">
              {scores.map((s) => (
                <li key={s.case_id}>
                  {cases.find((c) => c.id === s.case_id)?.title || s.case_id}:{' '}
                  <strong>{s.best_grade}</strong> ({s.best_points} pts)
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
