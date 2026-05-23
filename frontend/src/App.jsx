import React, { useState } from 'react';
import Auth from './Auth';
import Lobby from './Lobby';
import GameBoard from './GameBoard';

function App() {
  const [user, setUser] = useState(null);
  const [room, setRoom] = useState(null);

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  if (!room) {
    return <Lobby user={user} onJoinRoom={setRoom} onLogout={() => setUser(null)} />;
  }

  return <GameBoard user={user} room={room} onLeave={() => setRoom(null)} />;
}

export default App;
