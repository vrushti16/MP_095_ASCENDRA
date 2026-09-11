const path = require('path');
const bcrypt = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'bcryptjs'));
const { getClient, pool } = require(path.join(__dirname, '..', '..', 'backend', 'src', 'config', 'database'));

async function seedDemoData() {
  console.log('🎮 [DEMO SEED] Connecting to ASCENDRA database...');
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Password hashes
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    const playerPasswordHash = await bcrypt.hash('PlayerPassword123!', 10);

    // 2. Insert or Update Admin User
    const adminRes = await client.query(
      `INSERT INTO users (email, password_hash, name, role, last_login)
       VALUES ($1, $2, $3, 'admin', NOW())
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'admin',
           name = EXCLUDED.name,
           last_login = NOW()
       RETURNING id;`,
      ['admin@ascendra.edu', adminPasswordHash, 'System Administrator']
    );
    const adminId = adminRes.rows[0].id;

    await client.query(
      `INSERT INTO player_profiles (user_id, level, experience, score, health, max_health)
       VALUES ($1, 10, 15000, 25000, 100, 100)
       ON CONFLICT (user_id) DO UPDATE
       SET level = 10, experience = 15000, score = 25000;`,
      [adminId]
    );

    // 3. Insert or Update Primary Demo Player: Aria
    const playerRes = await client.query(
      `INSERT INTO users (email, password_hash, name, role, last_login)
       VALUES ($1, $2, $3, 'player', NOW())
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'player',
           name = EXCLUDED.name,
           last_login = NOW()
       RETURNING id;`,
      ['player@ascendra.game', playerPasswordHash, 'Aria the Cryptseeker']
    );
    const playerId = playerRes.rows[0].id;

    await client.query(
      `INSERT INTO player_profiles (user_id, level, experience, score, health, max_health)
       VALUES ($1, 3, 2450, 3200, 100, 100)
       ON CONFLICT (user_id) DO UPDATE
       SET level = 3, experience = 2450, score = 3200, health = 100;`,
      [playerId]
    );

    // 4. Insert or Update Secondary Demo Player: Kaelen
    const player2Res = await client.query(
      `INSERT INTO users (email, password_hash, name, role, last_login)
       VALUES ($1, $2, $3, 'player', NOW() - INTERVAL '1 day')
       ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = 'player',
           name = EXCLUDED.name
       RETURNING id;`,
      ['kaelen@ascendra.game', playerPasswordHash, 'Kaelen Runehunter']
    );
    const player2Id = player2Res.rows[0].id;

    await client.query(
      `INSERT INTO player_profiles (user_id, level, experience, score, health, max_health)
       VALUES ($1, 2, 1250, 1600, 85, 100)
       ON CONFLICT (user_id) DO UPDATE
       SET level = 2, experience = 1250, score = 1600, health = 85;`,
      [player2Id]
    );

    // 5. Player Quests Progression
    await client.query(
      `INSERT INTO player_quests (player_id, quest_id, status, progress, started_at, completed_at)
       VALUES 
         ($1, 'quest_village_basics', 'completed', 100, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
         ($1, 'quest_ancient_runes', 'in_progress', 65, NOW() - INTERVAL '6 hours', NULL),
         ($2, 'quest_village_basics', 'completed', 100, NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days')
       ON CONFLICT (player_id, quest_id) DO UPDATE
       SET status = EXCLUDED.status,
           progress = EXCLUDED.progress,
           started_at = EXCLUDED.started_at,
           completed_at = EXCLUDED.completed_at;`,
      [playerId, player2Id]
    );

    // 6. Player Discovered Clues
    await client.query(
      `INSERT INTO player_clues (player_id, clue_id, discovered_at)
       VALUES 
         ($1, 'clue_village_inscription_1', NOW() - INTERVAL '2 days'),
         ($1, 'clue_village_inscription_2', NOW() - INTERVAL '1 day'),
         ($1, 'clue_ancient_runes_tablet_1', NOW() - INTERVAL '4 hours'),
         ($2, 'clue_village_inscription_1', NOW() - INTERVAL '3 days')
       ON CONFLICT (player_id, clue_id) DO NOTHING;`,
      [playerId, player2Id]
    );

    // 7. Educational Puzzles
    await client.query(
      `INSERT INTO puzzles (id, quest_id, type, topic, difficulty, question, options, correct_answer, explanation, xp_reward, score_reward)
       VALUES
         (
           'puzzle_village_cipher_1',
           'quest_village_basics',
           'multiple_choice',
           'logical_reasoning',
           'easy',
           'Which glyph completes the sequence: Circle, Triangle, Square, Pentagon, ...?',
           '["Hexagon", "Octagon", "Diamond", "Heptagon"]'::jsonb,
           'Hexagon',
           'The sequence represents polygons with incrementing side counts (3, 4, 5, 6).',
           30,
           75
         ),
         (
           'puzzle_runes_math_1',
           'quest_ancient_runes',
           'multiple_choice',
           'mathematics',
           'medium',
           'If three sundials display numbers 3, 7, and 15, what is the next number in this ancient celestial series?',
           '["27", "31", "35", "42"]'::jsonb,
           '31',
           'The series follows the progression 2x + 1: (3*2+1=7, 7*2+1=15, 15*2+1=31).',
           50,
           120
         ),
         (
           'puzzle_forest_cyber_1',
           'quest_forest_whispers',
           'multiple_choice',
           'cyber_security',
           'medium',
           'Which core security principle guarantees that parchment scrolls cannot be altered unnoticed during transit?',
           '["Integrity", "Confidentiality", "Availability", "Authentication"]'::jsonb,
           'Integrity',
           'Integrity ensures that data remains unaltered, verified through cryptographic hashes.',
           50,
           125
         )
       ON CONFLICT (id) DO UPDATE
       SET question = EXCLUDED.question,
           options = EXCLUDED.options,
           correct_answer = EXCLUDED.correct_answer,
           explanation = EXCLUDED.explanation;`
    );

    // 8. Puzzle Attempts (For Analytics)
    await client.query(
      `INSERT INTO puzzle_attempts (player_id, puzzle_id, submitted_answer, is_correct, attempt_number, xp_earned, score_earned, time_taken_seconds, created_at)
       VALUES
         ($1, 'puzzle_village_cipher_1', 'Hexagon', true, 1, 30, 75, 18, NOW() - INTERVAL '2 days'),
         ($1, 'puzzle_runes_math_1', '31', true, 1, 50, 120, 24, NOW() - INTERVAL '5 hours'),
         ($2, 'puzzle_village_cipher_1', 'Octagon', false, 1, 0, 0, 35, NOW() - INTERVAL '3 days'),
         ($2, 'puzzle_village_cipher_1', 'Hexagon', true, 2, 30, 75, 15, NOW() - INTERVAL '3 days')
       ON CONFLICT DO NOTHING;`,
      [playerId, player2Id]
    );

    // 9. AI Telemetry Records
    await client.query(
      `INSERT INTO ai_telemetry (quest_id, topic, difficulty, status, latency_ms, is_fallback, error_message, created_at)
       VALUES
         ('quest_village_basics', 'logical_reasoning', 'easy', 'success', 210, false, NULL, NOW() - INTERVAL '2 hours'),
         ('quest_ancient_runes', 'mathematics', 'medium', 'success', 285, false, NULL, NOW() - INTERVAL '90 minutes'),
         ('quest_forest_whispers', 'cyber_security', 'medium', 'success', 340, false, NULL, NOW() - INTERVAL '45 minutes'),
         ('quest_ancient_runes', 'aptitude', 'easy', 'success', 195, false, NULL, NOW() - INTERVAL '20 minutes'),
         ('quest_village_basics', 'english', 'easy', 'success', 180, false, NULL, NOW() - INTERVAL '5 minutes')
       ON CONFLICT DO NOTHING;`
    );

    await client.query('COMMIT');
    console.log('✅ [DEMO SEED COMPLETED] Demo users, progression, quests, clues, puzzles, and telemetry seeded!');
    console.log('----------------------------------------------------');
    console.log('👤 Admin Credentials:');
    console.log('   Email:    admin@ascendra.edu');
    console.log('   Password: AdminPassword123!');
    console.log('   URL:      http://localhost:5000/admin/');
    console.log('');
    console.log('⚔️ Player Credentials:');
    console.log('   Email:    player@ascendra.game');
    console.log('   Password: PlayerPassword123!');
    console.log('   URL:      http://localhost:5000/play/');
    console.log('----------------------------------------------------');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('💥 [DEMO SEED FAILED]:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seedDemoData };
