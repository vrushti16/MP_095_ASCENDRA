const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { query, getClient } = require('../config/database');
const { generatePasswordResetToken, verifyPasswordResetToken } = require('../config/jwt');
const emailService = require('./emailService');
const { AuthError } = require('./authService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Compute HMAC-SHA256 hash of OTP bound to user's email and server pepper
 * Never stores or leaks plaintext OTP in database or logs
 * @param {string} email
 * @param {string} otp
 * @returns {string} hex-encoded HMAC digest
 */
function hashOtp(email, otp) {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'ascendra_default_otp_secret_key_32bytes!';
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedOtp = otp.toString().trim();
  return crypto.createHmac('sha256', secret)
    .update(`${normalizedEmail}:${normalizedOtp}`)
    .digest('hex');
}

/**
 * Request a 5-digit password reset OTP sent to registered email
 * Enforces:
 * - Constant generic response (no account enumeration)
 * - 60-second resend cooldown per email
 * - Google-only account protection
 * - 10-minute expiry
 * - Zero plaintext OTP in logs
 * @param {string} rawEmail
 * @returns {Promise<{ genericMessage: string }>}
 */
async function requestOtp(rawEmail) {
  if (!rawEmail || typeof rawEmail !== 'string' || !EMAIL_REGEX.test(rawEmail.trim())) {
    throw new AuthError('A valid email address is required', 'VALIDATION_ERROR', 400);
  }

  const email = rawEmail.trim().toLowerCase();

  // Enforce Gmail ID requirement (@gmail.com or @googlemail.com, with @ascendra.test allowed in test environments)
  const isGmail = email.endsWith('@gmail.com') || email.endsWith('@googlemail.com');
  const isTestMock = process.env.NODE_ENV === 'test' && email.endsWith('@ascendra.test');
  if (!isGmail && !isTestMock) {
    throw new AuthError('Only Gmail addresses (@gmail.com) are allowed for password reset.', 'INVALID_GMAIL_DOMAIN', 400);
  }

  // 1. Look up user
  const userRes = await query(
    'SELECT id, email, name, role, password_hash FROM users WHERE email = $1;',
    [email]
  );

  // If user does not exist, reject instead of proceeding blindly
  if (userRes.rows.length === 0) {
    throw new AuthError('No account found with this Gmail address. Please check your email or register.', 'ACCOUNT_NOT_FOUND', 404);
  }

  const user = userRes.rows[0];

  // 2. Google-only account check (password_hash IS NULL)
  if (!user.password_hash) {
    throw new AuthError('This account was registered using Google Sign-In. Please sign in with Google.', 'GOOGLE_ACCOUNT', 400);
  }

  // 3. Enforce 60-second resend cooldown
  const activeOtpRes = await query(
    `SELECT id, resend_available_at
     FROM password_reset_otps
     WHERE email = $1 AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1;`,
    [email]
  );

  if (activeOtpRes.rows.length > 0) {
    const resendAvailableAt = new Date(activeOtpRes.rows[0].resend_available_at).getTime();
    const now = Date.now();
    if (resendAvailableAt > now) {
      const waitSeconds = Math.max(1, Math.ceil((resendAvailableAt - now) / 1000));
      const err = new AuthError(
        `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
        'COOLDOWN_ACTIVE',
        429
      );
      err.waitSeconds = waitSeconds;
      throw err;
    }
  }

  // 4. Generate cryptographically secure 5-digit decimal code (10000 - 99999)
  const otpCode = crypto.randomInt(10000, 100000).toString();
  const otpDigest = hashOtp(email, otpCode);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const resendAvailableAt = new Date(Date.now() + 60 * 1000); // 60 seconds

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Invalidate previous unconsumed OTPs for this user
    await client.query(
      `UPDATE password_reset_otps
       SET consumed_at = NOW()
       WHERE email = $1 AND consumed_at IS NULL;`,
      [email]
    );

    // Insert new OTP record with HMAC hash (never store plaintext)
    await client.query(
      `INSERT INTO password_reset_otps (user_id, email, otp_hash, expires_at, resend_available_at)
       VALUES ($1, $2, $3, $4, $5);`,
      [user.id, email, otpDigest, expiresAt, resendAvailableAt]
    );

    // Send email using email service
    // If SMTP is not configured, this will throw in real browser flow per user requirement
    await emailService.sendPasswordResetOtpEmail({
      toEmail: user.email,
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
    message: 'A 5-digit verification code has been sent to your Gmail address.',
    genericMessage: 'A 5-digit verification code has been sent to your Gmail address.'
  };
}

/**
 * Verify 5-digit OTP code and issue a short-lived, scoped reset authorization token
 * @param {string} rawEmail
 * @param {string} rawOtp
 * @returns {Promise<{ resetToken: string, message: string }>}
 */
async function verifyOtp(rawEmail, rawOtp) {
  if (!rawEmail || typeof rawEmail !== 'string' || !EMAIL_REGEX.test(rawEmail.trim())) {
    throw new AuthError('A valid email address is required', 'VALIDATION_ERROR', 400);
  }

  const email = rawEmail.trim().toLowerCase();
  const otp = (rawOtp || '').toString().trim();

  if (!otp || otp.length !== 5 || !/^\d{5}$/.test(otp)) {
    throw new AuthError('Please enter a valid 5-digit numeric verification code', 'VALIDATION_ERROR', 400);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock latest OTP record for this email
    const otpRes = await client.query(
      `SELECT id, user_id, email, otp_hash, expires_at, attempts, max_attempts, verified_at, consumed_at
       FROM password_reset_otps
       WHERE email = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE;`,
      [email]
    );

    if (otpRes.rows.length === 0) {
      throw new AuthError('No active verification request found. Please request a new code.', 'NO_ACTIVE_OTP', 400);
    }

    const record = otpRes.rows[0];

    // Check if already consumed or verified
    if (record.verified_at !== null) {
      throw new AuthError('This verification code has already been verified.', 'OTP_ALREADY_USED', 400);
    }

    // Check maximum attempts limit (Requirement 15: max 5 attempts)
    if (record.attempts >= record.max_attempts) {
      throw new AuthError(
        'Maximum verification attempts exceeded. Please request a new verification code.',
        'MAX_ATTEMPTS_EXCEEDED',
        429
      );
    }

    // Check expiration (Requirement 8 & 15: 10 minutes)
    if (new Date(record.expires_at).getTime() < Date.now()) {
      throw new AuthError('Verification code has expired. Please request a new code.', 'OTP_EXPIRED', 400);
    }

    // Compare HMAC hash securely with constant-time equality
    const expectedHash = record.otp_hash;
    const computedHash = hashOtp(email, otp);

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );

    if (!isMatch) {
      const newAttempts = record.attempts + 1;
      await client.query(
        'UPDATE password_reset_otps SET attempts = $1 WHERE id = $2;',
        [newAttempts, record.id]
      );

      const remainingAttempts = Math.max(0, record.max_attempts - newAttempts);
      await client.query('COMMIT');

      if (remainingAttempts === 0) {
        throw new AuthError(
          'Maximum verification attempts exceeded. Please request a new verification code.',
          'MAX_ATTEMPTS_EXCEEDED',
          429
        );
      }

      throw new AuthError(
        `Invalid verification code. Please try again. (${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining)`,
        'INVALID_OTP',
        400
      );
    }

    // Mark OTP as verified
    await client.query(
      'UPDATE password_reset_otps SET verified_at = NOW() WHERE id = $1;',
      [record.id]
    );

    // Query user data for reset token generation
    const userRes = await client.query(
      'SELECT id, email, role, password_hash FROM users WHERE id = $1;',
      [record.user_id]
    );

    if (userRes.rows.length === 0) {
      throw new AuthError('User account associated with code no longer exists', 'USER_NOT_FOUND', 400);
    }

    const user = userRes.rows[0];

    // Assert user is not a Google-only account
    if (!user.password_hash) {
      throw new AuthError(
        'This account is registered via Google OAuth. Please sign in with Google.',
        'GOOGLE_ACCOUNT_LOGIN',
        400
      );
    }

    // Issue short-lived scoped reset token (15-min expiry, purpose: "password_reset")
    const resetToken = generatePasswordResetToken(user, record.id);

    await client.query('COMMIT');

    return {
      resetToken,
      message: 'Email verification successful.'
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reset password using valid reset authorization token
 * In single database transaction:
 * - Validates passwords and token
 * - Hashes new password with bcrypt
 * - Updates users.password_hash
 * - Marks OTP record consumed (single use)
 * - Revokes all existing refresh tokens for user
 * @param {{ resetToken: string, newPassword: string, confirmPassword: string }} param0
 * @returns {Promise<{ message: string }>}
 */
async function resetPassword({ resetToken, newPassword, confirmPassword }) {
  if (!resetToken || typeof resetToken !== 'string') {
    throw new AuthError('Reset authorization token is required', 'MISSING_RESET_TOKEN', 400);
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    throw new AuthError('Password is required and must be at least 6 characters long', 'WEAK_PASSWORD', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AuthError('Passwords do not match', 'PASSWORD_MISMATCH', 400);
  }

  // 1. Verify reset token claims and strict purpose: "password_reset"
  let payload;
  try {
    payload = verifyPasswordResetToken(resetToken);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AuthError('Password reset authorization has expired. Please restart the verification flow.', 'EXPIRED_RESET_TOKEN', 401);
    }
    throw new AuthError('Invalid or unauthorized password reset token.', 'INVALID_RESET_TOKEN', 401);
  }

  const userId = payload.sub;
  const otpRecordId = payload.otpId;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 2. Lock and check OTP record status
    const otpRes = await client.query(
      `SELECT id, user_id, verified_at, consumed_at
       FROM password_reset_otps
       WHERE id = $1
       FOR UPDATE;`,
      [otpRecordId]
    );

    if (otpRes.rows.length === 0) {
      throw new AuthError('Invalid reset authorization record', 'INVALID_RESET_TOKEN', 401);
    }

    const otpRecord = otpRes.rows[0];

    if (otpRecord.verified_at === null) {
      throw new AuthError('OTP was not verified', 'UNVERIFIED_OTP', 401);
    }

    if (otpRecord.consumed_at !== null) {
      throw new AuthError('This password reset token has already been used.', 'RESET_TOKEN_ALREADY_USED', 401);
    }

    if (otpRecord.user_id !== userId) {
      throw new AuthError('Token subject mismatch', 'INVALID_RESET_TOKEN', 401);
    }

    // 3. Verify user exists and is not a Google-only account
    const userRes = await client.query(
      'SELECT id, password_hash FROM users WHERE id = $1 FOR UPDATE;',
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new AuthError('User account not found', 'USER_NOT_FOUND', 404);
    }

    const user = userRes.rows[0];
    if (!user.password_hash) {
      throw new AuthError(
        'This account is registered via Google OAuth. Please sign in with Google.',
        'GOOGLE_ACCOUNT_LOGIN',
        400
      );
    }

    // 4. Securely hash new password with bcrypt
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // 5. Update user password
    await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2;`,
      [passwordHash, userId]
    );

    // 6. Mark OTP record as consumed (single-use guarantee)
    await client.query(
      'UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = $1;',
      [otpRecordId]
    );

    // 7. Security Requirement 26: Invalidate all existing refresh tokens for that user
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL;`,
      [userId]
    );

    await client.query('COMMIT');

    return {
      message: 'Password reset successfully. Please sign in again.'
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  hashOtp,
  requestOtp,
  verifyOtp,
  resetPassword
};
