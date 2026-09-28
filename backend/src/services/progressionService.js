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

/**
 * Compile a comprehensive, server-authoritative player progression and
 * game completion summary.
 *
 * @param {string} userId - Authenticated player UUID
 * @returns {Promise<object>} Complete progression payload
 */
async function getPlayerProgressionSummary(userId) {
  if (!userId) {
    throw new ProgressionError('User ID is required', 'MISSING_USER_ID', 400);
  }

  const { query } = require('../config/database');
  const achievementService = require('./achievementService');

  // 1. Fetch user & profile
  const profileRes = await query(
    `SELECT u.id, u.email, u.name, u.role,
            p.level, p.experience, p.score, p.health, p.max_health
     FROM users u
     LEFT JOIN player_profiles p ON u.id = p.user_id
     WHERE u.id = $1;`,
    [userId]
  );

  if (profileRes.rows.length === 0) {
    throw new ProgressionError('Player not found', 'PLAYER_NOT_FOUND', 404);
  }

  const row = profileRes.rows[0];
  const currentXP = row.experience || 0;
  const currentLevel = row.level || calculateLevelFromXP(currentXP);

  // 2. Calculate XP thresholds & percentages
  const xpForCurrentLevel = calculateXPForLevel(currentLevel);
  const xpForNextLevel = calculateXPForLevel(currentLevel + 1);
  const xpRange = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const xpEarnedInLevel = Math.max(0, currentXP - xpForCurrentLevel);
  const levelProgressPercentage = Math.min(100, Math.round((xpEarnedInLevel / xpRange) * 100));

  // 3. Fetch Quest counts
  const questStatsRes = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress
     FROM player_quests
     WHERE player_id = $1;`,
    [userId]
  );
  const totalQuestsRes = await query(`SELECT COUNT(*)::int AS total FROM quests WHERE status = 'active';`);
  const completedQuests = questStatsRes.rows[0]?.completed || 0;
  const inProgressQuests = questStatsRes.rows[0]?.in_progress || 0;
  const totalQuests = totalQuestsRes.rows[0]?.total || 3;

  // 4. Fetch Puzzle counts
  const puzzleStatsRes = await query(
    `SELECT COUNT(DISTINCT puzzle_id)::int AS completed
     FROM puzzle_attempts
     WHERE player_id = $1 AND is_correct = true;`,
    [userId]
  );
  const completedPuzzles = puzzleStatsRes.rows[0]?.completed || 0;
  const totalRequiredPuzzles = 10;

  // 5. Fetch Inscription / Discovery counts
  const clueStatsRes = await query(
    `SELECT COUNT(*)::int AS discovered FROM player_clues WHERE player_id = $1;`,
    [userId]
  );
  const totalCluesRes = await query(`SELECT COUNT(*)::int AS total FROM clues;`);
  const discoveredInscriptions = clueStatsRes.rows[0]?.discovered || 0;
  const totalInscriptions = totalCluesRes.rows[0]?.total || 5;

  // 6. Stages and Realms metrics
  const completedStages = completedQuests; // 1 stage completed per main quest
  const totalStages = totalQuests;
  const unlockedRealms = Math.min(totalQuests, 1 + completedQuests);

  // 7. Calculate overall game completion percentage
  // Weighted: Quests 40%, Puzzles 30%, Inscriptions 30%
  const questWeight = (completedQuests / Math.max(1, totalQuests)) * 40;
  const puzzleWeight = (Math.min(completedPuzzles, totalRequiredPuzzles) / totalRequiredPuzzles) * 30;
  const discoveryWeight = (discoveredInscriptions / Math.max(1, totalInscriptions)) * 30;
  const overallPercentage = Math.min(100, Math.round(questWeight + puzzleWeight + discoveryWeight));

  // 8. Achievements
  const achievements = await achievementService.getAchievementsForPlayer(userId);

  return {
    player: {
      userId: row.id,
      name: row.name,
      email: row.email,
      level: currentLevel,
      xp: currentXP,
      score: row.score || 0,
      health: row.health || 100,
      maxHealth: row.max_health || 100,
      xpForCurrentLevel,
      xpForNextLevel,
      xpRemaining: Math.max(0, xpForNextLevel - currentXP),
      progressPercentage: levelProgressPercentage
    },
    gameProgress: {
      overallPercentage,
      completedQuests,
      inProgressQuests,
      totalQuests,
      completedPuzzles,
      totalRequiredPuzzles,
      completedStages,
      totalStages,
      discoveredInscriptions,
      totalInscriptions,
      unlockedRealms,
      totalRealms: totalStages
    },
    achievements: {
      unlocked: achievements.unlocked,
      total: achievements.total,
      percentage: achievements.percentage,
      items: achievements.items,
      newlyUnlocked: achievements.newlyUnlocked
    }
  };
}

module.exports = {
  ProgressionError,
  calculateLevelFromXP,
  calculateXPForLevel,
  getLevelProgress,
  awardProgression,
  getPlayerProgressionSummary
};
