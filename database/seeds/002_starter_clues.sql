-- ASCENDRA Starter Clues Seed Data
INSERT INTO clues (id, quest_id, title, content, sequence_number)
VALUES
  (
    'clue_village_inscription_1',
    'quest_village_basics',
    'Village Inscription',
    'The elder speaks of ancient stone markers near the eastern gate.',
    1
  ),
  (
    'clue_village_inscription_2',
    'quest_village_basics',
    'The Hidden Well',
    'Beneath the overgrown ivy by the old well lies the seal of the guardians.',
    2
  ),
  (
    'clue_ancient_runes_tablet_1',
    'quest_ancient_runes',
    'Weathered Tablet Fragment',
    'The runes align with the cardinal directions: North reveals the path of knowledge.',
    1
  ),
  (
    'clue_ancient_runes_tablet_2',
    'quest_ancient_runes',
    'The Celestial Cipher',
    'When the twin moons rise, the shadows cast by the obelisk point to the sanctuary.',
    2
  ),
  (
    'clue_forest_whispers_map_1',
    'quest_forest_whispers',
    'Cartographer''s Note',
    'Deep within the Whispering Woods lies an overgrown altar guarded by shadows.',
    1
  )
ON CONFLICT (id) DO UPDATE SET
  quest_id = EXCLUDED.quest_id,
  title = EXCLUDED.title,
  content = EXCLUDED.content,
  sequence_number = EXCLUDED.sequence_number;
