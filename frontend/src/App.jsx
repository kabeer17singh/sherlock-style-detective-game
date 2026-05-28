import React, { useState, useEffect } from 'react';
import Auth from './Auth';
import Lobby from './Lobby';
import GameBoard from './GameBoard';

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room')?.trim().toUpperCase() || null;
}

function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [pendingRoomCode] = useState(getRoomFromUrl);

  useEffect(() => {
    if (room) {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.pathname);
    }
  }, [room]);

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  if (!room) {
    return (
      <Lobby
        user={user}
        pendingRoomCode={pendingRoomCode}
        onJoinRoom={setRoom}
        onLogout={() => setUser(null)}
      />
    );
  }

  return <GameBoard user={user} room={room} onLeave={() => setRoom(null)} />;
}

export default App;
