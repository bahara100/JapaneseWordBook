import type { Song } from '../content/types';

/** Which songs each word or grammar point was picked from, for "이 단어가 나온 노래". */
export interface SongLinks {
  songs: Song[];
  ofWord: Map<string, Song[]>;
  ofGrammar: Map<string, Song[]>;
}

export function linkSongs(songs: Song[]): SongLinks {
  const ofWord = new Map<string, Song[]>();
  const ofGrammar = new Map<string, Song[]>();
  const add = (map: Map<string, Song[]>, id: string, song: Song) => map.set(id, [...(map.get(id) ?? []), song]);
  for (const song of songs) {
    for (const id of song.wordIds) add(ofWord, id, song);
    for (const id of song.grammarIds) add(ofGrammar, id, song);
  }
  return { songs, ofWord, ofGrammar };
}

/** Newest first: songs are added to the end of the file. */
export function newestFirst(songs: Song[]): Song[] {
  return [...songs].reverse();
}
