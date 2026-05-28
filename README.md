# Sherlock Style Detective Game

Cooperative multiplayer detective game. Link clues on a shared evidence board, uncover deductions together, and make the final accusation.

## Features

- **Cooperative investigation** — Real-time shared corkboard with live clue sync
- **Deduction mechanic** — Place related clues near each other to unlock new evidence
- **Progress tracking** — Evidence bar and visual connection hints on the board
- **Final accusation** — Three suspects; gather all critical clues before accusing
- **Shared detective notes** — Coordinate theories in real time

## Setup

```bash
npm install
```

## Run

Use two terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173 — the frontend proxies API and WebSocket traffic to the backend on port 3001.

## How to play

1. Register or log in as a detective
2. **Create** a case file and share the 6-letter room code, or **join** an existing room
3. Drag clues from the case file onto the evidence board
4. When two related clues are placed close together, new evidence may unlock for everyone
5. Unlock all critical clues, then accuse the correct suspect to close the case

## Tech stack

- React + Vite (frontend)
- Node.js, Express, Socket.io, SQLite (backend)
