# ASCENDRA Backend (Node.js + Express + PostgreSQL + Redis)

The primary application backend for the **ASCENDRA** AI-powered educational adventure game.

## Tech Stack
- **Runtime**: Node.js (>= v18, tested on v24)
- **Framework**: Express.js
- **Database**: PostgreSQL (Neon Serverless PostgreSQL)
- **Cache/Sessions**: Redis
- **Security**: Helmet, CORS, JWT, Google OAuth2
- **Testing**: Jest + Supertest
- **No Docker Required**: Runs directly via standard `npm` commands.

## Architecture
```
Unity 6 WebGL Client (Dev A)
        │
        ▼ HTTP REST / JWT
Node.js + Express Backend (Dev C)
 ├── PostgreSQL / Neon  (Persistent Game Data: Users, Quests, Puzzles, Progress)
 ├── Redis              (Temporary Data: Cache, Sessions, Leaderboard)
 └── FastAPI AI Service (Dev B: AI Puzzle Generation via OpenAI / Gemini)
```

## Getting Started

### 1. Installation
```bash
cd backend
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update database connection strings and secrets as needed.

### 3. Run Database Migrations
Runs the SQL migrations from the root `database/migrations/` directory:
```bash
npm run db:migrate
```

### 4. Run Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

### 5. Run Automated Tests
```bash
npm test
```

## API Endpoints (Version 1)
- `GET /api/v1/health` - Backend health and diagnostic status

### Authentication (`/api/v1/auth`)
- `POST /api/v1/auth/register` - Register player with email/password
- `POST /api/v1/auth/login` - Authenticate player & obtain tokens
- `POST /api/v1/auth/google` - Authenticate via Google ID Token
- `POST /api/v1/auth/refresh` - Rotate refresh token for a new access token
- `POST /api/v1/auth/logout` - Revoke active refresh token

### Users & Progression (`/api/v1/users`)
- `GET /api/v1/users/me` - Authenticated user info
- `GET /api/v1/users/me/profile` - Player profile (Level, XP, Score, Health)
- `PATCH /api/v1/users/me/profile` - Update non-sensitive profile fields (displayName, avatarUrl)

### Quests (`/api/v1/quests`)
- `GET /api/v1/quests` - Retrieve active quest catalog
- `GET /api/v1/quests/:questId` - Retrieve detailed quest info and player quest state
- `POST /api/v1/quests/:questId/start` - Start quest
- `PATCH /api/v1/quests/:questId/progress` - Update incremental quest progress
- `POST /api/v1/quests/:questId/complete` - Authoritative quest completion & reward

### Puzzles (`/api/v1/puzzles`)
- `POST /api/v1/puzzles/generate` - Generate puzzle via AI service (FastAPI) & persist (answers sanitized)
- `GET /api/v1/puzzles/:puzzleId` - Retrieve sanitized puzzle details (correct_answer hidden)
- `POST /api/v1/puzzles/:puzzleId/attempt` - Submit puzzle answer, validate, record attempt & award XP/score once

### Clues (`/api/v1/clues`)
- `GET /api/v1/clues` - Retrieve all clues legitimately unlocked by the authenticated player
- `GET /api/v1/clues/:clueId` - Retrieve a specific unlocked clue (returns 403 Forbidden if locked)
*Note: Clue unlocking is strictly server-authoritative and triggered internally during verified gameplay events (e.g. puzzle solves). There is no public client unlock endpoint.*
