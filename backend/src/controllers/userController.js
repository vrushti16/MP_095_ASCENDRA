const userService = require('../services/userService');
const { sendSuccess, sendError } = require('../utils/apiResponse');

/**
 * Get current authenticated user details
 * GET /api/v1/users/me
 */
async function getMe(req, res, next) {
  try {
    const user = await userService.getUserById(req.user.id);
    return sendSuccess(res, user, 'User retrieved successfully');
  } catch (err) {
    if (err.name === 'UserError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Get current authenticated player's complete game profile (Level, XP, Score, Health)
 * GET /api/v1/users/me/profile
 */
async function getProfile(req, res, next) {
  try {
    const profile = await userService.getPlayerProfile(req.user.id);
    return sendSuccess(res, profile, 'Player profile retrieved successfully');
  } catch (err) {
    if (err.name === 'UserError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

/**
 * Update authenticated player's public profile fields (name, avatarUrl)
 * PATCH /api/v1/users/me/profile
 */
async function updateProfile(req, res, next) {
  try {
    const updated = await userService.updateUserProfile(req.user.id, req.body);
    return sendSuccess(res, updated, 'Profile updated successfully');
  } catch (err) {
    if (err.name === 'UserError') {
      return sendError(res, err.message, err.code, err.statusCode);
    }
    next(err);
  }
}

module.exports = {
  getMe,
  getProfile,
  updateProfile
};
