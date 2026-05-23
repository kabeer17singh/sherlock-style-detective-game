import React, { useState } from 'react';

export default function Lobby({ user, onJoinRoom, onLogout }) {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');

  const handleCreateCase = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: 'case-crimson-cipher' })
      });
      const data = await res.json();
      if (res.ok) {
        onJoinRoom(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection failed.');
    }
  };

  const handleJoinCase = async (e) => {
    e.preventDefault();
    if (!joinCode) return;
    
    try {
      const res = await fetch(`http://localhost:3001/api/rooms/${joinCode}`);
      const data = await res.json();
      if (res.ok) {
        onJoinRoom({ roomId: data.roomId, roomCode: joinCode, caseId: data.caseId });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection failed.');
    }
  };

  return (
    <div className="lobby-container">
      <div className="panel auth-form" style={{ maxWidth: '500px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Welcome, {user.username}</h2>
          <button className="secondary" onClick={onLogout} style={{ padding: '0.5rem' }}>Logout</button>
        </div>
        
        {error && <div style={{color: 'red'}}>{error}</div>}
        
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '1rem 0' }}></div>
        
        <h3>Start a New Investigation</h3>
        <p style={{ fontSize: '0.9rem', color: '#ccc' }}>Begin "The Crimson Cipher" and invite other detectives to your office.</p>
        <button onClick={handleCreateCase}>Create New Case File</button>

        <div style={{ borderTop: '1px solid var(--color-border)', margin: '1rem 0', textAlign: 'center' }}>
          <span style={{ position: 'relative', top: '-12px', background: 'rgba(44,36,27,1)', padding: '0 10px' }}>OR</span>
        </div>

        <h3>Join Existing Investigation</h3>
        <form onSubmit={handleJoinCase} className="input-group" style={{ flexDirection: 'row' }}>
          <input 
            type="text" 
            placeholder="Enter 6-letter Room Code" 
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            style={{ flex: 1, textTransform: 'uppercase' }}
          />
          <button type="submit">Join</button>
        </form>
      </div>
    </div>
  );
}
