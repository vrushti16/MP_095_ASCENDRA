const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'ascendra_fallback_dev_secret_key_32bytes!';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate a signed JWT Access Token with minimal claims.
 * @param {{ id: string, role: string }} user
 * @returns {string} signed JWT access token
 */
function generateAccessToken(user) {
  const payload = {
    sub: user.id,
    role: user.role || 'player'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

/**
 * Verify and decode an Access Token
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Generate a cryptographically random, unguessable raw refresh token
 * @returns {string} random hex string
 */
function generateRawRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

/**
 * Hash a raw refresh token using SHA-256 for secure DB storage
 * @param {string} rawToken
 * @returns {string} hex-encoded SHA-256 hash
 */
function hashRefreshToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Calculate expiration Date based on JWT_REFRESH_EXPIRES_IN (e.g., '7d', '24h', '30m')
 * @returns {Date}
 */
function getRefreshTokenExpiryDate() {
  const match = JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([smhd])$/);
  const now = Date.now();

  if (!match) {
    // Default 7 days
    return new Date(now + 7 * 24 * 60 * 60 * 1000);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  let multiplier = 1000;
  if (unit === 's') multiplier *= 1;
  else if (unit === 'm') multiplier *= 60;
  else if (unit === 'h') multiplier *= 3600;
  else if (unit === 'd') multiplier *= 86400;

  return new Date(now + value * multiplier);
}

const PASSWORD_RESET_TOKEN_EXPIRES_IN = '15m';

/**
 * Generate a cryptographically signed, short-lived password reset token
 * Scoped strictly to purpose: 'password_reset'
 * @param {{ id: string, email: string }} user
 * @param {string} otpRecordId
 * @returns {string} signed JWT password reset token
 */
function generatePasswordResetToken(user, otpRecordId) {
  const payload = {
    sub: user.id,
    email: user.email,
    otpId: otpRecordId,
    purpose: 'password_reset'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: PASSWORD_RESET_TOKEN_EXPIRES_IN
  });
}

/**
 * Verify and decode a password reset token, asserting strict purpose scoping
 * @param {string} token
 * @returns {object} decoded payload
 */
function verifyPasswordResetToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (!payload || payload.purpose !== 'password_reset') {
    throw new Error('Invalid password reset token scope');
  }
  return payload;
}

module.exports = {
  JWT_SECRET,
  JWT_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  PASSWORD_RESET_TOKEN_EXPIRES_IN,
  generateAccessToken,
  verifyAccessToken,
  generateRawRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiryDate,
  generatePasswordResetToken,
  verifyPasswordResetToken
};
