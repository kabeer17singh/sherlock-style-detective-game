const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_code TEXT UNIQUE,
      case_id TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS room_state (
      room_id TEXT PRIMARY KEY,
      board_data TEXT,
      unlocked_clues TEXT,
      game_phase TEXT DEFAULT 'investigation',
      winner TEXT,
      accusation_result TEXT,
      leads_remaining INTEGER DEFAULT 7,
      game_mode TEXT DEFAULT 'coop',
      completed_combos TEXT DEFAULT '[]',
      investigated_locations TEXT DEFAULT '[]',
      stats_json TEXT DEFAULT '{}',
      started_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_case_scores (
      user_id TEXT,
      case_id TEXT,
      best_points INTEGER DEFAULT 0,
      best_grade TEXT,
      attempts INTEGER DEFAULT 0,
      updated_at INTEGER,
      PRIMARY KEY (user_id, case_id)
    )
  `);

  const alters = [
    'ALTER TABLE room_state ADD COLUMN game_phase TEXT DEFAULT \'investigation\'',
    'ALTER TABLE room_state ADD COLUMN winner TEXT',
    'ALTER TABLE room_state ADD COLUMN accusation_result TEXT',
    'ALTER TABLE room_state ADD COLUMN leads_remaining INTEGER DEFAULT 7',
    'ALTER TABLE room_state ADD COLUMN game_mode TEXT DEFAULT \'coop\'',
    'ALTER TABLE room_state ADD COLUMN completed_combos TEXT DEFAULT \'[]\'',
    'ALTER TABLE room_state ADD COLUMN investigated_locations TEXT DEFAULT \'[]\'',
    'ALTER TABLE room_state ADD COLUMN stats_json TEXT DEFAULT \'{}\'',
    'ALTER TABLE room_state ADD COLUMN started_at INTEGER',
  ];
  for (const sql of alters) {
    db.run(sql, () => {});
  }
});

module.exports = db;
