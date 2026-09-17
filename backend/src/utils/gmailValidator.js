const dns = require('dns');

/**
 * Validates whether an email is a syntactically valid and conforming Gmail account
 * matching Google's global account creation specifications.
 * 
 * Google Account Specifications:
 * - Domain: @gmail.com or @googlemail.com
 * - Username length: Between 6 and 30 characters
 * - Characters allowed: Letters (a-z), numbers (0-9), and periods (.)
 * - Period rules: No consecutive periods (..), cannot start or end with a period
 * - Test environment: Supports @ascendra.test and @ascendra.game mocks
 */

let cachedMxValid = null;
let lastMxCheckTime = 0;
const MX_CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour cache

async function verifyGoogleMxRecords() {
  const now = Date.now();
  if (cachedMxValid !== null && (now - lastMxCheckTime) < MX_CACHE_TTL_MS) {
    return cachedMxValid;
  }

  try {
    const records = await dns.promises.resolveMx('gmail.com');
    const hasGoogleMx = records && records.some(r => r.exchange && r.exchange.toLowerCase().includes('google'));
    cachedMxValid = Boolean(hasGoogleMx);
    lastMxCheckTime = now;
    return cachedMxValid;
  } catch (err) {
    console.warn('⚠️ [DNS MX CHECK] Failed to resolve MX for gmail.com:', err.message);
    // If DNS check fails due to offline/network glitch, fallback to true so valid users are not blocked
    return true;
  }
}

function validateGmailSyntax(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, code: 'VALIDATION_ERROR', message: 'Gmail address is required' };
  }

  const normalized = email.trim().toLowerCase();
  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return { valid: false, code: 'VALIDATION_ERROR', message: 'Invalid email format' };
  }

  const [username, domain] = parts;

  // Check test mock domains in test environment
  if (process.env.NODE_ENV === 'test' && (domain === 'ascendra.test' || domain === 'ascendra.game')) {
    if (!username || username.length < 3) {
      return { valid: false, code: 'VALIDATION_ERROR', message: 'Test email username is too short' };
    }
    return { valid: true, normalizedEmail: normalized, username, domain };
  }

  // Domain restriction: Only @gmail.com and @googlemail.com
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') {
    return { valid: false, code: 'INVALID_GMAIL_DOMAIN', message: 'Only Gmail addresses (@gmail.com) are allowed.' };
  }

  // Google username length: 6 to 30 characters
  if (username.length < 6) {
    return { valid: false, code: 'INVALID_GMAIL_SYNTAX', message: 'Gmail username must be at least 6 characters long.' };
  }
  if (username.length > 30) {
    return { valid: false, code: 'INVALID_GMAIL_SYNTAX', message: 'Gmail username cannot exceed 30 characters.' };
  }

  // Google allowed characters: Letters (a-z), numbers (0-9), periods (.)
  if (!/^[a-z0-9.]+$/.test(username)) {
    return { valid: false, code: 'INVALID_GMAIL_SYNTAX', message: 'Gmail username can only contain letters (a-z), numbers (0-9), and periods (.).' };
  }

  // Period rules
  if (username.startsWith('.')) {
    return { valid: false, code: 'INVALID_GMAIL_SYNTAX', message: 'Gmail username cannot begin with a period.' };
  }
  if (username.endsWith('.')) {
    return { valid: false, code: 'INVALID_GMAIL_SYNTAX', message: 'Gmail username cannot end with a period.' };
  }
  if (username.includes('..')) {
    return { valid: false, code: 'INVALID_GMAIL_SYNTAX', message: 'Gmail username cannot contain consecutive periods (..).' };
  }

  return {
    valid: true,
    normalizedEmail: normalized,
    username,
    domain
  };
}

module.exports = {
  validateGmailSyntax,
  verifyGoogleMxRecords
};
