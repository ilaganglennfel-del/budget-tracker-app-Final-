const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { createError } = require('../middleware/errorHandler');

// ── Frequency → monthly multiplier ───────────────────────────
const FREQUENCY_MULTIPLIER = {
  weekly:   4.33,   // avg weeks per month
  biweekly: 2.165,
  monthly:  1,
};

function calcMonthlyTotal(sources) {
  return sources.reduce((sum, s) => {
    const mult = FREQUENCY_MULTIPLIER[s.frequency] || 1;
    return sum + parseFloat(s.amount) * mult;
  }, 0);
}

// ── GET /api/income ───────────────────────────────────────────
// Returns all income sources + Total Monthly Income sum.
// NOTE: monthly_total is for display ONLY — it is never added to users.balance.

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM income_sources WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.uid]
    );
    // Sum all records in income_sources and return as "Total Monthly Income"
    const monthly_total = parseFloat(calcMonthlyTotal(rows).toFixed(2));
    res.json({ income_sources: rows, monthly_total });
  } catch (err) { next(err); }
});

// ── POST /api/income ──────────────────────────────────────────

router.post('/', authenticate, validate(schemas.incomeCreate), async (req, res, next) => {
  try {
    const { name, category, amount, frequency } = req.body;
    const { rows } = await query(
      `INSERT INTO income_sources (user_id, name, category, amount, frequency)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.uid, name, category, amount, frequency || 'monthly']
    );
    res.status(201).json({ income_source: rows[0], message: 'Income source added.' });
  } catch (err) { next(err); }
});

// ── PATCH /api/income/:id ─────────────────────────────────────

router.patch('/:id', authenticate, validate(schemas.incomeUpdate), async (req, res, next) => {
  try {
    const existing = await query(
      `SELECT id FROM income_sources WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.uid]
    );
    if (existing.rowCount === 0) {
      throw createError('NOT_FOUND', 'Income source not found.', 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of ['name', 'category', 'amount', 'frequency']) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
      }
    }

    if (fields.length === 0) {
      throw createError('VALIDATION_ERROR', 'No valid fields to update.', 400);
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.params.id, req.user.uid);

    const { rows } = await query(
      `UPDATE income_sources SET ${fields.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );
    res.json({ income_source: rows[0], message: 'Income source updated.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/income/:id ────────────────────────────────────

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM income_sources WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.uid]
    );
    if (result.rowCount === 0) {
      throw createError('NOT_FOUND', 'Income source not found.', 404);
    }
    res.json({ message: 'Income source deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
