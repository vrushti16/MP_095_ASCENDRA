const express = require('express');
const router = express.Router();
const progressionController = require('../controllers/progressionController');
const { authenticateJWT } = require('../middleware/authMiddleware');

router.use(authenticateJWT);

/**
 * @route   GET /api/v1/achievements
 * @desc    Get real server-evaluated achievements and player progress
 * @access  Private (Authenticated player)
 */
router.get('/', progressionController.getAchievements);

module.exports = router;
