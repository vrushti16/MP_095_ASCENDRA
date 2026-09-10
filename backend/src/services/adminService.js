const database = require('../config/database');
const healthService = require('./healthService');
const aiService = require('./aiService');

class AdminError extends Error {
  constructor(message, code = 'ADMIN_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AdminError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Regex for standard UUID validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format cleanly
 * @param {string} id
 */
function validateUuid(id) {
  if (!id || !UUID_REGEX.test(String(id).trim())) {
    throw new AdminError(`Invalid user ID format: '${id}'. Expected standard UUID.`, 'INVALID_ID_FORMAT', 400);
  }
  return String(id).trim();
}

/**
 * Retrieve high-level aggregate overview statistics for the admin dashboard
 */
async function getOverview() {
  // Concurrently execute aggregate queries
  const [usersCountRes, sessionsCountRes, questsCountRes, attemptsRes, profileStatsRes, health] = await Promise.all([
    database.query(`
      SELECT
        COUNT(*) AS total_users,
        COUNT(*) FILTER (WHERE role = 'player') AS total_players,
        COUNT(*) FILTER (WHERE role = 'admin') AS total_admins
      FROM users;
    `),
    database.query(`
      SELECT COUNT(*) AS active_sessions
      FROM game_sessions
      WHERE status = 'active';
    `),
    database.query(`
      SELECT
        (SELECT COUNT(*) FROM quests WHERE status = 'active') AS total_active_quests,
        (SELECT COUNT(*) FROM player_quests WHERE status = 'in_progress') AS in_progress_quests,
        (SELECT COUNT(*) FROM player_quests WHERE status = 'completed') AS completed_quests;
    `),
    database.query(`
      SELECT
        COUNT(*) AS total_attempts,
        COUNT(*) FILTER (WHERE is_correct = true) AS correct_attempts
      FROM puzzle_attempts;
    `),
    database.query(`
      SELECT
        COALESCE(AVG(level), 1) AS avg_level,
        COALESCE(AVG(score), 0) AS avg_score,
        COALESCE(AVG(experience), 0) AS avg_xp
      FROM player_profiles;
    `),
    healthService.getDetailedHealth()
  ]);

  const userStats = usersCountRes.rows[0];
  const sessionStats = sessionsCountRes.rows[0];
  const questStats = questsCountRes.rows[0];
  const attemptStats = attemptsRes.rows[0];
  const profileStats = profileStatsRes.rows[0];

  const totalAttempts = parseInt(attemptStats.total_attempts, 10) || 0;
  const correctAttempts = parseInt(attemptStats.correct_attempts, 10) || 0;
  const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  return {
    users: {
      total: parseInt(userStats.total_users, 10) || 0,
      players: parseInt(userStats.total_players, 10) || 0,
      admins: parseInt(userStats.total_admins, 10) || 0,
      activeSessions: parseInt(sessionStats.active_sessions, 10) || 0
    },
    quests: {
      activeQuests: parseInt(questStats.total_active_quests, 10) || 0,
      inProgressQuests: parseInt(questStats.in_progress_quests, 10) || 0,
      completedQuests: parseInt(questStats.completed_quests, 10) || 0
    },
    puzzles: {
      totalAttempts,
      correctAttempts,
      accuracyRate
    },
    progression: {
      averageLevel: Math.round(parseFloat(profileStats.avg_level) * 10) / 10,
      averageScore: Math.round(parseFloat(profileStats.avg_score)),
      averageXp: Math.round(parseFloat(profileStats.avg_xp))
    },
    systemHealth: {
      status: health.payload.status,
      services: {
        postgresql: health.payload.dependencies.postgresql.status,
        redis: health.payload.dependencies.redis.status,
        fastapi: health.payload.dependencies.fastapi.status
      }
    }
  };
}

/**
 * Retrieve paginated, filterable list of users with safe profile metadata
 * @param {object} params
 * @param {number} [params.page=1]
 * @param {number} [params.limit=20]
 * @param {string} [params.search]
 * @param {string} [params.role]
 */
async function getUsers({ page = 1, limit = 20, search = null, role = null }) {
  const parsedPage = parseInt(page, 10);
  const parsedLimit = parseInt(limit, 10);

  if (isNaN(parsedPage) || parsedPage < 1) {
    throw new AdminError('Query parameter "page" must be a positive integer >= 1', 'INVALID_PAGINATION', 400);
  }

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new AdminError('Query parameter "limit" must be between 1 and 100', 'INVALID_PAGINATION', 400);
  }

  if (role && role !== 'player' && role !== 'admin') {
    throw new AdminError(`Invalid role filter '${role}'. Allowed roles are: 'player', 'admin'`, 'INVALID_ROLE_FILTER', 400);
  }

  const conditions = [];
  const queryParams = [];

  if (role) {
    queryParams.push(role);
    conditions.push(`u.role = $${queryParams.length}`);
  }

  if (search && String(search).trim() !== '') {
    queryParams.push(`%${String(search).trim()}%`);
    const searchIndex = queryParams.length;
    conditions.push(`(u.email ILIKE $${searchIndex} OR u.name ILIKE $${searchIndex})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 1. Get total matching count
  const countSql = `SELECT COUNT(*) AS total FROM users u ${whereClause};`;
  const countRes = await database.query(countSql, queryParams);
  const total = parseInt(countRes.rows[0].total, 10) || 0;

  // 2. Query paginated records with safe fields
  const offset = (parsedPage - 1) * parsedLimit;
  const paginationParams = [...queryParams, parsedLimit, offset];

  const sql = `
    SELECT
      u.id,
      u.email,
      u.name,
      u.avatar_url AS "avatarUrl",
      u.role,
      u.created_at AS "createdAt",
      u.updated_at AS "updatedAt",
      u.last_login AS "lastLogin",
      p.level,
      p.experience,
      p.score
    FROM users u
    LEFT JOIN player_profiles p ON u.id = p.user_id
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2};
  `;

  const usersRes = await database.query(sql, paginationParams);

  return {
    users: usersRes.rows,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages: Math.ceil(total / parsedLimit) || 1
    }
  };
}

/**
 * Retrieve comprehensive administrative details for a single user by ID
 * @param {string} userId
 */
async function getUserById(userId) {
  const validId = validateUuid(userId);

  // 1. User & Profile
  const userRes = await database.query(
    `SELECT
       u.id,
       u.email,
       u.name,
       u.avatar_url AS "avatarUrl",
       u.role,
       u.created_at AS "createdAt",
       u.updated_at AS "updatedAt",
       u.last_login AS "lastLogin",
       p.level,
       p.experience,
       p.score,
       p.health,
       p.max_health AS "maxHealth"
     FROM users u
     LEFT JOIN player_profiles p ON u.id = p.user_id
     WHERE u.id = $1;`,
    [validId]
  );

  if (userRes.rows.length === 0) {
    throw new AdminError(`User with ID '${validId}' not found`, 'USER_NOT_FOUND', 404);
  }

  const user = userRes.rows[0];

  // 2. Fetch quests, recent puzzle attempts, clues, and sessions concurrently
  const [questsRes, attemptsRes, cluesRes, sessionsRes] = await Promise.all([
    database.query(
      `SELECT
         pq.quest_id AS "questId",
         q.title,
         q.category,
         q.difficulty,
         pq.status,
         pq.progress,
         pq.started_at AS "startedAt",
         pq.completed_at AS "completedAt"
       FROM player_quests pq
       JOIN quests q ON pq.quest_id = q.id
       WHERE pq.player_id = $1
       ORDER BY pq.started_at DESC;`,
      [validId]
    ),
    database.query(
      `SELECT
         pa.id,
         pa.puzzle_id AS "puzzleId",
         p.topic,
         p.difficulty,
         pa.submitted_answer AS "submittedAnswer",
         pa.is_correct AS "isCorrect",
         pa.attempt_number AS "attemptNumber",
         pa.xp_earned AS "xpEarned",
         pa.score_earned AS "scoreEarned",
         pa.time_taken_seconds AS "timeTakenSeconds",
         pa.created_at AS "createdAt"
       FROM puzzle_attempts pa
       LEFT JOIN puzzles p ON pa.puzzle_id = p.id
       WHERE pa.player_id = $1
       ORDER BY pa.created_at DESC
       LIMIT 20;`,
      [validId]
    ),
    database.query(
      `SELECT
         pc.clue_id AS "clueId",
         c.title,
         c.quest_id AS "questId",
         pc.discovered_at AS "discoveredAt"
       FROM player_clues pc
       JOIN clues c ON pc.clue_id = c.id
       WHERE pc.player_id = $1
       ORDER BY pc.discovered_at DESC;`,
      [validId]
    ),
    database.query(
      `SELECT
         id,
         ip_address AS "ipAddress",
         started_at AS "startedAt",
         last_activity AS "lastActivity",
         ended_at AS "endedAt",
         status
       FROM game_sessions
       WHERE player_id = $1
       ORDER BY started_at DESC
       LIMIT 10;`,
      [validId]
    )
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLogin: user.lastLogin
    },
    profile: {
      level: user.level || 1,
      experience: user.experience || 0,
      score: user.score || 0,
      health: user.health || 100,
      maxHealth: user.maxHealth || 100
    },
    quests: questsRes.rows,
    recentPuzzleAttempts: attemptsRes.rows,
    discoveredClues: cluesRes.rows,
    recentSessions: sessionsRes.rows
  };
}

/**
 * Modify user role with safeguards against demoting the last remaining administrator
 * @param {string} userId
 * @param {string} newRole
 */
async function updateUserRole(userId, newRole) {
  const validId = validateUuid(userId);

  if (!newRole || (newRole !== 'admin' && newRole !== 'player')) {
    throw new AdminError(`Invalid role '${newRole}'. Allowed roles: 'admin', 'player'.`, 'INVALID_ROLE', 400);
  }

  // 1. Verify user exists and check current role
  const userCheck = await database.query('SELECT id, role, email, name FROM users WHERE id = $1;', [validId]);
  if (userCheck.rows.length === 0) {
    throw new AdminError(`User with ID '${validId}' not found`, 'USER_NOT_FOUND', 404);
  }

  const currentUser = userCheck.rows[0];

  // 2. Prevent demoting the last remaining administrator
  if (currentUser.role === 'admin' && newRole === 'player') {
    const adminCountRes = await database.query(
      `SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND id != $1;`,
      [validId]
    );

    const remainingAdmins = parseInt(adminCountRes.rows[0].count, 10) || 0;
    if (remainingAdmins === 0) {
      throw new AdminError(
        'Action forbidden: Cannot demote the last remaining administrator in the system.',
        'LAST_ADMIN_DEMOTION_FORBIDDEN',
        409
      );
    }
  }

  // 3. Update role safely
  const updateRes = await database.query(
    `UPDATE users
     SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, name, role, updated_at AS "updatedAt";`,
    [newRole, validId]
  );

  return updateRes.rows[0];
}

/**
 * Calculate game & learning progression analytics from database entities
 */
async function getGameAnalytics() {
  const [questStatsRes, puzzleStatsRes, topicsRes, levelsRes, topPlayersRes] = await Promise.all([
    database.query(`
      SELECT
        (SELECT COUNT(*) FROM quests WHERE status = 'active') AS total_active_quests,
        COUNT(pq.id) AS total_started_quests,
        COUNT(pq.id) FILTER (WHERE pq.status = 'completed') AS total_completed_quests
      FROM player_quests pq;
    `),
    database.query(`
      SELECT
        COUNT(*) AS total_attempts,
        COUNT(*) FILTER (WHERE is_correct = true) AS correct_attempts,
        COALESCE(AVG(time_taken_seconds), 0) AS avg_time_seconds
      FROM puzzle_attempts;
    `),
    database.query(`
      SELECT
        COALESCE(p.topic, 'general') AS topic,
        COUNT(pa.id) AS attempts,
        COUNT(pa.id) FILTER (WHERE pa.is_correct = true) AS correct_attempts
      FROM puzzle_attempts pa
      LEFT JOIN puzzles p ON pa.puzzle_id = p.id
      GROUP BY p.topic
      ORDER BY attempts DESC;
    `),
    database.query(`
      SELECT
        level,
        COUNT(*) AS count
      FROM player_profiles
      GROUP BY level
      ORDER BY level ASC;
    `),
    database.query(`
      SELECT
        u.id,
        u.name,
        p.level,
        p.score
      FROM player_profiles p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.score DESC
      LIMIT 5;
    `)
  ]);

  const qStats = questStatsRes.rows[0];
  const pStats = puzzleStatsRes.rows[0];

  const totalQuests = parseInt(qStats.total_active_quests, 10) || 0;
  const startedQuests = parseInt(qStats.total_started_quests, 10) || 0;
  const completedQuests = parseInt(qStats.total_completed_quests, 10) || 0;
  const questCompletionRate = startedQuests > 0 ? Math.round((completedQuests / startedQuests) * 100) : 0;

  const totalAttempts = parseInt(pStats.total_attempts, 10) || 0;
  const correctAttempts = parseInt(pStats.correct_attempts, 10) || 0;
  const accuracyRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const avgTimeSeconds = Math.round(parseFloat(pStats.avg_time_seconds));

  const topicBreakdown = topicsRes.rows.map(row => {
    const attempts = parseInt(row.attempts, 10) || 0;
    const correct = parseInt(row.correct_attempts, 10) || 0;
    return {
      topic: row.topic,
      attempts,
      correct,
      accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0
    };
  });

  return {
    quests: {
      totalActiveQuests: totalQuests,
      startedQuests,
      completedQuests,
      completionRate: questCompletionRate
    },
    puzzles: {
      totalAttempts,
      correctAttempts,
      accuracyRate,
      averageTimeSeconds: avgTimeSeconds,
      topicBreakdown
    },
    progression: {
      levelDistribution: levelsRes.rows.map(r => ({ level: r.level, count: parseInt(r.count, 10) })),
      topPlayers: topPlayersRes.rows
    }
  };
}

module.exports = {
  AdminError,
  validateUuid,
  getOverview,
  getUsers,
  getUserById,
  updateUserRole,
  getGameAnalytics,
  getAiTelemetry: aiService.getAiTelemetry,
  getSystemHealth: healthService.getDetailedHealth
};
