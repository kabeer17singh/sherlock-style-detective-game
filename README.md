# Sherlock Style Detective Game

Cooperative or solo detective game. Spend investigation leads, link evidence on a corkboard, pass deduction challenges, and make a evidence-backed accusation.

## Features

- **3 cases** — Crimson Cipher, Locked Ledger, Midnight Telegram
- **Deduction challenges** — Multiple-choice theories (co-op: all detectives must agree)
- **Limited leads** — Investigate locations to uncover hidden clues
- **Evidence accusation** — Name the killer and cite two proving clues
- **Scoring** — Letter grades (S/A/B/C/F) with personal bests saved
- **Solo mode** — Detective's Hunch hint after 3 wrong deductions

## Setup

```bash
npm install
```

## Run

```bash
npm run dev:backend
npm run dev:frontend
```

Open http://localhost:5173

## How to play

1. Pick a case and **Solo** or **Co-op** mode
2. **Spend leads** on locations to find evidence
3. **Drag clues** onto the board; place related cards near each other
4. Answer **deduction challenges** when golden lines appear
5. **Accuse** the culprit and select the two clues that prove motive

See [DEPLOY.md](DEPLOY.md) for production deployment.
