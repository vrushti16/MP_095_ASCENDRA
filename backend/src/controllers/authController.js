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
    const { email, password, name, confirmPassword, requireVerification } = req.body;

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
      name: name.trim(),
      confirmPassword,
      requireVerification
    });

    const statusCode = result.accessToken ? 201 : 200;
    return sendSuccess(res, result, result.message || 'User registered successfully', statusCode);
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

const passwordResetService = require('../services/passwordResetService');

/**
 * Request password reset OTP
 * POST /api/v1/auth/forgot-password/request-otp
 */
async function requestPasswordResetOtp(req, res, next) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return sendError(res, 'A valid email address is required', 'VALIDATION_ERROR', 400);
    }

    const result = await passwordResetService.requestOtp(email);
    return sendSuccess(res, {}, result.genericMessage);
  } catch (err) {
    if (err.name === 'AuthError') {
      const extra = err.waitSeconds !== undefined ? { waitSeconds: err.waitSeconds } : null;
      return sendError(res, err.message, err.code, err.statusCode, extra);
    }
    if (err.message && err.message.includes('Email service is not configured')) {
      return sendError(res, err.message, 'EMAIL_NOT_CONFIGURED', 503);
    }
    next(err);
  }
}

/**
 * Verify 5-digit OTP code and retrieve scoped reset token
 * POST /api/v1/auth/forgot-password/verify-otp
 */
async function verifyPasswordResetOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    if (!email || typeof email !== 'string') {
      return sendError(res, 'A valid email address is required', 'VALIDATION_ERROR', 400);
    }
    if (!otp || (typeof otp !== 'string' && typeof otp !== 'number')) {
      return sendError(res, 'A 5-digit verification code is required', 'VALIDATION_ERROR', 400);
    }

    const result = await passwordResetService.verifyOtp(email, otp.toString());
    return res.status(200).json({
      success: true,
      message: result.message,
      resetToken: result.resetToken,
      data: {
        resetToken: result.resetToken
      }
    });
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Reset password using valid reset authorization token
 * POST /api/v1/auth/forgot-password/reset
 */
async function resetPassword(req, res, next) {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || typeof resetToken !== 'string') {
      return sendError(res, 'Reset token is required', 'VALIDATION_ERROR', 400);
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return sendError(res, 'New password is required', 'VALIDATION_ERROR', 400);
    }
    if (!confirmPassword || typeof confirmPassword !== 'string') {
      return sendError(res, 'Confirm password is required', 'VALIDATION_ERROR', 400);
    }

    const result = await passwordResetService.resetPassword({
      resetToken,
      newPassword,
      confirmPassword
    });

    return sendSuccess(res, {}, result.message);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

const registrationOtpService = require('../services/registrationOtpService');

/**
 * Request registration verification OTP to user's real Gmail address
 * POST /api/v1/auth/register/request-otp
 */
async function requestRegistrationOtp(req, res, next) {
  try {
    const { email, name, password } = req.body;
    const result = await registrationOtpService.requestRegistrationOtp({
      email,
      name,
      password
    });
    return sendSuccess(res, result, result.message);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Verify registration OTP and complete account creation
 * POST /api/v1/auth/register/verify-otp
 */
async function verifyRegistrationOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await registrationOtpService.verifyRegistrationOtpAndCreateUser({
      email,
      otp
    });
    return sendSuccess(res, result, 'Registration verified and account created', 201);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Resend registration OTP
 * POST /api/v1/auth/register/resend-otp
 */
async function resendRegistrationOtp(req, res, next) {
  try {
    const { email } = req.body;
    const result = await registrationOtpService.resendRegistrationOtp({ email });
    return sendSuccess(res, result, result.message);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

const emailVerificationService = require('../services/emailVerificationService');

/**
 * Send email ownership verification OTP (Explicit Section 8 endpoint)
 * POST /api/v1/auth/register/send-verification
 */
async function sendEmailVerification(req, res, next) {
  try {
    const { email, name, password, confirmPassword } = req.body;
    const result = await emailVerificationService.sendVerificationOtp({
      email,
      name,
      password,
      confirmPassword
    });
    return sendSuccess(res, result, result.message);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Verify email ownership OTP (Explicit Section 8 endpoint)
 * POST /api/v1/auth/register/verify-email
 */
async function verifyEmail(req, res, next) {
  try {
    const { email, otp } = req.body;
    const result = await emailVerificationService.verifyEmailOtp({
      email,
      otp
    });
    return sendSuccess(res, result, result.message);
  } catch (err) {
    if (err.name === 'AuthError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Resend email ownership verification OTP (Explicit Section 8 endpoint)
 * POST /api/v1/auth/register/resend-verification
 */
async function resendVerification(req, res, next) {
  try {
    const { email } = req.body;
    const result = await emailVerificationService.resendVerificationOtp({ email });
    return sendSuccess(res, result, result.message);
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
  logout,
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
  requestRegistrationOtp,
  verifyRegistrationOtp,
  resendRegistrationOtp,
  sendEmailVerification,
  verifyEmail,
  resendVerification
};

