const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateJWT } = require('../middleware/authMiddleware');

// All user endpoints require a valid JWT
router.use(authenticateJWT);

/**
 * @route   GET /api/v1/users/me
 * @desc    Retrieve current authenticated user's account information
 * @access  Private (Authenticated user)
 */
router.get('/me', userController.getMe);

/**
 * @route   GET /api/v1/users/me/profile
 * @desc    Retrieve current player's persistent stats (level, XP, score, health)
 * @access  Private (Authenticated player)
 */
router.get('/me/profile', userController.getProfile);

/**
 * @route   PATCH /api/v1/users/me/profile
 * @desc    Update editable public profile fields (name, avatarUrl)
 * @access  Private (Authenticated player)
 */
router.patch('/me/profile', userController.updateProfile);

module.exports = router;
