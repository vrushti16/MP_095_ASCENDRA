const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const { loginLimiter, registerLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @route   POST /api/v1/auth/google
 * @desc    Authenticate with verified Google OAuth ID Token
 * @access  Public
 */
router.post('/google', authController.googleLogin);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register new player account with email & password
 * @access  Public (Rate limited: 5 req/min)
 */
router.post('/register', registerLimiter, authController.register);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Log in with email & password
 * @access  Public (Rate limited: 10 req/min)
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Rotate and refresh JWT access token using valid refresh token
 * @access  Public
 */
router.post('/refresh', authController.refresh);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Revoke refresh token and end session
 * @access  Public
 */
router.post('/logout', authController.logout);

/**
 * @route   GET /api/v1/auth/config
 * @desc    Get public authentication configuration
 * @access  Public
 */
router.get('/config', (req, res) => {
  return sendSuccess(res, {
    googleClientId: process.env.GOOGLE_CLIENT_ID || null
  }, 'Auth configuration retrieved');
});

// Protected test routes for verification of JWT and Role middleware
const { authenticateJWT, requireRole } = require('../middleware/authMiddleware');
const { sendSuccess } = require('../utils/apiResponse');

router.get('/me-test', authenticateJWT, (req, res) => {
  return sendSuccess(res, { user: req.user }, 'Authentication verified');
});

router.get('/admin-test', authenticateJWT, requireRole('admin'), (req, res) => {
  return sendSuccess(res, { admin: true, user: req.user }, 'Admin access verified');
});

module.exports = router;
