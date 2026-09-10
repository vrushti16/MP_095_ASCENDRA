const request = require('supertest');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');

describe('User & Profile API (/api/v1/users)', () => {
  const timestamp = Date.now();
  let playerToken = null;
  let playerId = null;
  const testUser = {
    email: `player_profile_${timestamp}@ascendra.test`,
    password: 'ProfilePassword123!',
    name: 'Brave Explorer'
  };

  beforeAll(async () => {
    // Register player
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    playerId = regRes.body.data.user.id;
    playerToken = regRes.body.data.accessToken;
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await pool.end();
  });

  describe('1. GET /api/v1/users/me', () => {
    it('should return the authenticated user safe profile details', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(playerId);
      expect(res.body.data.email).toBe(testUser.email.toLowerCase());
      expect(res.body.data.name).toBe(testUser.name);
      expect(res.body.data.role).toBe('player');
      // Verify sensitive fields are omitted
      expect(res.body.data.password_hash).toBeUndefined();
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject unauthenticated request without token', async () => {
      const res = await request(app).get('/api/v1/users/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject request with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('2. GET /api/v1/users/me/profile', () => {
    it('should return combined user identity and game profile stats', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.id).toBe(playerId);
      expect(res.body.data.profile).toBeDefined();
      expect(res.body.data.profile.level).toBe(1);
      expect(res.body.data.profile.experience).toBe(0);
      expect(res.body.data.profile.score).toBe(0);
      expect(res.body.data.profile.health).toBe(100);
      expect(res.body.data.profile.maxHealth).toBe(100);
    });
  });

  describe('3. PATCH /api/v1/users/me/profile (Profile Updates & Anti-Cheat)', () => {
    it('should successfully update safe profile fields (name and avatarUrl)', async () => {
      const updateData = {
        name: 'Ascended Hero',
        avatarUrl: 'https://ascendra.game/assets/hero.png'
      };

      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send(updateData);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe('Ascended Hero');
      expect(res.body.data.user.avatarUrl).toBe('https://ascendra.game/assets/hero.png');

      // Verify in database
      const dbCheck = await query('SELECT name, avatar_url FROM users WHERE id = $1;', [playerId]);
      expect(dbCheck.rows[0].name).toBe('Ascended Hero');
      expect(dbCheck.rows[0].avatar_url).toBe('https://ascendra.game/assets/hero.png');
    });

    it('should strictly reject client attempts to set level directly', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ level: 99 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_FIELD_MODIFICATION');
    });

    it('should strictly reject client attempts to set experience directly', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ experience: 10000 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_FIELD_MODIFICATION');
    });

    it('should strictly reject client attempts to set score directly', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ score: 5000 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_FIELD_MODIFICATION');
    });

    it('should strictly reject client attempts to set role to admin', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ role: 'admin' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_FIELD_MODIFICATION');
    });

    it('should reject update with invalid name format', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ name: 'x' }); // Too short

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject update with invalid avatar URL protocol', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me/profile')
        .set('Authorization', `Bearer ${playerToken}`)
        .send({ avatarUrl: 'javascript:alert(1)' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
