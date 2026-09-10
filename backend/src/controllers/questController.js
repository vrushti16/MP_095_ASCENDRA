const questService = require('../services/questService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * List all available quests
 * GET /api/v1/quests
 */
async function getQuests(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const quests = await questService.getAllQuests(userId);
    return sendSuccess(res, quests, 'Quests retrieved successfully');
  } catch (err) {
    if (err.name === 'QuestError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Retrieve quest details and current player progress
 * GET /api/v1/quests/:questId
 */
async function getQuest(req, res, next) {
  try {
    const { questId } = req.params;
    if (!questId || typeof questId !== 'string' || questId.trim() === '') {
      return sendError(res, 'Valid questId parameter is required', 'VALIDATION_ERROR', 400);
    }

    const userId = req.user ? req.user.id : null;
    const questData = await questService.getQuestById(questId.trim(), userId);
    return sendSuccess(res, questData, 'Quest details retrieved successfully');
  } catch (err) {
    if (err.name === 'QuestError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Start a quest for authenticated player
 * POST /api/v1/quests/:questId/start
 */
async function startQuest(req, res, next) {
  try {
    const { questId } = req.params;
    if (!questId || typeof questId !== 'string' || questId.trim() === '') {
      return sendError(res, 'Valid questId parameter is required', 'VALIDATION_ERROR', 400);
    }

    const result = await questService.startQuest(questId.trim(), req.user.id);
    return sendSuccess(res, result, result.message);
  } catch (err) {
    if (err.name === 'QuestError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Update quest progress
 * PATCH /api/v1/quests/:questId/progress
 */
async function updateQuestProgress(req, res, next) {
  try {
    const { questId } = req.params;
    if (!questId || typeof questId !== 'string' || questId.trim() === '') {
      return sendError(res, 'Valid questId parameter is required', 'VALIDATION_ERROR', 400);
    }

    // Anti-Cheat: Strictly strip any client-supplied rewards or state bypasses
    const { progress, stepIncrement } = req.body || {};

    const result = await questService.updateQuestProgress(questId.trim(), req.user.id, {
      progress,
      stepIncrement
    });

    return sendSuccess(res, result, 'Quest progress updated successfully');
  } catch (err) {
    if (err.name === 'QuestError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Complete a quest and receive authoritative rewards
 * POST /api/v1/quests/:questId/complete
 */
async function completeQuest(req, res, next) {
  try {
    const { questId } = req.params;
    if (!questId || typeof questId !== 'string' || questId.trim() === '') {
      return sendError(res, 'Valid questId parameter is required', 'VALIDATION_ERROR', 400);
    }

    const result = await questService.completeQuest(questId.trim(), req.user.id);
    return sendSuccess(res, result, result.message);
  } catch (err) {
    if (err.name === 'QuestError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  getQuests,
  getQuest,
  startQuest,
  updateQuestProgress,
  completeQuest
};
