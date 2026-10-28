// Typed-answer grading (docs/01 §5). Hiragana and katakana count as the same, but 촉음·장음·요음
// differences are never ignored, and nothing is accepted for merely looking similar.
import type { CardPrompt } from '../content/types';
import { toHiragana } from './kana';

const IGNORED = /[\s、。，．,.!?！？・「」『』"'()（）]/g;

export function normalizeAnswer(text: string): string {
  return toHiragana(text.normalize('NFKC').replace(IGNORED, ''));
}

export function gradeTyped(input: string, prompt: Pick<CardPrompt, 'acceptedKanaForms' | 'acceptedWrittenForms'>): 'correct' | 'incorrect' {
  const answer = normalizeAnswer(input);
  if (!answer) return 'incorrect';
  const accepted = [...prompt.acceptedKanaForms, ...prompt.acceptedWrittenForms].map(normalizeAnswer);
  return accepted.includes(answer) ? 'correct' : 'incorrect';
}
