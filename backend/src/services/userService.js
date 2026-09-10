const { query, getClient } = require('../config/database');

class UserError extends Error {
  constructor(message, code = 'USER_ERROR', statusCode = 400) {
    super(message);
    this.name = 'UserError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Retrieve safe user account details by user ID
 * @param {string} userId - UUID of user
 * @returns {Promise<object>} safe user data
 */
async function getUserById(userId) {
  const res = await query(
    `SELECT id, email, name, avatar_url, role, created_at, last_login
     FROM users
     WHERE id = $1;`,
    [userId]
  );

  if (res.rows.length === 0) {
    throw new UserError('User not found', 'USER_NOT_FOUND', 404);
  }

  const row = res.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at,
    lastLogin: row.last_login
  };
}

/**
 * Retrieve full player profile including persistent stats (level, XP, score, health)
 * @param {string} userId - UUID of user
 * @returns {Promise<{ user: object, profile: object }>}
 */
async function getPlayerProfile(userId) {
  const client = await getClient();

  try {
    // 1. Query user record
    const userRes = await client.query(
      `SELECT id, email, name, avatar_url, role, created_at, last_login
       FROM users
       WHERE id = $1;`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new UserError('User not found', 'USER_NOT_FOUND', 404);
    }

    const u = userRes.rows[0];

    // 2. Query player profile, creating one if not yet initialized
    let profileRes = await client.query(
      `SELECT id, level, experience, score, health, max_health, created_at, updated_at
       FROM player_profiles
       WHERE user_id = $1;`,
      [userId]
    );

    let p;
    if (profileRes.rows.length === 0) {
      const initRes = await client.query(
        `INSERT INTO player_profiles (user_id, level, experience, score, health, max_health)
         VALUES ($1, 1, 0, 0, 100, 100)
         RETURNING id, level, experience, score, health, max_health, created_at, updated_at;`,
        [userId]
      );
      p = initRes.rows[0];
    } else {
      p = profileRes.rows[0];
    }

    return {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        avatarUrl: u.avatar_url,
        role: u.role
      },
      profile: {
        level: p.level,
        experience: p.experience,
        score: p.score,
        health: p.health,
        maxHealth: p.max_health,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }
    };
  } finally {
    client.release();
  }
}

/**
 * Update allowed public profile attributes (name, avatarUrl)
 * Strictly prevents modification of progression/security attributes (role, level, score, XP, health)
 * @param {string} userId - UUID of user
 * @param {object} updates - fields to update
 * @returns {Promise<{ user: object, profile: object }>}
 */
async function updateUserProfile(userId, updates) {
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new UserError('Request body must be a valid JSON object', 'VALIDATION_ERROR', 400);
  }

  // Forbidden fields that client can never modify
  const forbiddenFields = [
    'id', 'email', 'role', 'password', 'password_hash',
    'level', 'experience', 'score', 'health', 'max_health',
    'created_at', 'updated_at', 'last_login'
  ];

  for (const field of Object.keys(updates)) {
    if (forbiddenFields.includes(field.toLowerCase())) {
      throw new UserError(
        `Modification of field '${field}' is strictly forbidden`,
        'FORBIDDEN_FIELD_MODIFICATION',
        403
      );
    }
  }

  const { name, avatarUrl } = updates;

  if (name === undefined && avatarUrl === undefined) {
    throw new UserError('At least one valid field (name, avatarUrl) must be provided for update', 'VALIDATION_ERROR', 400);
  }

  // Validate name if provided
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 50) {
      throw new UserError('Name must be a string between 2 and 50 characters', 'VALIDATION_ERROR', 400);
    }
  }

  // Validate avatarUrl if provided
  if (avatarUrl !== undefined && avatarUrl !== null) {
    if (typeof avatarUrl !== 'string' || (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))) {
      throw new UserError('avatarUrl must be a valid HTTP or HTTPS URL or null', 'VALIDATION_ERROR', 400);
    }
  }

  // Construct dynamic parameterized update
  const setClauses = ['updated_at = NOW()'];
  const params = [];
  let paramIdx = 1;

  if (name !== undefined) {
    setClauses.push(`name = $${paramIdx++}`);
    params.push(name.trim());
  }

  if (avatarUrl !== undefined) {
    setClauses.push(`avatar_url = $${paramIdx++}`);
    params.push(avatarUrl ? avatarUrl.trim() : null);
  }

  params.push(userId);

  const updateSql = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $${paramIdx}
    RETURNING id;
  `;

  const res = await query(updateSql, params);
  if (res.rows.length === 0) {
    throw new UserError('User not found', 'USER_NOT_FOUND', 404);
  }

  return getPlayerProfile(userId);
}

module.exports = {
  UserError,
  getUserById,
  getPlayerProfile,
  updateUserProfile
};
