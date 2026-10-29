// Search for words and grammar (docs/03 §5): spaces, case, width and hiragana/katakana are treated
// alike, and romaji typed on an English keyboard is also read as kana. Ranking: exact match, then
// prefix, then anywhere; ties keep the course order (N5 first).
import type { Grammar, Level, Word } from '../content/types';
import { convertRomaji, toHiragana } from '../study/kana';

export function normalizeQuery(text: string): string {
  // 〜 and ~ mark where a grammar pattern attaches; they are not part of what people type.
  return toHiragana(text.normalize('NFKC').toLowerCase().replace(/[\s〜~]+/g, ''));
}

const LEVEL_ORDER: Record<Level, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

export interface SearchEntry<T> { item: T; level: Level; terms: string[] }

function entries<T extends { level: Level }>(items: T[], order: (a: T, b: T) => number, terms: (item: T) => string[]): SearchEntry<T>[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => LEVEL_ORDER[a.item.level] - LEVEL_ORDER[b.item.level] || order(a.item, b.item) || a.i - b.i)
    .map(({ item }) => ({ item, level: item.level, terms: terms(item).map(normalizeQuery) }));
}

export function buildIndex(words: Word[]): SearchEntry<Word>[] {
  return entries(words, (a, b) => a.curriculumOrder - b.curriculumOrder, word => [
    word.written,
    ...word.readings.flatMap(r => [r.kana, ...(r.romaji ? [r.romaji] : [])]),
    ...word.senses.flatMap(s => s.korean),
  ]);
}

export function buildGrammarIndex(grammar: Grammar[]): SearchEntry<Grammar>[] {
  return entries(grammar, () => 0, g => [g.expression, g.koreanMeaning, g.explanation]);
}

function rank(terms: string[], query: string): number {
  if (terms.some(t => t === query)) return 0;
  if (terms.some(t => t.startsWith(query))) return 1;
  if (terms.some(t => t.includes(query))) return 2;
  return -1;
}

export function search<T>(index: SearchEntry<T>[], query: string, level: Level | 'all' = 'all'): T[] {
  const inLevel = index.filter(e => level === 'all' || e.level === level);
  const q = normalizeQuery(query);
  if (!q) return inLevel.map(e => e.item);
  // "neko" also searches as ねこ once it forms complete kana.
  const romaji = /^[a-z'-]+$/.test(q) ? convertRomaji(q) : undefined;
  const queries = romaji?.complete ? [q, romaji.hiragana] : [q];
  return inLevel
    .map((e, order) => ({ e, order, score: Math.min(...queries.map(x => rank(e.terms, x)).filter(r => r >= 0), Infinity) }))
    .filter(x => x.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(x => x.e.item);
}

/** Kept for the word library and its tests. */
export const searchWords = search<Word>;
