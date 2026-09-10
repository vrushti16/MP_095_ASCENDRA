const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { query, getClient } = require('../config/database');
const {
  generateAccessToken,
  generateRawRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiryDate
} = require('../config/jwt');

// Initialize Google OAuth2 client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Custom application error with HTTP status code and custom error code
 */
class AuthError extends Error {
  constructor(message, code = 'AUTH_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Verify Google ID Token server-side and extract verified identity claims
 * @param {string} idToken
 * @returns {Promise<{ googleId: string, email: string, name: string, avatarUrl: string }>}
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken) {
    throw new AuthError('Google ID token is required', 'MISSING_GOOGLE_TOKEN', 400);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AuthError('GOOGLE_CLIENT_ID is not configured on server', 'SERVER_CONFIG_ERROR', 500);
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientId
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new AuthError('Invalid Google token payload', 'INVALID_GOOGLE_TOKEN', 401);
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split('@')[0],
      avatarUrl: payload.picture || null
    };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(`Google token verification failed: ${err.message}`, 'INVALID_GOOGLE_TOKEN', 401);
  }
}

/**
 * Authenticate or register a Google user in database, ensuring atomic user & profile creation
 * @param {{ googleId: string, email: string, name: string, avatarUrl: string }} googleData
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
async function loginOrRegisterGoogleUser(googleData) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Check if user exists by google_id
    let userRes = await client.query(
      'SELECT id, email, name, role, avatar_url FROM users WHERE google_id = $1;',
      [googleData.googleId]
    );

    let user;

    if (userRes.rows.length > 0) {
      user = userRes.rows[0];
      // Update last_login
      await client.query('UPDATE users SET last_login = NOW() WHERE id = $1;', [user.id]);
    } else {
      // 2. Check if user exists with matching verified email
      const emailRes = await client.query(
        'SELECT id, email, name, role, avatar_url FROM users WHERE email = $1;',
        [googleData.email]
      );

      if (emailRes.rows.length > 0) {
        user = emailRes.rows[0];
        // Link google_id and update last_login
        await client.query(
          `UPDATE users
           SET google_id = $1,
               avatar_url = COALESCE(avatar_url, $2),
               last_login = NOW(),
               updated_at = NOW()
           WHERE id = $3;`,
          [googleData.googleId, googleData.avatarUrl, user.id]
        );
      } else {
        // 3. Create new user
        const insertUserRes = await client.query(
          `INSERT INTO users (google_id, email, name, avatar_url, role, last_login)
           VALUES ($1, $2, $3, $4, 'player', NOW())
           RETURNING id, email, name, role, avatar_url;`,
          [googleData.googleId, googleData.email, googleData.name, googleData.avatarUrl]
        );
        user = insertUserRes.rows[0];
      }
    }

    // 4. Ensure player profile exists
    await client.query(
      `INSERT INTO player_profiles (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING;`,
      [user.id]
    );

    // 5. Generate and persist tokens
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
 * Register a new user with email and password
 * @param {{ email: string, password: string, name: string }} data
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
async function registerUser({ email, password, name }) {
  if (!email || !password || !name) {
    throw new AuthError('Email, password, and name are required', 'VALIDATION_ERROR', 400);
  }

  if (password.length < 6) {
    throw new AuthError('Password must be at least 6 characters long', 'WEAK_PASSWORD', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  // Check if user with email already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1;', [normalizedEmail]);
  if (existingUser.rows.length > 0) {
    throw new AuthError('A user with this email already exists', 'EMAIL_ALREADY_EXISTS', 409);
  }

  // Hash password securely with bcrypt
  const passwordHash = await bcrypt.hash(password, 12);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Insert user
    const insertRes = await client.query(
      `INSERT INTO users (email, password_hash, name, role, last_login)
       VALUES ($1, $2, $3, 'player', NOW())
       RETURNING id, email, name, role, created_at;`,
      [normalizedEmail, passwordHash, trimmedName]
    );
    const user = insertRes.rows[0];

    // Create linked player profile
    await client.query(
      `INSERT INTO player_profiles (user_id, level, experience, score, health, max_health)
       VALUES ($1, 1, 0, 0, 100, 100);`,
      [user.id]
    );

    // Generate tokens
    const tokens = await generateAuthTokens(user, client);

    await client.query('COMMIT');

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
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
 * Authenticate existing user with email and password
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>}
 */
async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new AuthError('Email and password are required', 'VALIDATION_ERROR', 400);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userRes = await query(
    `SELECT id, email, name, role, password_hash, avatar_url
     FROM users
     WHERE email = $1;`,
    [normalizedEmail]
  );

  if (userRes.rows.length === 0) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  const user = userRes.rows[0];

  // If user registered with Google only and has no password hash
  if (!user.password_hash) {
    throw new AuthError(
      'This account is registered via Google OAuth. Please sign in with Google.',
      'GOOGLE_ACCOUNT_LOGIN',
      401
    );
  }

  // Verify bcrypt password hash
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  // Update last_login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1;', [user.id]);

  // Generate tokens
  const tokens = await generateAuthTokens(user);

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
}

/**
 * Issue signed access token and persist a cryptographically random hashed refresh token
 * @param {{ id: string, role: string }} user
 * @param {import('pg').PoolClient} [client]
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function generateAuthTokens(user, client = null) {
  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRawRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = getRefreshTokenExpiryDate();

  const insertQuery = `
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3);
  `;
  const params = [user.id, tokenHash, expiresAt];

  if (client) {
    await client.query(insertQuery, params);
  } else {
    await query(insertQuery, params);
  }

  return {
    accessToken,
    refreshToken: rawRefreshToken
  };
}

/**
 * Rotate an existing refresh token: verifies hash, revokes old token, issues new token pair
 * @param {string} rawRefreshToken
 * @returns {Promise<{ accessToken: string, refreshToken: string }>}
 */
async function rotateRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AuthError('Refresh token is required', 'MISSING_REFRESH_TOKEN', 400);
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Lock token record to prevent race conditions during rotation
    const tokenRes = await client.query(
      `SELECT id, user_id, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1
       FOR UPDATE;`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      throw new AuthError('Invalid refresh token', 'INVALID_REFRESH_TOKEN', 401);
    }

    const tokenRecord = tokenRes.rows[0];

    // 2. Check if already revoked
    if (tokenRecord.revoked_at !== null) {
      throw new AuthError('Refresh token has already been revoked', 'REVOKED_REFRESH_TOKEN', 401);
    }

    // 3. Check if expired
    if (new Date(tokenRecord.expires_at).getTime() < Date.now()) {
      throw new AuthError('Refresh token has expired', 'EXPIRED_REFRESH_TOKEN', 401);
    }

    // 4. Revoke the current refresh token
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1;',
      [tokenRecord.id]
    );

    // 5. Query user to verify role and status
    const userRes = await client.query(
      'SELECT id, role FROM users WHERE id = $1;',
      [tokenRecord.user_id]
    );

    if (userRes.rows.length === 0) {
      throw new AuthError('User associated with refresh token no longer exists', 'USER_NOT_FOUND', 401);
    }

    const user = userRes.rows[0];

    // 6. Generate new access token and new refresh token (token rotation)
    const newTokens = await generateAuthTokens(user, client);

    await client.query('COMMIT');

    return newTokens;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Revoke a refresh token (logout)
 * @param {string} rawRefreshToken
 * @returns {Promise<{ revoked: boolean }>}
 */
async function revokeRefreshToken(rawRefreshToken) {
  if (!rawRefreshToken) {
    throw new AuthError('Refresh token is required', 'MISSING_REFRESH_TOKEN', 400);
  }

  const tokenHash = hashRefreshToken(rawRefreshToken);

  const res = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL;`,
    [tokenHash]
  );

  return {
    revoked: res.rowCount > 0
  };
}

module.exports = {
  AuthError,
  verifyGoogleIdToken,
  loginOrRegisterGoogleUser,
  registerUser,
  loginUser,
  generateAuthTokens,
  rotateRefreshToken,
  revokeRefreshToken
};
