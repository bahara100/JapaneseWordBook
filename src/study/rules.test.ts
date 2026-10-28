import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelWords, StudySession, WordProgress } from '../content/types';
import { dailySessionId, studyDate } from './dates';
import { gradeTyped, normalizeAnswer } from './grading';
import { REVIEW_CAP, selectDailyCards } from './selection';
import { answerCard, createDailySession, nextCard, retryCard, summarize } from './session';

const n5: LevelWords = JSON.parse(readFileSync(path.resolve(__dirname, '../../content/n5/words.json'), 'utf8'));

/** A level with `count` words, all drafts, in curriculum order x{count}..x1. */
function level(count: number): LevelWords {
  const base = n5.words[0], prompt = n5.prompts[0];
  const words = Array.from({ length: count }, (_, i) => ({ ...base, id: `x${i + 1}`, curriculumOrder: count - i }));
  return {
    level: 'N5', words, media: n5.media,
    prompts: words.map(w => ({ ...prompt, id: `${w.id}-p1`, wordId: w.id })),
  };
}
const now = new Date('2026-10-28T03:00:00Z');
const progress = (promptId: string, dueAt: string, incorrectCount = 0): WordProgress =>
  ({ promptId, level: 'N5', reviewStep: 1, dueAt, firstSeenAt: dueAt, lastReviewedAt: dueAt, incorrectCount });

describe('studyDate', () => {
  it('uses the calendar date of the chosen time zone', () => {
    const late = new Date('2026-10-28T16:30:00Z'); // 01:30 the next day in Seoul
    expect(studyDate(late, 'Asia/Seoul')).toBe('2026-10-29');
    expect(studyDate(late, 'UTC')).toBe('2026-10-28');
    expect(dailySessionId('2026-10-29')).toBe('daily:2026-10-29');
  });
});

describe('gradeTyped', () => {
  const prompt = { acceptedKanaForms: ['がっこう'], acceptedWrittenForms: ['学校'] };
  it('accepts the reading in either kana script, or the written form', () => {
    expect(gradeTyped('がっこう', prompt)).toBe('correct');
    expect(gradeTyped('ガッコウ', prompt)).toBe('correct');
    expect(gradeTyped(' がっこう。', prompt)).toBe('correct');
    expect(gradeTyped('学校', prompt)).toBe('correct');
  });
  it('does not ignore small っ, long vowels or 요음', () => {
    expect(gradeTyped('がこう', prompt)).toBe('incorrect');
    expect(gradeTyped('がっこ', prompt)).toBe('incorrect');
    expect(gradeTyped('きよう', { acceptedKanaForms: ['きょう'], acceptedWrittenForms: [] })).toBe('incorrect');
    expect(gradeTyped('', prompt)).toBe('incorrect');
  });
  it('normalizes width and punctuation only', () => {
    expect(normalizeAnswer('ｶﾞｯｺｳ！')).toBe('がっこう');
  });
});

describe('selectDailyCards', () => {
  it('takes new words in curriculum order', () => {
    const cards = selectDailyCards({ target: 10, content: level(4), progress: [], now });
    expect(cards.map(c => c.wordSnapshot.id)).toEqual(['x4', 'x3', 'x2', 'x1']);
    expect(cards.every(c => c.kind === 'new' && c.state === 'question')).toBe(true);
    expect(cards[0].mediaSnapshots[0].id).toBe(cards[0].promptSnapshot.imageAssetId);
  });

  it('caps reviews at about a third and fills the rest with new words', () => {
    const content = level(30);
    const due = content.prompts.slice(0, 8).map((p, i) => progress(p.id, `2026-10-2${i % 3}T00:00:00Z`));
    const cards = selectDailyCards({ target: 15, content, progress: due, now });
    expect(cards).toHaveLength(15);
    expect(cards.filter(c => c.kind === 'review')).toHaveLength(REVIEW_CAP[15]);
    expect(new Set(cards.map(c => c.wordSnapshot.id)).size).toBe(15);
  });

  it('orders reviews by due date, then mistakes, and skips ones not yet due', () => {
    const content = level(5);
    const [a, b, c, d] = content.prompts.map(p => p.id);
    const cards = selectDailyCards({
      target: 10, content, now,
      progress: [progress(a, '2026-10-27T00:00:00Z', 0), progress(b, '2026-10-27T00:00:00Z', 3), progress(c, '2026-10-20T00:00:00Z'), progress(d, '2026-11-01T00:00:00Z')],
    });
    expect(cards.filter(x => x.kind === 'review').map(x => x.promptSnapshot.id)).toEqual([c, b, a]);
    expect(cards.map(x => x.promptSnapshot.id)).not.toContain(d);
  });

  it('fills with extra due reviews when new words run out', () => {
    const content = level(10);
    const due = content.prompts.slice(0, 8).map(p => progress(p.id, '2026-10-27T00:00:00Z'));
    const cards = selectDailyCards({ target: 10, content, progress: due, now });
    expect(cards.filter(c => c.kind === 'review')).toHaveLength(8);
    expect(cards).toHaveLength(10);
  });

  it('gives only what exists when there is not enough, without repeats', () => {
    expect(selectDailyCards({ target: 15, content: n5, progress: [], now })).toHaveLength(3);
    expect(selectDailyCards({ target: 15, content: n5, progress: [], now, includeDrafts: false })).toHaveLength(0);
  });
});

describe('session rules', () => {
  const start = () => createDailySession({
    cards: selectDailyCards({ target: 10, content: n5, progress: [], now }),
    level: 'N5', target: 10, timeZone: 'Asia/Seoul', date: '2026-10-28', contentVersion: 'v1', now,
  });
  const answer = (s: StudySession, i: number, outcome: 'correct' | 'incorrect' | 'revealed' | 'unrecognized', n = 1) =>
    answerCard(s, i, { outcome, method: outcome === 'revealed' ? 'reveal' : 'typing', now, attemptId: `a${n}` });

  it('starts at the first card, keyed by date', () => {
    expect(start()).toMatchObject({ id: 'daily:2026-10-28', status: 'active', currentIndex: 0, revision: 0, level: 'N5', target: 10 });
  });

  it('counts only the first evaluation; retries are attempts only', () => {
    let s = answer(start(), 0, 'incorrect')!.session;
    expect(s.cards[0]).toMatchObject({ state: 'feedback', firstEvaluation: { outcome: 'incorrect', hintUsed: false } });
    s = retryCard(s, 0)!;
    const second = answer(s, 0, 'correct', 2)!;
    expect(second.session.cards[0].firstEvaluation!.outcome).toBe('incorrect');
    expect(second.attempt).toMatchObject({ outcome: 'correct', cardIndex: 0, sessionId: 'daily:2026-10-28' });
    expect(second.session.revision).toBe(3);
  });

  it('does not count a technical failure', () => {
    expect(answer(start(), 0, 'unrecognized')!.session.cards[0].firstEvaluation).toBeUndefined();
  });

  it('ignores repeated or stale actions', () => {
    const s = answer(start(), 0, 'correct')!.session;
    expect(answer(s, 0, 'incorrect')).toBeNull(); // already shown
    expect(answer(s, 1, 'correct')).toBeNull(); // not the current card
    const moved = nextCard(s, 0, now)!;
    expect(nextCard(moved, 0, now)).toBeNull(); // double click on 다음
    expect(nextCard(start(), 0, now)).toBeNull(); // answer not shown yet
  });

  it('completes after the last card and summarizes', () => {
    let s = start();
    const outcomes = ['correct', 'incorrect', 'revealed'] as const;
    outcomes.forEach((o, i) => {
      s = answer(s, i, o, i)!.session;
      if (o === 'incorrect') s = answer(s, i, 'revealed', 10 + i)!.session;
      s = nextCard(s, i, now)!;
    });
    expect(s.status).toBe('complete');
    expect(s.completedAt).toBe(now.toISOString());
    expect(summarize(s)).toEqual({ completed: 3, correct: 1, retried: 1, revealedOrHinted: 1, accuracy: 1 / 3 });
    expect(summarize(start()).accuracy).toBeNull();
  });
});
