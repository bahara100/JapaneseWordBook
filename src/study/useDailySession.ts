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
import { buildChoices, cardForWord, INCLUDE_DRAFTS, selectDailyCards } from './selection';
import { matchSpoken } from './grading';
import { answerCard, createDailySession, createFavoritesSession, createModeSession, createPracticeSession, endSession, hearDifferent, markHint, nextCard, recordTry, retryCard, type PracticeMode } from './session';

export type Daily =
  | { status: 'loading' }
  | { status: 'none' }
  | { status: 'active'; session: StudySession }
  | { status: 'done'; session: StudySession };

/** Actions on whichever session is on screen: the practice round if one is open, else today's. */
export interface SessionActions {
  answer(outcome: Outcome, method: AnswerAttempt['method'], inputText?: string): Promise<void>;
  /** Grades what the recognizer heard: right, asked to say it again once, or wrong. */
  spoken(alternatives: string[]): Promise<'correct' | 'again' | 'incorrect' | 'ignored'>;
  retry(): Promise<void>;
  next(): Promise<void>;
  /** The listening hint was played: the card's first answer will count as hinted. */
  hint(): Promise<void>;
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
  /** The practice round that just ended, for a short result. */
  const [finished, setFinished] = useState<StudySession | undefined>();
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
      if (next.type !== 'daily') {
        setPractice(next.status === 'active' ? next : undefined);
        setFinished(next.status === 'complete' && next.currentIndex >= next.cards.length ? next : undefined);
      }
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

  /** Saves an answer; only today's first answers move the review schedule, practice never does. */
  const commitAnswer = async (session: StudySession, result: NonNullable<ReturnType<typeof answerCard>>, now: Date) => {
    const first = result.firstEvaluation;
    const card = session.cards[session.currentIndex];
    const progress = session.type === 'daily' && first ? {
      promptId: card.promptSnapshot.id,
      next: (previous: Parameters<typeof scheduleReview>[0]) => scheduleReview(previous, {
        promptId: card.promptSnapshot.id, level: session.level, outcome: first.outcome, hintUsed: first.hintUsed, now, timeZone: session.timeZone,
      }),
    } : undefined;
    await commit(result.session, { attempt: result.attempt, progress });
  };

  const actions: SessionActions = {
    async answer(outcome, method, inputText) {
      if (!current) return;
      const now = new Date();
      const result = answerCard(current, current.currentIndex, { outcome, method, inputText, now, attemptId: crypto.randomUUID() });
      if (result) await commitAnswer(current, result, now);
    },
    async spoken(alternatives) {
      if (!current) return 'ignored';
      const card = current.cards[current.currentIndex];
      const now = new Date();
      const match = matchSpoken(alternatives, card.promptSnapshot);
      if (match) {
        const result = answerCard(current, current.currentIndex, { outcome: 'correct', method: 'speech', inputText: match, now, attemptId: crypto.randomUUID() });
        if (!result) return 'ignored';
        await commitAnswer(current, result, now);
        return 'correct';
      }
      const result = hearDifferent(current, current.currentIndex, alternatives[0], now, crypto.randomUUID());
      if (!result) return 'ignored';
      await commitAnswer(current, result, now);
      return result.askedAgain ? 'again' : 'incorrect';
    },
    async retry() {
      if (current) await commit(retryCard(current, current.currentIndex));
    },
    async next() {
      if (current) await commit(nextCard(current, current.currentIndex, new Date()));
    },
    async hint() {
      if (current) await commit(markHint(current, current.currentIndex));
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

  /** Starts a listening or repeat round over the chosen level's cards (up to 10, course order). */
  const startMode = async (mode: PracticeMode) => {
    if (!store) return;
    setProblem('');
    setFinished(undefined);
    try {
      const content = (await loadLevel(settings.level)).words;
      const order = new Map(content.words.map(w => [w.id, w.curriculumOrder]));
      const wordIds = [...new Set(content.prompts.filter(p => INCLUDE_DRAFTS || p.status === 'reviewed').map(p => p.wordId))]
        .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)).slice(0, 10);
      let cards = wordIds.map(id => cardForWord(content, id)).filter(c => c !== undefined);
      if (mode === 'listening') {
        cards = cards.map(c => ({ ...c, choices: buildChoices(c, content.words) }));
        if (cards.some(c => (c.choices?.length ?? 0) < 2)) { setProblem('듣고 맞히기에는 뜻이 다른 단어가 2개 이상 필요해요.'); return; }
      }
      if (!cards.length) { setProblem(`${settings.level} 수준에는 아직 연습할 카드가 없어요.`); return; }
      const open = await store.activePractice();
      if (open) await commit(endSession(open, new Date()));
      const now = new Date();
      await commit(createModeSession(cards, mode, settings.level, studyDate(now, timeZone), timeZone, now, `practice:${crypto.randomUUID()}`));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : '연습을 시작하지 못했어요.');
    }
  };

  /** Repeat mode: checks what was heard (or that nothing was) and keeps it as an attempt. */
  const tryRepeat = async (alternatives: string[] | null) => {
    if (!current) return false;
    const card = current.cards[current.currentIndex];
    const match = alternatives ? matchSpoken(alternatives, card.promptSnapshot) : undefined;
    const outcome = !alternatives ? 'unrecognized' : match ? 'correct' : 'incorrect';
    const result = recordTry(current, current.currentIndex, { outcome, inputText: match ?? alternatives?.[0], now: new Date(), attemptId: crypto.randomUUID() });
    if (result) await commit(result.session, { attempt: result.attempt });
    return !!match;
  };

  const leavePractice = async () => {
    if (practice) await commit(endSession(practice, new Date()));
  };

  const today = studyDate(new Date(), timeZone);
  const state: Daily = !store || !loaded ? { status: 'loading' } : classify(daily, today);
  return { daily: state, practice, finished, actions, start, practiceMissed, studyFavorites, startMode, tryRepeat, leavePractice, busy, problem, notice, today };
}
