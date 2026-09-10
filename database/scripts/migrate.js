const fs = require('fs');
const path = require('path');

// database.js inside backend/src/config/database.js already configures dotenv and the pg pool
const { getClient, pool } = require('../../backend/src/config/database');

async function runMigrations() {
  console.log('🔄 [MIGRATION START] Connecting to database...');
  const client = await getClient();

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Query already applied migrations
    const appliedRes = await client.query('SELECT filename FROM schema_migrations;');
    const appliedSet = new Set(appliedRes.rows.map(row => row.filename));

    // 3. Read migration files from database/migrations
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('ℹ️ No migrations directory found at:', migrationsDir);
      return;
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️ No SQL migration files found in:', migrationsDir);
      return;
    }

    let appliedCount = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⏩ [ALREADY APPLIED] ${file}`);
        continue;
      }

      console.log(`⚡ [APPLYING MIGRATION] ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [file]);
        await client.query('COMMIT');
        console.log(`✅ [SUCCESS] Applied: ${file}`);
        appliedCount++;
      } catch (migrationError) {
        await client.query('ROLLBACK');
        console.error(`💥 [MIGRATION FAILED] ${file}:`, migrationError.message);
        throw migrationError;
      }
    }

    if (appliedCount === 0) {
      console.log('✨ [ALL UP TO DATE] Database schema is already current.');
    } else {
      console.log(`🎉 [COMPLETED] Successfully applied ${appliedCount} migration(s).`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🏁 Migration process completed cleanly.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Migration process exited with error:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigrations };
