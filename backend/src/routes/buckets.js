const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { executeBucketDeposit, executeBucketWithdrawal } = require('../services/bucketService');
const { createError } = require('../middleware/errorHandler');

// ── GET /api/buckets ──────────────────────────────────────────

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM buckets WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user.uid]
    );
    res.json({ buckets: rows });
  } catch (err) { next(err); }
});

// ── POST /api/buckets ─────────────────────────────────────────

router.post('/', authenticate, validate(schemas.bucketCreate), async (req, res, next) => {
  try {
    const { name, emoji, color } = req.body;
    const { rows } = await query(
      `INSERT INTO buckets (user_id, name, emoji, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.uid, name, emoji || '🪣', color || '#10B981']
    );
    res.status(201).json({ bucket: rows[0], message: 'Bucket created successfully.' });
  } catch (err) { next(err); }
});

// ── PATCH /api/buckets/:id ────────────────────────────────────

router.patch('/:id', authenticate, validate(schemas.bucketUpdate), async (req, res, next) => {
  try {
    const existing = await query(
      `SELECT id FROM buckets WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.uid]
    );
    if (existing.rowCount === 0) {
      throw createError('NOT_FOUND', 'Bucket not found.', 404);
    }

    const fields = [];
    const values = [];
    let idx = 1;

    for (const key of ['name', 'emoji', 'color']) {
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
      `UPDATE buckets SET ${fields.join(', ')}
       WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING *`,
      values
    );
    res.json({ bucket: rows[0], message: 'Bucket updated.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/buckets/:id ───────────────────────────────────
// Blocked if bucket_balance > 0 (returns 409 BUCKET_NOT_EMPTY)

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, bucket_balance FROM buckets WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.uid]
    );
    if (rows.length === 0) {
      throw createError('NOT_FOUND', 'Bucket not found.', 404);
    }
    if (parseFloat(rows[0].bucket_balance) > 0) {
      throw createError(
        'BUCKET_NOT_EMPTY',
        'Please withdraw funds before deleting this bucket.',
        409
      );
    }
    await query(`DELETE FROM buckets WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Bucket deleted.' });
  } catch (err) { next(err); }
});

// ── POST /api/buckets/:id/deposit ─────────────────────────────
// Atomic: Balance → Bucket → Transaction → Streak
// Validates: amount must not exceed user's total_balance

router.post('/:id/deposit', authenticate, validate(schemas.bucketAmount), async (req, res, next) => {
  try {
    const result = await executeBucketDeposit(req.user.uid, req.params.id, req.body.amount);
    res.json({
      ...result,
      message: 'Transaction Successful',
      status:  'SAVE_IT_DEPOSIT',
    });
  } catch (err) {
    // Provide standardised status messages for the frontend
    if (err.code === 'INSUFFICIENT_FUNDS') {
      return res.status(422).json({
        error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient Funds' },
      });
    }
    next(err);
  }
});

// ── POST /api/buckets/:id/withdraw ───────────────────────────
// Atomic: Bucket → Balance → Transaction
// Validates: amount must not exceed bucket_balance

router.post('/:id/withdraw', authenticate, validate(schemas.bucketAmount), async (req, res, next) => {
  try {
    const result = await executeBucketWithdrawal(req.user.uid, req.params.id, req.body.amount);
    res.json({
      ...result,
      message: 'Transaction Successful',
      status:  'SAVE_IT_WITHDRAWAL',
    });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_FUNDS') {
      return res.status(422).json({
        error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient Funds' },
      });
    }
    next(err);
  }
});

module.exports = router;
