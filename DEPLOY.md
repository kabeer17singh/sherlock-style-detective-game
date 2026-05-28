# Deployment Guide

## Backend (Render)

1. Push this repo to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Connect the repo and set **Root Directory** to `backend`.
4. Build: `npm install` · Start: `node src/index.js`
5. Note the public URL (e.g. `https://sherlock-detective-api.onrender.com`).

## Frontend (Vercel)

1. Import the repo on [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Add environment variables:
   - `VITE_API_URL` = your Render backend URL (no trailing slash)
   - `VITE_SOCKET_URL` = same backend URL
4. Update `frontend/vercel.json` rewrite destinations to your backend URL, or rely on env vars (recommended).

## Local development

```bash
npm install
npm run dev:backend   # port 3001
npm run dev:frontend  # port 5173, proxies /api and /socket.io
```

## Share a game

Create a room in the lobby, then use **Copy invite link** or the QR code. Friends open the link and enter the same room code after logging in.
