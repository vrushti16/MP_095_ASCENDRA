const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const questRoutes = require('./questRoutes');
const puzzleRoutes = require('./puzzleRoutes');
const clueRoutes = require('./clueRoutes');
const adminRoutes = require('./adminRoutes');
const progressionRoutes = require('./progressionRoutes');
const achievementRoutes = require('./achievementRoutes');

// Mount Sub-routers with strict /api/v1 structure
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/quests', questRoutes);
router.use('/puzzles', puzzleRoutes);
router.use('/clues', clueRoutes);
router.use('/admin', adminRoutes);
router.use('/progression', progressionRoutes);
router.use('/achievements', achievementRoutes);
router.use('/game-events', progressionRoutes);

module.exports = router;
