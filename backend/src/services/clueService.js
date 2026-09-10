const { query, getClient } = require('../config/database');

class ClueError extends Error {
  constructor(message, code = 'CLUE_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ClueError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Sanitize clue record for client consumption.
 * Ensures consistent camelCase format and safe exposure.
 * @param {object} c - Raw clue record from database
 * @returns {object} Public clue object
 */
function sanitizeClue(c) {
  if (!c) return null;

  return {
    id: c.id,
    questId: c.quest_id,
    questTitle: c.quest_title || null,
    title: c.title,
    content: c.content,
    sequenceNumber: c.sequence_number,
    discoveredAt: c.discovered_at || null,
    createdAt: c.created_at || null
  };
}

/**
 * Retrieve all clues legitimately unlocked by the authenticated player.
 * @param {string} userId - Authenticated player UUID from JWT
 * @returns {Promise<Array<object>>} List of unlocked clues
 */
async function getPlayerClues(userId) {
  if (!userId) {
    throw new ClueError('User ID is required', 'VALIDATION_ERROR', 400);
  }

  const res = await query(
    `SELECT c.id, c.quest_id, q.title AS quest_title, c.title, c.content,
            c.sequence_number, c.created_at, pc.discovered_at
     FROM player_clues pc
     JOIN clues c ON pc.clue_id = c.id
     JOIN quests q ON c.quest_id = q.id
     WHERE pc.player_id = $1
     ORDER BY pc.discovered_at DESC, c.sequence_number ASC;`,
    [userId]
  );

  return res.rows.map(sanitizeClue);
}

/**
 * Retrieve a specific clue by ID, strictly verifying that the authenticated
 * player has discovered/unlocked it.
 *
 * @param {string} clueId - Clue identifier
 * @param {string} userId - Authenticated player UUID from JWT
 * @returns {Promise<object>} Sanitized clue object
 */
async function getClueById(clueId, userId) {
  if (!clueId || typeof clueId !== 'string') {
    throw new ClueError('Valid clueId is required', 'VALIDATION_ERROR', 400);
  }
  if (!userId) {
    throw new ClueError('User ID is required', 'VALIDATION_ERROR', 400);
  }

  const res = await query(
    `SELECT c.id, c.quest_id, q.title AS quest_title, c.title, c.content,
            c.sequence_number, c.created_at, pc.discovered_at
     FROM clues c
     JOIN quests q ON c.quest_id = q.id
     LEFT JOIN player_clues pc ON pc.clue_id = c.id AND pc.player_id = $2
     WHERE c.id = $1;`,
    [clueId, userId]
  );

  if (res.rows.length === 0) {
    throw new ClueError(`Clue with ID '${clueId}' not found`, 'CLUE_NOT_FOUND', 404);
  }

  const clueRow = res.rows[0];

  // If the player has not discovered this clue, access is forbidden
  if (!clueRow.discovered_at) {
    throw new ClueError(
      'Clue is locked. Solve the associated challenge to unlock it.',
      'CLUE_LOCKED',
      403
    );
  }

  return sanitizeClue(clueRow);
}

/**
 * Internal server-side helper to unlock a specific clue for a player idempotently.
 * Never exposed directly as an HTTP endpoint.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.clueId
 * @param {object} [params.client] - Optional active database transaction client
 * @returns {Promise<object>} Unlock result
 */
async function unlockClue({ userId, clueId, client = null }) {
  if (!userId || !clueId) {
    throw new ClueError('userId and clueId are required to unlock a clue', 'VALIDATION_ERROR', 400);
  }

  const dbClient = client || { query };

  // 1. Verify clue exists
  const clueRes = await dbClient.query(
    'SELECT id, quest_id, title, content, sequence_number, created_at FROM clues WHERE id = $1;',
    [clueId]
  );
  if (clueRes.rows.length === 0) {
    throw new ClueError(`Clue '${clueId}' does not exist`, 'CLUE_NOT_FOUND', 404);
  }

  const clue = clueRes.rows[0];

  // 2. Idempotent insert into player_clues
  const insertRes = await dbClient.query(
    `INSERT INTO player_clues (player_id, clue_id)
     VALUES ($1, $2)
     ON CONFLICT (player_id, clue_id) DO NOTHING
     RETURNING id, discovered_at;`,
    [userId, clueId]
  );

  const newlyUnlocked = insertRes.rows.length > 0;
  const discoveredAt = newlyUnlocked ? insertRes.rows[0].discovered_at : null;

  return {
    unlocked: newlyUnlocked,
    clue: {
      id: clue.id,
      questId: clue.quest_id,
      title: clue.title,
      content: clue.content,
      sequenceNumber: clue.sequence_number,
      discoveredAt: discoveredAt || new Date()
    }
  };
}

/**
 * Internal server-side helper to find and unlock the next eligible clue for a quest.
 * Selects the lowest sequence_number clue not yet discovered by the player.
 * Must run inside an ongoing transaction client during puzzle solve.
 *
 * @param {object} params
 * @param {string} params.userId - Authenticated player UUID
 * @param {string} params.questId - Associated quest ID
 * @param {object} params.client - Database transaction client
 * @returns {Promise<object>} { unlocked: boolean, clue: object|null }
 */
async function unlockNextClueForQuest({ userId, questId, client }) {
  if (!userId || !questId) {
    return { unlocked: false, clue: null };
  }

  if (!client) {
    throw new ClueError('Database transaction client is required', 'TRANSACTION_REQUIRED', 500);
  }

  // 1. Find the lowest sequence_number clue for this quest that the player has not yet unlocked
  const eligibleRes = await client.query(
    `SELECT c.id, c.quest_id, c.title, c.content, c.sequence_number, c.created_at
     FROM clues c
     WHERE c.quest_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM player_clues pc
         WHERE pc.player_id = $2 AND pc.clue_id = c.id
       )
     ORDER BY c.sequence_number ASC
     LIMIT 1;`,
    [questId, userId]
  );

  if (eligibleRes.rows.length === 0) {
    // All clues for this quest are already unlocked, or no clues exist for this quest
    return { unlocked: false, clue: null };
  }

  const eligibleClue = eligibleRes.rows[0];

  // 2. Insert into player_clues inside the same transaction
  const insertRes = await client.query(
    `INSERT INTO player_clues (player_id, clue_id)
     VALUES ($1, $2)
     ON CONFLICT (player_id, clue_id) DO NOTHING
     RETURNING id, discovered_at;`,
    [userId, eligibleClue.id]
  );

  if (insertRes.rows.length === 0) {
    // Handled by conflict (e.g. concurrent attempt already inserted)
    return { unlocked: false, clue: null };
  }

  return {
    unlocked: true,
    clue: {
      id: eligibleClue.id,
      questId: eligibleClue.quest_id,
      title: eligibleClue.title,
      content: eligibleClue.content,
      sequenceNumber: eligibleClue.sequence_number,
      discoveredAt: insertRes.rows[0].discovered_at
    }
  };
}

module.exports = {
  ClueError,
  sanitizeClue,
  getPlayerClues,
  getClueById,
  unlockClue,
  unlockNextClueForQuest
};
