import { describe, expect, it } from 'vitest';
import { addDays, INTERVALS, scheduleReview, startOfDay } from './schedule';

const base = { promptId: 'w001-p1', level: 'N5' as const, hintUsed: false, timeZone: 'Asia/Seoul' };
const at = (iso: string) => new Date(iso);

describe('dates for the schedule', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-29', 3)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('finds midnight in the study time zone', () => {
    expect(startOfDay('2026-10-30', 'Asia/Seoul').toISOString()).toBe('2026-10-29T15:00:00.000Z');
    expect(startOfDay('2026-10-30', 'UTC').toISOString()).toBe('2026-10-30T00:00:00.000Z');
    // New York leaves daylight saving on 2026-11-01.
    expect(startOfDay('2026-11-02', 'America/New_York').toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(startOfDay('2026-10-31', 'America/New_York').toISOString()).toBe('2026-10-31T04:00:00.000Z');
  });
});

describe('scheduleReview', () => {
  it('starts a new word at 1 day when answered right', () => {
    const p = scheduleReview(undefined, { ...base, outcome: 'correct', now: at('2026-10-29T13:00:00Z') }); // 22:00 Seoul
    expect(p).toMatchObject({ reviewStep: 1, incorrectCount: 0, dueAt: '2026-10-29T15:00:00.000Z' }); // midnight starting 10-30
    expect(p.firstSeenAt).toBe(p.lastReviewedAt);
  });

  it('climbs 1 → 3 → 7 → 14 → 30 days and stays at 30', () => {
    let p = undefined as ReturnType<typeof scheduleReview> | undefined;
    const days: number[] = [];
    let now = at('2026-10-29T03:00:00Z');
    for (let i = 0; i < 7; i++) {
      p = scheduleReview(p, { ...base, outcome: 'correct', now });
      const due = new Date(p.dueAt);
      days.push(Math.round((due.getTime() - startOfDay('2026-10-29', 'Asia/Seoul').getTime() - (now.getTime() - at('2026-10-29T03:00:00Z').getTime())) / 86400000));
      now = new Date(due.getTime() + 3600000);
    }
    expect(p!.reviewStep).toBe(INTERVALS.length);
    expect(days).toEqual([1, 3, 7, 14, 30, 30, 30]);
  });

  it('brings a missed word back tomorrow, from step 1', () => {
    let p = scheduleReview(undefined, { ...base, outcome: 'correct', now: at('2026-10-29T03:00:00Z') });
    p = scheduleReview(p, { ...base, outcome: 'correct', now: at('2026-10-30T03:00:00Z') });
    expect(p.reviewStep).toBe(2);
    for (const miss of [{ outcome: 'incorrect' as const }, { outcome: 'revealed' as const }, { outcome: 'correct' as const, hintUsed: true }]) {
      const after = scheduleReview(p, { ...base, ...miss, now: at('2026-11-02T03:00:00Z') });
      expect(after).toMatchObject({ reviewStep: 1, incorrectCount: 1, dueAt: '2026-11-02T15:00:00.000Z' });
      expect(after.firstSeenAt).toBe(p.firstSeenAt);
    }
  });
});
