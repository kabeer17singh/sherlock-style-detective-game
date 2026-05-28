import React, { useEffect, useState } from 'react';
import { API_BASE } from './config';

export default function Lobby({ user, onJoinRoom, onLogout }) {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [cases, setCases] = useState([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/cases`)
      .then((res) => res.json())
      .then(setCases)
      .catch(() => setCases([]));
  }, []);

  const featuredCase = cases[0];

  const handleCreateCase = async () => {
    setError('');
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: 'case-crimson-cipher' }),
      });
      const data = await res.json();
      if (res.ok) {
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
        });
      } else {
        setError(data.error);
      }
    } catch {
      setError('Connection failed. Is the server running?');
    }
  };

  return (
    <div className="lobby-container">
      <div className="panel auth-form lobby-panel">
        <div className="lobby-header">
          <div>
            <h2>Detective {user.username}</h2>
            <p className="lobby-sub">The Agency — Investigations Desk</p>
          </div>
          <button type="button" className="secondary" onClick={onLogout}>
            Logout
          </button>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="case-brief panel-inner">
          <h3>{featuredCase?.title || 'The Crimson Cipher'}</h3>
          <p>{featuredCase?.description || 'A Victorian murder mystery for 1–4 detectives.'}</p>
          {featuredCase && (
            <span className="case-meta">{featuredCase.clueCount} clues · cooperative deduction</span>
          )}
        </div>

        <div className="divider" />

        <h3>Start a new investigation</h3>
        <p className="hint">Create a private room and share the 6-letter code with your partner.</p>
        <button type="button" onClick={handleCreateCase} disabled={creating}>
          {creating ? 'Preparing case file...' : 'Open New Case File'}
        </button>

        <div className="divider or-divider">
          <span>or</span>
        </div>

        <h3>Join an existing room</h3>
        <form onSubmit={handleJoinCase} className="join-form">
          <input
            type="text"
            placeholder="Room code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ textTransform: 'uppercase' }}
          />
          <button type="submit">Enter Room</button>
        </form>

        <ul className="lobby-tips">
          <li>Drag clues onto the corkboard and place related cards near each other.</li>
          <li>Watch for red connection lines — they signal a possible deduction.</li>
          <li>Gather every critical clue before making your final accusation.</li>
        </ul>
      </div>
    </div>
  );
}
