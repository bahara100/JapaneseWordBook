import { Icon } from '../art/icons';
import type { Song } from '../content/types';

/** "이 단어가 나온 노래": links to the songs a word or grammar point was picked from. */
export function SongBadges({ songs, what }: { songs: Song[] | undefined; what: '단어' | '문법' }) {
  if (!songs?.length) return null;
  return (
    <>
      <h3 className="songs-heading">{what === '단어' ? '이 단어가' : '이 문법이'} 나온 노래</h3>
      <ul className="song-links">
        {songs.map(song => (
          <li key={song.id}>
            <a href={`#/songs/${song.id}`}><Icon name="music" /><span lang="ja">{song.title}</span></a>
          </li>
        ))}
      </ul>
    </>
  );
}
