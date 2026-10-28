import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, effectiveTimeZone, parseSettings, readSettings, SETTINGS_KEY, writeSettings } from './settings';

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial ? [[SETTINGS_KEY, initial]] : []);
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};
const blocked = {
  getItem: () => { throw new DOMException('denied', 'SecurityError'); },
  setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
};

describe('settings', () => {
  it('starts from the product defaults', () => {
    expect(readSettings(memory())).toEqual({ settings: DEFAULT_SETTINGS, saved: true });
    expect(DEFAULT_SETTINGS).toMatchObject({ level: 'N5', dailyTarget: 15 });
  });

  it('keeps good fields and replaces only the bad ones', () => {
    expect(parseSettings({ level: 'N3', dailyTarget: 12, timeZone: 'Mars/Base', showRomaji: true, speechRate: 1 }))
      .toEqual({ ...DEFAULT_SETTINGS, level: 'N3', showRomaji: true, speechRate: 1 });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips through storage', () => {
    const storage = memory();
    const settings = { ...DEFAULT_SETTINGS, level: 'N1' as const, dailyTarget: 20 as const, timeZone: 'Asia/Tokyo' };
    expect(writeSettings(storage, settings)).toBe(true);
    expect(readSettings(storage)).toEqual({ settings, saved: true });
  });

  it('treats corrupt JSON as defaults, not as a storage failure', () => {
    expect(readSettings(memory('{oops'))).toEqual({ settings: DEFAULT_SETTINGS, saved: true });
  });

  it('reports blocked storage', () => {
    expect(readSettings(blocked)).toEqual({ settings: DEFAULT_SETTINGS, saved: false });
    expect(readSettings(undefined).saved).toBe(false);
    expect(writeSettings(blocked, DEFAULT_SETTINGS)).toBe(false);
  });

  it('follows the device time zone on auto', () => {
    expect(effectiveTimeZone({ ...DEFAULT_SETTINGS, timeZone: 'Asia/Tokyo' })).toBe('Asia/Tokyo');
    expect(effectiveTimeZone(DEFAULT_SETTINGS)).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
