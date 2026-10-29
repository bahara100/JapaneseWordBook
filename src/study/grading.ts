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

/**
 * Spoken answers: the recognizer offers a few guesses. The answer is right when any guess, normalized
 * the same way as typing, equals an accepted kana or written form. Returns the matching guess.
 */
export function matchSpoken(alternatives: string[], prompt: Pick<CardPrompt, 'acceptedKanaForms' | 'acceptedWrittenForms'>): string | undefined {
  return alternatives.find(text => gradeTyped(text, prompt) === 'correct');
}
