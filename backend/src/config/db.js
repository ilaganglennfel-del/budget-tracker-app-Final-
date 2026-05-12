require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USER     || 'budget_user',
  password: process.env.DB_PASSWORD || 'budget_pass',
  database: process.env.DB_NAME     || 'budget_db',
  max:                 20,
  idleTimeoutMillis:   30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterised query. Always uses $1..$n placeholders.
 * @param {string} text  - SQL with $1, $2 … placeholders
 * @param {any[]}  params - Values array
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DB] ${duration}ms | rows: ${result.rowCount} | ${text.slice(0, 80)}`);
    }
    return result;
  } catch (err) {
    if (err.code === '57014') {
      const timeout = new Error('DB_TIMEOUT');
      timeout.code  = 'DB_TIMEOUT';
      throw timeout;
    }
    throw err;
  }
}

/**
 * Acquire a client for manual transaction control (BEGIN / COMMIT / ROLLBACK).
 */
async function getClient() {
  try {
    return await pool.connect();
  } catch (err) {
    const timeout = new Error('DB_TIMEOUT');
    timeout.code  = 'DB_TIMEOUT';
    throw timeout;
  }
}

module.exports = { query, getClient, pool };
