const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// ── GET /api/garden ───────────────────────────────────────────
// Returns all collected flowers for the authenticated user.
// Flowers are purely decorative — no sell/trade endpoints.

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM garden_flowers
       WHERE user_id = $1
       ORDER BY earned_at DESC, created_at DESC`,
      [req.user.uid]
    );
    res.json({ flowers: rows, total: rows.length });
  } catch (err) { next(err); }
});

module.exports = router;
