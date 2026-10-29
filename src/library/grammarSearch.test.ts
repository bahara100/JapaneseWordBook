import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVEL_IDS, type LevelGrammar } from '../content/types';
import { buildGrammarIndex, search } from './search';

const grammar = LEVEL_IDS.flatMap(level =>
  (JSON.parse(readFileSync(path.resolve(__dirname, `../../content/${level.toLowerCase()}/grammar.json`), 'utf8')) as LevelGrammar).grammar);
const index = buildGrammarIndex(grammar);
const ids = (query: string, level?: Parameters<typeof search>[2]) => search(index, query, level).map(g => g.id);

describe('grammar search', () => {
  it('lists all points N5 first without a query', () => {
    expect(ids('')).toEqual(['g001', 'g002', 'g003', 'g004', 'g005']);
    expect(ids('', 'N2')).toEqual(['g004']);
  });

  it('finds an expression with or without 〜, in kana or romaji', () => {
    expect(ids('〜ながら')).toEqual(['g002']);
    expect(ids('ながら')).toEqual(['g002']);
    expect(ids('ナガラ')).toEqual(['g002']);
    expect(ids('nagara')).toEqual(['g002']);
    expect(ids('余儀なく')).toEqual(['g005']);
  });

  it('finds by Korean meaning, and by words in the explanation', () => {
    expect(ids('하면서')).toEqual(['g002']);
    expect(ids('관계없이')).toEqual(['g004']);
    expect(ids('격식')).toEqual(['g005']); // only in the explanation
  });

  it('matches an exact expression first, and words inside explanations too', () => {
    expect(ids('ようにする')[0]).toBe('g003');
    expect(ids('います')).toEqual(['g001']); // appears only in g001's explanation
  });

  it('combines query and level, and returns nothing for no match', () => {
    expect(ids('ながら', 'N5')).toEqual([]);
    expect(ids('かもしれない')).toEqual([]);
  });
});
