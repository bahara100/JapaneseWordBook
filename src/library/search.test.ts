import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVEL_IDS, type LevelWords } from '../content/types';
import { buildIndex, normalizeQuery, searchWords } from './search';

const words = LEVEL_IDS.flatMap(level =>
  (JSON.parse(readFileSync(path.resolve(__dirname, `../../content/${level.toLowerCase()}/words.json`), 'utf8')) as LevelWords).words);
const index = buildIndex(words);
const ids = (query: string, level?: Parameters<typeof searchWords>[2]) => searchWords(index, query, level).map(w => w.id);

describe('word search', () => {
  it('lists everything in course order without a query', () => {
    expect(ids('')).toHaveLength(15);
    expect(ids('').slice(0, 4)).toEqual(['w001', 'w002', 'w003', 'w004']);
    expect(ids('', 'N3')).toEqual(['w007', 'w008', 'w009']);
  });

  it('finds by written form, reading in either script, and Korean meaning', () => {
    expect(ids('猫')).toEqual(['w001']);
    expect(ids('ねこ')).toEqual(['w001']);
    expect(ids('ネコ')).toEqual(['w001']);
    expect(ids('고양이')).toEqual(['w001']);
    expect(ids('기여')).toEqual(['w010']); // second meaning of 貢献
  });

  it('reads romaji as kana, and ignores spaces, case and width', () => {
    expect(ids('neko')).toEqual(['w001']);
    expect(ids('GAKKOU')).toEqual(['w002']);
    expect(ids(' ｎｅｋｏ ')).toEqual(['w001']);
    expect(normalizeQuery('ガッ コウ')).toBe('がっこう');
  });

  it('ranks exact, then prefix, then anywhere, keeping course order within each', () => {
    // こう: こうけん starts with it (w010, N2); がっこう (w002, N5) and けいこう (w011, N2) contain it.
    expect(ids('こう')).toEqual(['w010', 'w002', 'w011']);
    expect(ids('학교')).toEqual(['w002']);
    // 확인 is exactly w009's meaning.
    expect(ids('확인')[0]).toBe('w009');
  });

  it('applies the level filter together with the query', () => {
    expect(ids('고양이', 'N4')).toEqual([]);
    expect(ids('약속', 'N4')).toEqual(['w004']);
  });

  it('returns nothing for no match', () => {
    expect(ids('ばなな')).toEqual([]);
  });
});
