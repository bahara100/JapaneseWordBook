import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelWords, StudySession, WordProgress } from '../content/types';
import { dailySessionId, studyDate } from './dates';
import { gradeTyped, normalizeAnswer } from './grading';
import { buildChoices, cardForWord, REVIEW_CAP, selectDailyCards } from './selection';
import { answerCard, createDailySession, createFavoritesSession, createModeSession, createPracticeSession, endSession, hearDifferent, markHint, missedCards, nextCard, recordTry, retryCard, summarize } from './session';

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

  it('counts a right answer after the listening hint as hinted', () => {
    const hinted = markHint(start(), 0)!;
    expect(hinted.cards[0].hintUsed).toBe(true);
    expect(markHint(hinted, 0)).toBeNull(); // once is enough
    const answered = answer(hinted, 0, 'correct')!;
    expect(answered.firstEvaluation).toMatchObject({ outcome: 'correct', hintUsed: true });
    expect(markHint(answered.session, 0)).toBeNull(); // too late after the answer
    const done = nextCard(answered.session, 0, now)!;
    expect(summarize(done)).toMatchObject({ correct: 0, revealedOrHinted: 1 });
    expect(missedCards(done)).toHaveLength(1);
    expect(createPracticeSession(done, now, 'p')!.cards[0].hintUsed).toBeUndefined();
  });

  it('asks again the first time speech is heard as another word, then counts it wrong', () => {
    const first = hearDifferent(start(), 0, '寝子', now, 's1')!;
    expect(first.askedAgain).toBe(true);
    expect(first.firstEvaluation).toBeUndefined();
    expect(first.attempt).toMatchObject({ method: 'speech', outcome: 'unrecognized', inputText: '寝子' });
    expect(first.session.cards[0]).toMatchObject({ state: 'question', speechMismatches: 1 });
    const second = hearDifferent(first.session, 0, 'ねっこ', now, 's2')!;
    expect(second.askedAgain).toBe(false);
    expect(second.firstEvaluation).toEqual({ outcome: 'incorrect', hintUsed: false, method: 'speech', inputText: 'ねっこ' });
    expect(second.session.cards[0].state).toBe('feedback');
  });

  it('keeps the card as it was after a technical failure', () => {
    const s = answer(start(), 0, 'unrecognized')!.session;
    expect(s.cards[0].state).toBe('question');
    expect(s.revision).toBe(1);
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

  it('marks only the first evaluation as the one that moves the schedule', () => {
    const first = answer(start(), 0, 'incorrect')!;
    expect(first.firstEvaluation).toEqual({ outcome: 'incorrect', hintUsed: false, method: 'typing' });
    const again = answer(retryCard(first.session, 0)!, 0, 'correct', 2)!;
    expect(again.firstEvaluation).toBeUndefined();
    expect(answer(start(), 0, 'unrecognized')!.firstEvaluation).toBeUndefined();
  });

  it('practices the missed cards without their first evaluations', () => {
    let s = start();
    (['correct', 'incorrect', 'revealed'] as const).forEach((o, i) => {
      s = answer(s, i, o, i)!.session;
      if (o === 'incorrect') s = answer(s, i, 'revealed', 10 + i)!.session;
      s = nextCard(s, i, now)!;
    });
    expect(missedCards(s).map(c => c.wordSnapshot.id)).toEqual(['w002', 'w003']);
    const practice = createPracticeSession(s, now, 'practice:x')!;
    expect(practice).toMatchObject({ id: 'practice:x', type: 'practice', status: 'active', currentIndex: 0, revision: 0, target: 2 });
    expect(practice.cards.every(c => c.state === 'question' && c.firstEvaluation === undefined)).toBe(true);
    expect(s.cards[1].firstEvaluation).toBeDefined(); // the day's record is untouched

    const ended = endSession(practice, now)!;
    expect(ended).toMatchObject({ status: 'complete', revision: 1 });
    expect(endSession(ended, now)).toBeNull();
  });

  it('has nothing to practice after a perfect day', () => {
    let s = start();
    for (let i = 0; i < 3; i++) s = nextCard(answer(s, i, 'correct', i)!.session, i, now)!;
    expect(createPracticeSession(s, now, 'practice:y')).toBeNull();
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

describe('favorites study', () => {
  it('makes one picture card per word, apart from the daily session', () => {
    const cards = ['w003', 'w001'].map(id => cardForWord(n5, id)!);
    expect(cards.map(c => c.promptSnapshot.id)).toEqual(['w003-p1', 'w001-p1']);
    expect(cards[0].mediaSnapshots[0].id).toBe('img-apple');
    expect(cardForWord(n5, 'w999')).toBeUndefined();
    const s = createFavoritesSession(cards, '2026-10-29', 'Asia/Seoul', now, 'favorites:x')!;
    expect(s).toMatchObject({ id: 'favorites:x', type: 'favorites', target: 2, status: 'active', revision: 0 });
    expect(createFavoritesSession([], '2026-10-29', 'Asia/Seoul', now, 'favorites:y')).toBeNull();
  });
});

describe('other practice modes', () => {
  const cards = n5.words.map(w => cardForWord(n5, w.id)!);

  it('offers the right meaning among others from the level, with no duplicate labels', () => {
    let seed = 0.42;
    const random = () => (seed = (seed * 9301 + 49297) % 233280 / 233280);
    const pool = [...n5.words, { ...n5.words[1], id: 'twin' }]; // same meaning as 学校
    const choices = buildChoices(cards[1], pool, 4, random);
    expect(choices.map(c => c.label).sort()).toEqual(['고양이', '사과', '학교']);
    expect(choices.filter(c => c.label === '학교')).toEqual([{ wordId: 'w002', label: '학교' }]);
  });

  it('starts listening rounds on the question side and repeat rounds on the answer side', () => {
    const listening = createModeSession(cards, 'listening', 'N5', '2026-10-29', 'Asia/Seoul', now, 'practice:l')!;
    expect(listening).toMatchObject({ type: 'practice', target: 3 });
    expect(listening.cards.every(c => c.mode === 'listening' && c.state === 'question')).toBe(true);
    const repeat = createModeSession(cards, 'repeat', 'N5', '2026-10-29', 'Asia/Seoul', now, 'practice:r')!;
    expect(repeat.cards.every(c => c.mode === 'repeat' && c.state === 'revealed')).toBe(true);
    expect(createModeSession([], 'repeat', 'N5', '2026-10-29', 'Asia/Seoul', now, 'x')).toBeNull();
  });

  it('keeps repeat tries as attempts only, and moves on freely', () => {
    const repeat = createModeSession(cards, 'repeat', 'N5', '2026-10-29', 'Asia/Seoul', now, 'practice:r')!;
    const tried = recordTry(repeat, 0, { outcome: 'incorrect', inputText: 'ねっこ', now, attemptId: 't1' })!;
    expect(tried.attempt).toMatchObject({ method: 'speech', outcome: 'incorrect', inputText: 'ねっこ', sessionId: 'practice:r' });
    expect(tried.session.cards[0].firstEvaluation).toBeUndefined();
    expect(nextCard(tried.session, 0, now)!.currentIndex).toBe(1);
    const listening = createModeSession(cards, 'listening', 'N5', '2026-10-29', 'Asia/Seoul', now, 'practice:l')!;
    expect(recordTry(listening, 0, { outcome: 'correct', now, attemptId: 't2' })).toBeNull();
  });
});
