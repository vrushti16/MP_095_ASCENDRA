const clueService = require('../services/clueService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Retrieve all clues unlocked by the authenticated player
 * GET /api/v1/clues
 */
async function getClues(req, res, next) {
  try {
    const userId = req.user.id;
    const clues = await clueService.getPlayerClues(userId);
    return sendSuccess(res, clues, 'Unlocked clues retrieved successfully');
  } catch (err) {
    if (err.name === 'ClueError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Retrieve a specific clue by ID, only if authorized and unlocked by the authenticated player
 * GET /api/v1/clues/:clueId
 */
async function getClue(req, res, next) {
  try {
    const { clueId } = req.params;
    if (!clueId || typeof clueId !== 'string' || clueId.trim() === '') {
      return sendError(res, 'Valid clueId parameter is required', 'VALIDATION_ERROR', 400);
    }

    const userId = req.user.id;
    const clue = await clueService.getClueById(clueId.trim(), userId);
    return sendSuccess(res, clue, 'Clue retrieved successfully');
  } catch (err) {
    if (err.name === 'ClueError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  getClues,
  getClue
};
