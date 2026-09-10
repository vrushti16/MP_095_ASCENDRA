const { query, getClient } = require('../config/database');
const progressionService = require('./progressionService');
const cacheService = require('./cacheService');

class QuestError extends Error {
  constructor(message, code = 'QUEST_ERROR', statusCode = 400) {
    super(message);
    this.name = 'QuestError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Retrieve all active quests, optionally annotating each with the authenticated player's progress
 * @param {string} [userId] - Optional UUID of player
 * @returns {Promise<Array<object>>} List of quests with progress
 */
async function getAllQuests(userId = null) {
  if (!userId) {
    const cacheKey = 'quests:catalog:public';
    const cachedCatalog = await cacheService.get(cacheKey);
    if (cachedCatalog) {
      return cachedCatalog;
    }

    const res = await query(
      `SELECT id, title, description, category, difficulty, xp_reward, score_reward, status
       FROM quests
       WHERE status = 'active'
       ORDER BY created_at ASC;`
    );

    const catalog = res.rows.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description,
      category: q.category,
      difficulty: q.difficulty,
      xpReward: q.xp_reward,
      scoreReward: q.score_reward
    }));

    await cacheService.set(cacheKey, catalog, 300); // Cache for 5 minutes
    return catalog;
  }

  const res = await query(
    `SELECT
       q.id, q.title, q.description, q.category, q.difficulty,
       q.xp_reward, q.score_reward, q.status,
       pq.status AS player_status,
       pq.progress AS player_progress,
       pq.started_at,
       pq.completed_at
     FROM quests q
     LEFT JOIN player_quests pq
       ON q.id = pq.quest_id AND pq.player_id = $1
     WHERE q.status = 'active'
     ORDER BY q.created_at ASC;`,
    [userId]
  );

  return res.rows.map(row => ({
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    difficulty: row.difficulty,
    xpReward: row.xp_reward,
    scoreReward: row.score_reward,
    playerProgress: {
      status: row.player_status || 'not_started',
      progress: row.player_progress !== null ? row.player_progress : 0,
      startedAt: row.started_at || null,
      completedAt: row.completed_at || null
    }
  }));
}

/**
 * Retrieve detailed quest information by quest ID with the player's personal progress
 * @param {string} questId
 * @param {string} [userId]
 * @returns {Promise<object>} Quest details and player progress
 */
async function getQuestById(questId, userId = null) {
  const questRes = await query(
    `SELECT id, title, description, category, difficulty, xp_reward, score_reward, status
     FROM quests
     WHERE id = $1 AND status = 'active';`,
    [questId]
  );

  if (questRes.rows.length === 0) {
    throw new QuestError(`Quest with ID '${questId}' not found`, 'QUEST_NOT_FOUND', 404);
  }

  const q = questRes.rows[0];
  let playerProgress = {
    status: 'not_started',
    progress: 0,
    startedAt: null,
    completedAt: null
  };

  if (userId) {
    const pqRes = await query(
      `SELECT status, progress, started_at, completed_at
       FROM player_quests
       WHERE player_id = $1 AND quest_id = $2;`,
      [userId, questId]
    );

    if (pqRes.rows.length > 0) {
      const pq = pqRes.rows[0];
      playerProgress = {
        status: pq.status,
        progress: pq.progress,
        startedAt: pq.started_at,
        completedAt: pq.completed_at
      };
    }
  }

  return {
    quest: {
      id: q.id,
      title: q.title,
      description: q.description,
      category: q.category,
      difficulty: q.difficulty,
      xpReward: q.xp_reward,
      scoreReward: q.score_reward
    },
    playerProgress
  };
}

/**
 * Start a quest for the authenticated player (transitions not_started -> in_progress)
 * Idempotent: If already in_progress, returns current state safely.
 * @param {string} questId
 * @param {string} userId
 * @returns {Promise<object>} Updated quest state
 */
async function startQuest(questId, userId) {
  // 1. Verify quest exists and is active
  const questRes = await query(
    `SELECT id, title, xp_reward, score_reward, status
     FROM quests
     WHERE id = $1 AND status = 'active';`,
    [questId]
  );

  if (questRes.rows.length === 0) {
    throw new QuestError(`Quest '${questId}' does not exist or is inactive`, 'QUEST_NOT_FOUND', 404);
  }

  // 2. Query or insert player_quest
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const pqRes = await client.query(
      `SELECT id, status, progress, started_at, completed_at
       FROM player_quests
       WHERE player_id = $1 AND quest_id = $2
       FOR UPDATE;`,
      [userId, questId]
    );

    let progressRecord;

    if (pqRes.rows.length === 0) {
      // Create new in_progress record
      const insertRes = await client.query(
        `INSERT INTO player_quests (player_id, quest_id, status, progress, started_at)
         VALUES ($1, $2, 'in_progress', 0, NOW())
         RETURNING status, progress, started_at, completed_at;`,
        [userId, questId]
      );
      progressRecord = insertRes.rows[0];
    } else {
      progressRecord = pqRes.rows[0];
      if (progressRecord.status === 'completed') {
        await client.query('COMMIT');
        return {
          questId,
          status: 'completed',
          progress: progressRecord.progress,
          startedAt: progressRecord.started_at,
          completedAt: progressRecord.completed_at,
          message: 'Quest has already been completed'
        };
      }
    }

    await client.query('COMMIT');

    return {
      questId,
      status: progressRecord.status,
      progress: progressRecord.progress,
      startedAt: progressRecord.started_at,
      completedAt: progressRecord.completed_at,
      message: 'Quest started successfully'
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update quest progression.
 * Strictly prevents client from using progress update as a bypass to mark quest completed.
 * @param {string} questId
 * @param {string} userId
 * @param {object} payload - { progress: number, stepIncrement?: number }
 * @returns {Promise<object>} Updated player_quests progress
 */
async function updateQuestProgress(questId, userId, payload) {
  const { progress, stepIncrement } = payload;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const pqRes = await client.query(
      `SELECT id, status, progress, started_at, completed_at
       FROM player_quests
       WHERE player_id = $1 AND quest_id = $2
       FOR UPDATE;`,
      [userId, questId]
    );

    if (pqRes.rows.length === 0) {
      throw new QuestError('Quest has not been started yet. Call start endpoint first.', 'QUEST_NOT_STARTED', 400);
    }

    const currentRecord = pqRes.rows[0];

    if (currentRecord.status === 'completed') {
      throw new QuestError('Cannot modify progress of an already completed quest', 'QUEST_ALREADY_COMPLETED', 400);
    }

    let nextProgress = currentRecord.progress;

    if (typeof stepIncrement === 'number') {
      if (stepIncrement < 0) {
        throw new QuestError('stepIncrement must be a non-negative number', 'INVALID_INCREMENT', 400);
      }
      nextProgress = Math.min(100, nextProgress + Math.floor(stepIncrement));
    } else if (typeof progress === 'number') {
      if (progress < 0 || progress > 100) {
        throw new QuestError('Progress percentage must be an integer between 0 and 100', 'INVALID_PROGRESS', 400);
      }
      // Progress cannot regress backwards
      if (progress < currentRecord.progress) {
        throw new QuestError('Progress cannot decrease backwards', 'PROGRESS_REGRESSION', 400);
      }
      nextProgress = Math.floor(progress);
    } else {
      throw new QuestError('Either progress (0-100) or stepIncrement must be provided', 'VALIDATION_ERROR', 400);
    }

    // Anti-Cheat: Progress updates never set status to 'completed' or grant rewards.
    // Quest completion must always go through the explicit complete endpoint.
    const updateRes = await client.query(
      `UPDATE player_quests
       SET progress = $1
       WHERE player_id = $2 AND quest_id = $3
       RETURNING status, progress, started_at, completed_at;`,
      [nextProgress, userId, questId]
    );

    await client.query('COMMIT');

    const updated = updateRes.rows[0];
    return {
      questId,
      status: updated.status,
      progress: updated.progress,
      startedAt: updated.started_at,
      completedAt: updated.completed_at
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Server-Authoritative Quest Completion.
 * Atomically validates requirements, updates quest status to 'completed', and awards XP + Score.
 * Idempotent: If already completed, returns state safely without double-awarding rewards.
 *
 * @param {string} questId
 * @param {string} userId
 * @returns {Promise<object>} Completion state, awarded rewards, updated profile
 */
async function completeQuest(questId, userId) {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Verify quest definition and rewards
    const questRes = await client.query(
      `SELECT id, title, xp_reward, score_reward, status
       FROM quests
       WHERE id = $1 AND status = 'active';`,
      [questId]
    );

    if (questRes.rows.length === 0) {
      throw new QuestError(`Quest with ID '${questId}' not found or inactive`, 'QUEST_NOT_FOUND', 404);
    }

    const quest = questRes.rows[0];

    // 2. Lock player_quest row FOR UPDATE to prevent race conditions & double-rewards
    const pqRes = await client.query(
      `SELECT id, status, progress, started_at, completed_at
       FROM player_quests
       WHERE player_id = $1 AND quest_id = $2
       FOR UPDATE;`,
      [userId, questId]
    );

    if (pqRes.rows.length === 0) {
      throw new QuestError('Cannot complete a quest that has not been started', 'QUEST_NOT_STARTED', 400);
    }

    const currentProgress = pqRes.rows[0];

    // 3. Check if already completed (Anti-Duplicate Rewards & Network Retries)
    if (currentProgress.status === 'completed') {
      await client.query('COMMIT');
      return {
        alreadyCompleted: true,
        message: 'Quest was already completed. No duplicate rewards granted.',
        quest: { id: quest.id, title: quest.title },
        playerProgress: {
          status: 'completed',
          progress: currentProgress.progress,
          startedAt: currentProgress.started_at,
          completedAt: currentProgress.completed_at
        },
        reward: { xp: 0, score: 0 }
      };
    }

    // 4. Mark quest as completed and set progress to 100%
    const updateRes = await client.query(
      `UPDATE player_quests
       SET status = 'completed',
           progress = 100,
           completed_at = NOW()
       WHERE player_id = $1 AND quest_id = $2
       RETURNING status, progress, started_at, completed_at;`,
      [userId, questId]
    );

    const completedRecord = updateRes.rows[0];

    // 5. Award authoritative XP and Score rewards via progressionService within the same transaction
    const progressionResult = await progressionService.awardProgression({
      userId,
      xpEarned: quest.xp_reward,
      scoreEarned: quest.score_reward,
      client
    });

    await client.query('COMMIT');

    return {
      alreadyCompleted: false,
      message: 'Quest completed successfully! Rewards awarded.',
      quest: {
        id: quest.id,
        title: quest.title
      },
      playerProgress: {
        status: completedRecord.status,
        progress: completedRecord.progress,
        startedAt: completedRecord.started_at,
        completedAt: completedRecord.completed_at
      },
      reward: progressionResult.reward,
      profile: progressionResult.profile,
      levelUp: progressionResult.levelUp
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  QuestError,
  getAllQuests,
  getQuestById,
  startQuest,
  updateQuestProgress,
  completeQuest
};
