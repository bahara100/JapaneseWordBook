import { useCallback } from 'react';
import { loadLevel } from '../content/loader';
import { LEVEL_IDS, type LevelWords, type Word } from '../content/types';
import { useLoaded } from '../content/useContent';
import { buildIndex, type SearchEntry } from './search';

export interface Library {
  words: Word[];
  index: SearchEntry<Word>[];
  /** The level file each word came from, for its cards and pictures. */
  contentOf: Map<string, LevelWords>;
}

async function loadLibrary(): Promise<Library> {
  const levels = await Promise.all(LEVEL_IDS.map(loadLevel));
  const contentOf = new Map<string, LevelWords>();
  for (const { words } of levels) for (const w of words.words) contentOf.set(w.id, words);
  const words = levels.flatMap(l => l.words.words);
  return { words, index: buildIndex(words), contentOf };
}

/** Every level's words, loaded once per page visit (each level file is cached by the loader). */
export function useLibrary() {
  const load = useCallback(loadLibrary, []);
  return useLoaded(load, []);
}
