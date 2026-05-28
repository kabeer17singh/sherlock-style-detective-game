const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { loadCases } = require('./loadCases');
const {
  comboKey,
  getReadyCombinations,
  validateDeductionAnswer,
  findComboByKey,
  canAccuse,
  evaluateAccusation,
  computeScore,
  getHintForCombo,
} = require('./gameLogic');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const cases = loadCases();
const roomPlayers = new Map();
const deductionVotes = new Map();

function getCase(caseId) {
  return cases[caseId];
}

function normalizeRoomCode(code) {
  return String(code || '').trim().toUpperCase();
}

function parseRoomRow(row) {
  const stats = JSON.parse(row.stats_json || '{}');
  if (row.started_at && !stats.startedAt) stats.startedAt = row.started_at;
  return {
    boardData: JSON.parse(row.board_data || '[]'),
    unlockedClues: JSON.parse(row.unlocked_clues || '[]'),
    gamePhase: row.game_phase || 'investigation',
    winner: row.winner,
    accusationResult: row.accusation_result ? JSON.parse(row.accusation_result) : null,
    leadsRemaining: row.leads_remaining ?? 7,
    gameMode: row.game_mode || 'coop',
    completedCombos: JSON.parse(row.completed_combos || '[]'),
    investigatedLocations: JSON.parse(row.investigated_locations || '[]'),
    stats,
  };
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
    db.get(`SELECT * FROM room_state WHERE room_id = ?`, [roomId], (err, row) => {
      if (err || !row) return reject(err || new Error('Room state not found'));
      resolve(parseRoomRow(row));
    });
  });
}

function saveRoomState(roomId, state) {
  const stats = { ...state.stats };
  if (stats.startedAt) {
    stats.elapsedSeconds = Math.floor((Date.now() - stats.startedAt) / 1000);
  }
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE room_state SET
        board_data = ?, unlocked_clues = ?, game_phase = ?, winner = ?, accusation_result = ?,
        leads_remaining = ?, completed_combos = ?, investigated_locations = ?, stats_json = ?
       WHERE room_id = ?`,
      [
        JSON.stringify(state.boardData),
        JSON.stringify(state.unlockedClues),
        state.gamePhase,
        state.winner || null,
        state.accusationResult ? JSON.stringify(state.accusationResult) : null,
        state.leadsRemaining,
        JSON.stringify(state.completedCombos || []),
        JSON.stringify(state.investigatedLocations || []),
        JSON.stringify(stats),
        roomId,
      ],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function emitRoomSync(code, roomId, caseId, state) {
  const caseData = getCase(caseId);
  io.to(code).emit('board_updated', state.boardData);
  io.to(code).emit('clues_unlocked', state.unlockedClues);
  io.to(code).emit('leads_updated', {
    leadsRemaining: state.leadsRemaining,
    investigatedLocations: state.investigatedLocations,
  });
  io.to(code).emit('stats_updated', state.stats);
  const ready = getReadyCombinations(
    caseData,
    state.boardData,
    state.unlockedClues,
    state.completedCombos
  );
  io.to(code).emit('deductions_ready', ready);
}

function clearVotes(code, key) {
  const roomVotes = deductionVotes.get(code);
  if (roomVotes) roomVotes.delete(key);
}

app.get('/api/cases', (_req, res) => {
  res.json(
    Object.values(cases).map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      clueCount: Object.keys(c.clues).length,
      maxLeads: c.maxLeads || 7,
    }))
  );
});

app.get('/api/cases/:caseId', (req, res) => {
  const caseData = getCase(req.params.caseId);
  if (!caseData) return res.status(404).json({ error: 'Case not found' });
  res.json(caseData);
});

app.get('/api/scores/:userId', (req, res) => {
  db.all(
    `SELECT case_id, best_points, best_grade, attempts FROM user_case_scores WHERE user_id = ?`,
    [req.params.userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Failed to load scores' });
      res.json(rows || []);
    }
  );
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
  const { caseId, gameMode = 'coop' } = req.body;
  const caseData = getCase(caseId);
  if (!caseData) return res.status(400).json({ error: 'Invalid case ID' });

  const roomId = uuidv4();
  const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const maxLeads = caseData.maxLeads || 7;
  const startedAt = Date.now();
  const stats = { wrongDeductions: 0, hintsUsed: 0, startedAt };

  db.run(
    `INSERT INTO rooms (id, room_code, case_id) VALUES (?, ?, ?)`,
    [roomId, roomCode, caseId],
    function onRoom(err) {
      if (err) return res.status(500).json({ error: 'Failed to create room' });

      db.run(
        `INSERT INTO room_state (
          room_id, board_data, unlocked_clues, game_phase, leads_remaining,
          game_mode, completed_combos, investigated_locations, stats_json, started_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          roomId,
          '[]',
          JSON.stringify(caseData.startingClues),
          'investigation',
          maxLeads,
          gameMode === 'solo' ? 'solo' : 'coop',
          '[]',
          '[]',
          JSON.stringify(stats),
          startedAt,
        ],
        (stateErr) => {
          if (stateErr) return res.status(500).json({ error: 'Failed to initialize room state' });
          res.json({
            roomId,
            roomCode,
            caseId,
            caseTitle: caseData.title,
            gameMode: gameMode === 'solo' ? 'solo' : 'coop',
            leadsRemaining: maxLeads,
          });
        }
      );
    }
  );
});

app.get('/api/rooms/:roomCode', (req, res) => {
  const roomCode = normalizeRoomCode(req.params.roomCode);
  db.get(
    `SELECT r.id, r.case_id, rs.* FROM rooms r
     JOIN room_state rs ON r.id = rs.room_id WHERE r.room_code = ?`,
    [roomCode],
    (err, row) => {
      if (err || !row) return res.status(404).json({ error: 'Room not found' });
      const caseData = getCase(row.case_id);
      const state = parseRoomRow(row);
      const ready = getReadyCombinations(
        caseData,
        state.boardData,
        state.unlockedClues,
        state.completedCombos
      );
      res.json({
        roomId: row.id,
        roomCode,
        caseId: row.case_id,
        caseTitle: caseData?.title,
        intro: caseData?.intro,
        gameMode: state.gameMode,
        ...state,
        totalClues: caseData ? Object.keys(caseData.clues).length : 0,
        maxLeads: caseData?.maxLeads || 7,
        deductionsReady: ready,
      });
    }
  );
});

async function unlockFromDeduction(code, roomId, caseId, state, combo, by) {
  const key = comboKey(combo.requires);
  const newUnlocked = [...state.unlockedClues];
  if (!newUnlocked.includes(combo.unlocks)) newUnlocked.push(combo.unlocks);

  const nextState = {
    ...state,
    unlockedClues: newUnlocked,
    completedCombos: [...(state.completedCombos || []), key],
  };
  await saveRoomState(roomId, nextState);
  clearVotes(code, key);

  io.to(code).emit('clues_unlocked', newUnlocked);
  io.to(code).emit('stats_updated', nextState.stats);
  io.to(code).emit('discovery_made', {
    unlocks: combo.unlocks,
    message: combo.message,
    title: cases[caseId].clues[combo.unlocks]?.title,
    by,
  });
  emitRoomSync(code, roomId, caseId, nextState);
  return nextState;
}

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

      const nextState = { ...state, boardData };
      await saveRoomState(roomId, nextState);
      io.to(code).emit('board_updated', boardData);
      emitRoomSync(code, roomId, caseId, nextState);
    } catch (e) {
      console.error('update_board error', e);
    }
  });

  socket.on('investigate_location', async ({ roomCode, roomId, caseId, locationId }) => {
    const code = normalizeRoomCode(roomCode);
    const caseData = getCase(caseId);
    if (!caseData) return;

    try {
      const state = await getRoomState(roomId);
      if (state.gamePhase === 'solved') return;
      if (state.leadsRemaining <= 0) {
        socket.emit('action_rejected', { reason: 'No leads remaining.' });
        return;
      }
      if (state.investigatedLocations.includes(locationId)) {
        socket.emit('action_rejected', { reason: 'Already investigated this location.' });
        return;
      }

      const location = (caseData.locations || []).find((l) => l.id === locationId);
      if (!location) {
        socket.emit('action_rejected', { reason: 'Unknown location.' });
        return;
      }

      const newUnlocked = [...state.unlockedClues];
      if (!newUnlocked.includes(location.clueId)) newUnlocked.push(location.clueId);

      const nextState = {
        ...state,
        leadsRemaining: state.leadsRemaining - 1,
        investigatedLocations: [...state.investigatedLocations, locationId],
        unlockedClues: newUnlocked,
      };
      await saveRoomState(roomId, nextState);

      io.to(code).emit('clues_unlocked', newUnlocked);
      io.to(code).emit('leads_updated', {
        leadsRemaining: nextState.leadsRemaining,
        investigatedLocations: nextState.investigatedLocations,
      });
      io.to(code).emit('discovery_made', {
        unlocks: location.clueId,
        message: `Investigated ${location.name}: ${location.action}`,
        title: caseData.clues[location.clueId]?.title,
        by: socket.data.username,
      });
      emitRoomSync(code, roomId, caseId, nextState);
    } catch (e) {
      console.error('investigate_location error', e);
    }
  });

  socket.on('submit_deduction', async ({ roomCode, roomId, caseId, comboKey: key, optionId }) => {
    const code = normalizeRoomCode(roomCode);
    const caseData = getCase(caseId);
    if (!caseData) return;

    try {
      const state = await getRoomState(roomId);
      if (state.gamePhase === 'solved') return;

      const combo = findComboByKey(caseData, key);
      if (!combo) {
        socket.emit('deduction_failed', { reason: 'Invalid deduction.' });
        return;
      }

      const correct = validateDeductionAnswer(combo, optionId);

      if (state.gameMode === 'solo') {
        if (!correct) {
          const stats = {
            ...state.stats,
            wrongDeductions: (state.stats.wrongDeductions || 0) + 1,
          };
          await saveRoomState(roomId, { ...state, stats });
          io.to(code).emit('stats_updated', stats);
          socket.emit('deduction_failed', {
            reason: 'Incorrect theory. Re-examine the evidence.',
            wrongCount: stats.wrongDeductions,
          });
          return;
        }
        await unlockFromDeduction(code, roomId, caseId, state, combo, socket.data.username);
        socket.emit('deduction_success', { unlocks: combo.unlocks });
        return;
      }

      if (!deductionVotes.has(code)) deductionVotes.set(code, new Map());
      const roomVotes = deductionVotes.get(code);
      if (!roomVotes.has(key)) roomVotes.set(key, new Map());
      roomVotes.get(key).set(socket.data.userId, { optionId, username: socket.data.username });

      const players = getRoomPlayers(code);
      const votes = roomVotes.get(key);
      const votedCount = votes.size;

      io.to(code).emit('deduction_vote_update', {
        comboKey: key,
        voted: votedCount,
        required: players.length,
        voters: Array.from(votes.values()).map((v) => v.username),
      });

      if (votedCount < players.length) return;

      const allCorrect = Array.from(votes.values()).every((v) =>
        validateDeductionAnswer(combo, v.optionId)
      );
      const sameAnswer = new Set(Array.from(votes.values()).map((v) => v.optionId)).size === 1;

      if (!allCorrect || !sameAnswer) {
        clearVotes(code, key);
        const stats = {
          ...state.stats,
          wrongDeductions: (state.stats.wrongDeductions || 0) + 1,
        };
        await saveRoomState(roomId, { ...state, stats });
        io.to(code).emit('deduction_failed', {
          reason: 'Detectives disagree or chose wrongly. Try again.',
        });
        io.to(code).emit('stats_updated', stats);
        return;
      }

      await unlockFromDeduction(code, roomId, caseId, state, combo, socket.data.username);
      io.to(code).emit('deduction_success', { unlocks: combo.unlocks });
    } catch (e) {
      console.error('submit_deduction error', e);
    }
  });

  socket.on('request_hint', async ({ roomCode, roomId, caseId, comboKey: key }) => {
    const code = normalizeRoomCode(roomCode);
    const caseData = getCase(caseId);
    if (!caseData) return;

    try {
      const state = await getRoomState(roomId);
      if (state.gameMode !== 'solo') {
        socket.emit('action_rejected', { reason: 'Hints are solo mode only.' });
        return;
      }
      if ((state.stats.wrongDeductions || 0) < 3) {
        socket.emit('action_rejected', { reason: 'Earn a hint after 3 wrong deductions.' });
        return;
      }
      if (state.stats.hintUsedFor === key) {
        socket.emit('action_rejected', { reason: 'Hint already used for this deduction.' });
        return;
      }

      const combo = findComboByKey(caseData, key);
      const hint = getHintForCombo(combo);
      if (!hint) return;

      const stats = {
        ...state.stats,
        hintsUsed: (state.stats.hintsUsed || 0) + 1,
        hintUsedFor: key,
      };
      await saveRoomState(roomId, { ...state, stats });
      socket.emit('hint_granted', { comboKey: key, ...hint });
      io.to(code).emit('stats_updated', stats);
    } catch (e) {
      console.error('request_hint error', e);
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

  socket.on('make_accusation', async ({
    roomCode,
    roomId,
    caseId,
    suspectId,
    evidenceClueIds,
    userId,
  }) => {
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

      const result = evaluateAccusation(caseData, suspectId, evidenceClueIds || []);
      const score = computeScore(
        {
          ...state.stats,
          leadsRemaining: state.leadsRemaining,
          elapsedSeconds: Math.floor((Date.now() - (state.stats.startedAt || Date.now())) / 1000),
        },
        caseData,
        result.correct
      );

      const payload = {
        suspectId,
        evidenceClueIds,
        correct: result.correct,
        suspectCorrect: result.suspectCorrect,
        evidenceCorrect: result.evidenceCorrect,
        culpritName: result.culpritName,
        explanation: result.explanation,
        redHerringNote: result.redHerringNote,
        by: socket.data.username,
        score,
        unlockedClues: state.unlockedClues,
      };

      const nextState = {
        ...state,
        gamePhase: 'solved',
        winner: result.correct ? socket.data.username : null,
        accusationResult: payload,
      };
      await saveRoomState(roomId, nextState);

      if (userId && result.correct) {
        db.get(
          `SELECT best_points FROM user_case_scores WHERE user_id = ? AND case_id = ?`,
          [userId, caseId],
          (_err, row) => {
            const prev = row?.best_points || 0;
            if (score.points > prev) {
              db.run(
                `INSERT INTO user_case_scores (user_id, case_id, best_points, best_grade, attempts, updated_at)
                 VALUES (?, ?, ?, ?, 1, ?)
                 ON CONFLICT(user_id, case_id) DO UPDATE SET
                   best_points = excluded.best_points,
                   best_grade = excluded.best_grade,
                   attempts = attempts + 1,
                   updated_at = excluded.updated_at`,
                [userId, caseId, score.points, score.grade, Date.now()]
              );
            } else {
              db.run(
                `INSERT INTO user_case_scores (user_id, case_id, best_points, best_grade, attempts, updated_at)
                 VALUES (?, ?, ?, ?, 1, ?)
                 ON CONFLICT(user_id, case_id) DO UPDATE SET attempts = attempts + 1`,
                [userId, caseId, prev, row?.best_grade || score.grade, Date.now()]
              );
            }
          }
        );
      } else if (userId) {
        db.run(
          `INSERT INTO user_case_scores (user_id, case_id, best_points, best_grade, attempts, updated_at)
           VALUES (?, ?, 0, 'F', 1, ?)
           ON CONFLICT(user_id, case_id) DO UPDATE SET attempts = attempts + 1`,
          [userId, caseId, Date.now()]
        );
      }

      io.to(code).emit('accusation_result', payload);
    } catch (e) {
      console.error('make_accusation error', e);
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (code && roomPlayers.has(code)) {
      roomPlayers.get(code).delete(socket.id);
      if (roomPlayers.get(code).size === 0) {
        roomPlayers.delete(code);
        deductionVotes.delete(code);
      }
      broadcastPlayers(code);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
