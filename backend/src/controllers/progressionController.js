const progressionService = require('../services/progressionService');
const achievementService = require('../services/achievementService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Get comprehensive player progression, XP, level, and game completion
 * GET /api/v1/progression
 */
async function getProgression(req, res, next) {
  try {
    const userId = req.user.id;
    const summary = await progressionService.getPlayerProgressionSummary(userId);
    return sendSuccess(res, summary, 'Player progression retrieved successfully');
  } catch (err) {
    if (err.name === 'ProgressionError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Get player achievements with real server-verified progress
 * GET /api/v1/achievements
 */
async function getAchievements(req, res, next) {
  try {
    const userId = req.user.id;
    const achievements = await achievementService.getAchievementsForPlayer(userId);
    return sendSuccess(res, achievements, 'Achievements retrieved successfully');
  } catch (err) {
    if (err.name === 'AchievementError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Process authenticated Unity gameplay event (anti-cheat & idempotent)
 * POST /api/v1/progression/events
 */
async function recordGameplayEvent(req, res, next) {
  try {
    const { eventId, eventType, payload } = req.body;

    if (!eventId || typeof eventId !== 'string') {
      return sendError(res, 'Valid eventId is required for idempotency', 'VALIDATION_ERROR', 400);
    }
    if (!eventType || typeof eventType !== 'string') {
      return sendError(res, 'Valid eventType is required', 'VALIDATION_ERROR', 400);
    }

    const playerId = req.user.id;
    const result = await achievementService.recordAndProcessGameplayEvent({
      eventId: eventId.trim(),
      eventType: eventType.trim(),
      playerId,
      payload: payload || {}
    });

    return sendSuccess(res, result, 'Gameplay event processed successfully');
  } catch (err) {
    if (err.name === 'AchievementError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  getProgression,
  getAchievements,
  recordGameplayEvent
};
