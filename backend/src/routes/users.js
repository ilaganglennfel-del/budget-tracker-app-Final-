const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { executeTransfer, executeDeposit } = require('../services/transferService');
const { createError } = require('../middleware/errorHandler');
const { z } = require('zod');

// ── GET /api/users/search?email= ──────────────────────────────
// Returns only firstName + lastInitial for privacy (verification step)

router.get('/search', authenticate, async (req, res, next) => {
  try {
    const parsed = schemas.searchEmail.safeParse({ email: req.query.email });
    if (!parsed.success) {
      throw createError('VALIDATION_ERROR', 'Please provide a valid email address.', 400);
    }
    const { email } = parsed.data;

    const { rows } = await query(
      `SELECT first_name, last_name FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (rows.length === 0) {
      throw createError('USER_NOT_FOUND', 'No account found with that email.', 404);
    }

    const { first_name, last_name } = rows[0];
    // Verification display: "Glenn F." — never expose full last name
    const display_name = `${first_name} ${last_name.charAt(0).toUpperCase()}.`;

    res.json({ display_name, email });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/users/me ─────────────────────────────────────────

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, email, first_name, last_name, balance, created_at
       FROM users WHERE id = $1`,
      [req.user.uid]
    );
    if (rows.length === 0) {
      throw createError('USER_NOT_FOUND', 'User not found.', 404);
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/users/deposit ───────────────────────────────────

router.post('/deposit', authenticate, validate(schemas.deposit), async (req, res, next) => {
  try {
    const { amount } = req.body;
    const result = await executeDeposit(req.user.uid, amount);
    res.json({ balance: result.balance, message: 'Deposit successful.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
