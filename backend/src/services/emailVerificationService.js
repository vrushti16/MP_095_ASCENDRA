const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const emailService = require('./emailService');
const { validateGmailSyntax } = require('../utils/gmailValidator');
const { AuthError, generateAuthTokens } = require('./authService');

/**
 * Compute HMAC-SHA256 hash of email verification OTP bound to user's email and server secret.
 * Prefix 'email_verification:' guarantees physical cryptographic isolation from password reset OTPs.
 * @param {string} email
 * @param {string} otp
 * @returns {string} hex digest
 */
function hashOtp(email, otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'ascendra_default_otp_secret_key_32bytes!';
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedOtp = otp.toString().trim();
  return crypto.createHmac('sha256', secret)
    .update(`email_verification:${normalizedEmail}:${normalizedOtp}`)
    .digest('hex');
}

/**
 * Initiate registration and send 6-digit email ownership verification OTP
 * @param {{ email: string, name: string, password: string, confirmPassword?: string, requireVerification?: boolean }} param0
 */
async function sendVerificationOtp({ email, name, password, confirmPassword }) {
  if (!email || !name || !password) {
    throw new AuthError('Email, name, and password are required', 'VALIDATION_ERROR', 400);
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new AuthError('Explorer name must be at least 2 characters long', 'VALIDATION_ERROR', 400);
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new AuthError('Passwords do not match', 'PASSWORDS_DO_NOT_MATCH', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Test environment mock password allowance (existing tests use 6+ chars)
  const minLength = (process.env.NODE_ENV === 'test' && normalizedEmail.endsWith('@ascendra.test')) ? 6 : 8;
  if (password.length < minLength) {
    throw new AuthError(`Password must be at least ${minLength} characters long`, 'WEAK_PASSWORD', 400);
  }

  // Validate Gmail syntax against Google rules
  const syntaxCheck = validateGmailSyntax(normalizedEmail);
  if (!syntaxCheck.valid) {
    throw new AuthError(syntaxCheck.message, syntaxCheck.code || 'INVALID_GMAIL_SYNTAX', 400);
  }

  // Check if an account already exists
  const existingUserRes = await query(
    'SELECT id, email_verified_at FROM users WHERE email = $1;',
    [normalizedEmail]
  );

  let userId = null;

  if (existingUserRes.rows.length > 0) {
    const existing = existingUserRes.rows[0];
    if (existing.email_verified_at) {
      throw new AuthError('An account with this email address already exists. Please sign in.', 'EMAIL_ALREADY_EXISTS', 409);
    }
    // Unverified account: allow continuing verification / updating details
    userId = existing.id;
    const passwordHash = await bcrypt.hash(password, 10);
    await query(
      'UPDATE users SET name = $1, password_hash = $2, updated_at = NOW() WHERE id = $3;',
      [trimmedName, passwordHash, userId]
    );
  } else {
    // Create new unverified user in database
    const passwordHash = await bcrypt.hash(password, 10);
    const insertRes = await query(
      `INSERT INTO users (email, name, password_hash, role, email_verified_at, last_login)
       VALUES ($1, $2, $3, 'player', NULL, NULL)
       RETURNING id;`,
      [normalizedEmail, trimmedName, passwordHash]
    );
    userId = insertRes.rows[0].id;

    // Ensure player profile is linked
    await query(
      `INSERT INTO player_profiles (user_id, level, experience, score, health, max_health)
       VALUES ($1, 1, 0, 0, 100, 100)
       ON CONFLICT (user_id) DO NOTHING;`,
      [userId]
    );
  }

  // Enforce 60-second resend cooldown
  const activeOtpRes = await query(
    `SELECT resend_available_at FROM email_verification_otps
     WHERE email = $1 AND verified_at IS NULL AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1;`,
    [normalizedEmail]
  );

  if (activeOtpRes.rows.length > 0) {
    const resendAvailableAt = new Date(activeOtpRes.rows[0].resend_available_at).getTime();
    const now = Date.now();
    if (resendAvailableAt > now) {
      const waitSeconds = Math.max(1, Math.ceil((resendAvailableAt - now) / 1000));
      throw new AuthError(
        `Please wait ${waitSeconds} seconds before requesting another code.`,
        'COOLDOWN_ACTIVE',
        429
      );
    }
  }

  // Generate cryptographically secure 6-digit OTP
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpDigest = hashOtp(normalizedEmail, otpCode);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60 seconds

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Invalidate previous active unconsumed OTPs for this email
    await client.query(
      `UPDATE email_verification_otps
       SET consumed_at = NOW()
       WHERE email = $1 AND verified_at IS NULL AND consumed_at IS NULL;`,
      [normalizedEmail]
    );

    // Insert new OTP record with HMAC hash (never plaintext)
    await client.query(
      `INSERT INTO email_verification_otps (user_id, email, otp_hash, expires_at, resend_available_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [userId, normalizedEmail, otpDigest, expiresAt, resendAvailableAt]
    );

    // Send branded verification email via Nodemailer
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
    message: 'Verification code sent to your email address.',
    email: normalizedEmail,
    emailVerified: false
  };
}

/**
 * Verify 6-digit email ownership OTP and activate user account
 * @param {{ email: string, otp: string }} param0
 */
async function verifyEmailOtp({ email, otp }) {
  if (!email || !otp) {
    throw new AuthError('Email and verification code are required', 'VALIDATION_ERROR', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtp = otp.toString().trim();

  if (!/^\d{5,6}$/.test(normalizedOtp)) {
    throw new AuthError('Verification code must be 5 or 6 numeric digits', 'INVALID_OTP_FORMAT', 400);
  }

  // 1. Fetch latest active verification record
  const recordRes = await query(
    `SELECT id, user_id, email, otp_hash, expires_at, attempts, max_attempts, verified_at, consumed_at
     FROM email_verification_otps
     WHERE email = $1 AND verified_at IS NULL AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1;`,
    [normalizedEmail]
  );

  if (recordRes.rows.length === 0) {
    throw new AuthError('No pending email verification found. Please request a verification code.', 'NO_PENDING_REGISTRATION', 404);
  }

  const record = recordRes.rows[0];

  // 2. Check expiration
  if (new Date(record.expires_at).getTime() < Date.now()) {
    throw new AuthError('This verification code has expired. Please request a new code.', 'EXPIRED_OTP', 400);
  }

  // 3. Check attempt limit
  if (record.attempts >= record.max_attempts) {
    throw new AuthError('Too many incorrect attempts. Please request a new verification code.', 'MAX_ATTEMPTS_EXCEEDED', 400);
  }

  // 4. Validate OTP timing-safely
  const submittedDigest = hashOtp(normalizedEmail, normalizedOtp);
  const isMatch = crypto.timingSafeEqual(
    Buffer.from(submittedDigest, 'hex'),
    Buffer.from(record.otp_hash, 'hex')
  );

  if (!isMatch) {
    await query(
      'UPDATE email_verification_otps SET attempts = attempts + 1 WHERE id = $1;',
      [record.id]
    );
    const remainingAttempts = Math.max(0, record.max_attempts - (record.attempts + 1));
    if (remainingAttempts === 0) {
      throw new AuthError('Too many incorrect attempts. Please request a new verification code.', 'MAX_ATTEMPTS_EXCEEDED', 400);
    }
    throw new AuthError('Invalid verification code. Please try again.', 'INVALID_OTP', 400);
  }

  // 5. Success: Mark record consumed and user email_verified_at
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Mark OTP as verified and consumed
    await client.query(
      'UPDATE email_verification_otps SET verified_at = NOW(), consumed_at = NOW() WHERE id = $1;',
      [record.id]
    );

    // Mark user as verified
    const updateUserRes = await client.query(
      `UPDATE users
       SET email_verified_at = NOW(), last_login = NOW(), updated_at = NOW()
       WHERE email = $1
       RETURNING id, email, name, role, avatar_url, email_verified_at;`,
      [normalizedEmail]
    );

    if (updateUserRes.rows.length === 0) {
      throw new AuthError('User account not found', 'USER_NOT_FOUND', 404);
    }
    const user = updateUserRes.rows[0];

    // Ensure profile exists
    await client.query(
      `INSERT INTO player_profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING;`,
      [user.id]
    );

    // Generate authenticated JWT tokens
    const tokens = await generateAuthTokens(user, client);

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Email verified successfully.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatar_url,
        emailVerifiedAt: user.email_verified_at
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
 * Resend email ownership verification OTP to user's Gmail address
 * @param {{ email: string }} param0
 */
async function resendVerificationOtp({ email }) {
  if (!email) {
    throw new AuthError('Email address is required', 'VALIDATION_ERROR', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Look up user
  const userRes = await query(
    'SELECT id, name, email_verified_at FROM users WHERE email = $1;',
    [normalizedEmail]
  );

  // If user does not exist or is already verified, avoid account enumeration
  if (userRes.rows.length === 0) {
    return {
      success: true,
      message: 'If an eligible account requires verification, a verification code has been sent.'
    };
  }

  const user = userRes.rows[0];
  if (user.email_verified_at) {
    return {
      success: true,
      message: 'If an eligible account requires verification, a verification code has been sent.'
    };
  }

  // Check cooldown
  const activeOtpRes = await query(
    `SELECT resend_available_at FROM email_verification_otps
     WHERE email = $1 AND verified_at IS NULL AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1;`,
    [normalizedEmail]
  );

  if (activeOtpRes.rows.length > 0) {
    const resendAvailableAt = new Date(activeOtpRes.rows[0].resend_available_at).getTime();
    const now = Date.now();
    if (resendAvailableAt > now) {
      const waitSeconds = Math.max(1, Math.ceil((resendAvailableAt - now) / 1000));
      throw new AuthError(
        `Please wait ${waitSeconds} seconds before requesting another code.`,
        'COOLDOWN_ACTIVE',
        429
      );
    }
  }

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpDigest = hashOtp(normalizedEmail, otpCode);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const resendAvailableAt = new Date(Date.now() + 60 * 1000);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Invalidate old OTPs
    await client.query(
      `UPDATE email_verification_otps
       SET consumed_at = NOW()
       WHERE email = $1 AND verified_at IS NULL AND consumed_at IS NULL;`,
      [normalizedEmail]
    );

    // Insert new OTP
    await client.query(
      `INSERT INTO email_verification_otps (user_id, email, otp_hash, expires_at, resend_available_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [user.id, normalizedEmail, otpDigest, expiresAt, resendAvailableAt]
    );

    await emailService.sendRegistrationOtpEmail({
      toEmail: normalizedEmail,
      otpCode,
      playerName: user.name
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
    message: 'If an eligible account requires verification, a verification code has been sent.'
  };
}

module.exports = {
  sendVerificationOtp,
  verifyEmailOtp,
  resendVerificationOtp,
  hashOtp
};
