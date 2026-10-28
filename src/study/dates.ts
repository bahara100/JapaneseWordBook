import type { StudyDate } from '../content/types';

/** The calendar date (YYYY-MM-DD) at `now` in the given time zone. */
export function studyDate(now: Date, timeZone: string): StudyDate {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function dailySessionId(date: StudyDate): string {
  return `daily:${date}`;
}
