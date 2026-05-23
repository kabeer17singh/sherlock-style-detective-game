const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Load Case Data
const case1Data = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases', 'case1.json'), 'utf-8'));
const cases = { [case1Data.id]: case1Data };

// API Routes

// Register
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const id = uuidv4();
  db.run(`INSERT INTO users (id, username, password) VALUES (?, ?, ?)`, [id, username, password], function(err) {
    if (err) return res.status(400).json({ error: "Username might already exist" });
    res.json({ id, username });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT id, username FROM users WHERE username = ? AND password = ?`, [username, password], (err, row) => {
    if (err || !row) return res.status(401).json({ error: "Invalid credentials" });
    res.json(row);
  });
});

// Create Room
app.post('/api/rooms', (req, res) => {
  const { caseId } = req.body;
  if (!cases[caseId]) return res.status(400).json({ error: "Invalid case ID" });
  
  const roomId = uuidv4();
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  db.run(`INSERT INTO rooms (id, room_code, case_id) VALUES (?, ?, ?)`, [roomId, roomCode, caseId], function(err) {
    if (err) return res.status(500).json({ error: "Failed to create room" });
    
    const initialBoardData = JSON.stringify([]);
    const initialUnlockedClues = JSON.stringify(cases[caseId].startingClues);
    
    db.run(`INSERT INTO room_state (room_id, board_data, unlocked_clues) VALUES (?, ?, ?)`, 
      [roomId, initialBoardData, initialUnlockedClues], (err) => {
        if (err) return res.status(500).json({ error: "Failed to initialize room state" });
        res.json({ roomId, roomCode, caseId });
    });
  });
});

// Get Room State
app.get('/api/rooms/:roomCode', (req, res) => {
  const { roomCode } = req.params;
  db.get(`SELECT r.id, r.case_id, rs.board_data, rs.unlocked_clues FROM rooms r 
          JOIN room_state rs ON r.id = rs.room_id 
          WHERE r.room_code = ?`, [roomCode], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Room not found" });
    res.json({
      roomId: row.id,
      caseId: row.case_id,
      boardData: JSON.parse(row.board_data),
      unlockedClues: JSON.parse(row.unlocked_clues)
    });
  });
});

// WebSocket for Real-time Game Board
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('join_room', (roomCode) => {
    socket.join(roomCode);
    console.log(`User joined room: ${roomCode}`);
  });

  socket.on('update_board', ({ roomCode, roomId, boardData }) => {
    // Save to DB
    db.run(`UPDATE room_state SET board_data = ? WHERE room_id = ?`, [JSON.stringify(boardData), roomId]);
    // Broadcast to others in room
    socket.to(roomCode).emit('board_updated', boardData);
  });

  socket.on('unlock_clues', ({ roomCode, roomId, unlockedClues }) => {
     db.run(`UPDATE room_state SET unlocked_clues = ? WHERE room_id = ?`, [JSON.stringify(unlockedClues), roomId]);
     socket.to(roomCode).emit('clues_unlocked', unlockedClues);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
