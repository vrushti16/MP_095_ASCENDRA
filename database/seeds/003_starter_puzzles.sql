-- ASCENDRA Starter Puzzles Seed Data
INSERT INTO puzzles (
  id,
  quest_id,
  external_ai_puzzle_id,
  type,
  topic,
  difficulty,
  question,
  options,
  correct_answer,
  explanation,
  xp_reward,
  score_reward
)
VALUES
  (
    'PZ-001',
    'quest_village_basics',
    'unity_starter_pz001',
    'number_matrix',
    'aptitude',
    'medium',
    'Complete the 3x3 Number Matrix series: 12, 18, 24, 30, ??, 42, 48, 54, 60.',
    '{"interactionType": "tile_selection", "content": {"rows": 3, "columns": 3, "elements": [{"id": "t1", "value": "12", "type": "tile"}, {"id": "t2", "value": "18", "type": "tile"}, {"id": "t3", "value": "24", "type": "tile"}, {"id": "t4", "value": "30", "type": "tile"}, {"id": "t5", "value": "??", "type": "tile"}, {"id": "t6", "value": "42", "type": "tile"}, {"id": "t7", "value": "48", "type": "tile"}, {"id": "t8", "value": "54", "type": "tile"}, {"id": "t9", "value": "60", "type": "tile"}]}}'::jsonb,
    '36',
    'The matrix increases arithmetic series by +6 in row-major progression.',
    100,
    200
  )
ON CONFLICT (id) DO UPDATE SET
  quest_id = EXCLUDED.quest_id,
  type = EXCLUDED.type,
  topic = EXCLUDED.topic,
  difficulty = EXCLUDED.difficulty,
  question = EXCLUDED.question,
  options = EXCLUDED.options,
  correct_answer = EXCLUDED.correct_answer,
  explanation = EXCLUDED.explanation,
  xp_reward = EXCLUDED.xp_reward,
  score_reward = EXCLUDED.score_reward;
