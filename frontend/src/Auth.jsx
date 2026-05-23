import React, { useState } from 'react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isLogin ? '/api/login' : '/api/register';
    
    try {
      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (res.ok) {
        onLogin(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Connection failed. Is the server running?');
    }
  };

  return (
    <div className="auth-container">
      <div className="panel auth-form">
        <h1 className="auth-title">The Agency</h1>
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
          {error && <div style={{color: 'red', textAlign: 'center'}}>{error}</div>}
          <div className="input-group">
            <label>Detective Name</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label>Passcode</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit">
            {isLogin ? 'Enter Office' : 'Register Credentials'}
          </button>
        </form>
        <button className="secondary" onClick={() => setIsLogin(!isLogin)}>
          {isLogin ? 'Need an account?' : 'Already have an account?'}
        </button>
      </div>
    </div>
  );
}
