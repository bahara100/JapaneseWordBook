// Session rules as pure functions: each returns the next session (with revision + 1) or null when
// the action does not apply, e.g. a second click on a card that already moved on.
import type { AnswerAttempt, DailyTarget, Level, Outcome, SessionCard, StudySession } from '../content/types';
import { dailySessionId } from './dates';

export function createDailySession({ cards, level, target, timeZone, date, contentVersion, now }: {
  cards: SessionCard[]; level: Level; target: DailyTarget; timeZone: string; date: string; contentVersion: string; now: Date;
}): StudySession {
  return {
    id: dailySessionId(date), type: 'daily', studyDate: date, timeZone, level, target, contentVersion,
    cards, currentIndex: 0, status: 'active', revision: 0, startedAt: now.toISOString(),
  };
}

export function currentCard(session: StudySession): SessionCard | undefined {
  return session.status === 'active' ? session.cards[session.currentIndex] : undefined;
}

/**
 * Records an answer on the current card. Only the first valid answer counts toward results;
 * later tries are kept as attempts only. 'unrecognized' (a technical failure) never counts.
 */
export function answerCard(session: StudySession, cardIndex: number, answer: {
  outcome: Outcome; method: AnswerAttempt['method']; inputText?: string; hintUsed?: boolean; now: Date; attemptId: string;
}): { session: StudySession; attempt: AnswerAttempt; firstEvaluation: SessionCard['firstEvaluation'] } | null {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.state === 'revealed' || card.state === 'complete') return null;
  const hintUsed = answer.hintUsed ?? card.hintUsed ?? false;
  const next: SessionCard = { ...card };
  const isFirst = !next.firstEvaluation && answer.outcome !== 'unrecognized';
  if (isFirst) next.firstEvaluation = {
    outcome: answer.outcome as Exclude<Outcome, 'unrecognized'>, hintUsed, method: answer.method,
    ...(answer.inputText !== undefined ? { inputText: answer.inputText } : {}),
  };
  // A technical failure leaves the card as it was: the learner just tries again or types.
  // In listening mode any choice turns the card: there is nothing to retype.
  if (answer.outcome !== 'unrecognized')
    next.state = answer.outcome === 'correct' || answer.outcome === 'revealed' || card.mode === 'listening' ? 'revealed' : 'feedback';
  const cards = session.cards.slice();
  cards[cardIndex] = next;
  const attempt: AnswerAttempt = {
    id: answer.attemptId, sessionId: session.id, cardIndex, method: answer.method,
    ...(answer.inputText !== undefined ? { inputText: answer.inputText } : {}),
    outcome: answer.outcome, hintUsed, attemptedAt: answer.now.toISOString(),
  };
  return {
    session: { ...session, cards, revision: session.revision + 1 }, attempt,
    // Set only when this answer is the card's first evaluation, so the schedule moves once.
    firstEvaluation: isFirst ? next.firstEvaluation : undefined,
  };
}

/**
 * A spoken answer that was heard as some other word. The first time, the card asks again without
 * an evaluation (recognition may simply have misheard, docs/01 §5); after that it counts as wrong,
 * so saying it over and over cannot hide a mistake.
 */
export function hearDifferent(session: StudySession, cardIndex: number, heard: string, now: Date, attemptId: string) {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.state === 'revealed' || card.state === 'complete') return null;
  if (card.firstEvaluation || (card.speechMismatches ?? 0) >= 1)
    return { ...answerCard(session, cardIndex, { outcome: 'incorrect', method: 'speech', inputText: heard, now, attemptId })!, askedAgain: false };
  const result = answerCard(session, cardIndex, { outcome: 'unrecognized', method: 'speech', inputText: heard, now, attemptId })!;
  const cards = result.session.cards.slice();
  cards[cardIndex] = { ...cards[cardIndex], speechMismatches: 1 };
  return { ...result, session: { ...result.session, cards }, askedAgain: true };
}

/** Records that the listening hint was played on the current card, before its first answer. */
export function markHint(session: StudySession, cardIndex: number): StudySession | null {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.hintUsed || card.firstEvaluation) return null;
  const cards = session.cards.slice();
  cards[cardIndex] = { ...card, hintUsed: true };
  return { ...session, cards, revision: session.revision + 1 };
}

/** After a wrong answer, go back to answering the same card. */
export function retryCard(session: StudySession, cardIndex: number): StudySession | null {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.state !== 'feedback') return null;
  const cards = session.cards.slice();
  cards[cardIndex] = { ...card, state: 'answering' };
  return { ...session, cards, revision: session.revision + 1 };
}

/** Moves past a card whose answer is shown. Finishing the last card completes the session. */
export function nextCard(session: StudySession, cardIndex: number, now: Date): StudySession | null {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.state !== 'revealed') return null;
  const cards = session.cards.slice();
  cards[cardIndex] = { ...card, state: 'complete' };
  const currentIndex = cardIndex + 1;
  const done = currentIndex >= cards.length;
  return {
    ...session, cards, currentIndex, revision: session.revision + 1,
    ...(done ? { status: 'complete' as const, completedAt: now.toISOString() } : {}),
  };
}

export interface SessionSummary {
  completed: number;
  /** Right on the first try without a hint. */
  correct: number;
  retried: number;
  /** Answer shown, or right only after a hint. */
  revealedOrHinted: number;
  /** correct / completed, or null when nothing is completed yet. */
  accuracy: number | null;
}

export function summarize(session: StudySession): SessionSummary {
  const done = session.cards.filter(c => c.state === 'complete' && c.firstEvaluation);
  const correct = done.filter(c => c.firstEvaluation!.outcome === 'correct' && !c.firstEvaluation!.hintUsed).length;
  const retried = done.filter(c => c.firstEvaluation!.outcome === 'incorrect').length;
  return {
    completed: done.length, correct, retried, revealedOrHinted: done.length - correct - retried,
    accuracy: done.length ? correct / done.length : null,
  };
}

/** Cards to look at again: anything not answered right on the first try without a hint. */
export function missedCards(session: StudySession): SessionCard[] {
  return session.cards.filter(c => c.state === 'complete' && c.firstEvaluation
    && !(c.firstEvaluation.outcome === 'correct' && !c.firstEvaluation.hintUsed));
}

/**
 * A separate practice round over the missed cards of a session (docs/01 §6). It records attempts
 * but never changes the review schedule or the day's first evaluations.
 */
export function createPracticeSession(from: StudySession, now: Date, id: string): StudySession | null {
  const cards = missedCards(from).map(({ firstEvaluation: _, hintUsed: __, speechMismatches: ___, ...card }) => ({ ...card, state: 'question' as const }));
  if (!cards.length) return null;
  return {
    id, type: 'practice', studyDate: from.studyDate, timeZone: from.timeZone, level: from.level, target: cards.length,
    contentVersion: from.contentVersion, cards, currentIndex: 0, status: 'active', revision: 0, startedAt: now.toISOString(),
  };
}

/** Stops a session before its last card (used to leave practice). */
export function endSession(session: StudySession, now: Date): StudySession | null {
  if (session.status !== 'active') return null;
  return { ...session, status: 'complete', completedAt: now.toISOString(), revision: session.revision + 1 };
}

/** Studying chosen favorites: kept apart from the day's goal and never moves the schedule. */
export function createFavoritesSession(cards: SessionCard[], studyDate: string, timeZone: string, now: Date, id: string): StudySession | null {
  if (!cards.length) return null;
  return {
    id, type: 'favorites', studyDate, timeZone, level: cards[0].wordSnapshot.level, target: cards.length,
    contentVersion: 'favorites', cards, currentIndex: 0, status: 'active', revision: 0, startedAt: now.toISOString(),
  };
}

export type PracticeMode = 'listening' | 'repeat';

/**
 * A practice round in another mode (docs/01 §5): listening (hear it, pick the meaning) or repeat
 * (answer and sound shown, say it along). Kept apart from the day's evaluation and the schedule.
 */
export function createModeSession(cards: SessionCard[], mode: PracticeMode, level: Level, studyDate: string, timeZone: string, now: Date, id: string): StudySession | null {
  if (!cards.length) return null;
  return {
    id, type: 'practice', studyDate, timeZone, level, target: cards.length, contentVersion: mode, currentIndex: 0,
    status: 'active', revision: 0, startedAt: now.toISOString(),
    // In repeat mode the answer is shown from the start.
    cards: cards.map(c => ({ ...c, mode, state: mode === 'repeat' ? 'revealed' : 'question' })),
  };
}

/** A try in repeat mode: kept as an attempt, never as an evaluation. */
export function recordTry(session: StudySession, cardIndex: number, tried: {
  outcome: Outcome; inputText?: string; now: Date; attemptId: string;
}): { session: StudySession; attempt: AnswerAttempt } | null {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.mode !== 'repeat') return null;
  return {
    session: { ...session, revision: session.revision + 1 },
    attempt: {
      id: tried.attemptId, sessionId: session.id, cardIndex, method: 'speech', outcome: tried.outcome, hintUsed: false,
      attemptedAt: tried.now.toISOString(), ...(tried.inputText !== undefined ? { inputText: tried.inputText } : {}),
    },
  };
}
