const {
  calculateLevelFromXP,
  calculateXPForLevel,
  getLevelProgress,
  awardProgression
} = require('../src/services/progressionService');
const { query, pool } = require('../src/config/database');

describe('Server-Authoritative Progression Engine', () => {
  const timestamp = Date.now();
  let testUserId = null;

  beforeAll(async () => {
    // Create a dedicated test user and profile
    const userRes = await query(
      `INSERT INTO users (email, name, role)
       VALUES ($1, $2, 'player')
       RETURNING id;`,
      [`progression_${timestamp}@ascendra.test`, 'Progression Tester']
    );
    testUserId = userRes.rows[0].id;

    await query(
      `INSERT INTO player_profiles (user_id, level, experience, score)
       VALUES ($1, 1, 0, 0);`,
      [testUserId]
    );
  });

  afterAll(async () => {
    if (testUserId) {
      await query('DELETE FROM users WHERE id = $1;', [testUserId]);
    }
    await pool.end();
  });

  describe('1. Progression Formula: calculateLevelFromXP(xp)', () => {
    it('should correctly calculate Level 1 for 0 to 99 XP', () => {
      expect(calculateLevelFromXP(0)).toBe(1);
      expect(calculateLevelFromXP(50)).toBe(1);
      expect(calculateLevelFromXP(99)).toBe(1);
    });

    it('should correctly calculate Level 2 for 100 to 399 XP', () => {
      expect(calculateLevelFromXP(100)).toBe(2);
      expect(calculateLevelFromXP(250)).toBe(2);
      expect(calculateLevelFromXP(399)).toBe(2);
    });

    it('should correctly calculate Level 3 for 400 to 899 XP', () => {
      expect(calculateLevelFromXP(400)).toBe(3);
      expect(calculateLevelFromXP(650)).toBe(3);
      expect(calculateLevelFromXP(899)).toBe(3);
    });

    it('should correctly calculate Level 4 for 900 to 1599 XP', () => {
      expect(calculateLevelFromXP(900)).toBe(4);
      expect(calculateLevelFromXP(1200)).toBe(4);
      expect(calculateLevelFromXP(1599)).toBe(4);
    });

    it('should correctly calculate Level 5 for 1600+ XP', () => {
      expect(calculateLevelFromXP(1600)).toBe(5);
    });

    it('should reject negative XP values with an error', () => {
      expect(() => calculateLevelFromXP(-10)).toThrow('non-negative number');
      expect(() => calculateLevelFromXP(-1)).toThrow('non-negative number');
    });
  });

  describe('2. Progression Formula: calculateXPForLevel(level)', () => {
    it('should return minimum XP required for each level', () => {
      expect(calculateXPForLevel(1)).toBe(0);
      expect(calculateXPForLevel(2)).toBe(100);
      expect(calculateXPForLevel(3)).toBe(400);
      expect(calculateXPForLevel(4)).toBe(900);
      expect(calculateXPForLevel(5)).toBe(1600);
    });

    it('should reject invalid level numbers', () => {
      expect(() => calculateXPForLevel(0)).toThrow();
      expect(() => calculateXPForLevel(-1)).toThrow();
    });
  });

  describe('3. Level Progress & Next Threshold: getLevelProgress(currentXP)', () => {
    it('should return current level, next level, and remaining XP', () => {
      const progress = getLevelProgress(150);
      expect(progress.currentLevel).toBe(2);
      expect(progress.currentXP).toBe(150);
      expect(progress.nextLevel).toBe(3);
      expect(progress.nextLevelXP).toBe(400);
      expect(progress.xpRemaining).toBe(250); // 400 - 150 = 250
    });
  });

  describe('4. Transactional Progression: awardProgression()', () => {
    it('should award XP and score, detect level up, and persist to database', async () => {
      // Starting from 0 XP -> Award 120 XP and 50 Score -> Level should become 2
      const result = await awardProgression({
        userId: testUserId,
        xpEarned: 120,
        scoreEarned: 50
      });

      expect(result.reward.xp).toBe(120);
      expect(result.reward.score).toBe(50);
      expect(result.profile.experience).toBe(120);
      expect(result.profile.score).toBe(50);
      expect(result.profile.level).toBe(2);
      expect(result.levelUp).toBe(true);

      // Verify directly in database
      const dbCheck = await query('SELECT level, experience, score FROM player_profiles WHERE user_id = $1;', [testUserId]);
      expect(dbCheck.rows[0].level).toBe(2);
      expect(dbCheck.rows[0].experience).toBe(120);
      expect(dbCheck.rows[0].score).toBe(50);
    });

    it('should award subsequent XP without triggering level up if threshold is not met', async () => {
      // Current: 120 XP (Level 2). Next level requires 400 XP.
      // Award 50 XP -> Total: 170 XP (Still Level 2)
      const result = await awardProgression({
        userId: testUserId,
        xpEarned: 50,
        scoreEarned: 25
      });

      expect(result.profile.experience).toBe(170);
      expect(result.profile.score).toBe(75);
      expect(result.profile.level).toBe(2);
      expect(result.levelUp).toBe(false);
    });

    it('should reject negative XP or score rewards', async () => {
      await expect(
        awardProgression({ userId: testUserId, xpEarned: -50, scoreEarned: 10 })
      ).rejects.toThrow('non-negative number');

      await expect(
        awardProgression({ userId: testUserId, xpEarned: 10, scoreEarned: -5 })
      ).rejects.toThrow('non-negative number');
    });

    it('should handle concurrent progression updates safely without lost updates', async () => {
      // Initial state: 170 XP, 75 Score
      // Run two parallel awardProgression calls: each awards 50 XP and 20 Score
      // Total added: 100 XP, 40 Score -> Expected Final: 270 XP, 115 Score
      const [res1, res2] = await Promise.all([
        awardProgression({ userId: testUserId, xpEarned: 50, scoreEarned: 20 }),
        awardProgression({ userId: testUserId, xpEarned: 50, scoreEarned: 20 })
      ]);

      expect(res1).toBeDefined();
      expect(res2).toBeDefined();

      const finalDb = await query('SELECT experience, score FROM player_profiles WHERE user_id = $1;', [testUserId]);
      expect(finalDb.rows[0].experience).toBe(270);
      expect(finalDb.rows[0].score).toBe(115);
    });
  });
});
