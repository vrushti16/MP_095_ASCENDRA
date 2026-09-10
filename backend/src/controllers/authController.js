const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// Email regex pattern for input validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Handle Google Sign-In verification and user synchronization
 * POST /api/v1/auth/google
 */
async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
      return sendError(res, 'Google idToken is required and must be a non-empty string', 'VALIDATION_ERROR', 400);
    }

    const verifiedGoogleUser = await authService.verifyGoogleIdToken(idToken.trim());
    const result = await authService.loginOrRegisterGoogleUser(verifiedGoogleUser);

    return sendSuccess(res, result, 'Google authentication successful');
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Register user via email and password
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return sendError(res, 'A valid email address is required', 'VALIDATION_ERROR', 400);
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return sendError(res, 'Password is required and must be at least 6 characters long', 'VALIDATION_ERROR', 400);
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return sendError(res, 'Name is required and must not be blank', 'VALIDATION_ERROR', 400);
    }

    const result = await authService.registerUser({
      email: email.trim(),
      password,
      name: name.trim()
    });

    return sendSuccess(res, result, 'User registered successfully', 201);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Login user via email and password
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return sendError(res, 'A valid email address is required', 'VALIDATION_ERROR', 400);
    }

    if (!password || typeof password !== 'string' || password === '') {
      return sendError(res, 'Password is required', 'VALIDATION_ERROR', 400);
    }

    const result = await authService.loginUser({
      email: email.trim(),
      password
    });

    return sendSuccess(res, result, 'Login successful');
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Refresh access token using existing refresh token with automatic token rotation
 * POST /api/v1/auth/refresh
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      return sendError(res, 'refreshToken is required', 'VALIDATION_ERROR', 400);
    }

    const tokens = await authService.rotateRefreshToken(refreshToken.trim());

    return sendSuccess(res, tokens, 'Token refreshed successfully');
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Revoke refresh token (logout)
 * POST /api/v1/auth/logout
 */
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      return sendError(res, 'refreshToken is required', 'VALIDATION_ERROR', 400);
    }

    await authService.revokeRefreshToken(refreshToken.trim());

    return sendSuccess(res, { loggedOut: true }, 'Logged out successfully');
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  googleLogin,
  register,
  login,
  refresh,
  logout
};
