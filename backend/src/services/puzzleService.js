const { query, getClient } = require('../config/database');
const aiService = require('./aiService');
const progressionService = require('./progressionService');
const clueService = require('./clueService');
const puzzleValidator = require('./puzzleValidator');

class PuzzleError extends Error {
  constructor(message, code = 'PUZZLE_ERROR', statusCode = 400) {
    super(message);
    this.name = 'PuzzleError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Sanitize puzzle record for public client consumption.
 * Strictly excludes correct_answer, correctAnswer, answer keys, and internal evaluation secrets.
 * Preserves 100% backwards compatibility for options array while providing rich content & interactionType.
 *
 * @param {object} p - Raw puzzle record from database
 * @returns {object} Sanitized puzzle payload safe for Unity WebGL
 */
function sanitizePuzzle(p) {
  if (!p) return null;

  let interactionType = 'multiple_choice';
  let content = {};
  let optionsArray = [];

  let rawOpts = p.options;
  if (typeof rawOpts === 'string') {
    try {
      rawOpts = JSON.parse(rawOpts);
    } catch (e) {
      rawOpts = [];
    }
  }

  if (rawOpts && typeof rawOpts === 'object' && !Array.isArray(rawOpts)) {
    interactionType = rawOpts.interactionType || 'multiple_choice';
    content = rawOpts.content || {};
    if (Array.isArray(content.options)) {
      optionsArray = content.options;
    } else if (Array.isArray(content.items)) {
      optionsArray = content.items;
    } else if (Array.isArray(content.choices)) {
      optionsArray = content.choices;
    }
  } else if (Array.isArray(rawOpts)) {
    interactionType = 'multiple_choice';
    optionsArray = rawOpts;
    content = { options: rawOpts };
  }

  return {
    id: p.id,
    questId: p.quest_id || null,
    type: p.type,
    interactionType,
    topic: p.topic,
    difficulty: p.difficulty,
    question: p.question,
    content,
    options: optionsArray,
    xpReward: p.xp_reward,
    scoreReward: p.score_reward,
    createdAt: p.created_at
  };
}

/**
 * Retrieve public puzzle information by puzzle ID
 * @param {string} puzzleId
 * @returns {Promise<object>} Sanitized puzzle object
 */
async function getPuzzleById(puzzleId) {
  const res = await query(
    `SELECT id, quest_id, type, topic, difficulty, question, options, xp_reward, score_reward, created_at
     FROM puzzles
     WHERE id = $1;`,
    [puzzleId]
  );

  if (res.rows.length === 0) {
    throw new PuzzleError(`Puzzle with ID '${puzzleId}' not found`, 'PUZZLE_NOT_FOUND', 404);
  }

  return sanitizePuzzle(res.rows[0]);
}

/**
 * Request new puzzle from AI service, persist to database with answers server-side,
 * and return sanitized puzzle to client.
 *
 * @param {object} params
 * @param {string} [params.questId]
 * @param {string} [params.topic="general"]
 * @param {string} [params.difficulty="easy"]
 * @param {string} [params.type="multiple_choice"]
 * @param {string} [params.interactionType]
 * @returns {Promise<object>} Sanitized generated puzzle
 */
async function generateOrFetchPuzzle({
  questId,
  topic = 'general',
  difficulty = 'easy',
  type = 'multiple_choice',
  interactionType = null
}) {
  // 1. If questId is supplied, verify quest exists and is active
  if (questId) {
    const questRes = await query(
      'SELECT id, status FROM quests WHERE id = $1 AND status = \'active\';',
      [questId]
    );
    if (questRes.rows.length === 0) {
      throw new PuzzleError(`Quest '${questId}' does not exist or is inactive`, 'QUEST_NOT_FOUND', 404);
    }
  }

  // 2. Request generation from Developer B's FastAPI service (with validator & retry)
  const generated = await aiService.requestPuzzleGeneration({
    questId,
    topic,
    difficulty,
    type,
    interactionType
  });

  // 3. Compute baseline rewards based on difficulty
  let xpReward = 20;
  let scoreReward = 50;

  if (generated.difficulty === 'medium') {
    xpReward = 40;
    scoreReward = 100;
  } else if (generated.difficulty === 'hard') {
    xpReward = 80;
    scoreReward = 200;
  }

  // 4. Generate unique server-side puzzle ID
  const puzzleId = `pz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 5. Canonical JSONB options structure storing interactionType and content
  const canonicalContent = (generated.content && typeof generated.content === 'object' && Object.keys(generated.content).length > 0)
    ? generated.content
    : { options: Array.isArray(generated.options) ? generated.options : [] };

  const canonicalInteractionType = generated.interactionType ||
    (Array.isArray(generated.options) ? 'multiple_choice' : 'multiple_choice');

  const canonicalOptions = JSON.stringify({
    interactionType: canonicalInteractionType,
    content: canonicalContent
  });

  const authoritativeAnswer = generated.answer !== undefined && generated.answer !== null
    ? (typeof generated.answer === 'object' ? JSON.stringify(generated.answer) : String(generated.answer).trim())
    : (generated.correctAnswer !== undefined && generated.correctAnswer !== null ? String(generated.correctAnswer).trim() : '');

  // 6. Persist to PostgreSQL (correct_answer stored server-side only)
  const insertRes = await query(
    `INSERT INTO puzzles (
       id, quest_id, external_ai_puzzle_id, type, topic, difficulty,
       question, options, correct_answer, explanation, xp_reward, score_reward
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id, quest_id, type, topic, difficulty, question, options, xp_reward, score_reward, created_at;`,
    [
      puzzleId,
      questId || null,
      generated.externalPuzzleId || `ai_${Date.now()}`,
      generated.type || 'multiple_choice',
      generated.topic || 'general',
      generated.difficulty || 'easy',
      generated.question,
      canonicalOptions,
      authoritativeAnswer,
      generated.explanation || null,
      xpReward,
      scoreReward
    ]
  );

  return sanitizePuzzle(insertRes.rows[0]);
}

/**
 * Server-Authoritative Puzzle Attempt Submission.
 * Validates player's answer according to interactionType, records every attempt,
 * awards XP/score only once, advances quest progress, and unlocks eligible clue in the SAME transaction.
 * Concurrency-safe against duplicate simultaneous solve submissions.
 *
 * @param {object} params
 * @param {string} params.puzzleId - Puzzle identifier
 * @param {string} params.playerId - Authenticated player UUID from JWT
 * @param {*} params.answer - Submitted player answer (string, number, array, or object)
 * @param {number} [params.timeTakenSeconds=0] - Time taken by player
 * @returns {Promise<object>} Result payload
 */
async function submitPuzzleAttempt({ puzzleId, playerId, answer, timeTakenSeconds = 0 }) {
  if (!puzzleId || typeof puzzleId !== 'string') {
    throw new PuzzleError('puzzleId is required', 'VALIDATION_ERROR', 400);
  }

  if (answer === undefined || answer === null || (typeof answer === 'string' && answer.trim() === '')) {
    throw new PuzzleError('answer is required and must not be empty', 'VALIDATION_ERROR', 400);
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Load puzzle definition including correct_answer and options
    const puzzleRes = await client.query(
      `SELECT id, quest_id, type, topic, difficulty, question, options, correct_answer, xp_reward, score_reward
       FROM puzzles
       WHERE id = $1;`,
      [puzzleId]
    );

    if (puzzleRes.rows.length === 0) {
      throw new PuzzleError(`Puzzle with ID '${puzzleId}' not found`, 'PUZZLE_NOT_FOUND', 404);
    }

    const puzzle = puzzleRes.rows[0];

    // 2. Lock attempts for this player and puzzle FOR UPDATE to prevent race conditions
    const attemptsRes = await client.query(
      `SELECT id, is_correct, attempt_number
       FROM puzzle_attempts
       WHERE player_id = $1 AND puzzle_id = $2
       FOR UPDATE;`,
      [playerId, puzzleId]
    );

    const existingAttempts = attemptsRes.rows;
    const previouslySolved = existingAttempts.some(a => a.is_correct);
    const attemptNumber = existingAttempts.length + 1;

    // 3. Multi-modal server-side answer evaluation
    const isCorrect = puzzleValidator.verifySubmittedAnswer(puzzle, answer);

    let xpEarned = 0;
    let scoreEarned = 0;
    let alreadyRewarded = previouslySolved;
    let unlockedClue = null;

    // 4. Award rewards ONLY on the first successful solve
    if (isCorrect && !previouslySolved) {
      xpEarned = puzzle.xp_reward;
      scoreEarned = puzzle.score_reward;

      // Award XP and Score through authoritative progressionService
      await progressionService.awardProgression({
        userId: playerId,
        xpEarned,
        scoreEarned,
        client
      });

      // 5. If associated with a quest, advance quest progress safely without bypassing completion
      if (puzzle.quest_id) {
        const pqRes = await client.query(
          `SELECT id, status, progress
           FROM player_quests
           WHERE player_id = $1 AND quest_id = $2
           FOR UPDATE;`,
          [playerId, puzzle.quest_id]
        );

        if (pqRes.rows.length > 0 && pqRes.rows[0].status === 'in_progress') {
          // Increment progress by 25% (up to 100%), but keep status as in_progress!
          const currentProg = pqRes.rows[0].progress;
          const nextProg = Math.min(100, currentProg + 25);

          await client.query(
            `UPDATE player_quests
             SET progress = $1
             WHERE id = $2;`,
            [nextProg, pqRes.rows[0].id]
          );
        }

        // 6. Unlock the next eligible clue in sequence for this quest within the SAME transaction
        const clueUnlockResult = await clueService.unlockNextClueForQuest({
          userId: playerId,
          questId: puzzle.quest_id,
          client
        });

        if (clueUnlockResult && clueUnlockResult.unlocked) {
          unlockedClue = clueUnlockResult.clue;
        }
      }
    }

    // 7. Record the attempt in puzzle_attempts
    const sanitizedTimeTaken = Math.max(0, parseInt(timeTakenSeconds, 10) || 0);
    const serializedSubmitted = typeof answer === 'object' ? JSON.stringify(answer) : String(answer).trim();

    await client.query(
      `INSERT INTO puzzle_attempts (
         player_id, puzzle_id, submitted_answer, is_correct,
         attempt_number, xp_earned, score_earned, time_taken_seconds
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
      [
        playerId,
        puzzleId,
        serializedSubmitted,
        isCorrect,
        attemptNumber,
        xpEarned,
        scoreEarned,
        sanitizedTimeTaken
      ]
    );

    await client.query('COMMIT');

    return {
      correct: isCorrect,
      attemptNumber,
      reward: {
        xp: xpEarned,
        score: scoreEarned
      },
      alreadyRewarded,
      questProgressUpdated: isCorrect && !previouslySolved && !!puzzle.quest_id,
      unlockedClue: unlockedClue ? {
        id: unlockedClue.id,
        questId: unlockedClue.questId,
        title: unlockedClue.title,
        content: unlockedClue.content,
        sequenceNumber: unlockedClue.sequenceNumber,
        discoveredAt: unlockedClue.discoveredAt
      } : null
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  PuzzleError,
  sanitizePuzzle,
  getPuzzleById,
  generateOrFetchPuzzle,
  submitPuzzleAttempt
};
