const { query, getClient } = require('../config/database');
const progressionService = require('./progressionService');

class AchievementError extends Error {
  constructor(message, code = 'ACHIEVEMENT_ERROR', statusCode = 400) {
    super(message);
    this.name = 'AchievementError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Authoritatively evaluate and synchronize a player's achievement progress
 * from verified server-side game state (quests, puzzles, clues, level, score).
 *
 * @param {object} params
 * @param {string} params.userId - Player UUID
 * @param {import('pg').PoolClient} [params.client] - Optional active transaction client
 * @returns {Promise<{ achievements: Array<object>, newlyUnlocked: Array<object> }>}
 */
async function evaluateAndSyncPlayerAchievements({ userId, client: externalClient = null }) {
  if (!userId) {
    throw new AchievementError('User ID is required', 'MISSING_USER_ID', 400);
  }

  const client = externalClient || (await getClient());
  const isInternalTransaction = !externalClient;

  try {
    if (isInternalTransaction) {
      await client.query('BEGIN');
    }

    // 1. Fetch player profile stats
    const profileRes = await client.query(
      `SELECT level, experience, score FROM player_profiles WHERE user_id = $1 FOR UPDATE;`,
      [userId]
    );
    const profile = profileRes.rows[0] || { level: 1, experience: 0, score: 0 };

    // 2. Fetch verified discovery/clues count
    const cluesRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM player_clues WHERE player_id = $1;`,
      [userId]
    );
    const discoveryCount = cluesRes.rows[0]?.count || 0;

    // 3. Fetch completed quests count
    const questsRes = await client.query(
      `SELECT COUNT(*)::int AS count FROM player_quests WHERE player_id = $1 AND status = 'completed';`,
      [userId]
    );
    const completedQuestsCount = questsRes.rows[0]?.count || 0;

    // 4. Fetch puzzle solve counts
    const puzzlesRes = await client.query(
      `SELECT 
         COUNT(DISTINCT puzzle_id)::int AS total_solved,
         COUNT(DISTINCT pa.puzzle_id) FILTER (WHERE p.topic IN ('aptitude', 'logical_reasoning', 'mathematics'))::int AS aptitude_solved
       FROM puzzle_attempts pa
       JOIN puzzles p ON pa.puzzle_id = p.id
       WHERE pa.player_id = $1 AND pa.is_correct = true;`,
      [userId]
    );
    const completedPuzzlesCount = puzzlesRes.rows[0]?.total_solved || 0;
    const aptitudePuzzlesCount = puzzlesRes.rows[0]?.aptitude_solved || 0;

    // 5. Load master achievements definitions
    const masterRes = await client.query(
      `SELECT id, name, description, category, icon, requirement_type, requirement_value, xp_reward, gameplay_event_source
       FROM achievements
       ORDER BY requirement_value ASC, id ASC;`
    );
    const masterAchievements = masterRes.rows;

    // 6. Load existing player achievements state
    const existingRes = await client.query(
      `SELECT achievement_id, current_progress, target_progress, unlocked, unlocked_at
       FROM player_achievements
       WHERE player_id = $1;`,
      [userId]
    );
    const existingMap = new Map();
    existingRes.rows.forEach(r => existingMap.set(r.achievement_id, r));

    const newlyUnlocked = [];
    const syncedItems = [];

    // 7. Evaluate each achievement against verified server statistics
    for (const ach of masterAchievements) {
      const existing = existingMap.get(ach.id);
      const wasUnlocked = existing?.unlocked || false;

      let calculatedProgress = 0;
      switch (ach.requirement_type) {
        case 'DISCOVERY_COUNT':
          calculatedProgress = discoveryCount;
          break;
        case 'QUEST_COUNT':
          calculatedProgress = completedQuestsCount;
          break;
        case 'LEVEL':
          calculatedProgress = profile.level;
          break;
        case 'SCORE':
          calculatedProgress = profile.score;
          break;
        case 'XP':
          calculatedProgress = profile.experience;
          break;
        case 'PUZZLE_COUNT':
          calculatedProgress = completedPuzzlesCount;
          break;
        case 'PUZZLE_CATEGORY_COUNT':
          calculatedProgress = aptitudePuzzlesCount;
          break;
        default:
          calculatedProgress = existing?.current_progress || 0;
      }

      const isNowUnlocked = wasUnlocked || (calculatedProgress >= ach.requirement_value);
      const unlockedAt = wasUnlocked ? existing.unlocked_at : (isNowUnlocked ? new Date() : null);

      // Record newly unlocked event
      if (!wasUnlocked && isNowUnlocked) {
        newlyUnlocked.push({
          id: ach.id,
          name: ach.name,
          description: ach.description,
          icon: ach.icon,
          xpReward: ach.xp_reward,
          unlockedAt
        });
      }

      // Upsert into player_achievements
      await client.query(
        `INSERT INTO player_achievements (
           player_id, achievement_id, current_progress, target_progress, unlocked, unlocked_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (player_id, achievement_id) DO UPDATE
         SET current_progress = EXCLUDED.current_progress,
             unlocked = EXCLUDED.unlocked,
             unlocked_at = COALESCE(player_achievements.unlocked_at, EXCLUDED.unlocked_at),
             updated_at = NOW();`,
        [userId, ach.id, calculatedProgress, ach.requirement_value, isNowUnlocked, unlockedAt]
      );

      const progressCap = Math.min(calculatedProgress, ach.requirement_value);
      const progressPercent = ach.requirement_value > 0
        ? Math.min(100, Math.round((progressCap / ach.requirement_value) * 100))
        : 100;

      syncedItems.push({
        id: ach.id,
        name: ach.name,
        description: ach.description,
        category: ach.category,
        icon: ach.icon,
        requirementType: ach.requirement_type,
        currentProgress: calculatedProgress,
        targetProgress: ach.requirement_value,
        progressPercentage: isNowUnlocked ? 100 : progressPercent,
        unlocked: isNowUnlocked,
        unlockedAt,
        xpReward: ach.xp_reward,
        gameplayEventSource: ach.gameplay_event_source
      });
    }

    if (isInternalTransaction) {
      await client.query('COMMIT');
    }

    return {
      achievements: syncedItems,
      newlyUnlocked
    };
  } catch (err) {
    if (isInternalTransaction) {
      await client.query('ROLLBACK');
    }
    throw err;
  } finally {
    if (isInternalTransaction) {
      client.release();
    }
  }
}

/**
 * Retrieve all achievements and progress for a player
 * @param {string} userId
 */
async function getAchievementsForPlayer(userId) {
  const { achievements, newlyUnlocked } = await evaluateAndSyncPlayerAchievements({ userId });
  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return {
    unlocked: unlockedCount,
    total: achievements.length,
    percentage: achievements.length > 0 ? Math.round((unlockedCount / achievements.length) * 100) : 0,
    items: achievements,
    newlyUnlocked
  };
}

/**
 * Ingest and process a verified gameplay event with idempotency protection.
 *
 * @param {object} params
 * @param {string} params.eventId - Unique event UUID/ID from Unity
 * @param {string} params.eventType - 'UNITY_QUEST_STARTED' | 'UNITY_INSCRIPTION_DISCOVERED' | 'UNITY_PUZZLE_COMPLETED' | 'UNITY_QUEST_COMPLETED'
 * @param {string} params.playerId - Authenticated player UUID
 * @param {object} params.payload - Event details
 * @returns {Promise<object>} Processing outcome
 */
async function recordAndProcessGameplayEvent({ eventId, eventType, playerId, payload = {} }) {
  if (!eventId || typeof eventId !== 'string') {
    throw new AchievementError('Valid eventId is required', 'VALIDATION_ERROR', 400);
  }
  if (!eventType || typeof eventType !== 'string') {
    throw new AchievementError('Valid eventType is required', 'VALIDATION_ERROR', 400);
  }
  if (!playerId) {
    throw new AchievementError('playerId is required', 'VALIDATION_ERROR', 400);
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Idempotency Check: check if event was already processed
    const existingEvent = await client.query(
      `SELECT id, event_id, event_type, status, created_at FROM gameplay_events WHERE event_id = $1;`,
      [eventId]
    );

    if (existingEvent.rows.length > 0) {
      await client.query('COMMIT');
      return {
        status: 'duplicate',
        message: 'Gameplay event already processed authoritatively',
        eventId,
        newlyUnlocked: []
      };
    }

    // 2. Insert event record
    await client.query(
      `INSERT INTO gameplay_events (event_id, player_id, event_type, payload, status)
       VALUES ($1, $2, $3, $4, 'processed');`,
      [eventId, playerId, eventType, JSON.stringify(payload)]
    );

    // 3. Process game action side-effects
    if (eventType === 'UNITY_INSCRIPTION_DISCOVERED' && payload.clueId) {
      // Idempotently discover clue
      await client.query(
        `INSERT INTO player_clues (player_id, clue_id)
         VALUES ($1, $2)
         ON CONFLICT (player_id, clue_id) DO NOTHING;`,
        [playerId, payload.clueId]
      );
    } else if (eventType === 'UNITY_QUEST_STARTED' && payload.questId) {
      await client.query(
        `INSERT INTO player_quests (player_id, quest_id, status, progress, started_at)
         VALUES ($1, $2, 'in_progress', 0, NOW())
         ON CONFLICT (player_id, quest_id) DO NOTHING;`,
        [playerId, payload.questId]
      );
    } else if ((eventType === 'UNITY_DYNAMIC_PUZZLE_COMPLETED' || eventType === 'UNITY_PUZZLE_COMPLETED') && payload.puzzleId) {
      const pzRes = await client.query(
        `SELECT id, xp_reward, score_reward, clue_id_unlocked FROM puzzles WHERE id = $1;`,
        [payload.puzzleId]
      );
      if (pzRes.rows.length > 0) {
        const pz = pzRes.rows[0];
        const prevRes = await client.query(
          `SELECT id FROM puzzle_attempts WHERE player_id = $1 AND puzzle_id = $2 AND is_correct = true;`,
          [playerId, payload.puzzleId]
        );
        if (prevRes.rows.length === 0) {
          const xpEarned = pz.xp_reward || 50;
          const scoreEarned = pz.score_reward || 100;
          await client.query(
            `INSERT INTO puzzle_attempts (player_id, puzzle_id, submitted_answer, is_correct, attempt_number, xp_earned, score_earned, time_taken_seconds)
             VALUES ($1, $2, $3, true, 1, $4, $5, 0);`,
            [playerId, payload.puzzleId, payload.answer || 'VERIFIED', xpEarned, scoreEarned]
          );
          await progressionService.awardProgression({
            userId: playerId,
            xpEarned,
            scoreEarned,
            client
          });
          if (pz.clue_id_unlocked) {
            await client.query(
              `INSERT INTO player_clues (player_id, clue_id)
               VALUES ($1, $2)
               ON CONFLICT (player_id, clue_id) DO NOTHING;`,
              [playerId, pz.clue_id_unlocked]
            );
          }
        }
      }
    }

    // 4. Evaluate achievements and recalculate progression
    const { achievements, newlyUnlocked } = await evaluateAndSyncPlayerAchievements({
      userId: playerId,
      client
    });

    await client.query('COMMIT');

    return {
      status: 'success',
      eventId,
      eventType,
      newlyUnlocked,
      achievementsCount: achievements.length
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  AchievementError,
  evaluateAndSyncPlayerAchievements,
  getAchievementsForPlayer,
  recordAndProcessGameplayEvent
};
