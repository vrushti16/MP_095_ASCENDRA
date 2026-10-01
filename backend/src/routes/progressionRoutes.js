const express = require('express');
const router = express.Router();
const progressionController = require('../controllers/progressionController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All progression operations require authenticated player JWT
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/progression
 * @desc    Get full player progression, XP, Level, and Game Completion breakdown
 * @access  Private (Authenticated player)
 */
router.get('/', progressionController.getProgression);

/**
 * @route   GET /api/v1/progression/achievements
 * @desc    Get player achievements
 * @access  Private (Authenticated player)
 */
router.get('/achievements', progressionController.getAchievements);

/**
 * @route   POST /api/v1/progression/events & POST /api/v1/game-events
 * @desc    Ingest verified Unity gameplay event with idempotency protection
 * @access  Private (Authenticated player)
 */
router.post('/events', progressionController.recordGameplayEvent);
router.post('/', progressionController.recordGameplayEvent);

module.exports = router;
