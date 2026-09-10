const fs = require('fs');
const path = require('path');
const { getClient, pool } = require('../../backend/src/config/database');

async function runSeeds() {
  console.log('🌱 [SEED START] Connecting to database...');
  const client = await getClient();

  try {
    const seedsDir = path.join(__dirname, '..', 'seeds');
    if (!fs.existsSync(seedsDir)) {
      console.log('ℹ️ No seeds directory found.');
      return;
    }

    const files = fs.readdirSync(seedsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️ No SQL seed files found.');
      return;
    }

    for (const file of files) {
      console.log(`⚡ [APPLYING SEED] ${file}...`);
      const filePath = path.join(seedsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`✅ [SUCCESS] Seeded: ${file}`);
      } catch (seedErr) {
        await client.query('ROLLBACK');
        console.error(`💥 [SEED FAILED] ${file}:`, seedErr.message);
        throw seedErr;
      }
    }

    console.log('🎉 [COMPLETED] Database seeding finished.');
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runSeeds()
    .then(() => {
      console.log('🏁 Seed process completed cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seed process exited with error:', err.message);
      process.exit(1);
    });
}

module.exports = { runSeeds };
