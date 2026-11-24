import { describe, expect, it } from 'vitest';
import type { Song } from '../content/types';
import { linkSongs, newestFirst } from './songs';

const song = (id: string, wordIds: string[], grammarIds: string[] = []): Song => ({
  id, title: id, artist: 'a', wordIds, grammarIds, provenance: { author: 'x', usageTerms: 'y', status: 'draft' },
});

describe('linkSongs', () => {
  it('finds every song a word or grammar point came from', () => {
    const a = song('s001', ['w001', 'w002'], ['g001']);
    const b = song('s002', ['w002']);
    const links = linkSongs([a, b]);
    expect(links.ofWord.get('w002')).toEqual([a, b]);
    expect(links.ofWord.get('w003')).toBeUndefined();
    expect(links.ofGrammar.get('g001')).toEqual([a]);
    expect(newestFirst([a, b])).toEqual([b, a]);
  });
});
