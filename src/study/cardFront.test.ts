import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelWords } from '../content/types';
import { frontStyle, typedAnswerForms } from './cardFront';
import { gradeTyped } from './grading';
import { cardForWord } from './selection';

const load = (level: string): LevelWords => JSON.parse(readFileSync(path.resolve(__dirname, `../../content/${level}/words.json`), 'utf8'));
const levels = ['n5', 'n4'].map(load);
const card = (written: string) => {
  const content = levels.find(l => l.words.some(w => w.written === written))!;
  return cardForWord(content, content.words.find(w => w.written === written)!.id)!;
};

describe('frontStyle', () => {
  it('uses the picture when the card has one', () => {
    expect(frontStyle(card('猫'))).toBe('picture');
    expect(frontStyle(card('水'))).toBe('picture');
  });

  it('shows the written word for kanji words without a picture', () => {
    expect(frontStyle(card('経験'))).toBe('reading');
    expect(frontStyle(card('集める'))).toBe('reading');
    expect(frontStyle(card('間に合う'))).toBe('reading');
  });

  it('shows the meaning when the word is written only in kana', () => {
    expect(frontStyle(card('テレビ'))).toBe('meaning');
    expect(frontStyle(card('ほとんど'))).toBe('meaning');
  });
});

describe('typedAnswerForms', () => {
  it('on a reading card, only the kana counts, since the kanji is on screen', () => {
    const experience = card('経験');
    expect(gradeTyped('けいけん', typedAnswerForms(experience))).toBe('correct');
    expect(gradeTyped('経験', typedAnswerForms(experience))).toBe('incorrect');
  });

  it('elsewhere the written form still counts', () => {
    expect(gradeTyped('猫', typedAnswerForms(card('猫')))).toBe('correct');
  });
});
