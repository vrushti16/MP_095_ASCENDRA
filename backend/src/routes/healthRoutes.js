const express = require('express');
const router = express.Router();
const { sendSuccess } = require('../utils/apiResponse');
const { getBasicHealth, getDetailedHealth } = require('../services/healthService');

/**
 * @route   GET /api/v1/health
 * @desc    Backend service health status check (basic or detailed with ?detailed=true)
 * @access  Public
 */
router.get('/', async (req, res) => {
  const isDetailed = req.query.detailed === 'true';

  if (!isDetailed) {
    return sendSuccess(res, getBasicHealth(), 'ASCENDRA backend is running');
  }

  const { httpStatusCode, payload } = await getDetailedHealth();

  return res.status(httpStatusCode).json({
    success: httpStatusCode !== 503,
    data: payload,
    message: payload.status === 'healthy'
      ? 'All ASCENDRA services are operational'
      : payload.status === 'degraded'
        ? 'ASCENDRA is operational in degraded mode'
        : 'ASCENDRA core services are unhealthy'
  });
});

module.exports = router;
