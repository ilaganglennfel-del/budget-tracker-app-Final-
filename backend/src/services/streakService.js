const { format, parseISO, isToday, isYesterday, startOfDay } = require('date-fns');
const { query, getClient } = require('../config/db');
const { createError } = require('../middleware/errorHandler');

// Badge thresholds
const BADGE_THRESHOLDS = [
  { min: 15, level: 'tree' },
  { min: 10, level: 'plant' },
  { min: 5,  level: 'sprout' },
  { min: 0,  level: 'seedling' },
];

function getBadge(streak) {
  return BADGE_THRESHOLDS.find((t) => streak >= t.min).level;
}

/**
 * Called on every authenticated "app open" ping.
 * Returns current streak state WITHOUT modifying it.
 * Per spec: streak progression is ONLY triggered by Save It deposits.
 *
 * @param {string} userId
 * @returns {object} current streak row
 */
async function checkAndUpdateStreak(userId) {
  const { rows } = await query(
    `SELECT * FROM streaks WHERE user_id = $1`,
    [userId]
  );
  return rows[0] || { current_streak: 0, badge_level: 'seedling' };
}

/**
 * Called exclusively by bucketService on a Save It deposit.
 * Advances the streak for the current UTC day.
 * Awards a random shiny flower every 3rd consecutive day.
 * Grays all existing flowers when a streak breaks.
 *
 * @param {string} userId
 * @returns {object} { streak, flower | null }
 */
async function checkAndUpdateStreakOnDeposit(userId) {
  const FLOWERS = ['rose', 'sunflower', 'tulip', 'sakura', 'hibiscus', 'daisy'];

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM streaks WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (rows.length === 0) {
      await client.query(`INSERT INTO streaks (user_id) VALUES ($1)`, [userId]);
      await client.query('COMMIT');
      return { streak: { current_streak: 1, badge_level: 'seedling' }, flower: null };
    }

    const streak   = rows[0];
    const todayUTC = format(new Date(), 'yyyy-MM-dd');
    const lastActive = streak.last_active_utc_date
      ? format(new Date(streak.last_active_utc_date), 'yyyy-MM-dd')
      : null;

    // Already deposited today — no-op, return current state
    if (lastActive === todayUTC) {
      await client.query('COMMIT');
      return { streak, flower: null };
    }

    let newStreak;
    let eventType;

    if (lastActive === null) {
      newStreak = 1;
      eventType = 'streak_started';
    } else {
      const last     = new Date(lastActive + 'T00:00:00Z');
      const now      = new Date(todayUTC   + 'T00:00:00Z');
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = streak.current_streak + 1;
        eventType = 'streak_increment';
      } else {
        newStreak = 1;
        eventType = 'streak_broken';
      }
    }

    const newBadge   = getBadge(newStreak);
    const newLongest = Math.max(streak.longest_streak, newStreak);

    const updated = await client.query(
      `UPDATE streaks
       SET current_streak       = $1,
           longest_streak       = $2,
           last_active_utc_date = $3,
           badge_level          = $4,
           updated_at           = NOW()
       WHERE user_id = $5
       RETURNING *`,
      [newStreak, newLongest, todayUTC, newBadge, userId]
    );

    await client.query(
      `INSERT INTO streak_metadata (user_id, event_type, streak_value, event_date)
       VALUES ($1, $2, $3, $4)`,
      [userId, eventType, newStreak, todayUTC]
    );

    let awardedFlower = null;

    // ── Gamification: Flower Award every 3rd day ──────────────
    if (eventType === 'streak_increment' && newStreak % 3 === 0) {
      const randomFlower = FLOWERS[Math.floor(Math.random() * FLOWERS.length)];
      const flowerRes = await client.query(
        `INSERT INTO garden_flowers (user_id, flower_type, is_shiny, streak_value)
         VALUES ($1, $2, true, $3)
         RETURNING *`,
        [userId, randomFlower, newStreak]
      );
      awardedFlower = flowerRes.rows[0];
    }

    // ── Gamification: Gray all flowers on streak break ─────────
    if (eventType === 'streak_broken') {
      await client.query(
        `UPDATE garden_flowers SET is_shiny = false
         WHERE user_id = $1 AND is_shiny = true`,
        [userId]
      );
    }

    await client.query('COMMIT');
    return { streak: updated.rows[0], flower: awardedFlower };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Restore a broken streak (free, max 5/month).
 * The streak value is restored to its previous value by simply re-incrementing by 1
 * (i.e. treating yesterday as a valid day).
 */
async function restoreStreak(userId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT * FROM streaks WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    if (rows.length === 0) {
      throw createError('USER_NOT_FOUND', 'Streak record not found.', 404);
    }

    const streak       = rows[0];
    const currentMonth = format(new Date(), 'yyyy-MM');

    // Reset counter if new month
    let usesThisMonth = streak.restore_uses_this_month;
    if (streak.restore_month_year !== currentMonth) {
      usesThisMonth = 0;
    }

    if (usesThisMonth >= 5) {
      throw createError(
        'VALIDATION_ERROR',
        'You have used all 5 streak restores for this month.',
        422
      );
    }

    // Restore: set last_active_utc_date to yesterday so tomorrow's check continues the streak
    const todayUTC     = format(new Date(), 'yyyy-MM-dd');
    const newStreak    = streak.current_streak + 1;
    const newBadge     = getBadge(newStreak);
    const newLongest   = Math.max(streak.longest_streak, newStreak);

    await client.query(
      `UPDATE streaks
       SET current_streak          = $1,
           longest_streak          = $2,
           last_active_utc_date    = $3,
           badge_level             = $4,
           restore_uses_this_month = $5,
           restore_month_year      = $6,
           updated_at              = NOW()
       WHERE user_id = $7`,
      [newStreak, newLongest, todayUTC, newBadge, usesThisMonth + 1, currentMonth, userId]
    );

    await client.query(
      `INSERT INTO streak_metadata (user_id, event_type, streak_value, event_date)
       VALUES ($1, 'restore_used', $2, $3)`,
      [userId, newStreak, todayUTC]
    );

    await client.query('COMMIT');

    const result = await query(`SELECT * FROM streaks WHERE user_id = $1`, [userId]);
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { checkAndUpdateStreak, checkAndUpdateStreakOnDeposit, restoreStreak, getBadge };
