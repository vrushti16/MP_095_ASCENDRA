const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ [DATABASE WARNING] DATABASE_URL is not defined in environment!');
}

// Detect if SSL is required (e.g., Neon cloud PostgreSQL or explicit sslmode=require)
const isSslRequired =
  process.env.NODE_ENV === 'production' ||
  (connectionString && (connectionString.includes('sslmode=require') || connectionString.includes('neon.tech')));

const pool = new Pool({
  connectionString,
  ssl: isSslRequired ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
  console.error('💥 [DATABASE ERROR] Unexpected error on idle client:', err.message);
});

/**
 * Execute a SQL query with parameter binding
 * @param {string} text
 * @param {Array<any>} [params]
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && duration > 500) {
      console.warn(`⚠️ [SLOW QUERY] (${duration}ms): ${text.substring(0, 100)}`);
    }
    return res;
  } catch (err) {
    console.error('💥 [QUERY FAILED]:', { query: text, error: err.message });
    throw err;
  }
}

/**
 * Acquire a dedicated client for multi-statement transactions
 * @returns {Promise<import('pg').PoolClient>}
 */
async function getClient() {
  return pool.connect();
}

/**
 * Test and verify active database connectivity
 * @returns {Promise<{ ok: boolean, timestamp: string, database: string }>}
 */
async function testConnection() {
  try {
    const res = await query('SELECT NOW() as current_time, current_database() as db_name;');
    return {
      ok: true,
      timestamp: res.rows[0].current_time,
      database: res.rows[0].db_name
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message
    };
  }
}

module.exports = {
  pool,
  query,
  getClient,
  testConnection
};
