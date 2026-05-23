import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export default function GameBoard({ user, room, onLeave }) {
  const [socket, setSocket] = useState(null);
  const [boardData, setBoardData] = useState([]);
  const [unlockedClues, setUnlockedClues] = useState([]);
  const [draggingClue, setDraggingClue] = useState(null);
  
  // Hardcoded case data for client (in a real app, fetch this via API)
  const caseData = {
    "clue-1": { title: "Police Report", content: "Victim: Lord Harrington. Found dead in his study at 11:00 PM. A window was broken from the inside. A red cipher was written on the wall in blood: 'THE RAVEN FLIES AT MIDNIGHT'." },
    "clue-2": { title: "Suspect: Arthur Penhaligon", content: "Harrington's nephew. Claims he was at the theater until midnight. Needs verification." },
    "clue-3": { title: "Theater Ticket", content: "A torn theater ticket for 'The Raven', stamped at 10:30 PM. Found in Arthur's coat." },
    "clue-4": { title: "The Nephew's Lie", content: "Arthur claims he was at the theater until midnight, but 'The Raven' is the cipher. The ticket proves he was there, but it connects him to the message." }
  };
  
  const combinations = [
    { requires: ["clue-1", "clue-2"], unlocks: "clue-3", message: "You searched Arthur's coat after reading the police report." },
    { requires: ["clue-1", "clue-3"], unlocks: "clue-4", message: "Aha! 'The Raven' connects Arthur to the cipher!" }
  ];

  const boardRef = useRef(null);

  useEffect(() => {
    // Fetch initial state
    fetch(`http://localhost:3001/api/rooms/${room.roomCode}`)
      .then(res => res.json())
      .then(data => {
        setBoardData(data.boardData || []);
        setUnlockedClues(data.unlockedClues || []);
      });

    // Setup WebSocket
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join_room', room.roomCode);
    });

    newSocket.on('board_updated', (newBoardData) => {
      setBoardData(newBoardData);
    });

    newSocket.on('clues_unlocked', (newUnlockedClues) => {
      setUnlockedClues(newUnlockedClues);
    });

    return () => newSocket.close();
  }, [room.roomCode]);

  const updateBoardAndEmit = (newBoard) => {
    setBoardData(newBoard);
    socket.emit('update_board', { roomCode: room.roomCode, roomId: room.roomId, boardData: newBoard });
  };

  const unlockCluesAndEmit = (newUnlocked) => {
    setUnlockedClues(newUnlocked);
    socket.emit('unlock_clues', { roomCode: room.roomCode, roomId: room.roomId, unlockedClues: newUnlocked });
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, clueId, isFromInventory) => {
    setDraggingClue({ id: clueId, isFromInventory });
    // This is required for Firefox
    e.dataTransfer.setData('text/plain', clueId);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // allow drop
  };

  const handleDropOnBoard = (e) => {
    e.preventDefault();
    if (!draggingClue) return;

    const boardRect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - boardRect.left;
    const y = e.clientY - boardRect.top;

    let newBoard = [...boardData];
    
    if (draggingClue.isFromInventory) {
      // Add to board
      newBoard.push({ id: draggingClue.id, x, y });
    } else {
      // Move existing clue
      newBoard = newBoard.map(clue => 
        clue.id === draggingClue.id ? { ...clue, x, y } : clue
      );
    }

    updateBoardAndEmit(newBoard);
    checkCombinations(newBoard);
    setDraggingClue(null);
  };

  const checkCombinations = (currentBoard) => {
    // Very simple distance check: if two clues are close, combine them
    const distanceThreshold = 50; 
    
    for (let i = 0; i < currentBoard.length; i++) {
      for (let j = i + 1; j < currentBoard.length; j++) {
        const c1 = currentBoard[i];
        const c2 = currentBoard[j];
        
        const dist = Math.sqrt(Math.pow(c1.x - c2.x, 2) + Math.pow(c1.y - c2.y, 2));
        if (dist < distanceThreshold) {
          // Check if this pair unlocks anything
          const combo = combinations.find(c => 
            c.requires.includes(c1.id) && c.requires.includes(c2.id) && !unlockedClues.includes(c.unlocks)
          );
          
          if (combo) {
            alert(combo.message + "\n\nNew Clue Unlocked!");
            unlockCluesAndEmit([...unlockedClues, combo.unlocks]);
          }
        }
      }
    }
  };

  return (
    <div className="game-container">
      {/* Sidebar: Case File & Inventory */}
      <div className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Room: {room.roomCode}</h2>
          <button className="secondary" onClick={onLeave} style={{ padding: '0.4rem', fontSize: '0.9rem' }}>Leave</button>
        </div>
        <p>Drag clues from the file onto the evidence board to organize and connect them.</p>
        
        <div style={{ borderTop: '1px solid var(--color-border)', margin: '1rem 0' }}></div>
        
        <h3>Case File</h3>
        {unlockedClues.map(clueId => {
          const clue = caseData[clueId];
          const isOnBoard = boardData.some(c => c.id === clueId);
          if (!clue || isOnBoard) return null; // Don't show if it's already on the board

          return (
            <div 
              key={clueId}
              className="clue-card inventory"
              draggable
              onDragStart={(e) => handleDragStart(e, clueId, true)}
            >
              <div className="clue-title">{clue.title}</div>
              <div className="clue-content" style={{ maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {clue.content}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Evidence Board */}
      <div 
        className="board" 
        ref={boardRef}
        onDragOver={handleDragOver}
        onDrop={handleDropOnBoard}
      >
        {boardData.map(cluePos => {
          const clue = caseData[cluePos.id];
          if (!clue) return null;
          
          return (
            <div 
              key={cluePos.id}
              className="clue-card"
              style={{ left: cluePos.x, top: cluePos.y }}
              draggable
              onDragStart={(e) => handleDragStart(e, cluePos.id, false)}
            >
              <div className="pin"></div>
              <div className="clue-title">{clue.title}</div>
              <div className="clue-content">{clue.content}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
