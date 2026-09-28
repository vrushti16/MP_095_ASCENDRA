-- ASCENDRA Phase 18: Real Server-Authoritative Achievements & Gameplay Events Schema

-- 1. Master Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'PROGRESSION',
  icon VARCHAR(16) NOT NULL DEFAULT '🏆',
  requirement_type VARCHAR(32) NOT NULL, -- 'COUNT', 'LEVEL', 'XP', 'QUEST_COUNT', 'PUZZLE_COUNT', 'DISCOVERY_COUNT'
  requirement_value INT NOT NULL DEFAULT 1,
  xp_reward INT NOT NULL DEFAULT 100,
  gameplay_event_source VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Player Achievements Progress & Unlock State Table
CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(64) NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  current_progress INT NOT NULL DEFAULT 0,
  target_progress INT NOT NULL DEFAULT 1,
  unlocked BOOLEAN NOT NULL DEFAULT FALSE,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_player_achievement UNIQUE (player_id, achievement_id)
);

-- 3. Authoritative Gameplay Events Table (Anti-Cheat & Idempotency)
CREATE TABLE IF NOT EXISTS gameplay_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(128) NOT NULL UNIQUE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'processed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_unlocked ON player_achievements(player_id, unlocked);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_player ON gameplay_events(player_id);
CREATE INDEX IF NOT EXISTS idx_gameplay_events_type ON gameplay_events(event_type);

-- Seed Authoritative ASCENDRA Achievements
INSERT INTO achievements (
  id, name, description, category, icon, requirement_type, requirement_value, xp_reward, gameplay_event_source
) VALUES
  (
    'first_discovery',
    'First Discovery',
    'Discover the ancient inscription marker in the village ruins of Stage 1-1.',
    'DISCOVERY',
    '📜',
    'DISCOVERY_COUNT',
    1,
    75,
    'UNITY_INSCRIPTION_DISCOVERED'
  ),
  (
    'village_awakening',
    'Village Awakening',
    'Complete the Village Elder starter quest ''Welcome to Ascendra: Village Awakening''.',
    'QUESTS',
    '🗺️',
    'QUEST_COUNT',
    1,
    150,
    'UNITY_QUEST_COMPLETED'
  ),
  (
    'cipher_adept',
    'Cipher Adept',
    'Reach Explorer Level 3 through verified in-game puzzle solving and exploration.',
    'PROGRESSION',
    '⭐',
    'LEVEL',
    3,
    200,
    'PLAYER_LEVEL_REACHED'
  ),
  (
    'expedition_veteran',
    'Expedition Veteran',
    'Accumulate 2,500 cumulative exploration score strictly from verified Unity expeditions.',
    'EXPLORATION',
    '🏆',
    'SCORE',
    2500,
    250,
    'UNITY_EXPLORATION_EVENT_COMPLETED'
  ),
  (
    'rune_seeker',
    'Rune Seeker',
    'Discover 3 ancient rune tablets and cartographer clues hidden across the realms.',
    'DISCOVERY',
    '🔮',
    'DISCOVERY_COUNT',
    3,
    175,
    'UNITY_INSCRIPTION_DISCOVERED'
  ),
  (
    'puzzle_solver',
    'Puzzle Solver',
    'Solve dynamic AI-generated puzzles deployed in the dungeon environments.',
    'PUZZLES',
    '🧩',
    'PUZZLE_COUNT',
    3,
    200,
    'UNITY_PUZZLE_COMPLETED'
  ),
  (
    'logic_master',
    'Logic Master',
    'Master 2 aptitude number matrices and logical reasoning ciphers.',
    'MASTERY',
    '🧠',
    'PUZZLE_CATEGORY_COUNT',
    2,
    225,
    'UNITY_PUZZLE_COMPLETED'
  ),
  (
    'realm_master',
    'Realm Master',
    'Conquer all 3 campaign realms and master the ancient secrets of Ascendra.',
    'MASTERY',
    '👑',
    'QUEST_COUNT',
    3,
    500,
    'UNITY_QUEST_COMPLETED'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  requirement_type = EXCLUDED.requirement_type,
  requirement_value = EXCLUDED.requirement_value,
  xp_reward = EXCLUDED.xp_reward,
  gameplay_event_source = EXCLUDED.gameplay_event_source;
