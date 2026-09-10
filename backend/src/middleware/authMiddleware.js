const { verifyAccessToken } = require('../config/jwt');
const { sendError } = require('../utils/apiResponse');

/**
 * Middleware to authenticate requests using JWT Access Tokens.
 * Expects header format: Authorization: Bearer <access-token>
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return sendError(
      res,
      'Authorization header is missing. Expected Bearer token.',
      'MISSING_TOKEN',
      401
    );
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return sendError(
      res,
      'Malformed authorization header. Format must be: Bearer <token>',
      'MALFORMED_TOKEN',
      401
    );
  }

  const token = parts[1];

  try {
    const payload = verifyAccessToken(token);

    if (!payload || !payload.sub) {
      return sendError(res, 'Invalid token claims', 'INVALID_TOKEN', 401);
    }

    // Attach verified user claims strictly from token
    req.user = {
      id: payload.sub,
      role: payload.role || 'player'
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 'Authentication token has expired', 'EXPIRED_TOKEN', 401);
    }
    return sendError(res, 'Invalid authentication token', 'INVALID_TOKEN', 401);
  }
}

/**
 * Authorization middleware to restrict endpoint to specified roles (e.g. 'admin', 'player')
 * @param {...string} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return sendError(
        res,
        'Authentication required before role verification',
        'UNAUTHORIZED',
        401
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access forbidden: required role [${allowedRoles.join(', ')}], but current user role is '${req.user.role}'`,
        'FORBIDDEN',
        403
      );
    }

    next();
  };
}

module.exports = {
  authenticateJWT,
  requireRole
};
