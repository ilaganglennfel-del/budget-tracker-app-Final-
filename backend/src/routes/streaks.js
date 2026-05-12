const router = require('express').Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { checkAndUpdateStreak, restoreStreak } = require('../services/streakService');

// ── POST /api/streaks/ping ────────────────────────────────────
// Called on every app open. Triggers streak logic on first call of each UTC day.

router.post('/ping', authenticate, async (req, res, next) => {
  try {
    const streak = await checkAndUpdateStreak(req.user.uid);
    res.json({ streak });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/streaks ──────────────────────────────────────────

router.get('/', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM streak_metadata WHERE user_id = $1 AND event_type = 'restore_used'
               AND TO_CHAR(created_at, 'YYYY-MM') = TO_CHAR(NOW(), 'YYYY-MM')
              ) AS restores_used_this_month
       FROM streaks s WHERE s.user_id = $1`,
      [req.user.uid]
    );
    res.json({ streak: rows[0] || null });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/streaks/restore ─────────────────────────────────

router.post('/restore', authenticate, async (req, res, next) => {
  try {
    const streak = await restoreStreak(req.user.uid);
    res.json({ streak, message: 'Streak restored!' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/streaks/history ──────────────────────────────────

router.get('/history', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT event_type, streak_value, event_date, created_at
       FROM streak_metadata
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.uid]
    );
    res.json({ history: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
