
# Learnato Discussion Forum — Microservice

**Theme:** *Empower learning through conversation.*  
Browser-based forum where learners and instructors can post questions, share insights, and reply in real time — designed as a plug-and-play microservice for the Learnato ecosystem.

## Tech Stack
- **Frontend:** React + Tailwind CSS (Vite)
- **Backend:** Node.js + Express
- **Database:** MongoDB (Docker)
- **Realtime:** Socket.io
- **Deployment:** Docker & Docker Compose (works locally or in the cloud)

## Features (MVP)
- Create post (title + content + optional author)
- List posts (sort by newest or top votes) + search
- View a post with replies
- Add reply
- Upvote post
- Responsive UI (Tailwind)
- Mark as answered (instructor action) — *stretch, included*  
- Live updates with WebSocket — *stretch, included*

## Quickstart (Docker)
```bash
# From project root
docker compose up --build
# Web: http://localhost:5173
# API: http://localhost:4000/api
```

## Local Dev (without Docker)
```bash
# Start MongoDB locally or with Docker
docker run -p 27017:27017 -d mongo:7

# Backend
cd backend
cp .env.example .env
npm install
npm run dev

# Frontend
cd ../frontend
npm install
npm run dev
# Vite dev server: http://localhost:5173 (proxied to API)
```

## API
```
POST   /api/posts            # create {title, content, author?}
GET    /api/posts?sort=votes|date&q=...  # list
GET    /api/posts/:id        # fetch one
POST   /api/posts/:id/reply  # add reply {content, author?}
POST   /api/posts/:id/upvote # upvote
POST   /api/posts/:id/answer # mark answered
GET    /api/health           # health check
```

## Architecture
- **Express** serves REST under `/api/*`; Socket.io broadcasts `post:created`, `reply:created`, `post:upvoted`, `post:answered`.
- **MongoDB Schema:** Post(title, content, author, votes, answered, createdAt, replies[]).
- **React** consumes API; uses Socket.io client to receive live updates without refresh.
- **Nginx** (in the web container) serves the React build and proxies `/api` + `/socket.io` to the API.

## Environment
Backend `.env`:
```
MONGO_URL=mongodb://mongo:27017/learnato_forum
PORT=4000
ORIGIN=http://localhost:5173
```

## Notes
- Swap Mongo for Postgres by replacing Mongoose with Prisma/pg (not included).
- Authentication is intentionally mocked (author is a free text field). Add OAuth (e.g., Google) as a stretch goal.
- For cloud deploy: push images to a registry and run with any container platform (Cloud Run, Render, Fly, etc.).
