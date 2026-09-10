const express = require('express');
const router = express.Router();
const clueController = require('../controllers/clueController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All clue routes require a verified player JWT
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/clues
 * @desc    Retrieve all clues unlocked by the authenticated player
 * @access  Private (Authenticated player)
 */
router.get('/', clueController.getClues);

/**
 * @route   GET /api/v1/clues/:clueId
 * @desc    Retrieve a specific clue by ID (only if already unlocked by player)
 * @access  Private (Authenticated player)
 */
router.get('/:clueId', clueController.getClue);

module.exports = router;
