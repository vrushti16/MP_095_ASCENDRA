const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const { JWT_SECRET } = require('../src/config/jwt');
const authService = require('../src/services/authService');

describe('Authentication API (/api/v1/auth)', () => {
  const timestamp = Date.now();
  const testPlayer = {
    email: `player_${timestamp}@ascendra.test`,
    password: 'SuperPassword123!',
    name: 'Ascendra Hero'
  };

  const testAdmin = {
    email: `admin_${timestamp}@ascendra.test`,
    password: 'AdminPassword123!',
    name: 'Ascendra Admin'
  };

  let playerTokens = null;
  let adminTokens = null;
  let playerId = null;
  let adminId = null;

  afterAll(async () => {
    // Clean up created test users (cascades to player_profiles and refresh_tokens)
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await pool.end();
  });

  describe('1. Registration (POST /api/v1/auth/register)', () => {
    it('should successfully register a new player and create a linked profile', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testPlayer);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(testPlayer.email.toLowerCase());
      expect(res.body.data.user.role).toBe('player');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      playerId = res.body.data.user.id;
      playerTokens = {
        accessToken: res.body.data.accessToken,
        refreshToken: res.body.data.refreshToken
      };

      // Verify password is NOT stored as plaintext in PostgreSQL
      const dbUserRes = await query('SELECT password_hash FROM users WHERE id = $1;', [playerId]);
      expect(dbUserRes.rows[0].password_hash).not.toBe(testPlayer.password);
      expect(dbUserRes.rows[0].password_hash).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash pattern

      // Verify player_profile was created automatically
      const profileRes = await query('SELECT * FROM player_profiles WHERE user_id = $1;', [playerId]);
      expect(profileRes.rows.length).toBe(1);
      expect(profileRes.rows[0].level).toBe(1);
      expect(profileRes.rows[0].experience).toBe(0);
      expect(profileRes.rows[0].health).toBe(100);
    });

    it('should reject registration if email is already taken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testPlayer);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should reject registration with invalid email or weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: '123',
          name: 'Bad'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('2. Login (POST /api/v1/auth/login)', () => {
    it('should successfully authenticate registered user and update last_login', async () => {
      const beforeLogin = Date.now();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testPlayer.email,
          password: testPlayer.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.id).toBe(playerId);

      // Verify last_login in DB was updated
      const userRes = await query('SELECT last_login FROM users WHERE id = $1;', [playerId]);
      const lastLoginTime = new Date(userRes.rows[0].last_login).getTime();
      expect(lastLoginTime).toBeGreaterThanOrEqual(beforeLogin - 5000);
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testPlayer.email,
          password: 'WrongPassword!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@ascendra.test',
          password: 'Password123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should safely reject password login for Google-only accounts', async () => {
      // Create a Google-only account directly with no password_hash
      const googleUserRes = await query(
        `INSERT INTO users (google_id, email, name, role)
         VALUES ($1, $2, $3, 'player')
         RETURNING id;`,
        [`google_${timestamp}`, `google_only_${timestamp}@ascendra.test`, 'Google User']
      );

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `google_only_${timestamp}@ascendra.test`,
          password: 'AttemptPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('GOOGLE_ACCOUNT_LOGIN');
    });
  });

  describe('3. Google Authentication (POST /api/v1/auth/google)', () => {
    it('should authenticate a valid Google token, creating user and profile if new', async () => {
      const mockGooglePayload = {
        googleId: `google_sub_${timestamp}`,
        email: `google_user_${timestamp}@ascendra.test`,
        name: 'Google Explorer',
        avatarUrl: 'https://example.com/avatar.png'
      };

      // Mock verifyGoogleIdToken for unit test
      jest.spyOn(authService, 'verifyGoogleIdToken').mockResolvedValueOnce(mockGooglePayload);

      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: 'valid-mock-google-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(mockGooglePayload.email);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Verify user and profile exist in database
      const userCheck = await query('SELECT id FROM users WHERE google_id = $1;', [mockGooglePayload.googleId]);
      expect(userCheck.rows.length).toBe(1);

      const profileCheck = await query('SELECT * FROM player_profiles WHERE user_id = $1;', [userCheck.rows[0].id]);
      expect(profileCheck.rows.length).toBe(1);
    });

    it('should reject invalid or missing Google token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/google')
        .send({ idToken: '' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('4. JWT Authentication & Role Middleware', () => {
    beforeAll(async () => {
      // Register an admin user and get admin tokens
      const adminRes = await request(app)
        .post('/api/v1/auth/register')
        .send(testAdmin);

      adminId = adminRes.body.data.user.id;
      // Elevate role to admin directly in DB for testing
      await query("UPDATE users SET role = 'admin' WHERE id = $1;", [adminId]);

      // Re-login to get updated admin token
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testAdmin.email, password: testAdmin.password });

      adminTokens = {
        accessToken: loginRes.body.data.accessToken,
        refreshToken: loginRes.body.data.refreshToken
      };
    });

    it('should allow access to protected route with valid player JWT', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me-test')
        .set('Authorization', `Bearer ${playerTokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.id).toBe(playerId);
      expect(res.body.data.user.role).toBe('player');
    });

    it('should reject request with missing Authorization header', async () => {
      const res = await request(app).get('/api/v1/auth/me-test');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MISSING_TOKEN');
    });

    it('should reject malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me-test')
        .set('Authorization', 'Basic 12345');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MALFORMED_TOKEN');
    });

    it('should reject tampered or invalid JWT signature', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me-test')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired JWT token', async () => {
      // Create an already-expired token with JWT_SECRET
      const expiredToken = jwt.sign(
        { sub: playerId, role: 'player' },
        JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me-test')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EXPIRED_TOKEN');
    });

    it('should forbid non-admin player from accessing admin-protected route', async () => {
      const res = await request(app)
        .get('/api/v1/auth/admin-test')
        .set('Authorization', `Bearer ${playerTokens.accessToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('should permit admin to access admin-protected route', async () => {
      const res = await request(app)
        .get('/api/v1/auth/admin-test')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
    });
  });

  describe('5. Refresh Token Rotation & Revocation (POST /api/v1/auth/refresh & /logout)', () => {
    let currentRefreshToken = null;

    beforeAll(async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testPlayer.email, password: testPlayer.password });

      currentRefreshToken = loginRes.body.data.refreshToken;
    });

    it('should rotate valid refresh token and return a new token pair', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(currentRefreshToken);

      const oldToken = currentRefreshToken;
      currentRefreshToken = res.body.data.refreshToken;

      // Verify the OLD refresh token is now rejected (token rotation)
      const oldRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldToken });

      expect(oldRes.status).toBe(401);
      expect(oldRes.body.success).toBe(false);
      expect(oldRes.body.error.code).toBe('REVOKED_REFRESH_TOKEN');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'completely-bogus-token' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should revoke refresh token on logout', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: currentRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.loggedOut).toBe(true);

      // Attempting to refresh with the logged out token should fail
      const refreshAttempt = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: currentRefreshToken });

      expect(refreshAttempt.status).toBe(401);
      expect(refreshAttempt.body.error.code).toBe('REVOKED_REFRESH_TOKEN');
    });
  });
});
