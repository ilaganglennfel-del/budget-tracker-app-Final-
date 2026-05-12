const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { executeTransfer } = require('../services/transferService');

// ── POST /api/transfers ───────────────────────────────────────
// Full atomic P2P transfer

router.post('/', authenticate, validate(schemas.transfer), async (req, res, next) => {
  try {
    const { receiver_email, amount, note } = req.body;
    const tx = await executeTransfer(req.user.uid, receiver_email, amount, note);
    res.status(201).json({ transaction: tx, message: 'Transfer completed successfully.' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/transfers ────────────────────────────────────────
// User's transaction history (sent + received), scoped by req.user.uid

router.get('/', authenticate, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit = Math.min(50, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;

    const { rows } = await query(
      `SELECT
         t.id,
         t.amount,
         t.type,
         t.status,
         t.note,
         t.created_at,
         -- Sender info
         s.first_name AS sender_first,
         s.last_name  AS sender_last,
         s.email      AS sender_email,
         -- Receiver info
         r.first_name AS receiver_first,
         r.last_name  AS receiver_last,
         r.email      AS receiver_email,
         -- Direction from current user's perspective
         CASE WHEN t.sender_id = $1 THEN 'sent' ELSE 'received' END AS direction
       FROM transactions t
       JOIN users s ON s.id = t.sender_id
       JOIN users r ON r.id = t.receiver_id
       WHERE t.sender_id = $1 OR t.receiver_id = $1
       ORDER BY t.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.uid, limit, offset]
    );

    const countRes = await query(
      `SELECT COUNT(*) FROM transactions
       WHERE sender_id = $1 OR receiver_id = $1`,
      [req.user.uid]
    );

    res.json({
      transactions: rows,
      total: parseInt(countRes.rows[0].count, 10),
      page,
      limit,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
