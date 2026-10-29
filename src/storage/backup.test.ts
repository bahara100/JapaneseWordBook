import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { StudySession } from '../content/types';
import { BACKUP_FORMAT, backupFileName, makeBackup, parseBackup, type DeviceRecords } from './backup';
import { openRecordStore } from './records';
import { DEFAULT_SETTINGS } from './settings';

const now = new Date('2026-10-29T12:00:00Z');
const session: StudySession = {
  id: 'daily:2026-10-28', type: 'daily', studyDate: '2026-10-28', timeZone: 'Asia/Seoul', level: 'N5', target: 15,
  contentVersion: 'v1', currentIndex: 1, status: 'complete', revision: 4, startedAt: '2026-10-28T01:00:00Z',
  cards: [{
    promptSnapshot: { id: 'w001-p1' } as never, wordSnapshot: { id: 'w001' } as never, mediaSnapshots: [],
    kind: 'new', mode: 'picture', state: 'complete', firstEvaluation: { outcome: 'correct', hintUsed: false },
  }],
};
const records: DeviceRecords = {
  favorites: [{ wordId: 'w001', createdAt: '2026-10-28T02:00:00Z' }],
  progress: [{ promptId: 'w001-p1', level: 'N5', reviewStep: 1, dueAt: '2026-10-28T15:00:00Z', firstSeenAt: '2026-10-28T01:00:00Z', lastReviewedAt: '2026-10-28T01:00:00Z', incorrectCount: 0 }],
  sessions: [session],
  attempts: [{ id: 'a1', sessionId: 'daily:2026-10-28', cardIndex: 0, method: 'typing', inputText: 'ねこ', outcome: 'correct', hintUsed: false, attemptedAt: '2026-10-28T01:01:00Z' }],
};
const settings = { ...DEFAULT_SETTINGS, level: 'N4' as const, dailyTarget: 20 as const };
const file = (change: (b: Record<string, unknown>) => void = () => {}) => {
  const b = JSON.parse(JSON.stringify(makeBackup(settings, records, now)));
  change(b);
  return JSON.stringify(b);
};
const errors = (text: string) => { const r = parseBackup(text); return r.ok ? [] : r.errors; };

describe('backup file', () => {
  it('reads back what was written, with a summary for the preview', () => {
    const result = parseBackup(file());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup).toMatchObject({ format: BACKUP_FORMAT, schemaVersion: 1, settings, ...records });
    expect(result.summary).toEqual({
      exportedAt: now.toISOString(), level: 'N4', dailyTarget: 20,
      favorites: 1, words: 1, days: 1, attempts: 1, lastStudyDate: '2026-10-28',
    });
    expect(backupFileName(now)).toBe('haru-japanese-backup-2026-10-29.json');
  });

  it('refuses files that are not ours, damaged, or from a newer app', () => {
    expect(errors('{oops')).toEqual(['JSON 파일이 아니거나 내용이 손상됐어요.']);
    expect(errors('{"hello":1}')).toEqual(['하루일본어 백업 파일이 아니에요.']);
    expect(errors(file(b => { b.schemaVersion = 2; }))[0]).toContain('더 새 버전');
    expect(errors('x'.repeat(5 * 1024 * 1024 + 1))[0]).toContain('너무 커요');
  });

  it('names broken records instead of importing part of them', () => {
    expect(errors(file(b => { (b.favorites as unknown[]).push({ wordId: 'w001', createdAt: 'x' }); })))
      .toEqual(expect.arrayContaining(['favorites에 같은 wordId "w001"가 두 번 있어요.', 'favorites[1]의 createdAt이 올바르지 않아요.']));
    expect(errors(file(b => { (b.progress as { reviewStep: number }[])[0].reviewStep = 9; })))
      .toEqual(['progress[0](w001-p1)의 복습 정보가 올바르지 않아요.']);
    expect(errors(file(b => { (b.attempts as { sessionId: string }[])[0].sessionId = 'daily:2000-01-01'; })))
      .toEqual(['attempts[0]가 없는 학습(daily:2000-01-01)을 가리켜요.']);
    expect(errors(file(b => { (b.sessions as { currentIndex: number }[])[0].currentIndex = 5; })))
      .toEqual(['sessions[0](daily:2026-10-28)의 현재 위치가 카드 수를 넘어요.']);
    expect(errors(file(b => { delete b.sessions; }))).toEqual(['sessions 목록이 없어요.', expect.stringContaining('attempts[0]가 없는 학습')]);
  });

  it('fixes only unreadable settings, like the settings screen does', () => {
    const result = parseBackup(file(b => { (b.settings as { level: string }).level = 'N9'; }));
    expect(result.ok && result.backup.settings.level).toBe('N5');
  });
});

describe('replacing records from a backup', () => {
  it('swaps everything in, and exports the same', async () => {
    const store = await openRecordStore(new IDBFactory());
    await store.setFavorite('w003', true);
    await store.replaceRecords(records);
    expect(await store.exportRecords()).toEqual(records);
    expect((await store.listFavorites()).map(f => f.wordId)).toEqual(['w001']);
    store.close();
  });

  it('changes nothing when any record cannot be stored', async () => {
    const store = await openRecordStore(new IDBFactory());
    await store.setFavorite('w003', true);
    const broken = { ...records, progress: [{ level: 'N5' } as never] }; // no promptId key
    await expect(store.replaceRecords(broken)).rejects.toThrow('이 기기에 기록을 저장하지 못했어요.');
    expect((await store.exportRecords()).favorites.map(f => f.wordId)).toEqual(['w003']);
    store.close();
  });

  it('remembers when the last backup was made', async () => {
    const store = await openRecordStore(new IDBFactory());
    expect(await store.getMeta('lastBackupAt')).toBeUndefined();
    await store.setMeta('lastBackupAt', now.toISOString());
    expect(await store.getMeta('lastBackupAt')).toBe(now.toISOString());
    store.close();
  });
});
