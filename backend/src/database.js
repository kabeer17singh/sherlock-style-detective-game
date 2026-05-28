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
      accusation_result TEXT
    )
  `);

  db.run(`ALTER TABLE room_state ADD COLUMN game_phase TEXT DEFAULT 'investigation'`, () => {});
  db.run(`ALTER TABLE room_state ADD COLUMN winner TEXT`, () => {});
  db.run(`ALTER TABLE room_state ADD COLUMN accusation_result TEXT`, () => {});
});

module.exports = db;
