const { query, getClient } = require('../config/db');
const { createError }      = require('../middleware/errorHandler');
const { checkAndUpdateStreakOnDeposit } = require('./streakService');

// ─────────────────────────────────────────────────────────────
// executeDeposit  — Atomic: Balance → Bucket → Transaction → Streak
// ─────────────────────────────────────────────────────────────
async function executeBucketDeposit(userId, bucketId, amount) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock user row and verify balance
    const userRes = await client.query(
      `SELECT balance FROM users WHERE id = $1 FOR UPDATE`,
      [userId]
    );
    if (userRes.rowCount === 0) throw createError('USER_NOT_FOUND', 'User not found.', 404);

    const balance = parseFloat(userRes.rows[0].balance);
    if (balance < amount) {
      throw createError('INSUFFICIENT_FUNDS', `Insufficient balance. Available: $${balance.toFixed(2)}`, 400);
    }

    // 2. Verify bucket ownership + lock
    const bucketRes = await client.query(
      `SELECT id, name, bucket_balance FROM buckets WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [bucketId, userId]
    );
    if (bucketRes.rowCount === 0) throw createError('NOT_FOUND', 'Bucket not found.', 404);

    // 3. Deduct from user balance
    const updatedUser = await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2 RETURNING balance`,
      [amount, userId]
    );

    // 4. Add to bucket balance
    const updatedBucket = await client.query(
      `UPDATE buckets SET bucket_balance = bucket_balance + $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [amount, bucketId]
    );

    // 5. Log transaction
    await client.query(
      `INSERT INTO transactions (sender_id, receiver_id, amount, type, bucket_id, note)
       VALUES ($1, $1, $2, 'bucket_deposit', $3, $4)`,
      [userId, amount, bucketId, `Stashed to: ${bucketRes.rows[0].name}`]
    );

    await client.query('COMMIT');

    // 6. Trigger streak (OUTSIDE transaction — non-critical)
    let streakResult = null;
    try {
      streakResult = await checkAndUpdateStreakOnDeposit(userId);
    } catch (_) { /* streak failure must not roll back the financial operation */ }

    return {
      new_balance:  parseFloat(updatedUser.rows[0].balance),
      bucket:       updatedBucket.rows[0],
      streak:       streakResult?.streak ?? null,
      flower:       streakResult?.flower ?? null,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// executeWithdrawal  — Atomic: Bucket → Balance → Transaction
// ─────────────────────────────────────────────────────────────
async function executeBucketWithdrawal(userId, bucketId, amount) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1. Lock bucket and verify funds
    const bucketRes = await client.query(
      `SELECT id, name, bucket_balance FROM buckets WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [bucketId, userId]
    );
    if (bucketRes.rowCount === 0) throw createError('NOT_FOUND', 'Bucket not found.', 404);

    const bucketBalance = parseFloat(bucketRes.rows[0].bucket_balance);
    if (bucketBalance < amount) {
      throw createError(
        'INSUFFICIENT_FUNDS',
        `Bucket only has $${bucketBalance.toFixed(2)} available.`,
        400
      );
    }

    // 2. Deduct from bucket
    const updatedBucket = await client.query(
      `UPDATE buckets SET bucket_balance = bucket_balance - $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [amount, bucketId]
    );

    // 3. Add to user balance
    const updatedUser = await client.query(
      `UPDATE users SET balance = balance + $1 WHERE id = $2 RETURNING balance`,
      [amount, userId]
    );

    // 4. Log transaction
    await client.query(
      `INSERT INTO transactions (sender_id, receiver_id, amount, type, bucket_id, note)
       VALUES ($1, $1, $2, 'bucket_withdrawal', $3, $4)`,
      [userId, amount, bucketId, `Withdrawn from: ${bucketRes.rows[0].name}`]
    );

    await client.query('COMMIT');

    return {
      new_balance: parseFloat(updatedUser.rows[0].balance),
      bucket:      updatedBucket.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { executeBucketDeposit, executeBucketWithdrawal };
