const adminService = require('../services/adminService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * GET /api/v1/admin/overview
 * System, user, quest, and puzzle summary statistics
 */
async function getOverview(req, res, next) {
  try {
    const overview = await adminService.getOverview();
    return sendSuccess(res, overview, 'Admin dashboard overview retrieved successfully');
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/users
 * Searchable, paginated, and role-filtered list of users
 */
async function getUsers(req, res, next) {
  try {
    const { page, limit, search, role } = req.query;
    const result = await adminService.getUsers({ page, limit, search, role });
    return sendSuccess(res, result, 'Users retrieved successfully');
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/users/:id
 * Detailed profile, quest progression, puzzle attempts, and clues for a specific user
 */
async function getUser(req, res, next) {
  try {
    const userDetail = await adminService.getUserById(req.params.id);
    return sendSuccess(res, userDetail, 'User details retrieved successfully');
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/users/:id/role
 * Promote or demote user role with guardrails against removing the last admin
 */
async function updateUserRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role) {
      return sendError(res, 'Request body must contain "role" field ("admin" or "player")', 'MISSING_ROLE', 400);
    }

    const updatedUser = await adminService.updateUserRole(req.params.id, role);
    return sendSuccess(res, updatedUser, `User role successfully updated to '${role}'`);
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/game/analytics
 * Aggregated quest completion, puzzle accuracy, topic breakdown, and level distribution
 */
async function getGameAnalytics(req, res, next) {
  try {
    const analytics = await adminService.getGameAnalytics();
    return sendSuccess(res, analytics, 'Game progression analytics retrieved successfully');
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/ai/telemetry
 * Microservice generation outcomes, latency distribution, and validation metrics
 */
async function getAiTelemetry(req, res, next) {
  try {
    const telemetry = await adminService.getAiTelemetry();
    return sendSuccess(res, telemetry, 'AI microservice telemetry retrieved successfully');
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * GET /api/v1/admin/system/health
 * Deep multi-service health diagnostic (Node.js, PostgreSQL, Redis, FastAPI)
 */
async function getSystemHealth(req, res, next) {
  try {
    const health = await adminService.getSystemHealth();
    return res.status(health.httpStatusCode).json({
      success: health.httpStatusCode !== 503,
      data: health.payload,
      message: health.payload.status === 'healthy'
        ? 'All system components are healthy'
        : health.payload.status === 'degraded'
          ? 'System is operational in degraded mode'
          : 'Core infrastructure is unhealthy'
    });
  } catch (err) {
    if (err.name === 'AdminError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  getOverview,
  getUsers,
  getUser,
  updateUserRole,
  getGameAnalytics,
  getAiTelemetry,
  getSystemHealth
};
