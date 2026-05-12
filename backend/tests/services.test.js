# Budget Tracker App — Backend Jest Tests

const { calcDailyTarget } = require('../src/services/transferService');
const { getBadge }        = require('../src/services/streakService');

# ── transferService tests ──────────────────────────────────────

describe('calcDailyTarget', () => {
  test('on-track: divides remaining by days left', () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const date = future.toISOString().split('T')[0];
    const result = calcDailyTarget(1000, 200, date);
    expect(result.status).toBe('on_track');
    expect(result.dailyTarget).toBeCloseTo(80, 0);
    expect(result.daysRemaining).toBe(10);
  });

  test('completed: returns 0 daily target', () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const date = future.toISOString().split('T')[0];
    const result = calcDailyTarget(500, 500, date);
    expect(result.status).toBe('completed');
    expect(result.dailyTarget).toBe(0);
  });

  test('overdue: uses divisor=1, returns full remaining', () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const date = past.toISOString().split('T')[0];
    const result = calcDailyTarget(1000, 400, date);
    expect(result.status).toBe('overdue');
    expect(result.dailyTarget).toBe(600);
    expect(result.daysRemaining).toBe(0);
  });

  test('never crashes on same-day deadline', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(() => calcDailyTarget(100, 50, today)).not.toThrow();
  });
});

# ── streakService tests ────────────────────────────────────────

describe('getBadge', () => {
  test('0 days → seedling',  () => expect(getBadge(0)).toBe('seedling'));
  test('4 days → seedling',  () => expect(getBadge(4)).toBe('seedling'));
  test('5 days → sprout',    () => expect(getBadge(5)).toBe('sprout'));
  test('10 days → plant',    () => expect(getBadge(10)).toBe('plant'));
  test('15 days → tree',     () => expect(getBadge(15)).toBe('tree'));
  test('100 days → tree',    () => expect(getBadge(100)).toBe('tree'));
});
