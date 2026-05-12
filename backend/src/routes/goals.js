const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { calcDailyTarget } = require('../services/transferService');
const { createError } = require('../middleware/errorHandler');

// ── GET /api/goals ────────────────────────────────────────────

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.uid]
    );

    const enriched = rows.map((g) => ({
      ...g,
      ...calcDailyTarget(g.target_amount, g.current_amount, g.target_date),
      progress_pct: Math.min(
        100,
        parseFloat(((g.current_amount / g.target_amount) * 100).toFixed(1))
      ),
    }));

    res.json({ goals: enriched });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/goals ───────────────────────────────────────────

router.post('/', authenticate, validate(schemas.goalCreate), async (req, res, next) => {
  try {
    const { name, target_amount, target_date, emoji } = req.body;

    const { rows } = await query(
      `INSERT INTO goals (user_id, name, target_amount, target_date, emoji)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.uid, name, target_amount, target_date, emoji || '🎯']
    );

    const goal = rows[0];
    res.status(201).json({
      goal: { ...goal, ...calcDailyTarget(goal.target_amount, goal.current_amount, goal.target_date) },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/goals/:id ──────────────────────────────────────

router.patch('/:id', authenticate, validate(schemas.goalUpdate), async (req, res, next) => {
  try {
    // Verify ownership (data isolation)
    const existing = await query(
      `SELECT id FROM goals WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.uid]
    );
    if (existing.rowCount === 0) {
      throw createError('USER_NOT_FOUND', 'Goal not found.', 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = ['name', 'target_amount', 'current_amount', 'target_date', 'emoji'];
    for (const key of allowed) {
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
      `UPDATE goals SET ${fields.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );

    const goal = rows[0];
    res.json({
      goal: { ...goal, ...calcDailyTarget(goal.target_amount, goal.current_amount, goal.target_date) },
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/goals/:id ─────────────────────────────────────

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      `DELETE FROM goals WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.uid]
    );
    if (result.rowCount === 0) {
      throw createError('USER_NOT_FOUND', 'Goal not found.', 404);
    }
    res.json({ message: 'Goal deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
