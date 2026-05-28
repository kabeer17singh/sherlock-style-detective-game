const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const fs = require('fs');
const path = require('path');
const {
  findNewDiscoveries,
  canAccuse,
  evaluateAccusation,
} = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const case1Data = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'cases', 'case1.json'), 'utf-8')
);
const cases = { [case1Data.id]: case1Data };

const roomPlayers = new Map();

function getCase(caseId) {
  return cases[caseId];
}

function normalizeRoomCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

function getRoomPlayers(roomCode) {
  const set = roomPlayers.get(roomCode);
  return set ? Array.from(set.values()) : [];
}

function broadcastPlayers(roomCode) {
  io.to(roomCode).emit('players_updated', getRoomPlayers(roomCode));
}

function getRoomState(roomId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT board_data, unlocked_clues, game_phase, winner, accusation_result
       FROM room_state WHERE room_id = ?`,
      [roomId],
      (err, row) => {
        if (err || !row) return reject(err || new Error('Room state not found'));
        resolve({
          boardData: JSON.parse(row.board_data || '[]'),
          unlockedClues: JSON.parse(row.unlocked_clues || '[]'),
          gamePhase: row.game_phase || 'investigation',
          winner: row.winner,
          accusationResult: row.accusation_result
            ? JSON.parse(row.accusation_result)
            : null,
        });
      }
    );
  });
}

function saveRoomState(roomId, state) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE room_state
       SET board_data = ?, unlocked_clues = ?, game_phase = ?, winner = ?, accusation_result = ?
       WHERE room_id = ?`,
      [
        JSON.stringify(state.boardData),
        JSON.stringify(state.unlockedClues),
        state.gamePhase,
        state.winner || null,
        state.accusationResult ? JSON.stringify(state.accusationResult) : null,
        roomId,
      ],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

app.get('/api/cases', (_req, res) => {
  res.json(
    Object.values(cases).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      clueCount: Object.keys(c.clues).length,
    }))
  );
});

app.get('/api/cases/:caseId', (req, res) => {
  const caseData = getCase(req.params.caseId);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });
  res.json(caseData);
});

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username?.trim() || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  const id = uuidv4();
  const hash = await bcrypt.hash(password, 10);
  db.run(
    `INSERT INTO users (id, username, password) VALUES (?, ?, ?)`,
    [id, username.trim(), hash],
    function onInsert(err) {
      if (err) return res.status(400).json({ error: 'Username might already exist' });
      res.json({ id, username: username.trim() });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT id, username, password FROM users WHERE username = ?`,
    [username?.trim()],
    async (err, row) => {
      if (err || !row) return res.status(401).json({ error: 'Invalid credentials' });

      let valid = false;
      if (row.password.startsWith('$2')) {
        valid = await bcrypt.compare(password, row.password);
      } else {
        valid = password === row.password;
        if (valid) {
          const hash = await bcrypt.hash(password, 10);
          db.run(`UPDATE users SET password = ? WHERE id = ?`, [hash, row.id]);
        }
      }
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ id: row.id, username: row.username });
    }
  );
});

app.post('/api/rooms', (req, res) => {
  const { caseId } = req.body;
  const caseData = getCase(caseId);
  if (!caseData) return res.status(400).json({ error: 'Invalid case ID' });

  const roomId = uuidv4();
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  db.run(
    `INSERT INTO rooms (id, room_code, case_id) VALUES (?, ?, ?)`,
    [roomId, roomCode, caseId],
    function onRoom(err) {
      if (err) return res.status(500).json({ error: 'Failed to create room' });

      db.run(
        `INSERT INTO room_state (room_id, board_data, unlocked_clues, game_phase) VALUES (?, ?, ?, ?)`,
        [roomId, '[]', JSON.stringify(caseData.startingClues), 'investigation'],
        (stateErr) => {
          if (stateErr) return res.status(500).json({ error: 'Failed to initialize room state' });
          res.json({ roomId, roomCode, caseId, caseTitle: caseData.title });
        }
      );
    }
  );
});

app.get('/api/rooms/:roomCode', (req, res) => {
  const roomCode = normalizeRoomCode(req.params.roomCode);
  db.get(
    `SELECT r.id, r.case_id, rs.board_data, rs.unlocked_clues, rs.game_phase, rs.winner, rs.accusation_result
     FROM rooms r
     JOIN room_state rs ON r.id = rs.room_id
     WHERE r.room_code = ?`,
    [roomCode],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Room not found' });
      const caseData = getCase(row.case_id);
      res.json({
        roomId: row.id,
        roomCode,
        caseId: row.case_id,
        caseTitle: caseData?.title,
        boardData: JSON.parse(row.board_data || '[]'),
        unlockedClues: JSON.parse(row.unlocked_clues || '[]'),
        gamePhase: row.game_phase || 'investigation',
        winner: row.winner,
        accusationResult: row.accusation_result
          ? JSON.parse(row.accusation_result)
          : null,
        totalClues: caseData ? Object.keys(caseData.clues).length : 0,
      });
    }
  );
});

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomCode, username, userId }) => {
    const code = normalizeRoomCode(roomCode);
    socket.join(code);
    socket.data.roomCode = code;
    socket.data.username = username;
    socket.data.userId = userId;

    if (!roomPlayers.has(code)) roomPlayers.set(code, new Map());
    roomPlayers.get(code).set(socket.id, { id: userId, username, socketId: socket.id });
    broadcastPlayers(code);
  });

  socket.on('update_board', async ({ roomCode, roomId, boardData, caseId }) => {
    const code = normalizeRoomCode(roomCode);
    const caseData = getCase(caseId);
    if (!caseData) return;

    try {
      const state = await getRoomState(roomId);
      if (state.gamePhase === 'solved') return;

      const { newUnlocked, discoveries } = findNewDiscoveries(
        caseData,
        boardData,
        state.unlockedClues
      );

      const nextState = {
        ...state,
        boardData,
        unlockedClues: newUnlocked,
      };
      await saveRoomState(roomId, nextState);

      io.to(code).emit('board_updated', boardData);
      io.to(code).emit('clues_unlocked', newUnlocked);

      for (const discovery of discoveries) {
        io.to(code).emit('discovery_made', {
          ...discovery,
          by: socket.data.username,
        });
      }
    } catch (e) {
      console.error('update_board error', e);
    }
  });

  socket.on('add_note', ({ roomCode, note }) => {
    const code = normalizeRoomCode(roomCode);
    io.to(code).emit('note_added', {
      text: note.text,
      by: socket.data.username,
      at: Date.now(),
    });
  });

  socket.on('make_accusation', async ({ roomCode, roomId, caseId, suspectId }) => {
    const code = normalizeRoomCode(roomCode);
    const caseData = getCase(caseId);
    if (!caseData) return;

    try {
      const state = await getRoomState(roomId);
      if (state.gamePhase === 'solved') return;

      if (!canAccuse(caseData, state.unlockedClues)) {
        socket.emit('accusation_rejected', {
          reason: 'Gather all critical evidence before accusing someone.',
        });
        return;
      }

      const result = evaluateAccusation(caseData, suspectId);
      const payload = {
        suspectId,
        correct: result.correct,
        culpritName: result.culpritName,
        explanation: result.explanation,
        by: socket.data.username,
      };

      const nextState = {
        ...state,
        gamePhase: 'solved',
        winner: result.correct ? socket.data.username : null,
        accusationResult: payload,
      };
      await saveRoomState(roomId, nextState);

      io.to(code).emit('accusation_result', payload);
    } catch (e) {
      console.error('make_accusation error', e);
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (code && roomPlayers.has(code)) {
      roomPlayers.get(code).delete(socket.id);
      if (roomPlayers.get(code).size === 0) roomPlayers.delete(code);
      broadcastPlayers(code);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
