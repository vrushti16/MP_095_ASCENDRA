/**
 * Standard API Response Utilities for ASCENDRA Backend
 * Ensures consistent JSON response structure across all endpoints.
 */

/**
 * Send a standardized success response.
 * @param {import('express').Response} res
 * @param {any} data
 * @param {string} [message="Operation successful"]
 * @param {number} [statusCode=200]
 */
function sendSuccess(res, data = {}, message = 'Operation successful', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message
  });
}

/**
 * Send a standardized error response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {string} [code="INTERNAL_SERVER_ERROR"]
 * @param {number} [statusCode=500]
 * @param {any} [details=null]
 */
function sendError(res, message = 'An error occurred', code = 'INTERNAL_SERVER_ERROR', statusCode = 500, details = null) {
  const errorPayload = {
    code,
    message
  };

  if (details && process.env.NODE_ENV !== 'production') {
    errorPayload.details = details;
  }

  return res.status(statusCode).json({
    success: false,
    error: errorPayload
  });
}

module.exports = {
  sendSuccess,
  sendError
};
