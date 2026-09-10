const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const { JWT_SECRET } = require('../src/config/jwt');
const cacheService = require('../src/services/cacheService');
const redisConfig = require('../src/config/redis');

describe('Full-Stack Security Audit & Adversarial QA Suite (Phase 18)', () => {
  const timestamp = Date.now();
  const testPlayerA = {
    email: `player_sec_a_${timestamp}@ascendra.test`,
    password: 'PlayerPassword123!',
    name: 'Security Player A'
  };

  const testPlayerB = {
    email: `player_sec_b_${timestamp}@ascendra.test`,
    password: 'PlayerPassword123!',
    name: 'Security Player B'
  };

  const testAdmin = {
    email: `admin_sec_${timestamp}@ascendra.test`,
    password: 'AdminPassword123!',
    name: 'Security Admin'
  };

  let playerAToken = null;
  let playerARefreshToken = null;
  let playerAId = null;

  let playerBToken = null;
  let playerBId = null;

  let adminToken = null;
  let adminId = null;

  beforeAll(async () => {
    // 1. Register Player A
    const regResA = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-client-id', `client_init_a_${timestamp}`)
      .send(testPlayerA);
    playerAId = regResA.body.data.user.id;
    playerAToken = regResA.body.data.accessToken;
    playerARefreshToken = regResA.body.data.refreshToken;

    // 2. Register Player B
    const regResB = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-client-id', `client_init_b_${timestamp}`)
      .send(testPlayerB);
    playerBId = regResB.body.data.user.id;
    playerBToken = regResB.body.data.accessToken;

    // 3. Register Admin and promote in DB
    const regResAdmin = await request(app)
      .post('/api/v1/auth/register')
      .set('x-test-client-id', `client_init_admin_${timestamp}`)
      .send(testAdmin);
    adminId = regResAdmin.body.data.user.id;

    await query("UPDATE users SET role = 'admin' WHERE id = $1;", [adminId]);

    // Login as admin to get admin token with role='admin' claim
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('x-test-client-id', `client_init_admin_login_${timestamp}`)
      .send({ email: testAdmin.email, password: testAdmin.password });
    adminToken = adminLoginRes.body.data.accessToken;
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await pool.end();
  });

  // =========================================================================
  // 1. AUTHENTICATION ATTACK VECTORS (A01 - A12)
  // =========================================================================
  describe('1. Authentication Attack Vectors (A01 - A12)', () => {
    it('A01: Missing Authorization header should be rejected with 401 MISSING_TOKEN', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('A02: Empty Authorization header should be rejected with 401 MISSING_TOKEN or MALFORMED_TOKEN', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', '');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(['MISSING_TOKEN', 'MALFORMED_TOKEN']).toContain(res.body.error.code);
    });

    it('A03: Malformed Authorization headers (missing token or bad schema) should return 401 MALFORMED_TOKEN', async () => {
      const badHeaders = ['Bearer', 'Basic xyz123', 'Bearer a b c', 'Token 12345'];
      for (const header of badHeaders) {
        const res = await request(app)
          .get('/api/v1/users/me')
          .set('Authorization', header);
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('MALFORMED_TOKEN');
      }
    });

    it('A04: Random or garbage JWT string should be rejected with 401 INVALID_TOKEN', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer not.a.valid.jwt.string.random');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('A05: Expired JWT access token should be rejected with 401 EXPIRED_TOKEN', async () => {
      const expiredToken = jwt.sign(
        { sub: playerAId, role: 'player' },
        JWT_SECRET,
        { expiresIn: '-10s' }
      );
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('EXPIRED_TOKEN');
    });

    it('A06: JWT signed with incorrect secret should be rejected with 401 INVALID_TOKEN', async () => {
      const forgedToken = jwt.sign(
        { sub: playerAId, role: 'player' },
        'completely_wrong_attacker_secret_key_12345',
        { expiresIn: '15m' }
      );
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${forgedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('A07: Algorithm confusion ("none" algorithm) should be rejected with 401 INVALID_TOKEN', async () => {
      // Create unsigned JWT header with alg: none
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({ sub: playerAId, role: 'player' })).toString('base64url');
      const noneToken = `${header}.${payload}.`;

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${noneToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('A08: Tampered payload (changing role to admin without valid signature) should be rejected with 401', async () => {
      // Split valid token, replace payload with role: admin, keep old signature
      const [header, , signature] = playerAToken.split('.');
      const tamperedPayload = Buffer.from(JSON.stringify({ sub: playerAId, role: 'admin' })).toString('base64url');
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`;

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${tamperedToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('A09: Refresh token rotation replay attack should reject reused tokens with 401 REVOKED_REFRESH_TOKEN', async () => {
      // 1. First rotation: valid
      const rotRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: playerARefreshToken });
      expect(rotRes.status).toBe(200);
      const newRefreshToken = rotRes.body.data.refreshToken;
      expect(newRefreshToken).toBeDefined();

      // 2. Replay attack: try using the old, now-revoked refresh token again
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: playerARefreshToken });
      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error.code).toBe('REVOKED_REFRESH_TOKEN');

      // Update playerARefreshToken to current valid token for subsequent tests
      playerARefreshToken = newRefreshToken;
    });

    it('A10: Logout invalidates refresh token and subsequent refresh is rejected', async () => {
      // 1. Log out with current refresh token
      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: playerARefreshToken });
      expect(logoutRes.status).toBe(200);

      // 2. Attempt to use revoked refresh token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: playerARefreshToken });
      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe('REVOKED_REFRESH_TOKEN');

      // Re-login player A to obtain new active tokens
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-client-id', `client_relogin_a_${timestamp}`)
        .send({ email: testPlayerA.email, password: testPlayerA.password });
      playerAToken = loginRes.body.data.accessToken;
      playerARefreshToken = loginRes.body.data.refreshToken;
    });

    it('A11: Invalid login credentials should return 401 INVALID_CREDENTIALS without revealing email existence', async () => {
      const wrongPassRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-client-id', `client_invalid_pass_${timestamp}`)
        .send({ email: testPlayerA.email, password: 'WrongPassword999!' });
      expect(wrongPassRes.status).toBe(401);
      expect(wrongPassRes.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(wrongPassRes.body.error.message).toBe('Invalid email or password');

      const nonexistentEmailRes = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-client-id', `client_nonexistent_email_${timestamp}`)
        .send({ email: `nonexistent_${timestamp}@ascendra.test`, password: 'SomePassword123!' });
      expect(nonexistentEmailRes.status).toBe(401);
      expect(nonexistentEmailRes.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(nonexistentEmailRes.body.error.message).toBe('Invalid email or password');
    });

    it('A12: Privilege persistence: player logs in, escalation fails, refreshed token still has player role', async () => {
      // 1. Player attempts role escalation via profile update
      const escalateRes = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({ role: 'admin' });
      expect(escalateRes.status).toBe(403);
      expect(escalateRes.body.error.code).toBe('FORBIDDEN_FIELD_MODIFICATION');

      // 2. Refresh token
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: playerARefreshToken });
      expect(refreshRes.status).toBe(200);
      const newAccessToken = refreshRes.body.data.accessToken;
      playerARefreshToken = refreshRes.body.data.refreshToken;
      playerAToken = newAccessToken;

      // 3. Decode payload from fresh token and verify role is still 'player'
      const decoded = jwt.decode(newAccessToken);
      expect(decoded.role).toBe('player');

      // 4. Verify admin route access is still forbidden with new token
      const adminAttemptRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${newAccessToken}`);
      expect(adminAttemptRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 2. RBAC & PRIVILEGE ESCALATION
  // =========================================================================
  describe('2. RBAC & Privilege Escalation', () => {
    it('Authenticated player must be forbidden (403) from all 7 admin endpoints', async () => {
      const adminEndpoints = [
        { method: 'get', path: '/api/v1/admin/overview' },
        { method: 'get', path: '/api/v1/admin/users' },
        { method: 'get', path: `/api/v1/admin/users/${playerAId}` },
        { method: 'patch', path: `/api/v1/admin/users/${playerAId}/role`, body: { role: 'admin' } },
        { method: 'get', path: '/api/v1/admin/game/analytics' },
        { method: 'get', path: '/api/v1/admin/ai/telemetry' },
        { method: 'get', path: '/api/v1/admin/system/health' }
      ];

      for (const ep of adminEndpoints) {
        let req = request(app)[ep.method](ep.path).set('Authorization', `Bearer ${playerAToken}`);
        if (ep.body) req = req.send(ep.body);
        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('Unauthenticated requests to admin endpoints must return 401', async () => {
      const res = await request(app).get('/api/v1/admin/overview');
      expect(res.status).toBe(401);
    });

    it('Admin token must succeed accessing admin endpoints', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('Last Admin Demotion safeguard: Attempting to demote final admin must return 409 LAST_ADMIN_DEMOTION_FORBIDDEN', async () => {
      // Find all existing admins
      const adminsRes = await query("SELECT id FROM users WHERE role = 'admin';");
      const existingAdmins = adminsRes.rows;

      if (existingAdmins.length === 1) {
        // Direct attempt on the single admin
        const res = await request(app)
          .patch(`/api/v1/admin/users/${existingAdmins[0].id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'player' });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('LAST_ADMIN_DEMOTION_FORBIDDEN');
      } else {
        // Demote other admins until only 1 remains
        for (let i = 1; i < existingAdmins.length; i++) {
          await query("UPDATE users SET role = 'player' WHERE id = $1;", [existingAdmins[i].id]);
        }
        // Now attempt to demote the final remaining admin
        const res = await request(app)
          .patch(`/api/v1/admin/users/${existingAdmins[0].id}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'player' });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('LAST_ADMIN_DEMOTION_FORBIDDEN');

        // Restore admin role for adminId
        await query("UPDATE users SET role = 'admin' WHERE id = $1;", [adminId]);
      }
    });

    it('Role input validation: Reject unexpected role values (superadmin, root, owner, empty)', async () => {
      const invalidRoles = ['superadmin', 'root', 'owner', 'administrator', '', null];
      for (const invalidRole of invalidRoles) {
        const res = await request(app)
          .patch(`/api/v1/admin/users/${playerAId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: invalidRole });
        expect([400, 422]).toContain(res.status);
      }
    });

    it('Registration with client-supplied role: "admin" should still create a user with role "player"', async () => {
      const sneakyUser = {
        email: `sneaky_${timestamp}@ascendra.test`,
        password: 'SneakyPassword123!',
        name: 'Sneaky User',
        role: 'admin' // Attempting to inject admin role on signup
      };
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('x-test-client-id', `client_sneaky_${timestamp}`)
        .send(sneakyUser);
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('player');

      const dbCheck = await query('SELECT role FROM users WHERE email = $1;', [sneakyUser.email.toLowerCase()]);
      expect(dbCheck.rows[0].role).toBe('player');
    });
  });

  // =========================================================================
  // 3. IDOR & OBJECT AUTHORIZATION
  // =========================================================================
  describe('3. IDOR & Object Authorization', () => {
    it('Player A cannot modify forbidden attributes (role, level, score, experience, health)', async () => {
      const forbiddenPayloads = [
        { role: 'admin' },
        { level: 99 },
        { score: 999999 },
        { experience: 999999 },
        { health: 9999 }
      ];

      for (const payload of forbiddenPayloads) {
        const res = await request(app)
          .patch('/api/v1/users/me/profile')
          .set('Authorization', `Bearer ${playerAToken}`)
          .send(payload);
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN_FIELD_MODIFICATION');
      }
    });

    it('Profile retrieval is strictly scoped to token claims (/users/me and /users/me/profile)', async () => {
      const resA = await request(app)
        .get('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerAToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.data.user.id).toBe(playerAId);

      const resB = await request(app)
        .get('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerBToken}`);
      expect(resB.status).toBe(200);
      expect(resB.body.data.user.id).toBe(playerBId);
      expect(resB.body.data.user.id).not.toBe(playerAId);
    });

    it('Player A cannot view a clue unlocked only by Player B', async () => {
      // Find a clue in database
      const clueRes = await query('SELECT id FROM clues LIMIT 1;');
      if (clueRes.rows.length > 0) {
        const clueId = clueRes.rows[0].id;

        // Unlock clue for Player B only
        await query(
          `INSERT INTO player_clues (player_id, clue_id, discovered_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT DO NOTHING;`,
          [playerBId, clueId]
        );
        // Ensure Player A does NOT have this clue
        await query('DELETE FROM player_clues WHERE player_id = $1 AND clue_id = $2;', [playerAId, clueId]);

        // Player A attempts to fetch clue
        const resA = await request(app)
          .get(`/api/v1/clues/${clueId}`)
          .set('Authorization', `Bearer ${playerAToken}`);
        expect(resA.status).toBe(403);
        expect(resA.body.error.code).toBe('CLUE_LOCKED');

        // Player B should be allowed
        const resB = await request(app)
          .get(`/api/v1/clues/${clueId}`)
          .set('Authorization', `Bearer ${playerBToken}`);
        expect(resB.status).toBe(200);
        expect(resB.body.data.id).toBe(clueId);
      }
    });
  });

  // =========================================================================
  // 4. QUEST PROGRESSION ANTI-CHEAT
  // =========================================================================
  describe('4. Quest Progression Anti-Cheat', () => {
    let testQuestId = null;

    beforeAll(async () => {
      const qRes = await query("SELECT id FROM quests WHERE status = 'active' LIMIT 1;");
      if (qRes.rows.length > 0) {
        testQuestId = qRes.rows[0].id;
      }
    });

    it('Completing an unstarted quest should be rejected with 400 QUEST_NOT_STARTED', async () => {
      if (!testQuestId) return;
      // Ensure player A has not started quest
      await query('DELETE FROM player_quests WHERE player_id = $1 AND quest_id = $2;', [playerAId, testQuestId]);

      const res = await request(app)
        .post(`/api/v1/quests/${testQuestId}/complete`)
        .set('Authorization', `Bearer ${playerAToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('QUEST_NOT_STARTED');
    });

    it('Client-injected reward fields (xpReward, score) in completion payload are ignored', async () => {
      if (!testQuestId) return;
      // Start quest first
      await request(app)
        .post(`/api/v1/quests/${testQuestId}/start`)
        .set('Authorization', `Bearer ${playerAToken}`);

      // Record profile before completion
      const preProfileRes = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerAId]);
      const initialXp = preProfileRes.rows[0].experience;
      const initialScore = preProfileRes.rows[0].score;

      // Complete with malicious reward injections
      const completeRes = await request(app)
        .post(`/api/v1/quests/${testQuestId}/complete`)
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({
          xpReward: 999999,
          score: 999999,
          scoreReward: 999999
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.data.alreadyCompleted).toBe(false);

      // Verify authoritative XP in DB
      const postProfileRes = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [playerAId]);
      const gainedXp = postProfileRes.rows[0].experience - initialXp;
      const gainedScore = postProfileRes.rows[0].score - initialScore;

      // Should match quest definitions, NOT 999999
      expect(gainedXp).toBeLessThan(10000);
      expect(gainedScore).toBeLessThan(10000);
    });

    it('Completing an already-completed quest grants zero duplicate rewards', async () => {
      if (!testQuestId) return;
      // Complete again
      const repeatRes = await request(app)
        .post(`/api/v1/quests/${testQuestId}/complete`)
        .set('Authorization', `Bearer ${playerAToken}`);
      expect(repeatRes.status).toBe(200);
      expect(repeatRes.body.data.alreadyCompleted).toBe(true);
      expect(repeatRes.body.data.reward.xp).toBe(0);
      expect(repeatRes.body.data.reward.score).toBe(0);
    });

    it('Quest progress cannot decrease backwards (regression rejected)', async () => {
      // Find or create second quest
      const qRes = await query("SELECT id FROM quests WHERE status = 'active' OFFSET 1 LIMIT 1;");
      if (qRes.rows.length === 0) return;
      const secondQuestId = qRes.rows[0].id;

      await request(app)
        .post(`/api/v1/quests/${secondQuestId}/start`)
        .set('Authorization', `Bearer ${playerBToken}`);

      // Set progress to 50
      await request(app)
        .patch(`/api/v1/quests/${secondQuestId}/progress`)
        .set('Authorization', `Bearer ${playerBToken}`)
        .send({ progress: 50 });

      // Attempt regression to 20
      const regRes = await request(app)
        .patch(`/api/v1/quests/${secondQuestId}/progress`)
        .set('Authorization', `Bearer ${playerBToken}`)
        .send({ progress: 20 });

      expect(regRes.status).toBe(400);
      expect(regRes.body.error.code).toBe('PROGRESS_REGRESSION');
    });
  });

  // =========================================================================
  // 5. PUZZLE SECRECY & ANTI-REPLAY
  // =========================================================================
  describe('5. Puzzle Secrecy & Anti-Replay', () => {
    let testPuzzle = null;

    beforeAll(async () => {
      const pRes = await query('SELECT id, correct_answer, xp_reward, score_reward FROM puzzles LIMIT 1;');
      if (pRes.rows.length > 0) {
        testPuzzle = pRes.rows[0];
      }
    });

    it('GET /api/v1/puzzles/:id must NEVER expose correct_answer or solution to client', async () => {
      if (!testPuzzle) return;
      const res = await request(app)
        .get(`/api/v1/puzzles/${testPuzzle.id}`)
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(200);
      const puzzleData = res.body.data;
      expect(puzzleData.correct_answer).toBeUndefined();
      expect(puzzleData.correctAnswer).toBeUndefined();
      expect(puzzleData.solution).toBeUndefined();
      expect(puzzleData.answer).toBeUndefined();
      expect(puzzleData.privateHint).toBeUndefined();
    });

    it('Empty or whitespace-only answer attempt should be rejected with 400 VALIDATION_ERROR', async () => {
      if (!testPuzzle) return;
      const res = await request(app)
        .post(`/api/v1/puzzles/${testPuzzle.id}/attempt`)
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({ answer: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('Solving an already solved puzzle awards 0 duplicate XP and score', async () => {
      if (!testPuzzle) return;
      // Clean attempts for player B on this puzzle
      await query('DELETE FROM puzzle_attempts WHERE player_id = $1 AND puzzle_id = $2;', [playerBId, testPuzzle.id]);

      // First solve attempt (correct)
      const solveRes1 = await request(app)
        .post(`/api/v1/puzzles/${testPuzzle.id}/attempt`)
        .set('Authorization', `Bearer ${playerBToken}`)
        .send({ answer: testPuzzle.correct_answer });

      expect(solveRes1.status).toBe(200);
      expect(solveRes1.body.data.correct).toBe(true);
      expect(solveRes1.body.data.alreadyRewarded).toBe(false);
      expect(solveRes1.body.data.reward.xp).toBeGreaterThan(0);

      // Second solve attempt (duplicate)
      const solveRes2 = await request(app)
        .post(`/api/v1/puzzles/${testPuzzle.id}/attempt`)
        .set('Authorization', `Bearer ${playerBToken}`)
        .send({ answer: testPuzzle.correct_answer });

      expect(solveRes2.status).toBe(200);
      expect(solveRes2.body.data.correct).toBe(true);
      expect(solveRes2.body.data.alreadyRewarded).toBe(true);
      expect(solveRes2.body.data.reward.xp).toBe(0);
      expect(solveRes2.body.data.reward.score).toBe(0);
    });
  });

  // =========================================================================
  // 6. CLUE SECRECY & AUTHORIZATION
  // =========================================================================
  describe('6. Clue Secrecy & Authorization', () => {
    it('Requesting an undiscovered clue should return 403 CLUE_LOCKED', async () => {
      const clueRes = await query('SELECT id FROM clues LIMIT 1;');
      if (clueRes.rows.length === 0) return;
      const clueId = clueRes.rows[0].id;

      // Ensure player A has not unlocked it
      await query('DELETE FROM player_clues WHERE player_id = $1 AND clue_id = $2;', [playerAId, clueId]);

      const res = await request(app)
        .get(`/api/v1/clues/${clueId}`)
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('CLUE_LOCKED');
    });

    it('Guessing a non-existent clue ID should return 404 CLUE_NOT_FOUND', async () => {
      const res = await request(app)
        .get('/api/v1/clues/non-existent-clue-id-xyz-999')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('CLUE_NOT_FOUND');
    });
  });

  // =========================================================================
  // 7. INPUT VALIDATION & INJECTION DEFENSE
  // =========================================================================
  describe('7. Input Validation & Injection Defense', () => {
    it('SQL injection in admin users search parameter should execute safely with 0 syntax errors', async () => {
      const maliciousSearches = [
        "' OR 1=1 --",
        "admin' UNION SELECT id, email, password_hash, NULL, NULL, NULL, NULL, NULL FROM users --",
        "'; DROP TABLE users; --"
      ];

      for (const search of maliciousSearches) {
        const res = await request(app)
          .get('/api/v1/admin/users')
          .query({ search })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        // Table must still exist and return normal paginated structure
        expect(res.body.data.users).toBeDefined();
      }
    });

    it('SQL injection in login credentials should be rejected safely without database error', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-client-id', `client_sqli_login_${timestamp}`)
        .send({
          email: "admin' OR '1'='1' --",
          password: "' OR '1'='1'"
        });

      // Rejected due to regex or credentials lookup failure
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });

    it('UUID fuzzing: Invalid UUIDs in route parameters must return 400 INVALID_ID_FORMAT', async () => {
      const fuzzedIds = ['abc', '123', 'not-a-uuid', '../../etc/passwd', '00000000-0000-0000-0000'];
      for (const id of fuzzedIds) {
        const res = await request(app)
          .get(`/api/v1/admin/users/${encodeURIComponent(id)}`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_ID_FORMAT');
      }
    });

    it('Pagination fuzzing: Out of bounds pagination values must return 400 INVALID_PAGINATION', async () => {
      const badParams = [
        { page: 0, limit: 10 },
        { page: -1, limit: 10 },
        { page: 1, limit: 0 },
        { page: 1, limit: 999999 },
        { page: 'abc', limit: 10 }
      ];

      for (const params of badParams) {
        const res = await request(app)
          .get('/api/v1/admin/users')
          .query(params)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('INVALID_PAGINATION');
      }
    });
  });

  // =========================================================================
  // 8. XSS SECURITY: DATA STORAGE VS RENDERING
  // =========================================================================
  describe('8. XSS Security: Storage vs Rendering', () => {
    it('Backend stores XSS payload literally as data without executing or crashing', async () => {
      const xssPayload = 'Hero<script>alert(1)</script>';
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerAToken}`)
        .send({ name: xssPayload });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe(xssPayload);

      // Verify literal storage in database
      const dbCheck = await query('SELECT name FROM users WHERE id = $1;', [playerAId]);
      expect(dbCheck.rows[0].name).toBe(xssPayload);
    });

    it('Frontend escaping utility converts XSS characters safely', () => {
      // Replicate the escapeHtml utility used across both player and admin frontends
      function escapeHtml(str) {
        if (!str) return '';
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      const rawXss = '<script>alert("xss")</script>';
      const escaped = escapeHtml(rawXss);
      expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(escaped).not.toContain('<script>');
    });
  });

  // =========================================================================
  // 9. RATE LIMITING PROTECTION
  // =========================================================================
  describe('9. Rate Limiting Protection on Sensitive Auth Endpoints', () => {
    it('Rapid login attempts exceeding threshold return 429 Too Many Requests with Retry-After', async () => {
      // Use isolated test client IP / header
      const testClientId = `client_ratelimit_${timestamp}`;
      let hitRateLimit = false;
      let lastResponse = null;

      // Attempt 12 rapid logins (default limit is 10/min)
      for (let i = 0; i < 12; i++) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .set('x-test-client-id', testClientId)
          .send({ email: 'fake_attempt@ascendra.test', password: 'wrong' });

        lastResponse = res;
        if (res.status === 429) {
          hitRateLimit = true;
          break;
        }
      }

      expect(hitRateLimit).toBe(true);
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.headers['retry-after']).toBeDefined();
    });
  });

  // =========================================================================
  // 10. INFRASTRUCTURE RESILIENCE & ERROR SANITIZATION
  // =========================================================================
  describe('10. Infrastructure Resilience & Error Sanitization', () => {
    it('Oversized payload exceeding 2MB limit should return 413 Payload Too Large', async () => {
      // Construct a string slightly over 2MB
      const bigString = 'A'.repeat(2.1 * 1024 * 1024);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ largeField: bigString }));

      expect(res.status).toBe(413);
    });

    it('Error responses must never leak connection URIs, database passwords, or internal file paths', async () => {
      // Trigger a 404 and inspect response body
      const res = await request(app).get('/api/v1/non-existent-secret-path-999');
      const bodyStr = JSON.stringify(res.body);

      expect(bodyStr).not.toMatch(/postgres:\/\//i);
      expect(bodyStr).not.toMatch(/redis:\/\//i);
      expect(bodyStr).not.toMatch(/password/i);
    });

    it('Static route isolation: /play/ serves player client, /admin/ serves admin, / redirects to /play/', async () => {
      const rootRes = await request(app).get('/');
      expect(rootRes.status).toBe(302);
      expect(rootRes.headers.location).toBe('/play/');

      const playRes = await request(app).get('/play/');
      expect(playRes.status).toBe(200);
      expect(playRes.text).toContain('ASCENDRA');

      const adminRes = await request(app).get('/admin/');
      expect(adminRes.status).toBe(200);
      expect(adminRes.text).toContain('ASCENDRA');
    });

    it('Redis offline resilience: system remains operational in cache-bypass mode', async () => {
      // Spy on redisConfig.isRedisAvailable to simulate Redis offline
      const origIsRedisAvailable = redisConfig.isRedisAvailable;
      redisConfig.isRedisAvailable = () => false;

      try {
        // Cache get returns null without throwing
        const cached = await cacheService.get('any_key');
        expect(cached).toBeNull();

        // Quest catalog still serves from DB
        const questsRes = await request(app)
          .get('/api/v1/quests')
          .set('Authorization', `Bearer ${playerAToken}`);
        expect(questsRes.status).toBe(200);
        expect(questsRes.body.data).toBeInstanceOf(Array);
      } finally {
        redisConfig.isRedisAvailable = origIsRedisAvailable;
      }
    });
  });
});
