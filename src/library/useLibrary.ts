import { useCallback } from 'react';
import { loadLevel, loadSongs } from '../content/loader';
import { LEVEL_IDS, type LevelWords, type Song, type Word } from '../content/types';
import { linkSongs } from '../songs/songs';
import { useLoaded } from '../content/useContent';
import { buildIndex, type SearchEntry } from './search';

export interface Library {
  words: Word[];
  index: SearchEntry<Word>[];
  /** The level file each word came from, for its cards and pictures. */
  contentOf: Map<string, LevelWords>;
  /** The songs each word was picked from. */
  songsOf: Map<string, Song[]>;
}

async function loadLibrary(): Promise<Library> {
  const [levels, songs] = await Promise.all([Promise.all(LEVEL_IDS.map(loadLevel)), loadSongs()]);
  const contentOf = new Map<string, LevelWords>();
  for (const { words } of levels) for (const w of words.words) contentOf.set(w.id, words);
  const words = levels.flatMap(l => l.words.words);
  return { words, index: buildIndex(words), contentOf, songsOf: linkSongs(songs).ofWord };
}

/** Every level's words, loaded once per page visit (each level file is cached by the loader). */
export function useLibrary() {
  const load = useCallback(loadLibrary, []);
  return useLoaded(load, []);
}
