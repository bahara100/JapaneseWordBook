// Today's session (and an optional practice round) for the screens. Every step is saved before it
// is shown; if a save fails, the screen stays where it was and says so (docs/03 §4).
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadLevel } from '../content/loader';
import type { AnswerAttempt, Outcome, SessionCard, StudySession } from '../content/types';
import { ConflictError, requestPersistence, type RecordStore, type SessionChange } from '../storage/records';
import { effectiveTimeZone } from '../storage/settings';
import { useStorage } from '../storage/StorageProvider';
import { studyDate } from './dates';
import { scheduleReview } from './schedule';
import { selectDailyCards } from './selection';
import { answerCard, createDailySession, createFavoritesSession, createPracticeSession, endSession, nextCard, retryCard } from './session';

export type Daily =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'active'; session: StudySession }
  | { status: 'done'; session: StudySession };

/** Actions on whichever session is on screen: the practice round if one is open, else today's. */
export interface SessionActions {
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
  const [daily, setDaily] = useState<StudySession | undefined>();
  const [practice, setPractice] = useState<StudySession | undefined>();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref, not only state: two clicks in the same frame must not both get through.
  const busyRef = useRef(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');

  const reload = useCallback(async () => {
    if (!store) return;
    const [d, p] = await Promise.all([store.latestDailySession(), store.activePractice()]);
    setDaily(d);
    setPractice(p);
    setLoaded(true);
  }, [store]);

  useEffect(() => {
    setLoaded(false);
    reload().catch(() => { setProblem('이 기기의 학습 기록을 읽지 못했어요.'); setLoaded(true); });
  }, [reload]);

  /** Saves `next`; shows it only once stored. A conflict adopts what the other tab saved. */
  const commit = useCallback(async (next: StudySession | null, change?: SessionChange) => {
    if (!store || !next || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setProblem('');
    setNotice('');
    try {
      await store.saveSession(next, change);
      if (next.type !== 'daily') setPractice(next.status === 'active' ? next : undefined);
      else setDaily(next);
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

  const current = practice ?? (daily?.status === 'active' ? daily : undefined);

  const actions: SessionActions = {
    async answer(outcome, method, inputText) {
      if (!current) return;
      const now = new Date();
      const result = answerCard(current, current.currentIndex, { outcome, method, inputText, now, attemptId: crypto.randomUUID() });
      if (!result) return;
      const first = result.firstEvaluation;
      const card = current.cards[current.currentIndex];
      // Only today's first answers move the review schedule; practice never does.
      const progress = current.type === 'daily' && first ? {
        promptId: card.promptSnapshot.id,
        next: (previous: Parameters<typeof scheduleReview>[0]) => scheduleReview(previous, {
          promptId: card.promptSnapshot.id, level: current.level, outcome: first.outcome, hintUsed: first.hintUsed, now, timeZone: current.timeZone,
        }),
      } : undefined;
      await commit(result.session, { attempt: result.attempt, progress });
    },
    async retry() {
      if (current) await commit(retryCard(current, current.currentIndex));
    },
    async next() {
      if (current) await commit(nextCard(current, current.currentIndex, new Date()));
    },
  };

  const start = async () => {
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
  };

  const practiceMissed = async () => {
    if (!daily) return;
    await commit(createPracticeSession(daily, new Date(), `practice:${crypto.randomUUID()}`));
  };

  /** Starts studying chosen cards; an open practice round is closed first. Returns whether it started. */
  const studyFavorites = async (cards: SessionCard[]) => {
    if (!store) return false;
    const open = await store.activePractice();
    if (open) await commit(endSession(open, new Date()));
    const now = new Date();
    const session = createFavoritesSession(cards, studyDate(now, timeZone), timeZone, now, `favorites:${crypto.randomUUID()}`);
    if (!session) return false;
    await commit(session);
    return (await store.getSession(session.id)) !== undefined;
  };

  const leavePractice = async () => {
    if (practice) await commit(endSession(practice, new Date()));
  };

  const today = studyDate(new Date(), timeZone);
  const state: Daily = !store || !loaded ? { status: 'loading' } : classify(daily, today);
  return { daily: state, practice, actions, start, practiceMissed, studyFavorites, leavePractice, busy, problem, notice, today };
}
