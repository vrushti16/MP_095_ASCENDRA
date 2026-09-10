const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateJWT, requireRole } = require('../middleware/authMiddleware');

/**
 * All admin routes require valid JWT authentication and 'admin' role authorization.
 * Unauthenticated requests are rejected with 401.
 * Authenticated non-admin players are rejected with 403.
 */
router.use(authenticateJWT);
router.use(requireRole('admin'));

/**
 * @route   GET /api/v1/admin/overview
 * @desc    High-level platform metrics and service statuses
 * @access  Private (Admin only)
 */
router.get('/overview', adminController.getOverview);

/**
 * @route   GET /api/v1/admin/users
 * @desc    Paginated, searchable, role-filtered list of users
 * @access  Private (Admin only)
 */
router.get('/users', adminController.getUsers);

/**
 * @route   GET /api/v1/admin/users/:id
 * @desc    Deep user inspection (profile, quests, puzzles, clues, sessions)
 * @access  Private (Admin only)
 */
router.get('/users/:id', adminController.getUser);

/**
 * @route   PATCH /api/v1/admin/users/:id/role
 * @desc    Update user role with safeguards against demoting the final admin
 * @access  Private (Admin only)
 */
router.patch('/users/:id/role', adminController.updateUserRole);

/**
 * @route   GET /api/v1/admin/game/analytics
 * @desc    Aggregated quest progression, puzzle accuracy, topic breakdown, and level distribution
 * @access  Private (Admin only)
 */
router.get('/game/analytics', adminController.getGameAnalytics);

/**
 * @route   GET /api/v1/admin/ai/telemetry
 * @desc    AI microservice request logs, validation failure metrics, and latency stats
 * @access  Private (Admin only)
 */
router.get('/ai/telemetry', adminController.getAiTelemetry);

/**
 * @route   GET /api/v1/admin/system/health
 * @desc    Multi-service health diagnostic (Node.js, PostgreSQL, Redis, FastAPI)
 * @access  Private (Admin only)
 */
router.get('/system/health', adminController.getSystemHealth);

module.exports = router;
