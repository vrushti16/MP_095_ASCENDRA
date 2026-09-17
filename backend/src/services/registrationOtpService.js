const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const emailService = require('./emailService');
const { validateGmailSyntax } = require('../utils/gmailValidator');
const { AuthError, generateAuthTokens } = require('./authService');

/**
 * Compute HMAC-SHA256 hash of registration OTP bound to user's email and server pepper
 * @param {string} email
 * @param {string} otp
 * @returns {string} hex digest
 */
function hashOtp(email, otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'ascendra_default_otp_secret_key_32bytes!';
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedOtp = otp.toString().trim();
  return crypto.createHmac('sha256', secret)
    .update(`reg:${normalizedEmail}:${normalizedOtp}`)
    .digest('hex');
}

/**
 * Request a 6-digit registration OTP sent to the user's real Gmail address
 * @param {{ email: string, name: string, password: string }} param0
 */
async function requestRegistrationOtp({ email, name, password }) {
  if (!email || !name || !password) {
    throw new AuthError('Email, name, and password are required', 'VALIDATION_ERROR', 400);
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new AuthError('Explorer name must be at least 2 characters long', 'VALIDATION_ERROR', 400);
  }

  if (password.length < 6) {
    throw new AuthError('Password must be at least 6 characters long', 'WEAK_PASSWORD', 400);
  }

  // 1. Validate Gmail syntax against Google worldwide rules
  const syntaxCheck = validateGmailSyntax(email);
  if (!syntaxCheck.valid) {
    throw new AuthError(syntaxCheck.message, syntaxCheck.code || 'INVALID_GMAIL_SYNTAX', 400);
  }

  const normalizedEmail = syntaxCheck.normalizedEmail;

  // 2. Check if an account already exists with this Gmail address
  const existingUserRes = await query('SELECT id FROM users WHERE email = $1;', [normalizedEmail]);
  if (existingUserRes.rows.length > 0) {
    throw new AuthError('An account with this Gmail address already exists. Please sign in.', 'EMAIL_ALREADY_EXISTS', 409);
  }

  // 3. Enforce 60-second resend cooldown
  const activeOtpRes = await query(
    `SELECT resend_available_at FROM registration_otps
     WHERE email = $1 AND verified_at IS NULL
     ORDER BY created_at DESC LIMIT 1;`,
    [normalizedEmail]
  );

  if (activeOtpRes.rows.length > 0) {
    const resendAvailableAt = new Date(activeOtpRes.rows[0].resend_available_at).getTime();
    const now = Date.now();
    if (resendAvailableAt > now) {
      const waitSeconds = Math.max(1, Math.ceil((resendAvailableAt - now) / 1000));
      throw new AuthError(
        `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
        'COOLDOWN_ACTIVE',
        429
      );
    }
  }

  // 4. Securely hash the password with bcrypt before storing
  const passwordHash = await bcrypt.hash(password, 10);

  // 5. Generate cryptographically secure 6-digit OTP
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpDigest = hashOtp(normalizedEmail, otpCode);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60 seconds

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Invalidate previous unverified registration attempts for this email
    await client.query(
      `DELETE FROM registration_otps
       WHERE email = $1 AND verified_at IS NULL;`,
      [normalizedEmail]
    );

    // Insert pending registration record
    await client.query(
      `INSERT INTO registration_otps (email, name, password_hash, otp_hash, expires_at, resend_available_at)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [normalizedEmail, trimmedName, passwordHash, otpDigest, expiresAt, resendAvailableAt]
    );

    // Send email using real Gmail SMTP service
    await emailService.sendRegistrationOtpEmail({
      toEmail: normalizedEmail,
      otpCode,
      playerName: trimmedName
    });

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return {
    success: true,
    message: 'A 6-digit verification code has been sent to your Gmail address.',
    email: normalizedEmail
  };
}

/**
 * Verify 6-digit registration OTP and activate user account
 * @param {{ email: string, otp: string }} param0
 */
async function verifyRegistrationOtpAndCreateUser({ email, otp }) {
  if (!email || !otp) {
    throw new AuthError('Email and verification code are required', 'VALIDATION_ERROR', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = otp.toString().trim();

  if (!/^\d{6}$/.test(normalizedOtp)) {
    throw new AuthError('Verification code must be exactly 6 digits', 'INVALID_OTP_FORMAT', 400);
  }

  // 1. Fetch latest pending registration record
  const recordRes = await query(
    `SELECT id, email, name, password_hash, otp_hash, expires_at, attempts, max_attempts, verified_at
     FROM registration_otps
     WHERE email = $1 AND verified_at IS NULL
     ORDER BY created_at DESC LIMIT 1;`,
    [normalizedEmail]
  );

  if (recordRes.rows.length === 0) {
    throw new AuthError('No pending registration found for this email. Please submit the registration form.', 'NO_PENDING_REGISTRATION', 404);
  }

  const record = recordRes.rows[0];

  // 2. Check expiration
  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw new AuthError('Verification code has expired. Please request a new code.', 'EXPIRED_OTP', 400);
  }

  // 3. Check attempt limit
  if (record.attempts >= record.max_attempts) {
    throw new AuthError('Maximum verification attempts exceeded. Please request a new code.', 'MAX_ATTEMPTS_EXCEEDED', 400);
  }

  // 4. Validate OTP timing-safely
  const submittedDigest = hashOtp(normalizedEmail, normalizedOtp);
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(submittedDigest, 'hex'),
    Buffer.from(record.otp_hash, 'hex')
  );

  if (!isMatch) {
    await query(
      'UPDATE registration_otps SET attempts = attempts + 1 WHERE id = $1;',
      [record.id]
    );
    const remainingAttempts = Math.max(0, record.max_attempts - (record.attempts + 1));
    throw new AuthError(
      `Invalid verification code. ${remainingAttempts} attempts remaining.`,
      'INVALID_OTP',
      400
    );
  }

  // 5. Success: Create account and log in
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Mark registration record as verified
    await client.query(
      'UPDATE registration_otps SET verified_at = NOW() WHERE id = $1;',
      [record.id]
    );

    // Check race condition for existing user
    const existingCheck = await client.query('SELECT id FROM users WHERE email = $1;', [normalizedEmail]);
    if (existingCheck.rows.length > 0) {
      throw new AuthError('An account with this Gmail address was already created. Please sign in.', 'EMAIL_ALREADY_EXISTS', 409);
    }

    // Insert new user
    const insertRes = await client.query(
      `INSERT INTO users (email, name, password_hash, role, last_login)
       VALUES ($1, $2, $3, 'player', NOW())
       RETURNING id, email, name, role, avatar_url;`,
      [record.email, record.name, record.password_hash]
    );
    const user = insertRes.rows[0];

    // Ensure player profile row exists
    await client.query(
      `INSERT INTO player_profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING;`,
      [user.id]
    );

    // Generate JWT auth tokens
    const tokens = await generateAuthTokens(user, client);

    await client.query('COMMIT');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url
      },
      ...tokens
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Resend a registration OTP to user's Gmail address
 * @param {{ email: string }} param0
 */
async function resendRegistrationOtp({ email }) {
  if (!email) {
    throw new AuthError('Email address is required', 'VALIDATION_ERROR', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const recordRes = await query(
    `SELECT id, email, name, resend_available_at
     FROM registration_otps
     WHERE email = $1 AND verified_at IS NULL
     ORDER BY created_at DESC LIMIT 1;`,
    [normalizedEmail]
  );

  if (recordRes.rows.length === 0) {
    throw new AuthError('No pending registration found for this email.', 'NO_PENDING_REGISTRATION', 404);
  }

  const record = recordRes.rows[0];
  const now = Date.now();
  const resendAvailableAt = new Date(record.resend_available_at).getTime();

  if (resendAvailableAt > now) {
    const waitSeconds = Math.max(1, Math.ceil((resendAvailableAt - now) / 1000));
    throw new AuthError(
      `Please wait ${waitSeconds} seconds before requesting a new code.`,
      'COOLDOWN_ACTIVE',
      429
    );
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpDigest = hashOtp(normalizedEmail, otpCode);
  const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const nextResendAt = new Date(Date.now() + 60 * 1000);

  await query(
    `UPDATE registration_otps
     SET otp_hash = $1, expires_at = $2, resend_available_at = $3, attempts = 0
     WHERE id = $4;`,
    [otpDigest, newExpiresAt, nextResendAt, record.id]
  );

  await emailService.sendRegistrationOtpEmail({
    toEmail: normalizedEmail,
    otpCode,
    playerName: record.name
  });

  return {
    success: true,
    message: 'New verification code sent to your Gmail address.'
  };
}

module.exports = {
  requestRegistrationOtp,
  verifyRegistrationOtpAndCreateUser,
  resendRegistrationOtp,
  hashOtp
};
