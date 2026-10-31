import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelWords } from '../content/types';
import { frontStyle, typedAnswerForms } from './cardFront';
import { gradeTyped } from './grading';
import { cardForWord } from './selection';

const load = (level: string): LevelWords => JSON.parse(readFileSync(path.resolve(__dirname, `../../content/${level}/words.json`), 'utf8'));
const n5 = load('n5');
const card = (written: string) => cardForWord(n5, n5.words.find(w => w.written === written)!.id)!;

describe('frontStyle', () => {
  it('uses the picture when the card has one', () => {
    expect(frontStyle(card('猫'))).toBe('picture');
  });

  it('shows the written word for kanji words without a picture', () => {
    expect(frontStyle(card('水'))).toBe('reading');
    expect(frontStyle(card('食べる'))).toBe('reading');
    expect(frontStyle(card('お金'))).toBe('reading');
  });

  it('shows the meaning when the word is written only in kana', () => {
    expect(frontStyle(card('テレビ'))).toBe('meaning');
    expect(frontStyle(cardForWord(load('n4'), load('n4').words.find(w => w.written === 'ほとんど')!.id)!)).toBe('meaning');
  });
});

describe('typedAnswerForms', () => {
  it('on a reading card, only the kana counts, since the kanji is on screen', () => {
    const water = card('水');
    expect(gradeTyped('みず', typedAnswerForms(water))).toBe('correct');
    expect(gradeTyped('水', typedAnswerForms(water))).toBe('incorrect');
  });

  it('elsewhere the written form still counts', () => {
    expect(gradeTyped('猫', typedAnswerForms(card('猫')))).toBe('correct');
  });
});
