const { sendError } = require('../utils/apiResponse');

/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  return sendError(
    res,
    `Route not found: ${req.method} ${req.originalUrl}`,
    'ROUTE_NOT_FOUND',
    404
  );
}

/**
 * Scrub sensitive connection strings, credentials, and passwords from error messages
 */
function sanitizeErrorMessage(msg) {
  if (!msg || typeof msg !== 'string') return 'Internal Server Error';
  return msg
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@[^\s/]+/gi, 'postgresql://[REDACTED]')
    .replace(/redis:\/\/[^@\s]+@[^\s/]+/gi, 'redis://[REDACTED]')
    .replace(/password\s*=\s*[^\s;]+/gi, 'password=[REDACTED]');
}

/**
 * Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Handle body-parser oversized payload
  if (err.type === 'entity.too.large' || err.status === 413) {
    return sendError(
      res,
      'Request payload exceeds maximum allowed size (2MB)',
      'PAYLOAD_TOO_LARGE',
      413
    );
  }

  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const rawMessage = err.message || 'Internal Server Error';
  const errorMessage = sanitizeErrorMessage(rawMessage);

  // Log error details for server diagnostics
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[ERROR] [${req.method} ${req.originalUrl}]`, {
      message: errorMessage,
      code: errorCode,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  }

  return sendError(
    res,
    errorMessage,
    errorCode,
    statusCode,
    process.env.NODE_ENV === 'production' ? null : (err.stack ? sanitizeErrorMessage(err.stack) : null)
  );
}

module.exports = {
  notFoundHandler,
  errorHandler,
  sanitizeErrorMessage
};
