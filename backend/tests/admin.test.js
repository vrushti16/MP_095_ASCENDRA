const request = require('supertest');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const { generateAccessToken } = require('../src/config/jwt');
const redisConfig = require('../src/config/redis');
const aiService = require('../src/services/aiService');

describe('Admin Backend API Suite (/api/v1/admin)', () => {
  const timestamp = Date.now();
  const testAdminUser = {
    id: 'a0000000-0000-4000-a000-000000000001',
    email: `admin_${timestamp}@ascendra.test`,
    name: 'Admin Supervisor',
    role: 'admin'
  };

  const testPlayerUser = {
    id: 'b0000000-0000-4000-b000-000000000002',
    email: `player_${timestamp}@ascendra.test`,
    name: 'Player Explorer',
    role: 'player'
  };

  const testSecondaryAdmin = {
    id: 'a0000000-0000-4000-a000-000000000002',
    email: `admin2_${timestamp}@ascendra.test`,
    name: 'Secondary Admin',
    role: 'admin'
  };

  let adminToken;
  let playerToken;
  let secondaryAdminToken;

  beforeAll(async () => {
    // Generate valid tokens
    adminToken = generateAccessToken(testAdminUser);
    playerToken = generateAccessToken(testPlayerUser);
    secondaryAdminToken = generateAccessToken(testSecondaryAdmin);

    // Insert test users into database
    await query(
      `INSERT INTO users (id, email, name, role)
       VALUES ($1, $2, $3, $4), ($5, $6, $7, $8), ($9, $10, $11, $12)
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;`,
      [
        testAdminUser.id, testAdminUser.email, testAdminUser.name, testAdminUser.role,
        testPlayerUser.id, testPlayerUser.email, testPlayerUser.name, testPlayerUser.role,
        testSecondaryAdmin.id, testSecondaryAdmin.email, testSecondaryAdmin.name, testSecondaryAdmin.role
      ]
    );

    // Insert linked player profile for test player
    await query(
      `INSERT INTO player_profiles (user_id, level, experience, score)
       VALUES ($1, 5, 250, 500)
       ON CONFLICT (user_id) DO NOTHING;`,
      [testPlayerUser.id]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await pool.end();
  });

  // ===========================================================================
  // 1. Authentication & Role Authorization Enforcement
  // ===========================================================================
  describe('Authentication & Role Authorization Security', () => {
    it('should reject unauthenticated request with 401 Missing Token', async () => {
      const res = await request(app).get('/api/v1/admin/overview');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject malformed Bearer header with 401 Malformed Token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', 'Basic 12345');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('MALFORMED_TOKEN');
    });

    it('should reject invalid token signature with 401 Invalid Token', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', 'Bearer invalid.token.payload');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject authenticated player with 403 Forbidden across all admin routes', async () => {
      const endpoints = [
        { method: 'get', path: '/api/v1/admin/overview' },
        { method: 'get', path: '/api/v1/admin/users' },
        { method: 'get', path: `/api/v1/admin/users/${testPlayerUser.id}` },
        { method: 'patch', path: `/api/v1/admin/users/${testPlayerUser.id}/role`, body: { role: 'admin' } },
        { method: 'get', path: '/api/v1/admin/game/analytics' },
        { method: 'get', path: '/api/v1/admin/ai/telemetry' },
        { method: 'get', path: '/api/v1/admin/system/health' }
      ];

      for (const ep of endpoints) {
        const req = request(app)[ep.method](ep.path).set('Authorization', `Bearer ${playerToken}`);
        if (ep.body) req.send(ep.body);

        const res = await req;
        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('FORBIDDEN');
      }
    });
  });

  // ===========================================================================
  // 2. GET /api/v1/admin/overview
  // ===========================================================================
  describe('GET /api/v1/admin/overview', () => {
    it('should return 200 with platform metrics when authenticated as admin', async () => {
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data.users).toHaveProperty('total');
      expect(res.body.data.users).toHaveProperty('players');
      expect(res.body.data.users).toHaveProperty('admins');
      expect(res.body.data).toHaveProperty('quests');
      expect(res.body.data).toHaveProperty('puzzles');
      expect(res.body.data).toHaveProperty('progression');
      expect(res.body.data).toHaveProperty('systemHealth');
    });
  });

  // ===========================================================================
  // 3. GET /api/v1/admin/users (Search, Pagination, Role Filtering)
  // ===========================================================================
  describe('GET /api/v1/admin/users', () => {
    it('should return paginated list of users with safe fields', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.users)).toBe(true);
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
      expect(typeof res.body.data.pagination.total).toBe('number');

      // Security check: Verify sensitive columns are never returned
      if (res.body.data.users.length > 0) {
        const sampleUser = res.body.data.users[0];
        expect(sampleUser).toHaveProperty('id');
        expect(sampleUser).toHaveProperty('email');
        expect(sampleUser).toHaveProperty('role');
        expect(sampleUser.password_hash).toBeUndefined();
        expect(sampleUser.password).toBeUndefined();
        expect(sampleUser.refreshToken).toBeUndefined();
      }
    });

    it('should filter users by search query (name or email)', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users?search=${encodeURIComponent(testPlayerUser.name)}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.some(u => u.id === testPlayerUser.id)).toBe(true);
    });

    it('should filter users by role parameter', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users.every(u => u.role === 'admin')).toBe(true);
    });

    it('should reject invalid page parameter with 400', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?page=-1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAGINATION');
    });

    it('should reject excessive limit parameter with 400', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?limit=99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PAGINATION');
    });

    it('should reject invalid role parameter with 400', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users?role=superadmin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ROLE_FILTER');
    });
  });

  // ===========================================================================
  // 4. GET /api/v1/admin/users/:id
  // ===========================================================================
  describe('GET /api/v1/admin/users/:id', () => {
    it('should return deep administrative user profile for valid ID', async () => {
      const res = await request(app)
        .get(`/api/v1/admin/users/${testPlayerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(testPlayerUser.id);
      expect(res.body.data.user.email).toBe(testPlayerUser.email);
      expect(res.body.data).toHaveProperty('profile');
      expect(res.body.data).toHaveProperty('quests');
      expect(res.body.data).toHaveProperty('recentPuzzleAttempts');
      expect(res.body.data).toHaveProperty('discoveredClues');
      expect(res.body.data).toHaveProperty('recentSessions');

      // Security check
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should reject invalid UUID format with 400', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/not-a-valid-uuid-123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ID_FORMAT');
    });

    it('should return 404 for nonexistent UUID', async () => {
      const res = await request(app)
        .get('/api/v1/admin/users/00000000-0000-4000-a000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  // ===========================================================================
  // 5. PATCH /api/v1/admin/users/:id/role
  // ===========================================================================
  describe('PATCH /api/v1/admin/users/:id/role', () => {
    it('should successfully promote player to admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testPlayerUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('admin');

      // Revert back to player
      await request(app)
        .patch(`/api/v1/admin/users/${testPlayerUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'player' });
    });

    it('should reject request missing role field with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testPlayerUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_ROLE');
    });

    it('should reject invalid role value with 400', async () => {
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testPlayerUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'moderator' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ROLE');
    });

    it('should prevent demoting the last remaining administrator with 409 Conflict', async () => {
      // First ensure only one admin exists by demoting all other admins
      await query("UPDATE users SET role = 'player' WHERE role = 'admin' AND id != $1;", [testAdminUser.id]);

      // Attempt to demote the sole remaining admin
      const res = await request(app)
        .patch(`/api/v1/admin/users/${testAdminUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'player' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_ADMIN_DEMOTION_FORBIDDEN');
      expect(res.body.error.message).toContain('Cannot demote the last remaining administrator');

      // Restore secondary admin and seeded admin
      await query("UPDATE users SET role = 'admin' WHERE id = $1;", [testSecondaryAdmin.id]);
      await query("UPDATE users SET role = 'admin' WHERE email = 'admin@ascendra.edu';");
    });
  });

  // ===========================================================================
  // 6. GET /api/v1/admin/game/analytics
  // ===========================================================================
  describe('GET /api/v1/admin/game/analytics', () => {
    it('should return 200 with quest completion rates, puzzle accuracy, and topic breakdown', async () => {
      const res = await request(app)
        .get('/api/v1/admin/game/analytics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('quests');
      expect(res.body.data.quests).toHaveProperty('completionRate');
      expect(res.body.data).toHaveProperty('puzzles');
      expect(res.body.data.puzzles).toHaveProperty('accuracyRate');
      expect(Array.isArray(res.body.data.puzzles.topicBreakdown)).toBe(true);
      expect(res.body.data).toHaveProperty('progression');
      expect(Array.isArray(res.body.data.progression.levelDistribution)).toBe(true);
    });
  });

  // ===========================================================================
  // 7. GET /api/v1/admin/ai/telemetry
  // ===========================================================================
  describe('GET /api/v1/admin/ai/telemetry', () => {
    it('should return 200 with telemetry summary and request logs', async () => {
      // Record a test telemetry event
      await aiService.recordAiTelemetry({
        questId: 'quest_test',
        topic: 'cloud_computing',
        difficulty: 'medium',
        status: 'success',
        latencyMs: 145,
        isFallback: false
      });

      const res = await request(app)
        .get('/api/v1/admin/ai/telemetry')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('summary');
      expect(res.body.data.summary).toHaveProperty('totalRequests');
      expect(res.body.data.summary).toHaveProperty('successfulRequests');
      expect(res.body.data.summary).toHaveProperty('averageLatencyMs');
      expect(Array.isArray(res.body.data.recentRequests)).toBe(true);
    });
  });

  // ===========================================================================
  // 8. GET /api/v1/admin/system/health
  // ===========================================================================
  describe('GET /api/v1/admin/system/health', () => {
    it('should return 200 with deep multi-service status probe', async () => {
      const res = await request(app)
        .get('/api/v1/admin/system/health')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('dependencies');
      expect(res.body.data.dependencies).toHaveProperty('postgresql');
      expect(res.body.data.dependencies).toHaveProperty('redis');
      expect(res.body.data.dependencies).toHaveProperty('fastapi');

      // Security check: Verify no DB connection string or secrets are leaked
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('postgres://');
      expect(bodyStr).not.toContain('redis://');
      expect(bodyStr).not.toContain('password');
    });
  });

  // ===========================================================================
  // 9. Admin Dashboard Static Assets Serving
  // ===========================================================================
  describe('Admin Dashboard Static Files (/admin)', () => {
    it('should serve admin dashboard index.html at /admin/', async () => {
      const res = await request(app).get('/admin/');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('ASCENDRA — Admin Console');
      expect(res.text).toContain('js/api.js');
    });

    it('should serve admin.css stylesheet with light theme tokens', async () => {
      const res = await request(app).get('/admin/css/admin.css');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/css/);
      expect(res.text).toContain('#f8fafc');
      expect(res.text).toContain('#4f46e5');
    });

    it('should serve admin client JavaScript modules', async () => {
      const res = await request(app).get('/admin/js/api.js');
      expect(res.status).toBe(200);
      expect(res.header['content-type']).toMatch(/javascript/);
      expect(res.text).toContain('ApiClient');
    });
  });
});

