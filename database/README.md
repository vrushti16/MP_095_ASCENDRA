# ASCENDRA Database Layer (PostgreSQL / Neon)

This folder contains all persistent database artifacts, SQL schemas, migrations, and seed scripts for ASCENDRA.

## Structure
```
database/
├── migrations/
│   └── 001_initial_schema.sql   # Core normalized tables & performance indexes
├── scripts/
│   └── migrate.js               # Standalone idempotent migration runner
├── seeds/                       # Seed data scripts for development & staging
└── README.md
```

## Running Migrations
From the `backend/` directory:
```bash
npm run db:migrate
```

Or run directly with Node:
```bash
node database/scripts/migrate.js
```

## Tables Overview
1. `users` - Player and Admin identity records (supports Google OAuth2 & email/password).
2. `refresh_tokens` - Hashed JWT refresh tokens with rotation and revocation.
3. `player_profiles` - 1:1 linked progression data (Level, XP, Score, Health).
4. `quests` - Available adventure learning quests.
5. `player_quests` - Individual player progression through quests (0-100%).
6. `puzzles` - Puzzle metadata and questions (Note: `correct_answer` is kept strictly server-side).
7. `puzzle_attempts` - Attempt logs, answer validation, and rewarded points.
8. `clues` - Interactive clues tied to quests.
9. `player_clues` - Player discovery log of discovered clues.
10. `game_sessions` - Active player play sessions.
11. `schema_migrations` - Tracking table for applied database migrations.
