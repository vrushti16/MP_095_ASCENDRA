const request = require('supertest');
const app = require('../src/app');
const { query } = require('../src/config/database');
const emailService = require('../src/services/emailService');

describe('Registration OTP Flow & Real-World Gmail Verification', () => {
  const timestamp = Date.now();
  const validGmail = `playerreal${timestamp}@gmail.com`;
  const existingGmail = `existingreal${timestamp}@gmail.com`;
  let issuedOtp = null;

  beforeAll(async () => {
    emailService.clearTestEmails();

    // Create an existing user to test conflict handling
    await query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, 'Existing Player', 'dummy_hash', 'player');`,
      [existingGmail]
    );
  });

  afterAll(async () => {
    await query('DELETE FROM registration_otps WHERE email LIKE $1;', [`%${timestamp}%`]);
    await query('DELETE FROM users WHERE email LIKE $1;', [`%${timestamp}%`]);
    emailService.clearTestEmails();
  });

  describe('1. Syntax & Domain Validation', () => {
    it('should reject non-Gmail address for registration OTP', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .set('x-test-client-id', `client_reg_syntax_1_${timestamp}`)
        .send({
          email: 'explorer@yahoo.com',
          name: 'Explorer Yahoo',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_GMAIL_DOMAIN');
    });

    it('should reject Gmail username shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .set('x-test-client-id', `client_reg_syntax_2_${timestamp}`)
        .send({
          email: 'abc@gmail.com',
          name: 'Short Explorer',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_GMAIL_SYNTAX');
      expect(res.body.error.message).toContain('at least 6 characters');
    });

    it('should reject Gmail username with consecutive periods', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .set('x-test-client-id', `client_reg_syntax_3_${timestamp}`)
        .send({
          email: 'hello..world@gmail.com',
          name: 'Period Explorer',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_GMAIL_SYNTAX');
    });

    it('should reject registration OTP request if account already exists', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .set('x-test-client-id', `client_reg_syntax_4_${timestamp}`)
        .send({
          email: existingGmail,
          name: 'Existing Again',
          password: 'Password123!'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });
  });

  describe('2. OTP Generation & Verification', () => {
    it('should successfully dispatch 6-digit registration OTP to valid Gmail', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .set('x-test-client-id', `client_reg_otp_1_${timestamp}`)
        .send({
          email: validGmail,
          name: 'Aric the Real',
          password: 'StrongSecretPass123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify email was captured in test store
      const sent = emailService.getSentEmailsForTesting();
      const regEmail = sent.find(e => e.to === validGmail);
      expect(regEmail).toBeDefined();
      expect(regEmail.otpCode).toMatch(/^\d{6}$/);
      issuedOtp = regEmail.otpCode;
    });

    it('should enforce 60-second cooldown on immediate re-request', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/request-otp')
        .set('x-test-client-id', `client_reg_otp_2_${timestamp}`)
        .send({
          email: validGmail,
          name: 'Aric the Real',
          password: 'StrongSecretPass123!'
        });

      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('COOLDOWN_ACTIVE');
    });

    it('should reject OTP verification with incorrect digits', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .set('x-test-client-id', `client_reg_otp_3_${timestamp}`)
        .send({
          email: validGmail,
          otp: '000000'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OTP');
    });

    it('should successfully verify valid OTP, create user, profile, and issue JWT tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .set('x-test-client-id', `client_reg_otp_4_${timestamp}`)
        .send({
          email: validGmail,
          otp: issuedOtp
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(validGmail);
      expect(res.body.data.user.name).toBe('Aric the Real');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();

      // Verify user exists in database
      const userInDb = await query('SELECT id FROM users WHERE email = $1;', [validGmail]);
      expect(userInDb.rows.length).toBe(1);

      // Verify player profile exists
      const profileInDb = await query('SELECT user_id FROM player_profiles WHERE user_id = $1;', [userInDb.rows[0].id]);
      expect(profileInDb.rows.length).toBe(1);
    });

    it('should reject reused OTP after successful verification', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register/verify-otp')
        .set('x-test-client-id', `client_reg_otp_5_${timestamp}`)
        .send({
          email: validGmail,
          otp: issuedOtp
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NO_PENDING_REGISTRATION');
    });
  });
});
