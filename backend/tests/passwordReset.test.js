const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const { JWT_SECRET } = require('../src/config/jwt');
const emailService = require('../src/services/emailService');
const passwordResetService = require('../src/services/passwordResetService');
const {
  forgotPasswordRequestLimiter,
  forgotPasswordVerifyLimiter
} = require('../src/middleware/rateLimitMiddleware');

describe('Gmail Email OTP Password Reset Flow (/api/v1/auth/forgot-password)', () => {
  const timestamp = Date.now();
  const testUser = {
    email: `reset_player_${timestamp}@ascendra.test`,
    password: 'InitialPassword123!',
    name: 'Reset Explorer'
  };

  const googleUser = {
    googleId: `google_uid_${timestamp}`,
    email: `google_only_${timestamp}@ascendra.test`,
    name: 'Google Explorer'
  };

  let userId = null;
  let googleUserId = null;
  let userRefreshToken = null;

  beforeAll(async () => {
    // 1. Create standard email/password test user
    const regRes = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    userId = regRes.body.data.user.id;
    userRefreshToken = regRes.body.data.refreshToken;

    // 2. Create Google-only test user (password_hash IS NULL)
    const gRes = await query(
      `INSERT INTO users (google_id, email, name, role, last_login)
       VALUES ($1, $2, $3, 'player', NOW())
       RETURNING id;`,
      [googleUser.googleId, googleUser.email, googleUser.name]
    );
    googleUserId = gRes.rows[0].id;
  });

  beforeEach(async () => {
    emailService.clearTestEmails();
    await query("UPDATE password_reset_otps SET resend_available_at = NOW() - INTERVAL '1 minute' WHERE email = $1;", [testUser.email]);
    await forgotPasswordRequestLimiter.reset();
    await forgotPasswordVerifyLimiter.reset();
  });

  afterAll(async () => {
    // Clean up test data
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await pool.end();
  });

  describe('1. Request OTP (POST /api/v1/auth/forgot-password/request-otp)', () => {
    it('should return success message for registered email and send email with 5-digit OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('verification code has been sent');
      // Ensure OTP is NEVER returned in API response
      expect(res.body.otp).toBeUndefined();
      expect(res.body.data?.otp).toBeUndefined();

      // Verify email was dispatched with 5-digit OTP
      const sentEmails = emailService.getSentEmailsForTesting();
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].to).toBe(testUser.email);
      expect(sentEmails[0].otpCode).toMatch(/^\d{5}$/);

      // Verify database stored HMAC hash and NOT plaintext OTP
      const dbRes = await query(
        'SELECT otp_hash, expires_at, attempts FROM password_reset_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1;',
        [testUser.email]
      );
      expect(dbRes.rows.length).toBe(1);
      expect(dbRes.rows[0].otp_hash).not.toBe(sentEmails[0].otpCode);
      expect(dbRes.rows[0].otp_hash.length).toBe(64); // SHA-256 hex string
      expect(dbRes.rows[0].attempts).toBe(0);
    });

    it('should reject non-existent email with 404 ACCOUNT_NOT_FOUND without sending OTP email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: 'nonexistent_explorer_999@ascendra.test' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_FOUND');

      // No OTP email should be sent for non-existent account
      const sentEmails = emailService.getSentEmailsForTesting();
      expect(sentEmails.length).toBe(0);
    });

    it('should reject Google-only account with 400 GOOGLE_ACCOUNT without issuing OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: googleUser.email });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('GOOGLE_ACCOUNT');

      // No OTP record should be in database for Google user
      const dbRes = await query(
        'SELECT id FROM password_reset_otps WHERE email = $1;',
        [googleUser.email]
      );
      expect(dbRes.rows.length).toBe(0);
    });

    it('should reject non-Gmail addresses with 400 INVALID_GMAIL_DOMAIN', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: 'explorer@yahoo.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_GMAIL_DOMAIN');
    });

    it('should reject malformed or missing email addresses', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce 60-second resend cooldown for active requests', async () => {
      // Clear limiters to isolate cooldown check
      await forgotPasswordRequestLimiter.reset();

      // Request 1
      const res1 = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: testUser.email });
      expect(res1.status).toBe(200);

      // Immediate Request 2 should trigger cooldown error 429
      const res2 = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: testUser.email });

      expect(res2.status).toBe(429);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('COOLDOWN_ACTIVE');
    });
  });

  describe('2. Verify OTP (POST /api/v1/auth/forgot-password/verify-otp)', () => {
    let activeOtp = null;

    beforeEach(async () => {
      emailService.clearTestEmails();
      // Fast forward past cooldown by updating existing records
      await query("UPDATE password_reset_otps SET resend_available_at = NOW() - INTERVAL '1 minute' WHERE email = $1;", [testUser.email]);
      await forgotPasswordRequestLimiter.reset();
      await forgotPasswordVerifyLimiter.reset();

      await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: testUser.email });

      const sent = emailService.getSentEmailsForTesting();
      activeOtp = sent[0]?.otpCode;
    });

    it('should reject invalid or non-numeric OTP and increment attempts counter', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({
          email: testUser.email,
          otp: '00000' // wrong 5-digit OTP
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_OTP');
      expect(res.body.error.message).toContain('4 attempts remaining');

      // Verify attempts was incremented in database
      const dbRes = await query(
        'SELECT attempts FROM password_reset_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1;',
        [testUser.email]
      );
      expect(dbRes.rows[0].attempts).toBe(1);
    });

    it('should lock verification after 5 failed attempts', async () => {
      // Intentionally fail 5 times
      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/v1/auth/forgot-password/verify-otp')
          .send({ email: testUser.email, otp: '11111' });
      }

      // 5th attempt
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp: '11111' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');

      // Even providing the correct OTP now should be rejected
      const lockedRes = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp: activeOtp });

      expect(lockedRes.status).toBe(429);
      expect(lockedRes.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    });

    it('should reject expired OTP (>10 minutes)', async () => {
      // Simulate expired OTP by rewinding expires_at in DB
      await query(
        "UPDATE password_reset_otps SET expires_at = NOW() - INTERVAL '1 second' WHERE email = $1;",
        [testUser.email]
      );

      const res = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp: activeOtp });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('OTP_EXPIRED');
    });

    it('should successfully verify correct OTP and return a scoped resetToken', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({
          email: testUser.email,
          otp: activeOtp
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resetToken).toBeDefined();

      // Verify OTP record marked verified
      const dbRes = await query(
        'SELECT verified_at FROM password_reset_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1;',
        [testUser.email]
      );
      expect(dbRes.rows[0].verified_at).not.toBeNull();
    });

    it('should prevent OTP from being verified twice (single-use)', async () => {
      // First verification succeeds
      const res1 = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp: activeOtp });
      expect(res1.status).toBe(200);

      // Second verification of same OTP must fail
      const res2 = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp: activeOtp });
      expect(res2.status).toBe(400);
      expect(res2.body.error.code).toBe('OTP_ALREADY_USED');
    });
  });

  describe('3. Scoped Reset Token Security', () => {
    let validResetToken = null;

    beforeAll(async () => {
      emailService.clearTestEmails();
      await query("UPDATE password_reset_otps SET resend_available_at = NOW() - INTERVAL '1 minute' WHERE email = $1;", [testUser.email]);
      await forgotPasswordRequestLimiter.reset();
      await forgotPasswordVerifyLimiter.reset();

      await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: testUser.email });

      const otp = emailService.getSentEmailsForTesting()[0].otpCode;
      const verifyRes = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp });

      validResetToken = verifyRes.body.resetToken;
    });

    it('should reject reset token when presented at normal authenticated endpoints', async () => {
      // Presenting password reset token as Bearer token to normal game endpoint must fail
      const res = await request(app)
        .get('/api/v1/auth/me-test')
        .set('Authorization', `Bearer ${validResetToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('4. Reset Password (POST /api/v1/auth/forgot-password/reset)', () => {
    let currentResetToken = null;
    const newPassword = 'NewlyChangedPassword999!';

    beforeEach(async () => {
      emailService.clearTestEmails();
      await query("UPDATE password_reset_otps SET resend_available_at = NOW() - INTERVAL '1 minute' WHERE email = $1;", [testUser.email]);
      await forgotPasswordRequestLimiter.reset();
      await forgotPasswordVerifyLimiter.reset();

      await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .send({ email: testUser.email });

      const otp = emailService.getSentEmailsForTesting()[0].otpCode;
      const verifyRes = await request(app)
        .post('/api/v1/auth/forgot-password/verify-otp')
        .send({ email: testUser.email, otp });

      currentResetToken = verifyRes.body.resetToken;
    });

    it('should reject password mismatch', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/reset')
        .send({
          resetToken: currentResetToken,
          newPassword: 'ValidPassword123!',
          confirmPassword: 'DifferentPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PASSWORD_MISMATCH');
    });

    it('should reject weak password (< 6 chars)', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/reset')
        .send({
          resetToken: currentResetToken,
          newPassword: '123',
          confirmPassword: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('should successfully reset password, update hash, invalidate refresh tokens, and accept login with new password', async () => {
      // 1. Reset password
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/reset')
        .send({
          resetToken: currentResetToken,
          newPassword,
          confirmPassword: newPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password reset successfully. Please sign in again.');

      // 2. Old password should NO LONGER work
      const oldLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      expect(oldLoginRes.status).toBe(401);

      // 3. New password MUST work
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: newPassword
        });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
      expect(newLoginRes.body.data.accessToken).toBeDefined();

      // 4. Existing refresh token should be revoked (Security Requirement 26)
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: userRefreshToken });
      expect(refreshRes.status).toBe(401);
      expect(refreshRes.body.error.code).toBe('REVOKED_REFRESH_TOKEN');

      // 5. Consumed reset token cannot be reused
      const reuseRes = await request(app)
        .post('/api/v1/auth/forgot-password/reset')
        .send({
          resetToken: currentResetToken,
          newPassword: 'AnotherPassword!',
          confirmPassword: 'AnotherPassword!'
        });
      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('RESET_TOKEN_ALREADY_USED');
    });
  });

  describe('5. Rate Limiting & Email Delivery Failure Handling', () => {
    it('should trigger rate limit 429 when request-otp is called more than 5 times within window', async () => {
      await forgotPasswordRequestLimiter.reset();

      // Send 5 valid requests with test isolation headers
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/forgot-password/request-otp')
          .set('x-test-client-id', 'test-rl-client')
          .send({ email: `rate_limit_user_${i}@ascendra.test` });
      }

      // 6th request triggers rate limit
      const res = await request(app)
        .post('/api/v1/auth/forgot-password/request-otp')
        .set('x-test-client-id', 'test-rl-client')
        .send({ email: 'rate_limit_user_6@ascendra.test' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should throw clear configuration error when email service is unconfigured outside test mode', async () => {
      const prevEnv = process.env.NODE_ENV;
      const prevUser = process.env.SMTP_USER;
      const prevPass = process.env.SMTP_PASSWORD;

      try {
        process.env.NODE_ENV = 'production';
        process.env.SMTP_USER = '';
        process.env.SMTP_PASSWORD = '';

        await expect(
          emailService.sendPasswordResetOtpEmail({
            toEmail: 'player@example.com',
            otpCode: '123456'
          })
        ).rejects.toThrow('Email service is not configured');
      } finally {
        process.env.NODE_ENV = prevEnv;
        process.env.SMTP_USER = prevUser;
        process.env.SMTP_PASSWORD = prevPass;
      }
    });
  });
});

