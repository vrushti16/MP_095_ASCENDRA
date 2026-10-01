#!/usr/bin/env node
/**
 * ASCENDRA Clue Discovery & Trigger Inspector
 * Displays real-time metrics of players triggering clues across quests.
 */

const path = require('path');
const { query, pool } = require('../backend/src/config/database');

async function checkClueMetrics() {
  console.log('🔍 [ASCENDRA CLUE METRICS] Fetching real-time clue telemetry...\n');

  try {
    // 1. Overall Clue Discovery Summary
    const summaryRes = await query(`
      SELECT
        COUNT(DISTINCT player_id)::int AS total_players,
        COUNT(id)::int AS total_discoveries
      FROM player_clues;
    `);

    const summary = summaryRes.rows[0];
    console.log('====================================================');
    console.log('📊 CLUE TRIGGER & DISCOVERY OVERVIEW');
    console.log('====================================================');
    console.log(`👤 Unique Players Who Triggered Clues : ${summary.total_players}`);
    console.log(`🗝️  Total Clue Discoveries Logged       : ${summary.total_discoveries}`);
    console.log('====================================================\n');

    // 2. Clue-by-Clue Discovery Breakdown
    const breakdownRes = await query(`
      SELECT
        c.id AS "clueId",
        c.title AS "clueTitle",
        c.quest_id AS "questId",
        c.sequence_number AS "sequence",
        COUNT(pc.player_id)::int AS "playersTriggered"
      FROM clues c
      LEFT JOIN player_clues pc ON c.id = pc.clue_id
      GROUP BY c.id, c.title, c.quest_id, c.sequence_number
      ORDER BY "playersTriggered" DESC, c.quest_id ASC, c.sequence_number ASC;
    `);

    console.log('📋 CLUE BREAKDOWN BY TRIGGER COUNT:');
    console.log('----------------------------------------------------');
    if (breakdownRes.rows.length === 0) {
      console.log('ℹ️  No clues found in database. Run npm run db:seed first.');
    } else {
      console.table(
        breakdownRes.rows.map(r => ({
          'Clue ID': r.clueId,
          'Title': r.clueTitle,
          'Quest': r.questId,
          'Seq': r.sequence,
          'Players Triggered': r.playersTriggered
        }))
      );
    }

    // 3. Recent 10 Player Trigger Events
    const recentRes = await query(`
      SELECT
        u.name AS "playerName",
        u.email AS "playerEmail",
        c.title AS "clueTitle",
        c.quest_id AS "questId",
        pc.discovered_at AS "triggeredAt"
      FROM player_clues pc
      JOIN users u ON pc.player_id = u.id
      JOIN clues c ON pc.clue_id = c.id
      ORDER BY pc.discovered_at DESC
      LIMIT 10;
    `);

    console.log('\n⏱️  MOST RECENT CLUE TRIGGERS:');
    console.log('----------------------------------------------------');
    if (recentRes.rows.length === 0) {
      console.log('ℹ️  No players have triggered clues yet.');
    } else {
      console.table(
        recentRes.rows.map(r => ({
          'Player': r.playerName,
          'Email': r.playerEmail,
          'Clue Title': r.clueTitle,
          'Quest': r.questId,
          'Triggered At': new Date(r.triggeredAt).toLocaleString()
        }))
      );
    }
  } catch (err) {
    console.error('💥 [ERROR] Failed to query clue metrics:', err.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkClueMetrics();
}

module.exports = { checkClueMetrics };
