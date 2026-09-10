-- ASCENDRA Starter Quests Seed Data
INSERT INTO quests (id, title, description, category, difficulty, xp_reward, score_reward, status)
VALUES
  (
    'quest_village_basics',
    'Welcome to Ascendra: Village Awakening',
    'Explore the starter village, inspect the surroundings, and discover your first set of ancient markings.',
    'tutorial',
    'easy',
    50,
    100,
    'active'
  ),
  (
    'quest_ancient_runes',
    'Deciphering the Ancient Runes',
    'Locate the weathered stone tablets near the village square and solve the sequence puzzle.',
    'puzzle',
    'easy',
    100,
    250,
    'active'
  ),
  (
    'quest_forest_whispers',
    'Whispers of the Enchanted Grove',
    'Venture beyond the palisade into the Whispering Woods to gather hidden clues about the lost civilization.',
    'exploration',
    'medium',
    200,
    500,
    'active'
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  difficulty = EXCLUDED.difficulty,
  xp_reward = EXCLUDED.xp_reward,
  score_reward = EXCLUDED.score_reward,
  status = EXCLUDED.status,
  updated_at = NOW();
