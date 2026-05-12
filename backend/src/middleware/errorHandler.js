/**
 * Centralised error handler.
 * Maps internal error codes → standardised JSON responses.
 * Must be registered LAST in Express: app.use(errorHandler)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusMap = {
    USER_NOT_FOUND:    404,
    INSUFFICIENT_FUNDS: 422,
    AUTH_EXPIRED:       401,
    DB_TIMEOUT:         503,
    VALIDATION_ERROR:   400,
    FORBIDDEN:          403,
    CONFLICT:           409,
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
