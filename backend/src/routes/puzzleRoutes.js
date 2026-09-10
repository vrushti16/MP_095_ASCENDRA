const express = require('express');
const router = express.Router();
const puzzleController = require('../controllers/puzzleController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All puzzle interactions require a verified player JWT
router.use(authenticateJWT);

/**
 * @route   POST /api/v1/puzzles/generate
 * @desc    Generate a new AI learning puzzle and persist metadata
 * @access  Private (Authenticated player)
 */
router.post('/generate', puzzleController.generatePuzzle);

/**
 * @route   GET /api/v1/puzzles/:puzzleId
 * @desc    Retrieve sanitized puzzle question and options (never leaks correct_answer)
 * @access  Private (Authenticated player)
 */
router.get('/:puzzleId', puzzleController.getPuzzle);

/**
 * @route   POST /api/v1/puzzles/:puzzleId/attempt
 * @desc    Submit an answer attempt; verifies and awards XP/score server-side
 * @access  Private (Authenticated player)
 */
router.post('/:puzzleId/attempt', puzzleController.submitAttempt);

module.exports = router;
