-- ASCENDRA Database Migration: 001_initial_schema.sql
-- Normalized schema for Users, Profiles, Quests, Puzzles, Clues, and Sessions

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  password_hash VARCHAR(255),
  role VARCHAR(32) NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMPTZ
);

-- 2. Secure Refresh Tokens Table (hashed tokens with rotation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ
);

-- 3. Player Profiles Table
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  experience INT NOT NULL DEFAULT 0 CHECK (experience >= 0),
  score INT NOT NULL DEFAULT 0 CHECK (score >= 0),
  health INT NOT NULL DEFAULT 100 CHECK (health >= 0),
  max_health INT NOT NULL DEFAULT 100 CHECK (max_health > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Quests Table
CREATE TABLE IF NOT EXISTS quests (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'tutorial',
  difficulty VARCHAR(32) NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  xp_reward INT NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),
  score_reward INT NOT NULL DEFAULT 100 CHECK (score_reward >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Player Quest Progression Table
CREATE TABLE IF NOT EXISTS player_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quest_id VARCHAR(64) NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  status VARCHAR(32) NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (player_id, quest_id)
);

-- 6. Puzzles Table (options stored as JSONB; correct_answer stays server-side only)
CREATE TABLE IF NOT EXISTS puzzles (
  id VARCHAR(64) PRIMARY KEY,
  quest_id VARCHAR(64) REFERENCES quests(id) ON DELETE SET NULL,
  external_ai_puzzle_id VARCHAR(255),
  type VARCHAR(64) NOT NULL DEFAULT 'multiple_choice',
  topic VARCHAR(64) NOT NULL DEFAULT 'general',
  difficulty VARCHAR(32) NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  xp_reward INT NOT NULL DEFAULT 20 CHECK (xp_reward >= 0),
  score_reward INT NOT NULL DEFAULT 50 CHECK (score_reward >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Puzzle Attempts Table
CREATE TABLE IF NOT EXISTS puzzle_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id VARCHAR(64) NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  submitted_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  attempt_number INT NOT NULL DEFAULT 1 CHECK (attempt_number >= 1),
  xp_earned INT NOT NULL DEFAULT 0 CHECK (xp_earned >= 0),
  score_earned INT NOT NULL DEFAULT 0 CHECK (score_earned >= 0),
  time_taken_seconds INT DEFAULT 0 CHECK (time_taken_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Clues Table
CREATE TABLE IF NOT EXISTS clues (
  id VARCHAR(64) PRIMARY KEY,
  quest_id VARCHAR(64) NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  sequence_number INT NOT NULL DEFAULT 1 CHECK (sequence_number >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Player Discovered Clues Table
CREATE TABLE IF NOT EXISTS player_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clue_id VARCHAR(64) NOT NULL REFERENCES clues(id) ON DELETE CASCADE,
  discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (player_id, clue_id)
);

-- 10. Game Sessions Table
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_activity TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended'))
);

-- ==================== Performance Indexes ====================
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_player_profiles_score ON player_profiles(score DESC);
CREATE INDEX IF NOT EXISTS idx_player_profiles_exp ON player_profiles(experience DESC);
CREATE INDEX IF NOT EXISTS idx_player_quests_player ON player_quests(player_id);
CREATE INDEX IF NOT EXISTS idx_player_quests_status ON player_quests(status);
CREATE INDEX IF NOT EXISTS idx_puzzles_quest ON puzzles(quest_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_player ON puzzle_attempts(player_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_attempts_puzzle ON puzzle_attempts(puzzle_id);
CREATE INDEX IF NOT EXISTS idx_clues_quest ON clues(quest_id);
CREATE INDEX IF NOT EXISTS idx_player_clues_player ON player_clues(player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player ON game_sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
