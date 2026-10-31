import type { SessionCard } from '../content/types';
import { normalizeAnswer } from './grading';

/**
 * What the question side shows (docs/01 §7 and the 2026-10-31 decision): the picture when there is
 * one; otherwise the written word, asking for its reading; and for words written only in kana, where
 * the written word would be the answer itself, the Korean meaning.
 */
export type FrontStyle = 'picture' | 'reading' | 'meaning';

const KANJI = /[㐀-鿿豈-﫿々〆]/;

export function frontStyle(card: SessionCard): FrontStyle {
  if (card.promptSnapshot.imageAssetId && card.mediaSnapshots.some(m => m.id === card.promptSnapshot.imageAssetId)) return 'picture';
  const reading = card.wordSnapshot.readings.find(r => r.id === card.promptSnapshot.readingId);
  const written = card.wordSnapshot.written;
  if (KANJI.test(written) && normalizeAnswer(written) !== normalizeAnswer(reading?.kana ?? '')) return 'reading';
  return 'meaning';
}

/** On a reading card the written word is on screen, so only typed kana counts as knowing it. */
export function typedAnswerForms(card: SessionCard) {
  return frontStyle(card) === 'reading'
    ? { acceptedKanaForms: card.promptSnapshot.acceptedKanaForms, acceptedWrittenForms: [] }
    : card.promptSnapshot;
}
