const { differenceInCalendarDays, parseISO, isValid } = require('date-fns');
const { getClient } = require('../config/db');
const { createError } = require('../middleware/errorHandler');

/**
 * Atomic P2P transfer between two users.
 * Uses BEGIN / SELECT ... FOR UPDATE / COMMIT to prevent race conditions.
 *
 * @param {string} senderUid
 * @param {string} receiverEmail
 * @param {number} amount
 * @param {string} [note]
 * @returns {object} transaction record
 */
async function executeTransfer(senderUid, receiverEmail, amount, note = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock & fetch sender row
    const senderRes = await client.query(
      `SELECT id, balance FROM users WHERE id = $1 FOR UPDATE`,
      [senderUid]
    );
    if (senderRes.rowCount === 0) {
      throw createError('USER_NOT_FOUND', 'Sender account not found.', 404);
    }
    const sender = senderRes.rows[0];

    // 2. Fetch receiver (no lock needed for credit-only ops, but we lock for consistency)
    const receiverRes = await client.query(
      `SELECT id, balance FROM users WHERE email = $1 FOR UPDATE`,
      [receiverEmail.toLowerCase()]
    );
    if (receiverRes.rowCount === 0) {
      throw createError('USER_NOT_FOUND', 'No account found with that email.', 404);
    }
    const receiver = receiverRes.rows[0];

    // 3. Prevent self-transfer
    if (sender.id === receiver.id) {
      throw createError('VALIDATION_ERROR', 'You cannot transfer to yourself.', 400);
    }

    // 4. Balance check
    if (parseFloat(sender.balance) < amount) {
      throw createError('INSUFFICIENT_FUNDS', 'Insufficient balance for this transfer.', 422);
    }

    // 5. Debit sender
    await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2`,
      [amount, sender.id]
    );

    // 6. Credit receiver
    await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2`,
      [amount, receiver.id]
    );

    // 7. Create transaction record
    const txRes = await client.query(
      `INSERT INTO transactions (sender_id, receiver_id, amount, type, status, note)
       VALUES ($1, $2, $3, 'transfer', 'completed', $4)
       RETURNING *`,
      [sender.id, receiver.id, amount, note]
    );

    await client.query('COMMIT');
    return txRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Atomic deposit: adds funds to user's own account.
 */
async function executeDeposit(userUid, amount) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2
       RETURNING id, balance`,
      [amount, userUid]
    );
    if (rows.length === 0) {
      throw createError('USER_NOT_FOUND', 'User not found.', 404);
    }

    // Self-referential transaction to log deposit
    await client.query(
      `INSERT INTO transactions (sender_id, receiver_id, amount, type, status, note)
       VALUES ($1, $1, $2, 'deposit', 'completed', 'Account deposit')`,
      [userUid, amount]
    );

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Calculate daily savings target for a goal.
 * Handles overdue goals gracefully (daysRemaining floor = 1).
 */
function calcDailyTarget(targetAmount, currentAmount, targetDateStr) {
  const remaining = parseFloat(targetAmount) - parseFloat(currentAmount);
  if (remaining <= 0) return { dailyTarget: 0, status: 'completed', daysRemaining: 0 };

  const targetDate = typeof targetDateStr === 'string'
    ? parseISO(targetDateStr)
    : targetDateStr;

  const daysRemaining = differenceInCalendarDays(targetDate, new Date());
  const isOverdue     = daysRemaining < 0;
  const divisor       = Math.max(1, daysRemaining); // never divide by 0 or negative

  return {
    dailyTarget:   parseFloat((remaining / divisor).toFixed(2)),
    status:        isOverdue ? 'overdue' : 'on_track',
    daysRemaining: isOverdue ? 0 : daysRemaining,
  };
}

module.exports = { executeTransfer, executeDeposit, calcDailyTarget };
