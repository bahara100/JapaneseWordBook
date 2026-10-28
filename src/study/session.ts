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
}): { session: StudySession; attempt: AnswerAttempt } | null {
  const card = currentCard(session);
  if (!card || cardIndex !== session.currentIndex || card.state === 'revealed' || card.state === 'complete') return null;
  const hintUsed = answer.hintUsed ?? false;
  const next: SessionCard = { ...card };
  if (!next.firstEvaluation && answer.outcome !== 'unrecognized') next.firstEvaluation = { outcome: answer.outcome, hintUsed };
  next.state = answer.outcome === 'correct' || answer.outcome === 'revealed' ? 'revealed' : 'feedback';
  const cards = session.cards.slice();
  cards[cardIndex] = next;
  const attempt: AnswerAttempt = {
    id: answer.attemptId, sessionId: session.id, cardIndex, method: answer.method,
    ...(answer.inputText !== undefined ? { inputText: answer.inputText } : {}),
    outcome: answer.outcome, hintUsed, attemptedAt: answer.now.toISOString(),
  };
  return { session: { ...session, cards, revision: session.revision + 1 }, attempt };
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
