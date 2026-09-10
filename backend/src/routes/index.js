const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const questRoutes = require('./questRoutes');
const puzzleRoutes = require('./puzzleRoutes');
const clueRoutes = require('./clueRoutes');
const adminRoutes = require('./adminRoutes');

// Mount Sub-routers with strict /api/v1 structure
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/quests', questRoutes);
router.use('/puzzles', puzzleRoutes);
router.use('/clues', clueRoutes);
router.use('/admin', adminRoutes);

// Additional routes will be mounted in upcoming phases:
// router.use('/leaderboard', leaderboardRoutes);
// router.use('/sessions', sessionRoutes);

module.exports = router;
