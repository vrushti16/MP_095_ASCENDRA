const request = require('supertest');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const aiService = require('../src/services/aiService');

describe('Puzzle Result Integration API (/api/v1/puzzles)', () => {
  const timestamp = Date.now();
  let playerToken = null;
  let playerId = null;
  let secondaryPlayerToken = null;
  let secondaryPlayerId = null;

  const testQuestId = `quest_puzzle_test_${timestamp}`;
  let generatedPuzzleId = null;

  beforeAll(async () => {
    // 1. Register primary player
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `puzzle_hero_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Puzzle Master'
      });
    playerId = regRes.body.data.user.id;
    playerToken = regRes.body.data.accessToken;

    // 2. Register secondary player
    const secRes = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `puzzle_sec_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Second Solver'
      });
    secondaryPlayerId = secRes.body.data.user.id;
    secondaryPlayerToken = secRes.body.data.accessToken;

    // 3. Create a test quest linked to puzzles
    await query(
      `INSERT INTO quests (id, title, description, category, difficulty, xp_reward, score_reward, status)
       VALUES ($1, 'Riddle of the Sands', 'Solve the math riddle.', 'puzzle', 'easy', 100, 200, 'active');`,
      [testQuestId]
    );

    // Start quest for primary player
    await request(app)
      .post(`/api/v1/quests/${testQuestId}/start`)
      .set('Authorization', `Bearer ${playerToken}`);
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await query('DELETE FROM quests WHERE id = $1;', [testQuestId]);
    await pool.end();
  });

  describe('1. Authentication Checks', () => {
    it('should reject POST /puzzles/generate without JWT', async () => {
      const res = await request(app).post('/api/v1/puzzles/generate').send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject GET /puzzles/:id without JWT', async () => {
      const res = await request(app).get('/api/v1/puzzles/pz_123');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject POST /puzzles/:id/attempt without JWT', async () => {
      const res = await request(app).post('/api/v1/puzzles/pz_123/attempt').send({ answer: '15' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('2. POST /api/v1/puzzles/generate (AI Generation Contract)', () => {
    it('should request puzzle via mocked FastAPI, persist to DB, and return sanitized payload without correct_answer', async () => {
      const mockFastApiResponse = {
        externalPuzzleId: `ai_pz_mock_${timestamp}`,
        type: 'pattern',
        topic: 'mathematics',
        difficulty: 'easy',
        question: 'What comes next in the sequence: 4, 8, 12, 16, ...?',
        options: ['18', '20', '22', '24'],
        correctAnswer: '20',
        explanation: 'Each step adds 4.'
      };

      // Mock the HTTP call to Developer B's FastAPI service
      jest.spyOn(aiService, 'requestPuzzleGeneration').mockResolvedValueOnce(mockFastApiResponse);

      const res = await request(app)
        .post('/api/v1/puzzles/generate')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          questId: testQuestId,
          topic: 'mathematics',
          difficulty: 'easy',
          type: 'pattern'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.question).toBe(mockFastApiResponse.question);
      expect(res.body.data.options).toEqual(mockFastApiResponse.options);
      expect(res.body.data.xpReward).toBe(20);
      expect(res.body.data.scoreReward).toBe(50);

      // CRUCIAL SECURITY AUDIT: Verify correct_answer and explanation are NEVER sent to Unity
      expect(res.body.data.correct_answer).toBeUndefined();
      expect(res.body.data.correctAnswer).toBeUndefined();
      expect(res.body.data.explanation).toBeUndefined();

      generatedPuzzleId = res.body.data.id;

      // Verify in PostgreSQL that correct_answer is stored securely server-side
      const dbPuzzle = await query('SELECT correct_answer, explanation FROM puzzles WHERE id = $1;', [generatedPuzzleId]);
      expect(dbPuzzle.rows[0].correct_answer).toBe('20');
      expect(dbPuzzle.rows[0].explanation).toBe('Each step adds 4.');
    });
  });

  describe('3. GET /api/v1/puzzles/:puzzleId (Sanitized Retrieval)', () => {
    it('should retrieve puzzle and strictly omit correct_answer', async () => {
      const res = await request(app)
        .get(`/api/v1/puzzles/${generatedPuzzleId}`)
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(generatedPuzzleId);
      expect(res.body.data.question).toContain('4, 8, 12, 16');

      // Zero answer leak
      expect(res.body.data.correct_answer).toBeUndefined();
      expect(res.body.data.correctAnswer).toBeUndefined();
      expect(res.body.data.explanation).toBeUndefined();
    });

    it('should return 404 for non-existent puzzle', async () => {
      const res = await request(app)
        .get('/api/v1/puzzles/non_existent_pz_999')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PUZZLE_NOT_FOUND');
    });
  });

  describe('4. POST /api/v1/puzzles/:puzzleId/attempt (Attempts, Rewards, & Anti-Double Reward)', () => {
    it('should record an incorrect attempt without granting XP or score', async () => {
      const profileBefore = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);

      const res = await request(app)
        .post(`/api/v1/puzzles/${generatedPuzzleId}/attempt`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          answer: '99', // Incorrect answer
          timeTakenSeconds: 12
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correct).toBe(false);
      expect(res.body.data.attemptNumber).toBe(1);
      expect(res.body.data.reward.xp).toBe(0);
      expect(res.body.data.reward.score).toBe(0);

      // Verify in DB that attempt is recorded with 0 rewards
      const attemptCheck = await query(
        'SELECT is_correct, attempt_number, xp_earned, score_earned FROM puzzle_attempts WHERE player_id = $1 AND puzzle_id = $2;',
        [playerId, generatedPuzzleId]
      );
      expect(attemptCheck.rows.length).toBe(1);
      expect(attemptCheck.rows[0].is_correct).toBe(false);
      expect(attemptCheck.rows[0].attempt_number).toBe(1);
      expect(attemptCheck.rows[0].xp_earned).toBe(0);

      // Verify player stats did not increase
      const profileAfter = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      expect(profileAfter.rows[0].experience).toBe(profileBefore.rows[0].experience);
    });

    it('should accept correct answer on attempt 2, award rewards, and increment quest progress', async () => {
      const profileBefore = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      const xpBefore = profileBefore.rows[0].experience;

      const res = await request(app)
        .post(`/api/v1/puzzles/${generatedPuzzleId}/attempt`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          answer: '20', // Correct answer
          timeTakenSeconds: 15
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.correct).toBe(true);
      expect(res.body.data.attemptNumber).toBe(2);
      expect(res.body.data.alreadyRewarded).toBe(false);
      expect(res.body.data.reward.xp).toBe(20);
      expect(res.body.data.reward.score).toBe(50);
      expect(res.body.data.questProgressUpdated).toBe(true);

      // Verify player stats increased by exactly 20 XP and 50 Score
      const profileAfter = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      expect(profileAfter.rows[0].experience).toBe(xpBefore + 20);
      expect(profileAfter.rows[0].score).toBe(profileBefore.rows[0].score + 50);

      // Verify linked quest progress advanced, but status remained in_progress
      const pqCheck = await query('SELECT status, progress FROM player_quests WHERE player_id = $1 AND quest_id = $2;', [playerId, testQuestId]);
      expect(pqCheck.rows[0].progress).toBe(25); // incremented by 25%
      expect(pqCheck.rows[0].status).toBe('in_progress'); // DID NOT bypass Phase 8 quest completion!
    });

    it('should reject additional rewards on repeated correct solves (Anti-Double Reward)', async () => {
      const profileBefore = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);

      const res = await request(app)
        .post(`/api/v1/puzzles/${generatedPuzzleId}/attempt`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          answer: '20', // Correct answer again
          timeTakenSeconds: 5
        });

      expect(res.status).toBe(200);
      expect(res.body.data.correct).toBe(true);
      expect(res.body.data.attemptNumber).toBe(3);
      expect(res.body.data.alreadyRewarded).toBe(true);
      expect(res.body.data.reward.xp).toBe(0);
      expect(res.body.data.reward.score).toBe(0);

      // Verify stats did NOT increase
      const profileAfter = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerId]);
      expect(profileAfter.rows[0].experience).toBe(profileBefore.rows[0].experience);
      expect(profileAfter.rows[0].score).toBe(profileBefore.rows[0].score);
    });

    it('should ignore forged rewards or spoofed playerId sent in client attempt body', async () => {
      // Create another puzzle
      const mockFastApi2 = {
        externalPuzzleId: 'ai_pz_forgery_test',
        type: 'multiple_choice',
        topic: 'science',
        difficulty: 'easy',
        question: 'What is H2O?',
        options: ['Water', 'Air', 'Fire', 'Earth'],
        correctAnswer: 'Water'
      };
      jest.spyOn(aiService, 'requestPuzzleGeneration').mockResolvedValueOnce(mockFastApi2);

      const genRes = await request(app)
        .post('/api/v1/puzzles/generate')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ type: 'multiple_choice' });

      const pzId = genRes.body.data.id;

      // Primary player attempts with forged payload
      const res = await request(app)
        .post(`/api/v1/puzzles/${pzId}/attempt`)
        .set('Authorization', `Bearer ${playerToken}`)
        .send({
          answer: 'Water',
          playerId: secondaryPlayerId, // Forged ID
          xpEarned: 999999,            // Forged XP
          scoreEarned: 999999,         // Forged Score
          correctAnswer: 'Hacked'      // Forged answer key
        });

      expect(res.status).toBe(200);
      expect(res.body.data.correct).toBe(true);
      // Awards legitimate DB rewards (20 XP, 50 Score)
      expect(res.body.data.reward.xp).toBe(20);
      expect(res.body.data.reward.score).toBe(50);

      // Secondary player was NOT affected
      const secProfile = await query('SELECT experience FROM player_profiles WHERE user_id = $1;', [secondaryPlayerId]);
      expect(secProfile.rows[0].experience).toBe(0);
    });

    it('should handle concurrent correct attempts safely without double rewards', async () => {
      // Create a fresh puzzle for secondary player concurrency test
      const mockFastApiConcurrent = {
        externalPuzzleId: 'ai_pz_concurrent',
        type: 'pattern',
        topic: 'logic',
        difficulty: 'easy',
        question: 'Solve concurrency test: 1, 2, 3, ?',
        options: ['4', '5'],
        correctAnswer: '4'
      };
      jest.spyOn(aiService, 'requestPuzzleGeneration').mockResolvedValueOnce(mockFastApiConcurrent);

      const genRes = await request(app)
        .post('/api/v1/puzzles/generate')
        .set('Authorization', `Bearer ${secondaryPlayerToken}`)
        .send({ type: 'pattern' });

      const pzId = genRes.body.data.id;

      // Fire two simultaneous correct attempts for secondary player
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/v1/puzzles/${pzId}/attempt`).set('Authorization', `Bearer ${secondaryPlayerToken}`).send({ answer: '4' }),
        request(app).post(`/api/v1/puzzles/${pzId}/attempt`).set('Authorization', `Bearer ${secondaryPlayerToken}`).send({ answer: '4' })
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Exactly one request must be alreadyRewarded=false, and one alreadyRewarded=true
      const alreadyRewardedFlags = [res1.body.data.alreadyRewarded, res2.body.data.alreadyRewarded];
      expect(alreadyRewardedFlags).toContain(false);
      expect(alreadyRewardedFlags).toContain(true);

      // Total awarded XP for secondary player must be exactly 20 XP (not 40 XP!)
      const secProfile = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [secondaryPlayerId]);
      expect(secProfile.rows[0].experience).toBe(20);
      expect(secProfile.rows[0].score).toBe(50);
    });
  });
});
