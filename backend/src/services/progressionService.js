const { getClient } = require('../config/database');

class ProgressionError extends Error {
  constructor(message, code = 'PROGRESSION_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ProgressionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Calculate player level based on total accumulated Experience Points (XP).
 * Formula: Level = floor(sqrt(XP / 100)) + 1
 * - 0 to 99 XP   -> Level 1
 * - 100 to 399 XP -> Level 2
 * - 400 to 899 XP -> Level 3
 * - 900 to 1599 XP -> Level 4
 * @param {number} xp - Total accumulated experience
 * @returns {number} Calculated player level (minimum 1)
 */
function calculateLevelFromXP(xp) {
  if (typeof xp !== 'number' || isNaN(xp) || xp < 0) {
    throw new ProgressionError('Experience Points (XP) must be a non-negative number', 'INVALID_XP_VALUE', 400);
  }

  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/**
 * Calculate minimum total XP required to reach a specific level.
 * Formula: XP = (Level - 1)^2 * 100
 * @param {number} level - Target level
 * @returns {number} Minimum XP required
 */
function calculateXPForLevel(level) {
  if (typeof level !== 'number' || isNaN(level) || level < 1) {
    throw new ProgressionError('Level must be a positive integer greater than or equal to 1', 'INVALID_LEVEL_VALUE', 400);
  }

  return Math.pow(level - 1, 2) * 100;
}

/**
 * Calculate progress toward the next level
 * @param {number} currentXP
 * @returns {{ currentLevel: number, currentXP: number, nextLevel: number, nextLevelXP: number, xpRemaining: number }}
 */
function getLevelProgress(currentXP) {
  const currentLevel = calculateLevelFromXP(currentXP);
  const nextLevel = currentLevel + 1;
  const nextLevelXP = calculateXPForLevel(nextLevel);
  const xpRemaining = nextLevelXP - currentXP;

  return {
    currentLevel,
    currentXP,
    nextLevel,
    nextLevelXP,
    xpRemaining
  };
}

/**
 * Atomically award XP and Score to a player using PostgreSQL row-level locking.
 * Updates level automatically based on server-side progression formula.
 *
 * @param {object} params
 * @param {string} params.userId - UUID of the player
 * @param {number} params.xpEarned - Amount of XP to award (must be non-negative)
 * @param {number} params.scoreEarned - Amount of score to award (must be non-negative)
 * @param {import('pg').PoolClient} [params.client] - Optional active transaction client
 * @returns {Promise<{ reward: { xp: number, score: number }, profile: object, levelUp: boolean }>}
 */
async function awardProgression({ userId, xpEarned = 0, scoreEarned = 0, client: externalClient = null }) {
  if (!userId) {
    throw new ProgressionError('User ID is required for progression updates', 'MISSING_USER_ID', 400);
  }

  if (typeof xpEarned !== 'number' || isNaN(xpEarned) || xpEarned < 0) {
    throw new ProgressionError('Awarded XP must be a non-negative number', 'INVALID_XP_REWARD', 400);
  }

  if (typeof scoreEarned !== 'number' || isNaN(scoreEarned) || scoreEarned < 0) {
    throw new ProgressionError('Awarded score must be a non-negative number', 'INVALID_SCORE_REWARD', 400);
  }

  // Use provided transaction client or acquire a new one
  const client = externalClient || (await getClient());
  const isInternalTransaction = !externalClient;

  try {
    if (isInternalTransaction) {
      await client.query('BEGIN');
    }

    // 1. Lock player profile record to prevent concurrent race conditions
    const profileRes = await client.query(
      `SELECT id, user_id, level, experience, score, health, max_health
       FROM player_profiles
       WHERE user_id = $1
       FOR UPDATE;`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      throw new ProgressionError('Player profile not found for user', 'PROFILE_NOT_FOUND', 404);
    }

    const currentProfile = profileRes.rows[0];
    const oldLevel = currentProfile.level;

    // 2. Calculate updated progression stats
    const newXP = currentProfile.experience + Math.floor(xpEarned);
    const newScore = currentProfile.score + Math.floor(scoreEarned);
    const newLevel = calculateLevelFromXP(newXP);
    const levelUp = newLevel > oldLevel;

    // 3. Persist updated stats
    const updateRes = await client.query(
      `UPDATE player_profiles
       SET experience = $1,
           score = $2,
           level = $3,
           updated_at = NOW()
       WHERE user_id = $4
       RETURNING id, user_id, level, experience, score, health, max_health, updated_at;`,
      [newXP, newScore, newLevel, userId]
    );

    const updatedProfile = updateRes.rows[0];

    if (isInternalTransaction) {
      await client.query('COMMIT');
    }

    return {
      reward: {
        xp: Math.floor(xpEarned),
        score: Math.floor(scoreEarned)
      },
      profile: {
        level: updatedProfile.level,
        experience: updatedProfile.experience,
        score: updatedProfile.score,
        health: updatedProfile.health,
        maxHealth: updatedProfile.max_health
      },
      levelUp
    };
  } catch (err) {
    if (isInternalTransaction) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (isInternalTransaction) {
      client.release();
    }
  }
}

module.exports = {
  ProgressionError,
  calculateLevelFromXP,
  calculateXPForLevel,
  getLevelProgress,
  awardProgression
};
