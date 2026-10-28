// Today's session for the screens: reads it from device records, and saves every step before
// showing it. If a save fails, the screen stays where it was and says so (docs/03 §4).
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLevel } from '../content/loader';
import type { AnswerAttempt, Outcome, StudySession } from '../content/types';
import { ConflictError, requestPersistence, type RecordStore } from '../storage/records';
import { effectiveTimeZone } from '../storage/settings';
import { useStorage } from '../storage/StorageProvider';
import { studyDate } from './dates';
import { selectDailyCards } from './selection';
import { answerCard, createDailySession, nextCard, retryCard } from './session';

export type Daily =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'active'; session: StudySession }
  | { status: 'done'; session: StudySession };

export interface DailyActions {
  start(): Promise<void>;
  answer(outcome: Outcome, method: AnswerAttempt['method'], inputText?: string): Promise<void>;
  retry(): Promise<void>;
  next(): Promise<void>;
}

function classify(session: StudySession | undefined, today: string): Daily {
  if (session?.status === 'active') return { status: 'active', session };
  if (session?.status === 'complete' && session.studyDate === today) return { status: 'done', session };
  return { status: 'none' };
}

export function useDailySession() {
  const { settings, records } = useStorage();
  const store: RecordStore | undefined = records.status === 'ready' ? records.store : undefined;
  const timeZone = effectiveTimeZone(settings);
  const [session, setSession] = useState<StudySession | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref, not only state: two clicks in the same frame must not both get through.
  const busyRef = useRef(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    if (!store) return;
    setSession(await store.latestDailySession());
    setLoaded(true);
  }, [store]);

  useEffect(() => {
    setLoaded(false);
    reload().catch(() => { setProblem('이 기기의 학습 기록을 읽지 못했어요.'); setLoaded(true); });
  }, [reload]);

  /** Saves `next`; shows it only once stored. A conflict adopts what the other tab saved. */
  const commit = useCallback(async (next: StudySession | null, attempt?: AnswerAttempt) => {
    if (!store || !next || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      await store.saveSession(next, attempt);
      setSession(next);
    } catch (e) {
      if (e instanceof ConflictError) {
        await reload();
        setNotice(e.message);
      } else {
        setProblem('이 기기에 기록을 저장하지 못했어요. 다시 눌러 주세요.');
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [store, reload]);

  const actions: DailyActions = {
    async start() {
      if (!store || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setProblem('');
      let created: StudySession | undefined;
      try {
        const now = new Date();
        const content = await loadLevel(settings.level);
        const progress = await store.listProgress(settings.level);
        const cards = selectDailyCards({ target: settings.dailyTarget, content: content.words, progress, now });
        if (!cards.length) setProblem(`${settings.level} 수준에는 아직 학습할 카드가 없어요.`);
        else created = createDailySession({
          cards, level: settings.level, target: settings.dailyTarget, timeZone,
          date: studyDate(now, timeZone), contentVersion: content.manifest.contentVersion, now,
        });
      } catch (e) {
        setProblem(e instanceof Error ? e.message : '학습을 시작하지 못했어요.');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
      if (!created) return;
      await commit(created);
      // Now there is something worth keeping, ask the browser not to clear it.
      void requestPersistence();
    },
    async answer(outcome, method, inputText) {
      if (!session) return;
      const result = answerCard(session, session.currentIndex, { outcome, method, inputText, now: new Date(), attemptId: crypto.randomUUID() });
      if (result) await commit(result.session, result.attempt);
    },
    async retry() {
      if (session) await commit(retryCard(session, session.currentIndex));
    },
    async next() {
      if (session) await commit(nextCard(session, session.currentIndex, new Date()));
    },
  };

  const today = studyDate(new Date(), timeZone);
  const daily: Daily = !store || !loaded ? { status: 'loading' } : classify(session, today);
  return { daily, actions, busy, problem, notice, today };
}
