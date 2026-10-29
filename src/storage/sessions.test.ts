import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import type { AnswerAttempt, StudySession, WordProgress } from '../content/types';
import { ConflictError, MemoryStore, openRecordStore, type RecordStore } from './records';

const session = (date: string, revision = 0, extra: Partial<StudySession> = {}): StudySession => ({
  id: `daily:${date}`, type: 'daily', studyDate: date, timeZone: 'Asia/Seoul', level: 'N5', target: 15,
  contentVersion: 'v1', cards: [], currentIndex: 0, status: 'active', revision, startedAt: `${date}T00:00:00Z`, ...extra,
});
const attempt = (id: string, sessionId: string, cardIndex: number): AnswerAttempt => ({
  id, sessionId, cardIndex, method: 'typing', inputText: 'ねこ', outcome: 'correct', hintUsed: false, attemptedAt: '2026-10-28T00:00:00Z',
});

const stores: [string, () => Promise<RecordStore>][] = [
  ['IndexedDB', () => openRecordStore(new IDBFactory())],
  ['memory', async () => new MemoryStore()],
];

describe.each(stores)('sessions in %s', (_, open) => {
  it('saves a session with its attempt, one revision at a time', async () => {
    const store = await open();
    await store.saveSession(session('2026-10-28'));
    await store.saveSession(session('2026-10-28', 1, { currentIndex: 1 }), { attempt: attempt('a1', 'daily:2026-10-28', 0) });
    await store.saveSession(session('2026-10-28', 2, { currentIndex: 2 }), { attempt: attempt('a2', 'daily:2026-10-28', 1) });
    expect(await store.getSession('daily:2026-10-28')).toMatchObject({ revision: 2, currentIndex: 2 });
    expect((await store.listAttempts('daily:2026-10-28')).map(a => a.id)).toEqual(['a1', 'a2']);
    store.close();
  });

  it('refuses a stale or duplicate save, and writes nothing from it', async () => {
    const store = await open();
    await store.saveSession(session('2026-10-28'));
    await store.saveSession(session('2026-10-28', 1));
    await expect(store.saveSession(session('2026-10-28', 1), { attempt: attempt('late', 'daily:2026-10-28', 0) })).rejects.toBeInstanceOf(ConflictError);
    await expect(store.saveSession(session('2026-10-28'))).rejects.toBeInstanceOf(ConflictError);
    expect(await store.listAttempts('daily:2026-10-28')).toEqual([]);
    expect((await store.getSession('daily:2026-10-28'))!.revision).toBe(1);
    store.close();
  });

  it('finds the latest daily session', async () => {
    const store = await open();
    expect(await store.latestDailySession()).toBeUndefined();
    await store.saveSession(session('2026-10-27', 0, { status: 'complete' }));
    await store.saveSession(session('2026-10-29'));
    await store.saveSession(session('2026-10-28'));
    expect((await store.latestDailySession())!.studyDate).toBe('2026-10-29');
    store.close();
  });

  it('updates the review schedule with the answer, from the stored progress', async () => {
    const store = await open();
    const bump = (promptId: string) => ({
      promptId,
      next: (p: WordProgress | undefined): WordProgress => ({
        promptId, level: 'N5', reviewStep: (p?.reviewStep ?? 0) + 1, dueAt: '2026-10-30T15:00:00.000Z',
        firstSeenAt: p?.firstSeenAt ?? 'first', lastReviewedAt: 'now', incorrectCount: 0,
      }),
    });
    await store.saveSession(session('2026-10-28'));
    await store.saveSession(session('2026-10-28', 1), { attempt: attempt('a1', 'daily:2026-10-28', 0), progress: bump('w001-p1') });
    await store.saveSession(session('2026-10-28', 2), { progress: bump('w001-p1') });
    // A refused save changes no progress either.
    await expect(store.saveSession(session('2026-10-28', 2), { progress: bump('w001-p1') })).rejects.toBeInstanceOf(ConflictError);
    expect(await store.listProgress('N5')).toEqual([expect.objectContaining({ promptId: 'w001-p1', reviewStep: 2, firstSeenAt: 'first' })]);
    expect(await store.listProgress('N4')).toEqual([]);
    store.close();
  });

  it('finds the unfinished practice session', async () => {
    const store = await open();
    expect(await store.activePractice()).toBeUndefined();
    await store.saveSession(session('2026-10-28', 0, { id: 'practice:a', type: 'practice', status: 'complete', startedAt: '2026-10-28T01:00:00Z' }));
    await store.saveSession(session('2026-10-28', 0, { id: 'practice:b', type: 'practice', startedAt: '2026-10-28T02:00:00Z' }));
    expect((await store.activePractice())!.id).toBe('practice:b');
    expect((await store.latestDailySession())).toBeUndefined();
    store.close();
  });

  it('has no progress yet for a new learner', async () => {
    const store = await open();
    expect(await store.listProgress('N5')).toEqual([]);
    store.close();
  });
});

describe('IndexedDB sessions', () => {
  it('survive reopening', async () => {
    const factory = new IDBFactory();
    const first = await openRecordStore(factory);
    await first.saveSession(session('2026-10-28'));
    first.close();
    const again = await openRecordStore(factory);
    expect(await again.getSession('daily:2026-10-28')).toMatchObject({ revision: 0 });
    again.close();
  });
});
