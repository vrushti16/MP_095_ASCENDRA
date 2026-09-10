const puzzleService = require('../services/puzzleService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Generate a new learning puzzle via AI service and persist to database
 * POST /api/v1/puzzles/generate
 */
async function generatePuzzle(req, res, next) {
  try {
    const { questId, topic, difficulty, type, interactionType } = req.body || {};

    if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
      return sendError(res, 'Difficulty must be one of: easy, medium, hard', 'VALIDATION_ERROR', 400);
    }

    const puzzle = await puzzleService.generateOrFetchPuzzle({
      questId,
      topic,
      difficulty,
      type,
      interactionType
    });

    return sendSuccess(res, puzzle, 'Puzzle generated successfully', 201);
  } catch (err) {
    if (err.name === 'PuzzleError' || err.name === 'AiServiceError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Get sanitized puzzle information (excludes correct answer)
 * GET /api/v1/puzzles/:puzzleId
 */
async function getPuzzle(req, res, next) {
  try {
    const { puzzleId } = req.params;
    if (!puzzleId || typeof puzzleId !== 'string' || puzzleId.trim() === '') {
      return sendError(res, 'puzzleId parameter is required', 'VALIDATION_ERROR', 400);
    }

    const puzzle = await puzzleService.getPuzzleById(puzzleId.trim());
    return sendSuccess(res, puzzle, 'Puzzle retrieved successfully');
  } catch (err) {
    if (err.name === 'PuzzleError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Submit an answer attempt for a puzzle
 * POST /api/v1/puzzles/:puzzleId/attempt
 */
async function submitAttempt(req, res, next) {
  try {
    const { puzzleId } = req.params;
    if (!puzzleId || typeof puzzleId !== 'string' || puzzleId.trim() === '') {
      return sendError(res, 'puzzleId parameter is required', 'VALIDATION_ERROR', 400);
    }

    const { answer, timeTakenSeconds } = req.body || {};

    if (answer === undefined || answer === null || String(answer).trim() === '') {
      return sendError(res, 'answer is required and must not be empty', 'VALIDATION_ERROR', 400);
    }

    // Authenticated user ID is strictly taken from verified JWT
    const playerId = req.user.id;

    const result = await puzzleService.submitPuzzleAttempt({
      puzzleId: puzzleId.trim(),
      playerId,
      answer,
      timeTakenSeconds
    });

    const message = result.correct
      ? (result.alreadyRewarded ? 'Correct answer! Puzzle was already solved previously.' : 'Correct answer! Reward granted.')
      : 'Incorrect answer. Try again!';

    return sendSuccess(res, result, message);
  } catch (err) {
    if (err.name === 'PuzzleError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  generatePuzzle,
  getPuzzle,
  submitAttempt
};
