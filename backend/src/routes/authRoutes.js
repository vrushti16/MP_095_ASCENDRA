const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

const {
  loginLimiter,
  registerLimiter,
  forgotPasswordRequestLimiter,
  forgotPasswordVerifyLimiter,
  registrationOtpRequestLimiter,
  registrationOtpVerifyLimiter
} = require('../middleware/rateLimitMiddleware');

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
 * @route   POST /api/v1/auth/register/send-verification
 * @desc    Send 6-digit email OTP for registration verification (Section 8)
 * @access  Public (Rate limited)
 */
router.post('/register/send-verification', registrationOtpRequestLimiter, authController.sendEmailVerification);

/**
 * @route   POST /api/v1/auth/register/verify-email
 * @desc    Verify 6-digit OTP and activate player account (Section 8)
 * @access  Public (Rate limited)
 */
router.post('/register/verify-email', registrationOtpVerifyLimiter, authController.verifyEmail);

/**
 * @route   POST /api/v1/auth/register/resend-verification
 * @desc    Resend registration verification OTP (Section 8)
 * @access  Public (Rate limited)
 */
router.post('/register/resend-verification', registrationOtpRequestLimiter, authController.resendVerification);

/**
 * @route   POST /api/v1/auth/register/request-otp
 * @desc    Request 6-digit email OTP for real Gmail registration
 * @access  Public (Rate limited)
 */
router.post('/register/request-otp', registrationOtpRequestLimiter, authController.requestRegistrationOtp);

/**
 * @route   POST /api/v1/auth/register/verify-otp
 * @desc    Verify 6-digit OTP and complete player registration
 * @access  Public (Rate limited)
 */
router.post('/register/verify-otp', registrationOtpVerifyLimiter, authController.verifyRegistrationOtp);

/**
 * @route   POST /api/v1/auth/register/resend-otp
 * @desc    Resend 6-digit registration OTP
 * @access  Public (Rate limited)
 */
router.post('/register/resend-otp', registrationOtpRequestLimiter, authController.resendRegistrationOtp);

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
 * @route   POST /api/v1/auth/forgot-password/request-otp
 * @desc    Request 6-digit email OTP for password reset
 * @access  Public (Rate limited)
 */
router.post('/forgot-password/request-otp', forgotPasswordRequestLimiter, authController.requestPasswordResetOtp);

/**
 * @route   POST /api/v1/auth/forgot-password/verify-otp
 * @desc    Verify 6-digit OTP and obtain scoped reset authorization token
 * @access  Public (Rate limited)
 */
router.post('/forgot-password/verify-otp', forgotPasswordVerifyLimiter, authController.verifyPasswordResetOtp);

/**
 * @route   POST /api/v1/auth/forgot-password/reset
 * @desc    Reset password using valid reset authorization token
 * @access  Public
 */
router.post('/forgot-password/reset', authController.resetPassword);


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
