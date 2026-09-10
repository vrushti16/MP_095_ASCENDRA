const request = require('supertest');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const aiService = require('../src/services/aiService');

describe('Clue Persistence & Unlock Integration API (/api/v1/clues)', () => {
  const timestamp = Date.now();
  let player1Token = null;
  let player1Id = null;
  let player2Token = null;
  let player2Id = null;

  const testQuestId = `quest_clue_test_${timestamp}`;
  const testClueId1 = `clue_test_seq1_${timestamp}`;
  const testClueId2 = `clue_test_seq2_${timestamp}`;
  let testPuzzleId = null;

  beforeAll(async () => {
    // 1. Register Player 1
    const p1Res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `clue_seeker1_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Clue Explorer 1'
      });
    player1Id = p1Res.body.data.user.id;
    player1Token = p1Res.body.data.accessToken;

    // 2. Register Player 2
    const p2Res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: `clue_seeker2_${timestamp}@ascendra.test`,
        password: 'Password123!',
        name: 'Clue Explorer 2'
      });
    player2Id = p2Res.body.data.user.id;
    player2Token = p2Res.body.data.accessToken;

    // 3. Insert test quest
    await query(
      `INSERT INTO quests (id, title, description, category, difficulty, xp_reward, score_reward, status)
       VALUES ($1, 'Ruins of the Oracle', 'Seek the hidden scrolls.', 'exploration', 'easy', 100, 200, 'active');`,
      [testQuestId]
    );

    // 4. Insert test clues for this quest (two sequential clues)
    await query(
      `INSERT INTO clues (id, quest_id, title, content, sequence_number)
       VALUES
         ($1, $3, 'Oracle Map Fragment', 'Head towards the weeping willow near the riverbank.', 1),
         ($2, $3, 'Sanctuary Keyhole Hint', 'The keyhole requires the bronze sun medallion.', 2);`,
      [testClueId1, testClueId2, testQuestId]
    );

    // 5. Start the quest for Player 1
    await request(app)
      .post(`/api/v1/quests/${testQuestId}/start`)
      .set('Authorization', `Bearer ${player1Token}`);

    // 6. Generate a test puzzle linked to this quest
    const mockFastApiResponse = {
      externalPuzzleId: `ai_clue_pz_${timestamp}`,
      type: 'multiple_choice',
      topic: 'history',
      difficulty: 'easy',
      question: 'Which empire built the ancient stone archways?',
      options: ['Valoria', 'Eldoria', 'Ascendra', 'Zephyria'],
      correctAnswer: 'Ascendra',
      explanation: 'Ascendra was the architect of the first stones.'
    };

    jest.spyOn(aiService, 'requestPuzzleGeneration').mockResolvedValueOnce(mockFastApiResponse);

    const puzzleRes = await request(app)
      .post('/api/v1/puzzles/generate')
      .set('Authorization', `Bearer ${player1Token}`)
      .send({
        questId: testQuestId,
        topic: 'history',
        difficulty: 'easy',
        type: 'multiple_choice'
      });

    testPuzzleId = puzzleRes.body.data.id;
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await query('DELETE FROM quests WHERE id = $1;', [testQuestId]);
    await pool.end();
  });

  describe('1. Authentication Enforcement', () => {
    it('should reject GET /api/v1/clues without JWT', async () => {
      const res = await request(app).get('/api/v1/clues');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject GET /api/v1/clues/:clueId without JWT', async () => {
      const res = await request(app).get(`/api/v1/clues/${testClueId1}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('2. Locked Clue & Security Isolation', () => {
    it('should return empty clues list for player who has not unlocked any clues', async () => {
      const res = await request(app)
        .get('/api/v1/clues')
        .set('Authorization', `Bearer ${player1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const testClues = res.body.data.filter(c => c.questId === testQuestId);
      expect(testClues).toHaveLength(0);
    });

    it('should return 403 Forbidden (CLUE_LOCKED) when requesting an unearned clue', async () => {
      const res = await request(app)
        .get(`/api/v1/clues/${testClueId1}`)
        .set('Authorization', `Bearer ${player1Token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CLUE_LOCKED');
    });

    it('should return 404 for a non-existent clue ID', async () => {
      const res = await request(app)
        .get('/api/v1/clues/non_existent_clue_999')
        .set('Authorization', `Bearer ${player1Token}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CLUE_NOT_FOUND');
    });

    it('should confirm NO public client unlock endpoint exists (404 Not Found)', async () => {
      const res = await request(app)
        .post(`/api/v1/clues/${testClueId1}/unlock`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({});

      expect(res.status).toBe(404);
    });
  });

  describe('3. Puzzle Solve -> Clue Unlock Integration', () => {
    it('should NOT unlock clue when puzzle answer is incorrect', async () => {
      const res = await request(app)
        .post(`/api/v1/puzzles/${testPuzzleId}/attempt`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ answer: 'WrongAnswer' });

      expect(res.status).toBe(200);
      expect(res.body.data.correct).toBe(false);
      expect(res.body.data.unlockedClue).toBeNull();

      // Verify clue remains locked
      const checkRes = await request(app)
        .get(`/api/v1/clues/${testClueId1}`)
        .set('Authorization', `Bearer ${player1Token}`);
      expect(checkRes.status).toBe(403);
    });

    it('should unlock the first eligible clue upon correct puzzle solve', async () => {
      const res = await request(app)
        .post(`/api/v1/puzzles/${testPuzzleId}/attempt`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ answer: 'Ascendra' });

      expect(res.status).toBe(200);
      expect(res.body.data.correct).toBe(true);
      expect(res.body.data.alreadyRewarded).toBe(false);
      expect(res.body.data.questProgressUpdated).toBe(true);

      // Verify unlockedClue object in response
      expect(res.body.data.unlockedClue).toBeDefined();
      expect(res.body.data.unlockedClue.id).toBe(testClueId1);
      expect(res.body.data.unlockedClue.title).toBe('Oracle Map Fragment');
      expect(res.body.data.unlockedClue.sequenceNumber).toBe(1);
      expect(res.body.data.unlockedClue.discoveredAt).toBeDefined();
    });

    it('should allow player to retrieve the newly unlocked clue via GET /clues/:clueId', async () => {
      const res = await request(app)
        .get(`/api/v1/clues/${testClueId1}`)
        .set('Authorization', `Bearer ${player1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testClueId1);
      expect(res.body.data.title).toBe('Oracle Map Fragment');
      expect(res.body.data.content).toBe('Head towards the weeping willow near the riverbank.');
      expect(res.body.data.questId).toBe(testQuestId);
      expect(res.body.data.questTitle).toBe('Ruins of the Oracle');
    });

    it('should list the unlocked clue under GET /api/v1/clues for Player 1', async () => {
      const res = await request(app)
        .get('/api/v1/clues')
        .set('Authorization', `Bearer ${player1Token}`);

      expect(res.status).toBe(200);
      const myClue = res.body.data.find(c => c.id === testClueId1);
      expect(myClue).toBeDefined();
      expect(myClue.title).toBe('Oracle Map Fragment');
    });

    it('should NOT allow Player 2 to access Player 1 unlocked clue (Cross-Player Isolation)', async () => {
      const res = await request(app)
        .get(`/api/v1/clues/${testClueId1}`)
        .set('Authorization', `Bearer ${player2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CLUE_LOCKED');
    });

    it('should NOT re-unlock or duplicate clue on repeated correct puzzle solve', async () => {
      const res = await request(app)
        .post(`/api/v1/puzzles/${testPuzzleId}/attempt`)
        .set('Authorization', `Bearer ${player1Token}`)
        .send({ answer: 'Ascendra' });

      expect(res.status).toBe(200);
      expect(res.body.data.correct).toBe(true);
      expect(res.body.data.alreadyRewarded).toBe(true);
      // Already rewarded attempts do not unlock further clues
      expect(res.body.data.unlockedClue).toBeNull();

      // Check DB to ensure exactly 1 record exists in player_clues for player1 and testClueId1
      const countRes = await query(
        'SELECT count(*) FROM player_clues WHERE player_id = $1 AND clue_id = $2;',
        [player1Id, testClueId1]
      );
      expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
    });
  });

  describe('4. Quest Progress & Phase 8 Authority Integrity', () => {
    it('should verify puzzle solve advances quest progress but does NOT auto-complete quest', async () => {
      const questRes = await request(app)
        .get(`/api/v1/quests/${testQuestId}`)
        .set('Authorization', `Bearer ${player1Token}`);

      expect(questRes.status).toBe(200);
      expect(questRes.body.data.playerProgress.status).toBe('in_progress');
      expect(questRes.body.data.playerProgress.progress).toBe(25);
      expect(questRes.body.data.playerProgress.completedAt).toBeNull();
    });

    it('should confirm authoritative quest completion remains governed by POST /quests/:id/complete', async () => {
      // Complete quest via Phase 8 authoritative endpoint
      const completeRes = await request(app)
        .post(`/api/v1/quests/${testQuestId}/complete`)
        .set('Authorization', `Bearer ${player1Token}`);

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.alreadyCompleted).toBe(false);
      expect(completeRes.body.data.playerProgress.status).toBe('completed');
      expect(completeRes.body.data.reward.xp).toBe(100);
      expect(completeRes.body.data.reward.score).toBe(200);
    });
  });

  describe('5. Concurrency Safety', () => {
    it('should handle concurrent puzzle solve requests without duplicate clue unlocks or double progression', async () => {
      // 1. Register Player 3 for concurrency test
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `clue_concurrency_${timestamp}@ascendra.test`,
          password: 'Password123!',
          name: 'Concurrent Runner'
        });
      const cPlayerToken = regRes.body.data.accessToken;
      const cPlayerId = regRes.body.data.user.id;

      // 2. Start quest for Player 3
      await request(app)
        .post(`/api/v1/quests/${testQuestId}/start`)
        .set('Authorization', `Bearer ${cPlayerToken}`);

      // 3. Generate a dedicated puzzle for Player 3
      jest.spyOn(aiService, 'requestPuzzleGeneration').mockResolvedValueOnce({
        externalPuzzleId: `ai_conc_${timestamp}`,
        type: 'multiple_choice',
        topic: 'history',
        difficulty: 'easy',
        question: 'Solve concurrent test',
        options: ['A', 'B'],
        correctAnswer: 'A',
        explanation: 'Test explanation'
      });

      const pzRes = await request(app)
        .post('/api/v1/puzzles/generate')
        .set('Authorization', `Bearer ${cPlayerToken}`)
        .send({
          questId: testQuestId,
          topic: 'history',
          difficulty: 'easy',
          type: 'multiple_choice'
        });
      const concPuzzleId = pzRes.body.data.id;

      // 4. Fire 2 simultaneous correct submissions
      const [res1, res2] = await Promise.all([
        request(app)
          .post(`/api/v1/puzzles/${concPuzzleId}/attempt`)
          .set('Authorization', `Bearer ${cPlayerToken}`)
          .send({ answer: 'A' }),
        request(app)
          .post(`/api/v1/puzzles/${concPuzzleId}/attempt`)
          .set('Authorization', `Bearer ${cPlayerToken}`)
          .send({ answer: 'A' })
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Exactly one must have awarded XP and score
      const rewardsAwarded = [res1.body.data.reward.xp, res2.body.data.reward.xp].filter(xp => xp > 0);
      expect(rewardsAwarded).toHaveLength(1);

      // Exactly one must have unlocked the clue
      const cluesUnlocked = [res1.body.data.unlockedClue, res2.body.data.unlockedClue].filter(Boolean);
      expect(cluesUnlocked).toHaveLength(1);

      // Verify DB has strictly 1 clue record in player_clues for Player 3 and testClueId1
      const pcRes = await query(
        'SELECT count(*) FROM player_clues WHERE player_id = $1 AND clue_id = $2;',
        [cPlayerId, testClueId1]
      );
      expect(parseInt(pcRes.rows[0].count, 10)).toBe(1);
    });
  });
});
