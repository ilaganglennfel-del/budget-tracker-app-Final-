/**
 * Centralised error handler.
 * Maps internal error codes → standardised JSON responses.
 * Must be registered LAST in Express: app.use(errorHandler)
 *
 * PostgreSQL error codes intercepted:
 *   42P01 — undefined_table   → DATABASE_SYNC_ERROR (503)
 *   42703 — undefined_column  → DATABASE_SYNC_ERROR (503)
 *   23514 — check_violation   → VALIDATION_ERROR    (400)
 *   23503 — foreign_key       → CONFLICT            (409)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // ── Detect PostgreSQL relation/column-not-found errors ──────────────
  if (err.code === '42P01' || err.code === '42703') {
    console.error('[DB SYNC ERROR]', err.message);
    return res.status(503).json({
      error: {
        code:    'DATABASE_SYNC_ERROR',
        message: 'Database Sync Error — a required table is missing. Please run the latest migrations.',
      },
    });
  }

  // ── Check constraint violations ──────────────────────────────────────
  if (err.code === '23514') {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: err.detail || 'Input violates a database constraint.' },
    });
  }

  // ── Foreign-key violations ───────────────────────────────────────────
  if (err.code === '23503') {
    return res.status(409).json({
      error: { code: 'CONFLICT', message: err.detail || 'Referenced record does not exist.' },
    });
  }

  const statusMap = {
    USER_NOT_FOUND:      404,
    NOT_FOUND:           404,
    INSUFFICIENT_FUNDS:  422,
    AUTH_EXPIRED:        401,
    DB_TIMEOUT:          503,
    DATABASE_SYNC_ERROR: 503,
    VALIDATION_ERROR:    400,
    FORBIDDEN:           403,
    CONFLICT:            409,
    BUCKET_NOT_EMPTY:    409,
  };

  const code    = err.code    || 'INTERNAL_ERROR';
  const message = err.message || 'An unexpected error occurred.';
  const status  = statusMap[code] || 500;

  if (status === 500) {
    console.error('[ERROR]', err);
  }

  return res.status(status).json({
    error: { code, message },
  });
}

/**
 * Helper: throw a structured error that errorHandler understands.
 */
function createError(code, message, status) {
  const err = new Error(message);
  err.code   = code;
  err.status = status;
  return err;
}

module.exports = { errorHandler, createError };
