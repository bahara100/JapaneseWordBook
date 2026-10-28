// Small preferences live in localStorage (docs/03 §2). Anything unreadable falls back to the defaults
// field by field, so one bad value never loses the rest.
import { LEVEL_IDS, type DailyTarget, type Settings, type SpeechRate } from '../content/types';

export const SETTINGS_KEY = 'haru-japanese.settings.v1';
export const DAILY_TARGETS: DailyTarget[] = [10, 15, 20];
export const SPEECH_RATES: SpeechRate[] = [0.7, 0.85, 1];
export const FALLBACK_TIME_ZONE = 'Asia/Seoul';

export const DEFAULT_SETTINGS: Settings = {
  level: 'N5',
  dailyTarget: 15,
  timeZone: 'auto',
  showRomaji: false,
  speechRate: 0.85,
};

export function isTimeZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isTimeZone(zone) ? zone : FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/** The zone that decides today's study date. */
export function effectiveTimeZone(settings: Settings): string {
  return settings.timeZone === 'auto' ? deviceTimeZone() : settings.timeZone;
}

export function parseSettings(raw: unknown): Settings {
  const v = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    level: LEVEL_IDS.find(l => l === v.level) ?? d.level,
    dailyTarget: DAILY_TARGETS.find(t => t === v.dailyTarget) ?? d.dailyTarget,
    timeZone: typeof v.timeZone === 'string' && (v.timeZone === 'auto' || isTimeZone(v.timeZone)) ? v.timeZone : d.timeZone,
    showRomaji: typeof v.showRomaji === 'boolean' ? v.showRomaji : d.showRomaji,
    speechRate: SPEECH_RATES.find(r => r === v.speechRate) ?? d.speechRate,
  };
}

export type SettingsLoad = { settings: Settings; saved: boolean };

/** saved is false when localStorage cannot be read at all (blocked storage). */
export function readSettings(storage: Pick<Storage, 'getItem'> | undefined): SettingsLoad {
  let text: string | null;
  try {
    if (!storage) return { settings: DEFAULT_SETTINGS, saved: false };
    text = storage.getItem(SETTINGS_KEY);
  } catch {
    return { settings: DEFAULT_SETTINGS, saved: false };
  }
  if (!text) return { settings: DEFAULT_SETTINGS, saved: true };
  try {
    return { settings: parseSettings(JSON.parse(text)), saved: true };
  } catch {
    // Corrupt JSON is not a storage failure: start from defaults and overwrite on the next change.
    return { settings: DEFAULT_SETTINGS, saved: true };
  }
}

/** Returns false when the browser refused to store it. */
export function writeSettings(storage: Pick<Storage, 'setItem'> | undefined, settings: Settings): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function browserStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
