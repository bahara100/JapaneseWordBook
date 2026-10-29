// Backup files (docs/03 §7): settings and every personal record in one JSON file, with no audio and
// no keys. Reading a file checks all of it before anything is written, so a wrong or damaged file
// can never touch the records already on this device.
import { LEVEL_IDS, type Backup, type Settings } from '../content/types';
import { isTimeZone, parseSettings } from './settings';

export const BACKUP_FORMAT = 'haru-japanese-backup';
export const BACKUP_SCHEMA = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export type DeviceRecords = Pick<Backup, 'favorites' | 'progress' | 'sessions' | 'attempts'>;

export function makeBackup(settings: Settings, records: DeviceRecords, now: Date): Backup {
  return { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA, exportedAt: now.toISOString(), settings, ...records };
}

export function backupFileName(now: Date): string {
  return `haru-japanese-backup-${now.toISOString().slice(0, 10)}.json`;
}

export interface BackupSummary {
  exportedAt: string;
  favorites: number;
  /** Words with a review schedule. */
  words: number;
  /** Daily sessions finished. */
  days: number;
  attempts: number;
  /** Latest daily study date, if any. */
  lastStudyDate?: string;
  level: Settings['level'];
  dailyTarget: Settings['dailyTarget'];
}

export function summarize(records: DeviceRecords): Omit<BackupSummary, 'exportedAt' | 'level' | 'dailyTarget'> {
  const daily = records.sessions.filter(s => s.type === 'daily');
  return {
    favorites: records.favorites.length,
    words: records.progress.length,
    days: daily.filter(s => s.status === 'complete').length,
    attempts: records.attempts.length,
    lastStudyDate: daily.map(s => s.studyDate).sort().at(-1),
  };
}

export type ParsedBackup = { ok: true; backup: Backup; summary: BackupSummary } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isTime = (v: unknown) => isText(v) && !Number.isNaN(Date.parse(v));
const isDate = (v: unknown) => isText(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isCount = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
const isLevel = (v: unknown) => LEVEL_IDS.includes(v as never);
const OUTCOMES = ['correct', 'incorrect', 'revealed', 'unrecognized'];
const CARD_STATES = ['question', 'answering', 'feedback', 'revealed', 'complete'];

/** Reads a backup file's text. Errors are in Korean and name the first problems found. */
export function parseBackup(text: string): ParsedBackup {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) return { ok: false, errors: ['파일이 너무 커요. 하루일본어 백업 파일이 맞는지 확인해 주세요.'] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON 파일이 아니거나 내용이 손상됐어요.'] };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, errors: ['하루일본어 백업 파일이 아니에요.'] };
  if (typeof raw.schemaVersion !== 'number' || raw.schemaVersion > BACKUP_SCHEMA)
    return { ok: false, errors: ['더 새 버전의 하루일본어에서 만든 백업이에요. 페이지를 새로고침한 뒤 다시 시도해 주세요.'] };
  if (raw.schemaVersion < 1) return { ok: false, errors: ['알 수 없는 백업 형식이에요.'] };

  const errors: string[] = [];
  const fail = (message: string) => { if (errors.length < 20) errors.push(message); };
  if (!isTime(raw.exportedAt)) fail('내보낸 시각(exportedAt)이 올바르지 않아요.');
  if (!isObj(raw.settings)) fail('설정(settings)이 없어요.');

  const listOf = (key: string): Obj[] => {
    const v = raw[key];
    if (!Array.isArray(v)) { fail(`${key} 목록이 없어요.`); return []; }
    return v.map((item, i) => { if (!isObj(item)) fail(`${key}[${i}]의 형식이 올바르지 않아요.`); return isObj(item) ? item : {}; });
  };
  const unique = (items: Obj[], key: string, label: string) => {
    const seen = new Set<unknown>();
    items.forEach((item, i) => {
      if (!isText(item[key])) fail(`${label}[${i}]에 ${key}가 없어요.`);
      else if (seen.has(item[key])) fail(`${label}에 같은 ${key} "${item[key]}"가 두 번 있어요.`);
      seen.add(item[key]);
    });
  };

  const favorites = listOf('favorites');
  unique(favorites, 'wordId', 'favorites');
  favorites.forEach((f, i) => { if (!isTime(f.createdAt)) fail(`favorites[${i}]의 createdAt이 올바르지 않아요.`); });

  const progress = listOf('progress');
  unique(progress, 'promptId', 'progress');
  progress.forEach((p, i) => {
    const ok = isLevel(p.level) && Number.isInteger(p.reviewStep) && (p.reviewStep as number) >= 1 && (p.reviewStep as number) <= 5
      && isTime(p.dueAt) && isTime(p.firstSeenAt) && isTime(p.lastReviewedAt) && isCount(p.incorrectCount);
    if (!ok) fail(`progress[${i}](${String(p.promptId)})의 복습 정보가 올바르지 않아요.`);
  });

  const sessions = listOf('sessions');
  unique(sessions, 'id', 'sessions');
  sessions.forEach((s, i) => {
    const where = `sessions[${i}](${String(s.id)})`;
    if (!['daily', 'favorites', 'practice'].includes(s.type as string)) fail(`${where}의 종류가 올바르지 않아요.`);
    if (!isDate(s.studyDate) || !isText(s.timeZone) || !isTimeZone(s.timeZone as string)) fail(`${where}의 날짜나 시간대가 올바르지 않아요.`);
    if (!isLevel(s.level) || !isCount(s.target) || !isText(s.contentVersion) || !isCount(s.revision) || !isTime(s.startedAt))
      fail(`${where}의 기본 정보가 올바르지 않아요.`);
    if (s.status !== 'active' && s.status !== 'complete') fail(`${where}의 상태가 올바르지 않아요.`);
    if (!Array.isArray(s.cards)) fail(`${where}에 카드 목록이 없어요.`);
    const cards: unknown[] = Array.isArray(s.cards) ? s.cards : [];
    if (!isCount(s.currentIndex) || (s.currentIndex as number) > cards.length) fail(`${where}의 현재 위치가 카드 수를 넘어요.`);
    cards.forEach((c, j) => {
      const card = isObj(c) ? c : {};
      const prompt = isObj(card.promptSnapshot) ? card.promptSnapshot : {};
      const word = isObj(card.wordSnapshot) ? card.wordSnapshot : {};
      if (!isText(prompt.id) || !isText(word.id) || !Array.isArray(card.mediaSnapshots) || !CARD_STATES.includes(card.state as string))
        fail(`${where}의 카드 ${j + 1}이 올바르지 않아요.`);
    });
  });

  const sessionIds = new Set(sessions.map(s => s.id));
  const attempts = listOf('attempts');
  unique(attempts, 'id', 'attempts');
  attempts.forEach((a, i) => {
    if (!sessionIds.has(a.sessionId)) fail(`attempts[${i}]가 없는 학습(${String(a.sessionId)})을 가리켜요.`);
    if (!isCount(a.cardIndex) || !OUTCOMES.includes(a.outcome as string) || typeof a.hintUsed !== 'boolean' || !isTime(a.attemptedAt))
      fail(`attempts[${i}]의 답변 정보가 올바르지 않아요.`);
  });

  if (errors.length) return { ok: false, errors };
  const backup = { ...(raw as unknown as Backup), settings: parseSettings(raw.settings) };
  return {
    ok: true, backup,
    summary: { exportedAt: backup.exportedAt, level: backup.settings.level, dailyTarget: backup.settings.dailyTarget, ...summarize(backup) },
  };
}
