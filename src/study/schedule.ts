// Review schedule (docs/01 §6): 1 → 3 → 7 → 14 → 30 days. A first answer that is right without a
// hint moves one step up; a wrong answer, a shown answer or a hint brings the word back tomorrow
// (step 1). Technical failures never reach here. Reviews fall due at midnight of the study day.
import type { Level, Outcome, WordProgress } from '../content/types';
import { studyDate } from './dates';

export const INTERVALS = [1, 3, 7, 14, 30];

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Milliseconds the zone is ahead of UTC at instant `t`. */
function zoneOffset(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(t));
  const get = (type: string) => Number(parts.find(p => p.type === type)!.value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - Math.floor(t / 1000) * 1000;
}

/** The instant a study date begins in the zone. */
export function startOfDay(date: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let t = wall - zoneOffset(wall, timeZone);
  t = wall - zoneOffset(t, timeZone); // second pass settles daylight-saving changes
  return new Date(t);
}

export function scheduleReview(previous: WordProgress | undefined, answer: {
  promptId: string; level: Level; outcome: Exclude<Outcome, 'unrecognized'>; hintUsed: boolean; now: Date; timeZone: string;
}): WordProgress {
  const success = answer.outcome === 'correct' && !answer.hintUsed;
  const step = success ? Math.min((previous?.reviewStep ?? 0) + 1, INTERVALS.length) : 1;
  const today = studyDate(answer.now, answer.timeZone);
  const at = answer.now.toISOString();
  return {
    promptId: answer.promptId,
    level: answer.level,
    reviewStep: step,
    dueAt: startOfDay(addDays(today, INTERVALS[step - 1]), answer.timeZone).toISOString(),
    firstSeenAt: previous?.firstSeenAt ?? at,
    lastReviewedAt: at,
    // Counts every miss (wrong, shown or hinted); review order puts the most-missed first.
    incorrectCount: (previous?.incorrectCount ?? 0) + (success ? 0 : 1),
  };
}
