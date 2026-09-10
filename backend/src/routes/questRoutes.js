const express = require('express');
const router = express.Router();
const questController = require('../controllers/questController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All player-specific quest operations require a verified JWT
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/quests
 * @desc    List all available quests with player's progress state
 * @access  Private (Authenticated player)
 */
router.get('/', questController.getQuests);

/**
 * @route   GET /api/v1/quests/:questId
 * @desc    Get quest details and personal progress
 * @access  Private (Authenticated player)
 */
router.get('/:questId', questController.getQuest);

/**
 * @route   POST /api/v1/quests/:questId/start
 * @desc    Start a quest (not_started -> in_progress)
 * @access  Private (Authenticated player)
 */
router.post('/:questId/start', questController.startQuest);

/**
 * @route   PATCH /api/v1/quests/:questId/progress
 * @desc    Update quest progress percentage or step increment
 * @access  Private (Authenticated player)
 */
router.patch('/:questId/progress', questController.updateQuestProgress);

/**
 * @route   POST /api/v1/quests/:questId/complete
 * @desc    Complete quest and receive authoritative XP and Score rewards
 * @access  Private (Authenticated player)
 */
router.post('/:questId/complete', questController.completeQuest);

module.exports = router;
