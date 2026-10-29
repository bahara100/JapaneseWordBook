// Word search (docs/03 §5): written form, reading and Korean meaning, with spaces, case, width and
// hiragana/katakana treated alike. Romaji typed on an English keyboard is also read as kana.
// Ranking: exact match, then prefix, then anywhere; ties keep the course order (N5 first).
import type { Level, Word } from '../content/types';
import { convertRomaji, toHiragana } from '../study/kana';

export function normalizeQuery(text: string): string {
  return toHiragana(text.normalize('NFKC').toLowerCase().replace(/\s+/g, ''));
}

const LEVEL_ORDER: Record<Level, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

export interface SearchEntry { word: Word; terms: string[] }

export function buildIndex(words: Word[]): SearchEntry[] {
  return words
    .slice()
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || a.curriculumOrder - b.curriculumOrder)
    .map(word => ({
      word,
      terms: [
        word.written,
        ...word.readings.flatMap(r => [r.kana, ...(r.romaji ? [r.romaji] : [])]),
        ...word.senses.flatMap(s => s.korean),
      ].map(normalizeQuery),
    }));
}

function rank(terms: string[], query: string): number {
  if (terms.some(t => t === query)) return 0;
  if (terms.some(t => t.startsWith(query))) return 1;
  if (terms.some(t => t.includes(query))) return 2;
  return -1;
}

export function searchWords(index: SearchEntry[], query: string, level: Level | 'all' = 'all'): Word[] {
  const inLevel = index.filter(e => level === 'all' || e.word.level === level);
  const q = normalizeQuery(query);
  if (!q) return inLevel.map(e => e.word);
  // "neko" also searches as ねこ once it forms complete kana.
  const romaji = /^[a-z'-]+$/.test(q) ? convertRomaji(q) : undefined;
  const queries = romaji?.complete ? [q, romaji.hiragana] : [q];
  return inLevel
    .map((e, order) => ({ e, order, score: Math.min(...queries.map(x => rank(e.terms, x)).filter(r => r >= 0), Infinity) }))
    .filter(x => x.score !== Infinity)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(x => x.e.word);
}
