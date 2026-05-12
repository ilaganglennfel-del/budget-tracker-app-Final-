const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { query } = require('../config/db');
const { validate, schemas } = require('../middleware/validate');
const { createError }       = require('../middleware/errorHandler');

// ── Token helpers ─────────────────────────────────────────────

function signAccess(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { sub: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

// ── POST /api/auth/register ───────────────────────────────────

router.post('/register', validate(schemas.register), async (req, res, next) => {
  try {
    const { email, password, first_name, last_name } = req.body;

    // Check uniqueness
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      throw createError('CONFLICT', 'An account with this email already exists.', 409);
    }

    const password_hash = await bcrypt.hash(password, 12);

    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, first_name, last_name, balance, created_at`,
      [email.toLowerCase(), password_hash, first_name, last_name]
    );
    const user = rows[0];

    // Create streak record for new user
    await query(
      `INSERT INTO streaks (user_id) VALUES ($1)`,
      [user.id]
    );

    const access_token  = signAccess(user);
    const refresh_token = signRefresh(user);

    res.status(201).json({ user, access_token, refresh_token });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/login ──────────────────────────────────────

router.post('/login', validate(schemas.login), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      `SELECT id, email, password_hash, first_name, last_name, balance
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (rows.length === 0) {
      throw createError('USER_NOT_FOUND', 'No account found with that email.', 404);
    }

    const user  = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw createError('AUTH_EXPIRED', 'Incorrect password.', 401);
    }

    delete user.password_hash;

    const access_token  = signAccess(user);
    const refresh_token = signRefresh(user);

    res.json({ user, access_token, refresh_token });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/auth/refresh ────────────────────────────────────

router.post('/refresh', validate(schemas.refresh), async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    let payload;
    try {
      payload = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw createError('AUTH_EXPIRED', 'Refresh token expired. Please log in again.', 401);
    }

    const { rows } = await query(
      `SELECT id, email, first_name, last_name, balance FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (rows.length === 0) {
      throw createError('USER_NOT_FOUND', 'User not found.', 404);
    }

    const user         = rows[0];
    const access_token = signAccess(user);

    res.json({ access_token });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
