'use strict';

const { duePhrase, dueWhen, clockTime } = require('../../src/utils/reminder-text');

// A minute in ms, for building nextFireAt relative to a fixed "now".
const MIN = 60 * 1000;

describe('duePhrase — countdown', () => {
  const now = new Date('2026-07-04T10:00:00.000Z');

  test('fires at due time (window 0) → "due now"', () => {
    const r = { nextFireAt: now, reminderWindowMinutes: 0, time: '10:00' };
    expect(duePhrase(r, now)).toBe('due now');
  });

  test('a fire-at-due reminder is NOT inflated by a leftover window', () => {
    // The bug: window defaulted to 30, so a reminder due *now* said "due in 30 min".
    // With nextFireAt = the real due instant and window 0, it must read "due now".
    const r = { nextFireAt: now, reminderWindowMinutes: 0, time: '10:00' };
    expect(duePhrase(r, now)).not.toMatch(/in \d+ min/);
  });

  test('45 minutes out → "due in 45 min"', () => {
    const r = { nextFireAt: new Date(now.getTime() + 45 * MIN), reminderWindowMinutes: 0, time: '10:45' };
    expect(duePhrase(r, now)).toBe('due in 45 min');
  });

  test('fire-early reminder (window 30) reports the real due moment', () => {
    // nextFireAt = due − 30. duePhrase reconstructs due = nextFireAt + 30 = now+30.
    const r = { nextFireAt: now, reminderWindowMinutes: 30, time: '10:30' };
    expect(duePhrase(r, now)).toBe('due in 30 min');
  });

  test('already past → clamps to "due now" (never a stray "11 PM" clock)', () => {
    const r = { nextFireAt: new Date(now.getTime() - 5 * MIN), reminderWindowMinutes: 0, time: '09:55' };
    expect(duePhrase(r, now)).toBe('due now');
  });
});

describe('clockTime / dueWhen — absolute clock', () => {
  test('clockTime formats 24h → 12h with AM/PM', () => {
    expect(clockTime('10:51')).toBe('10:51 AM');
    expect(clockTime('23:00')).toBe('11:00 PM');
    expect(clockTime('00:05')).toBe('12:05 AM');
  });

  test('dueWhen echoes the wall-clock time verbatim (no timezone shift)', () => {
    const r = { date: new Date('2026-07-06T00:00:00.000Z'), time: '09:00' };
    expect(dueWhen(r)).toBe('Jul 6, 9:00 AM');
  });
});
