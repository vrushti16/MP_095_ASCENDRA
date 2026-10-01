const request = require('supertest');
const crypto = require('crypto');
const app = require('../src/app');
const { query, pool } = require('../src/config/database');
const emailService = require('../src/services/emailService');
const emailVerificationService = require('../src/services/emailVerificationService');
const passwordResetService = require('../src/services/passwordResetService');
const authService = require('../src/services/authService');
const {
  registrationOtpRequestLimiter,
  registrationOtpVerifyLimiter
} = require('../src/middleware/rateLimitMiddleware');

describe('Real Gmail Email Verification System (/api/v1/auth/register)', () => {
  const timestamp = Date.now();
  const testEmail = `verify_player_${timestamp}@ascendra.test`;
  const testPassword = 'Password123!';
  const testName = 'Verif Explorer';

  const unverifiedEmail = `unverified_${timestamp}@ascendra.test`;
  const unverifiedPassword = 'Password123!';
  const unverifiedName = 'Unverified Explorer';

  let initialOtpCode = null;

  beforeAll(async () => {
    // Clean up any stale test records
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
  });

  beforeEach(async () => {
    await registrationOtpRequestLimiter.reset();
    await registrationOtpVerifyLimiter.reset();
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE email LIKE '%@ascendra.test';");
    await pool.end();
  });

  // 1. Registration creates unverified account / pending verification state
  it('1. Registration creates unverified account and pending verification state', async () => {
    emailService.clearTestEmails();

    const res = await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        name: testName
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain('Verification code sent');

    // Verify user in DB has email_verified_at NULL
    const userRes = await query(
      'SELECT id, email, email_verified_at FROM users WHERE email = $1;',
      [testEmail]
    );
    expect(userRes.rows.length).toBe(1);
    expect(userRes.rows[0].email_verified_at).toBeNull();

    const sentEmails = emailService.getSentEmailsForTesting();
    expect(sentEmails.length).toBeGreaterThanOrEqual(1);
    const emailRecord = sentEmails.find(e => e.to === testEmail);
    expect(emailRecord).toBeDefined();
    initialOtpCode = emailRecord.otpCode;
  });

  // 2. Verification OTP is generated securely
  it('2. Verification OTP is generated securely with 6 digits', async () => {
    expect(initialOtpCode).toBeDefined();
    expect(initialOtpCode).toMatch(/^\d{6}$/);

    const otpInt = parseInt(initialOtpCode, 10);
    expect(otpInt).toBeGreaterThanOrEqual(100000);
    expect(otpInt).toBeLessThan(1000000);
  });

  // 3. OTP is stored hashed
  it('3. OTP is stored hashed in email_verification_otps', async () => {
    const otpRes = await query(
      'SELECT otp_hash, attempts, expires_at FROM email_verification_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1;',
      [testEmail]
    );
    expect(otpRes.rows.length).toBe(1);
    expect(otpRes.rows[0].otp_hash).toBeDefined();
    // SHA-256 HMAC produces 64 hex characters
    expect(otpRes.rows[0].otp_hash.length).toBe(64);
    expect(otpRes.rows[0].attempts).toBe(0);
  });

  // 4. Plaintext OTP is never stored
  it('4. Plaintext OTP is never stored in any database column', async () => {
    expect(initialOtpCode).toBeDefined();

    const otpRecord = await query(
      'SELECT * FROM email_verification_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1;',
      [testEmail]
    );
    const row = otpRecord.rows[0];
    for (const key of Object.keys(row)) {
      expect(String(row[key])).not.toBe(initialOtpCode);
    }
  });

  // 5. Plaintext OTP is never logged
  it('5. Plaintext OTP is never logged to console or logs', async () => {
    const logs = [];
    const originalLog = console.log;
    const originalInfo = console.info;
    const originalWarn = console.warn;
    const originalError = console.error;

    const capture = (...args) => logs.push(args.join(' '));
    console.log = capture;
    console.info = capture;
    console.warn = capture;
    console.error = capture;

    try {
      // Clear cooldown so we can send a new OTP
      await query(
        "UPDATE email_verification_otps SET resend_available_at = NOW() - INTERVAL '1 minute' WHERE email = $1;",
        [testEmail]
      );

      await request(app)
        .post('/api/v1/auth/register/send-verification')
        .send({
          email: testEmail,
          password: testPassword,
          confirmPassword: testPassword,
          name: testName
        });

      const sentEmails = emailService.getSentEmailsForTesting();
      const lastEmail = sentEmails[sentEmails.length - 1];
      const plaintextOtp = lastEmail.otpCode;

      for (const logLine of logs) {
        expect(logLine).not.toContain(plaintextOtp);
      }
    } finally {
      console.log = originalLog;
      console.info = originalInfo;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });

  // 6. Real email service is called when configured
  it('6. Email service delivers branded verification email with correct subject', async () => {
    const sentEmails = emailService.getSentEmailsForTesting();
    expect(sentEmails.length).toBeGreaterThan(0);
    const lastEmail = sentEmails[sentEmails.length - 1];
    expect(lastEmail.to).toBe(testEmail);
    expect(lastEmail.subject).toBe('ASCENDRA — Verify Your Email');
  });

  // 7. Invalid OTP rejected
  it('7. Invalid OTP rejected with 400 error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({
        email: testEmail,
        otp: '000000'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_OTP');
    expect(res.body.error.message).toContain('Invalid verification code');

    // Verify attempt counter incremented
    const record = await query(
      'SELECT attempts FROM email_verification_otps WHERE email = $1 ORDER BY created_at DESC LIMIT 1;',
      [testEmail]
    );
    expect(record.rows[0].attempts).toBe(1);
  });

  // 8. Expired OTP rejected
  it('8. Expired OTP rejected with 400 EXPIRED_OTP', async () => {
    // Manually expire the OTP in DB
    await query(
      "UPDATE email_verification_otps SET expires_at = NOW() - INTERVAL '1 minute' WHERE email = $1;",
      [testEmail]
    );

    const res = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({
        email: testEmail,
        otp: '123456'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('EXPIRED_OTP');
    expect(res.body.error.message).toContain('expired');
  });

  // 9. Fifth invalid attempt locks verification
  it('9. Fifth invalid attempt locks verification with MAX_ATTEMPTS_EXCEEDED', async () => {
    // Generate fresh OTP by resetting cooldown and re-requesting
    await query(
      "UPDATE email_verification_otps SET resend_available_at = NOW() - INTERVAL '1 minute', consumed_at = NOW() WHERE email = $1;",
      [testEmail]
    );

    await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        name: testName
      });

    // Send 4 wrong attempts
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/v1/auth/register/verify-email')
        .send({ email: testEmail, otp: '111111' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OTP');
    }

    // 5th wrong attempt locks the OTP
    const fifthRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: testEmail, otp: '111111' });
    expect(fifthRes.status).toBe(400);
    expect(fifthRes.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(fifthRes.body.error.message).toContain('Too many incorrect attempts');

    // 6th attempt is also blocked
    const sixthRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: testEmail, otp: '111111' });
    expect(sixthRes.status).toBe(400);
    expect(sixthRes.body.error.code).toBe('MAX_ATTEMPTS_EXCEEDED');
  });

  // 10. OTP cannot be reused
  it('10. OTP cannot be reused after successful verification', async () => {
    // Issue fresh OTP
    await query(
      "UPDATE email_verification_otps SET resend_available_at = NOW() - INTERVAL '1 minute', consumed_at = NOW() WHERE email = $1;",
      [testEmail]
    );

    await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
        name: testName
      });

    const sentEmails = emailService.getSentEmailsForTesting();
    const validOtp = sentEmails[sentEmails.length - 1].otpCode;

    // Verify first time -> succeeds
    const firstRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: testEmail, otp: validOtp });
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    // Verify second time with same OTP -> rejected
    const secondRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: testEmail, otp: validOtp });
    expect(secondRes.status).toBe(404);
    expect(secondRes.body.error.code).toBe('NO_PENDING_REGISTRATION');
  });

  // 11. Resend cooldown enforced
  it('11. Resend cooldown of 60 seconds is enforced', async () => {
    // Create new unverified account for testing resend cooldown
    await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: unverifiedEmail,
        password: unverifiedPassword,
        confirmPassword: unverifiedPassword,
        name: unverifiedName
      });

    // Immediate resend must fail with 429
    const res = await request(app)
      .post('/api/v1/auth/register/resend-verification')
      .send({ email: unverifiedEmail });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('COOLDOWN_ACTIVE');
    expect(res.body.error.message).toContain('Please wait');
  });

  // 12. Old OTP invalid after successful resend
  it('12. Old OTP becomes invalid after successful resend', async () => {
    // Get the first OTP sent to unverifiedEmail
    const sentEmailsBefore = emailService.getSentEmailsForTesting();
    const firstEmailRecord = sentEmailsBefore.slice().reverse().find(e => e.to === unverifiedEmail);
    expect(firstEmailRecord).toBeDefined();
    const firstOtp = firstEmailRecord.otpCode;

    // Fast-forward cooldown in DB
    await query(
      "UPDATE email_verification_otps SET resend_available_at = NOW() - INTERVAL '1 second' WHERE email = $1;",
      [unverifiedEmail]
    );

    // Resend
    const resendRes = await request(app)
      .post('/api/v1/auth/register/resend-verification')
      .send({ email: unverifiedEmail });
    expect(resendRes.status).toBe(200);

    const sentEmailsAfter = emailService.getSentEmailsForTesting();
    const secondEmailRecord = sentEmailsAfter.slice().reverse().find(e => e.to === unverifiedEmail);
    expect(secondEmailRecord).toBeDefined();
    const secondOtp = secondEmailRecord.otpCode;
    expect(secondOtp).not.toBe(firstOtp);

    // Submitting old OTP must fail
    const oldRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: unverifiedEmail, otp: firstOtp });
    expect(oldRes.status).toBe(400);
    expect(oldRes.body.error.code).toBe('INVALID_OTP');

    // Submitting new OTP must succeed
    const newRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: unverifiedEmail, otp: secondOtp });
    expect(newRes.status).toBe(200);
    expect(newRes.body.success).toBe(true);
  });

  // 13. Successful OTP marks email verified
  it('13. Successful OTP marks email_verified_at in database', async () => {
    const userRes = await query(
      'SELECT email_verified_at FROM users WHERE email = $1;',
      [testEmail]
    );
    expect(userRes.rows[0].email_verified_at).not.toBeNull();
  });

  // 14. Verified account can login
  it('14. Verified account can login normally with email & password', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testEmail,
        password: testPassword
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.refreshToken).toBeDefined();
    expect(loginRes.body.data.user.email).toBe(testEmail);
  });

  // 15. Unverified account cannot login
  it('15. Unverified account cannot login with password (403 EMAIL_NOT_VERIFIED)', async () => {
    const blockedEmail = `blocked_${timestamp}@ascendra.test`;
    await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: blockedEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        name: 'Blocked User'
      });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: blockedEmail,
        password: 'Password123!'
      });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(loginRes.body.error.message).toContain('Please verify your email address before signing in.');
  });

  // 16. Login does not issue tokens before verification
  it('16. Login does not issue tokens before email verification succeeds', async () => {
    const blockedEmail = `blocked_${timestamp}@ascendra.test`;
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: blockedEmail,
        password: 'Password123!'
      });

    expect(loginRes.body.accessToken).toBeUndefined();
    expect(loginRes.body.refreshToken).toBeUndefined();
    expect(loginRes.body.data?.accessToken).toBeUndefined();
    expect(loginRes.body.data?.refreshToken).toBeUndefined();
  });

  // 17. Duplicate verified email rejected
  it('17. Duplicate verified email is rejected with 409 EMAIL_ALREADY_EXISTS', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: testEmail,
        password: 'AnotherPassword123!',
        confirmPassword: 'AnotherPassword123!',
        name: 'Duplicate Explorer'
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  // 18. Unverified registration can continue verification
  it('18. Unverified registration can continue verification or resend without duplicate error', async () => {
    const pendingEmail = `pending_${timestamp}@ascendra.test`;

    // 1st attempt: initiates registration
    const firstRes = await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: pendingEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        name: 'Pending Explorer'
      });
    expect(firstRes.status).toBe(200);

    // Fast-forward cooldown
    await query(
      "UPDATE email_verification_otps SET resend_available_at = NOW() - INTERVAL '1 second' WHERE email = $1;",
      [pendingEmail]
    );

    // 2nd attempt with updated name/password: continues verification without 409
    const secondRes = await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: pendingEmail,
        password: 'UpdatedPassword123!',
        confirmPassword: 'UpdatedPassword123!',
        name: 'Pending Explorer Updated'
      });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.success).toBe(true);

    // Verify only ONE user record was created in the database
    const userCount = await query('SELECT count(*) FROM users WHERE email = $1;', [pendingEmail]);
    expect(parseInt(userCount.rows[0].count, 10)).toBe(1);
  });

  // 19. Google users are not forced through email verification
  it('19. Google users are automatically email-verified and receive auth tokens', async () => {
    const googleUser = {
      googleId: `google_verified_${timestamp}`,
      email: `google_verified_${timestamp}@ascendra.test`,
      name: 'Google Explorer',
      avatarUrl: 'https://example.com/avatar.png'
    };

    const result = await authService.loginOrRegisterGoogleUser(googleUser);
    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();

    // Verify user in DB has email_verified_at set
    const userRes = await query(
      'SELECT email_verified_at, password_hash FROM users WHERE email = $1;',
      [googleUser.email]
    );
    expect(userRes.rows[0].email_verified_at).not.toBeNull();
    // Google-only accounts remain passwordless
    expect(userRes.rows[0].password_hash).toBeNull();
  });

  // 20. Password reset OTP cannot verify registration
  it('20. Password reset OTP cannot verify email registration (domain isolation)', async () => {
    const crossEmail = `cross_${timestamp}@ascendra.test`;

    // 1. Create verified user so password reset can be requested
    await query(
      `INSERT INTO users (email, name, password_hash, role, email_verified_at)
       VALUES ($1, $2, 'fakehash', 'player', NOW())
       RETURNING id;`,
      [crossEmail, 'Cross User']
    );

    // 2. Request password reset OTP
    await passwordResetService.requestOtp(crossEmail);
    const sentEmails = emailService.getSentEmailsForTesting();
    const resetOtp = sentEmails[sentEmails.length - 1].otpCode;

    // 3. Try to use that password reset OTP on email verification endpoint
    const res = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({
        email: crossEmail,
        otp: resetOtp
      });

    // Must fail because email_verification_otps has no record for this
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_PENDING_REGISTRATION');
  });

  // 21. Registration OTP cannot reset password
  it('21. Registration verification OTP cannot reset password (domain isolation)', async () => {
    const crossEmail2 = `cross2_${timestamp}@ascendra.test`;

    // Request registration OTP
    await request(app)
      .post('/api/v1/auth/register/send-verification')
      .send({
        email: crossEmail2,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        name: 'Cross User 2'
      });

    const sentEmails = emailService.getSentEmailsForTesting();
    const regOtp = sentEmails[sentEmails.length - 1].otpCode;

    // Try to use that registration OTP (truncated to 5-digit reset format) on password reset endpoint
    const res = await request(app)
      .post('/api/v1/auth/forgot-password/verify-otp')
      .send({
        email: crossEmail2,
        otp: regOtp.slice(0, 5)
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NO_ACTIVE_OTP');
  });

  // 22. Rate limiting works
  it('22. Server-side rate limiting rejects abusive request volumes', async () => {
    const spamEmail = `spam_${timestamp}@ascendra.test`;

    // Send 10 verification attempts to reach limit of 10 for registrationOtpVerifyLimiter
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post('/api/v1/auth/register/verify-email')
        .send({ email: spamEmail, otp: '123456' });
    }

    // The 11th request must be rate limited with 429
    const limitedRes = await request(app)
      .post('/api/v1/auth/register/verify-email')
      .send({ email: spamEmail, otp: '123456' });

    expect(limitedRes.status).toBe(429);
    expect(limitedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
