const router = require('express').Router();
const { getClient, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { createError } = require('../middleware/errorHandler');

// ── GET /api/expenses ─────────────────────────────────────────

router.get('/', authenticate, async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1'));
    const limit  = Math.min(50, parseInt(req.query.limit || '20'));
    const offset = (page - 1) * limit;

    const { rows } = await query(
      `SELECT * FROM expenses WHERE user_id = $1
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.uid, limit, offset]
    );
    res.json({ expenses: rows, page, limit });
  } catch (err) { next(err); }
});

// ── POST /api/expenses ────────────────────────────────────────
// Atomic: Lock balance → deduct → insert expense → log transaction
// Returns: "Transaction Successful" | "Insufficient Funds" | "Database Sync Error"

router.post('/', authenticate, validate(schemas.expenseCreate), async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { amount, category, note } = req.body;

    // 1. Lock user row & verify balance
    const userRes = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [req.user.uid]
    );
    if (userRes.rowCount === 0) {
      throw createError('USER_NOT_FOUND', 'User not found.', 404);
    }
    const balance = parseFloat(userRes.rows[0].balance);
    if (balance < amount) {
      throw createError(
        'INSUFFICIENT_FUNDS',
        `Insufficient Funds. Available: $${balance.toFixed(2)}`,
        422
      );
    }

    // 2. Deduct from balance
    const updatedUser = await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance`,
      [amount, req.user.uid]
    );

    // 3. Insert expense record into the expenses table
    const expenseRes = await client.query(
      `INSERT INTO expenses (user_id, amount, category, note)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.uid, amount, category, note || null]
    );

    // 4. Log to transaction history (type: 'expense' / 'EXPENSE')
    await client.query(
      `INSERT INTO transactions (sender_id, receiver_id, amount, type, note)
       VALUES ($1, $1, $2, 'expense', $3)`,
      [req.user.uid, amount, `${category}${note ? ': ' + note : ''}`]
    );

    await client.query('COMMIT');

    res.status(201).json({
      expense:     expenseRes.rows[0],
      new_balance: parseFloat(updatedUser.rows[0].balance),
      message:     'Transaction Successful',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // Surface Insufficient Funds with standard message
    if (err.code === 'INSUFFICIENT_FUNDS') {
      return res.status(422).json({
        error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient Funds' },
      });
    }
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
