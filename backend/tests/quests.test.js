const request = require('supertest');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');

describe('Quest Persistence API (/api/v1/quests)', () => {
  const timestamp = Date.now();
  let playerToken = null;
  let playerId = null;
  let secondaryPlayerToken = null;
  let secondaryPlayerId = null;

  const testQuestId = `quest_test_${timestamp}`;

  beforeAll(async () => {
    // 1. Create primary player
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `quest_hero_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Quest Hero'
      });
    playerId = regRes.body.data.user.id;
    playerToken = regRes.body.data.accessToken;

    // 2. Create secondary player for ownership isolation test
    const secRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `quest_sec_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Secondary Hero'
      });
    secondaryPlayerId = secRes.body.data.user.id;
    secondaryPlayerToken = secRes.body.data.accessToken;

    // 3. Create a test quest in the database
    await query(
      `INSERT INTO quests (id, title, description, category, difficulty, xp_reward, score_reward, status)
       VALUES ($1, 'The Sunken Temple', 'Recover the legendary artifact.', 'adventure', 'medium', 150, 300, 'active');`,
      [testQuestId]
    );
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await query('DELETE FROM quests WHERE id = $1;', [testQuestId]);
    await pool.end();
  });

  describe('1. GET /api/v1/quests (Quest Catalog)', () => {
    it('should list all active quests with player progress state', async () => {
      const res = await request(app)
        .get('/api/v1/quests')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const foundQuest = res.body.data.find(q => q.id === testQuestId);
      expect(foundQuest).toBeDefined();
      expect(foundQuest.title).toBe('The Sunken Temple');
      expect(foundQuest.xpReward).toBe(150);
      expect(foundQuest.scoreReward).toBe(300);
      expect(foundQuest.playerProgress.status).toBe('not_started');
    });

    it('should reject unauthenticated request without JWT', async () => {
      const res = await request(app).get('/api/v1/quests');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('2. GET /api/v1/quests/:questId (Quest Details)', () => {
    it('should return quest details and personal progress', async () => {
      const res = await request(app)
        .get(`/api/v1/quests/${testQuestId}`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quest.id).toBe(testQuestId);
      expect(res.body.data.playerProgress.status).toBe('not_started');
      expect(res.body.data.playerProgress.progress).toBe(0);
    });

    it('should return 404 for non-existent questId', async () => {
      const res = await request(app)
        .get('/api/v1/quests/non_existent_quest_id_xyz')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('QUEST_NOT_FOUND');
    });
  });

  describe('3. POST /api/v1/quests/:questId/start (Start Quest)', () => {
    it('should successfully transition quest from not_started to in_progress', async () => {
      const res = await request(app)
        .post(`/api/v1/quests/${testQuestId}/start`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.progress).toBe(0);
      expect(res.body.data.startedAt).toBeDefined();

      // Verify in database
      const dbCheck = await query(
        'SELECT status, progress FROM player_quests WHERE player_id = $1 AND quest_id = $2;',
        [playerId, testQuestId]
      );
      expect(dbCheck.rows.length).toBe(1);
      expect(dbCheck.rows[0].status).toBe('in_progress');
    });

    it('should be idempotent if player calls start on already in_progress quest', async () => {
      const res = await request(app)
        .post(`/api/v1/quests/${testQuestId}/start`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
    });

    it('should return 404 when starting non-existent quest', async () => {
      const res = await request(app)
        .post('/api/v1/quests/non_existent_quest_999/start')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('QUEST_NOT_FOUND');
    });
  });

  describe('4. PATCH /api/v1/quests/:questId/progress (Update Progress)', () => {
    it('should update progress percentage correctly', async () => {
      const res = await request(app)
        .patch(`/api/v1/quests/${testQuestId}/progress`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ progress: 50 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.progress).toBe(50);
    });

    it('should update progress via stepIncrement', async () => {
      const res = await request(app)
        .patch(`/api/v1/quests/${testQuestId}/progress`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ stepIncrement: 25 }); // 50 + 25 = 75

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.progress).toBe(75);
    });

    it('should reject invalid progress values outside 0-100', async () => {
      const res = await request(app)
        .patch(`/api/v1/quests/${testQuestId}/progress`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ progress: 150 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_PROGRESS');
    });

    it('should reject progress update if player has not started the quest', async () => {
      const unstartedQuestId = 'quest_ancient_runes';
      const res = await request(app)
        .patch(`/api/v1/quests/${unstartedQuestId}/progress`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ progress: 20 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('QUEST_NOT_STARTED');
    });

    it('should NOT complete the quest or grant rewards even if progress reaches 100', async () => {
      // Prior stats check
      const profileBefore = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      const xpBefore = profileBefore.rows[0].experience;

      const res = await request(app)
        .patch(`/api/v1/quests/${testQuestId}/progress`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ progress: 100 });

      expect(res.status).toBe(200);
      expect(res.body.data.progress).toBe(100);
      expect(res.body.data.status).toBe('in_progress'); // Still in_progress!

      // Verify no XP was awarded via progress patch
      const profileAfter = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      expect(profileAfter.rows[0].experience).toBe(xpBefore);
    });
  });

  describe('5. POST /api/v1/quests/:questId/complete (Authoritative Completion & Rewards)', () => {
    it('should complete quest and award server-authoritative XP and score', async () => {
      const res = await request(app)
        .post(`/api/v1/quests/${testQuestId}/complete`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyCompleted).toBe(false);
      expect(res.body.data.playerProgress.status).toBe('completed');
      expect(res.body.data.playerProgress.progress).toBe(100);

      // Verify authoritative rewards (150 XP, 300 Score)
      expect(res.body.data.reward.xp).toBe(150);
      expect(res.body.data.reward.score).toBe(300);
      expect(res.body.data.profile.experience).toBe(150);
      expect(res.body.data.profile.score).toBe(300);
      expect(res.body.data.profile.level).toBe(2); // 150 XP = Level 2

      // Verify database state
      const dbPq = await query(
        'SELECT status, progress, completed_at FROM player_quests WHERE player_id = $1 AND quest_id = $2;',
        [playerId, testQuestId]
      );
      expect(dbPq.rows[0].status).toBe('completed');
      expect(dbPq.rows[0].progress).toBe(100);
      expect(dbPq.rows[0].completed_at).not.toBeNull();
    });

    it('should prevent double rewards when called again (idempotent)', async () => {
      const profileBefore = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);

      const res = await request(app)
        .post(`/api/v1/quests/${testQuestId}/complete`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.alreadyCompleted).toBe(true);
      expect(res.body.data.reward.xp).toBe(0);
      expect(res.body.data.reward.score).toBe(0);

      // Verify stats did NOT increase
      const profileAfter = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      expect(profileAfter.rows[0].experience).toBe(profileBefore.rows[0].experience);
      expect(profileAfter.rows[0].score).toBe(profileBefore.rows[0].score);
    });

    it('should reject completion of a quest that was never started', async () => {
      const res = await request(app)
        .post('/api/v1/quests/quest_forest_whispers/complete')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('QUEST_NOT_STARTED');
    });

    it('should handle concurrent completion requests safely without duplicate rewards', async () => {
      // Set up secondary player on another quest
      const concurrentQuestId = 'quest_ancient_runes'; // 100 XP, 250 Score

      // Start quest for secondary player
      await request(app)
        .post(`/api/v1/quests/${concurrentQuestId}/start`)
        .set('Authorization', `Bearer ${secondaryPlayerToken}`);

      // Fire two simultaneous completion requests
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/v1/quests/${concurrentQuestId}/complete`).set('Authorization', `Bearer ${secondaryPlayerToken}`),
        request(app).post(`/api/v1/quests/${concurrentQuestId}/complete`).set('Authorization', `Bearer ${secondaryPlayerToken}`)
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Exactly one should have alreadyCompleted=false, the other alreadyCompleted=true
      const results = [res1.body.data.alreadyCompleted, res2.body.data.alreadyCompleted];
      expect(results).toContain(false);
      expect(results).toContain(true);

      // Verify secondary player received reward exactly once (100 XP, 250 Score)
      const secProfile = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [secondaryPlayerId]);
      expect(secProfile.rows[0].experience).toBe(100);
      expect(secProfile.rows[0].score).toBe(250);
    });

    it('should ignore client attempts to supply forged rewards or target another player', async () => {
      const forgedQuestId = 'quest_village_basics'; // 50 XP, 100 Score
      await request(app)
        .post(`/api/v1/quests/${forgedQuestId}/start`)
        .set('Authorization', `Bearer ${playerToken}`);

      // Attempt forged payload
      const res = await request(app)
        .post(`/api/v1/quests/${forgedQuestId}/complete`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          playerId: secondaryPlayerId, // Forged ID
          xpEarned: 999999,            // Forged XP
          scoreEarned: 999999,         // Forged Score
          status: 'completed'
        });

      expect(res.status).toBe(200);
      // Backend awards only legitimate quest reward (50 XP, 100 Score)
      expect(res.body.data.reward.xp).toBe(50);
      expect(res.body.data.reward.score).toBe(100);

      // Verify secondary player was unaffected
      const secProfile = await query('SELECT experience FROM player_profiles WHERE user_id = $1;', [secondaryPlayerId]);
      expect(secProfile.rows[0].experience).toBe(100); // Remained 100
    });
  });
});
