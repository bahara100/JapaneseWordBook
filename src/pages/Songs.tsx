import { useCallback, useEffect, useRef } from 'react';
import { Icon } from '../art/icons';
import { loadLevel, loadSongs } from '../content/loader';
import { LEVEL_IDS, type Grammar, type Level, type Song, type Word } from '../content/types';
import { useLoaded } from '../content/useContent';
import { useIsPhone } from '../library/useIsPhone';
import { newestFirst } from '../songs/songs';
import { PageTitle } from './PageTitle';

interface SongShelf {
  songs: Song[];
  words: Map<string, Word>;
  grammar: Map<string, Grammar>;
}

async function loadShelf(): Promise<SongShelf> {
  const [songs, levels] = await Promise.all([loadSongs(), Promise.all(LEVEL_IDS.map(loadLevel))]);
  return {
    songs: newestFirst(songs),
    words: new Map(levels.flatMap(l => l.words.words).map(w => [w.id, w])),
    grammar: new Map(levels.flatMap(l => l.grammar.grammar).map(g => [g.id, g])),
  };
}

/** "N5 3 · N4 1": how the song's words and grammar spread over the levels. */
function levelSpread(items: { level: Level }[]): string {
  return LEVEL_IDS.map(level => [level, items.filter(i => i.level === level).length] as const)
    .filter(([, n]) => n > 0).map(([level, n]) => `${level} ${n}`).join(' · ');
}

function SongDetail({ song, shelf, headingRef }: { song: Song; shelf: SongShelf; headingRef: React.Ref<HTMLHeadingElement> }) {
  const words = song.wordIds.map(id => shelf.words.get(id)).filter(w => w !== undefined);
  const grammar = song.grammarIds.map(id => shelf.grammar.get(id)).filter(g => g !== undefined);
  const spread = levelSpread([...words, ...grammar]);
  return (
    <>
      <div className="detail-title"><span className="pill"><Icon name="music" /> 노래</span>{spread && <span className="pill outline">{spread}</span>}</div>
      <h2 lang="ja" ref={headingRef} tabIndex={-1}>{song.title}</h2>
      <p className="song-artist" lang="ja">{song.artist}</p>
      {words.length > 0 && (
        <>
          <h3>이 노래의 단어 {words.length}개</h3>
          <ul className="song-items" aria-label={`${song.title}의 단어`}>
            {words.map(word => (
              <li key={word.id}>
                <a href={`#/words/${word.id}`}>
                  <span className="song-item-main"><strong lang="ja">{word.written}</strong><span lang="ja">{word.readings.map(r => r.kana).join(' · ')}</span></span>
                  <span className="song-item-meta"><span>{word.senses.map(s => s.korean.join(', ')).join(' / ')}</span><span className="pill">{word.level}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      {grammar.length > 0 && (
        <>
          <h3>이 노래의 문법 {grammar.length}개</h3>
          <ul className="song-items" aria-label={`${song.title}의 문법`}>
            {grammar.map(point => (
              <li key={point.id}>
                <a href={`#/grammar/${point.id}`}>
                  <span className="song-item-main"><strong lang="ja">{point.expression}</strong></span>
                  <span className="song-item-meta"><span>{point.koreanMeaning}</span><span className="pill">{point.level}</span></span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="subtle song-note">가사는 싣지 않아요. 예문은 노래 가사가 아니라 새로 지은 문장이에요.</p>
    </>
  );
}

export function Songs({ routeId }: { routeId?: string }) {
  const load = useCallback(loadShelf, []);
  const data = useLoaded(load, []);
  const isPhone = useIsPhone();
  const detailHeading = useRef<HTMLHeadingElement>(null);

  const songs = data.status === 'ready' ? data.data.songs : [];
  const selected = routeId ? songs.find(s => s.id === routeId) : undefined;
  // On a wide screen the newest song is shown until one is chosen; an unknown id shows "not found".
  const shown = selected ?? (isPhone || routeId ? undefined : songs[0]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!routeId) return;
    if (isPhone) window.scrollTo(0, 0);
    detailHeading.current?.focus({ preventScroll: true });
  }, [routeId, isPhone]);

  const title = <PageTitle eyebrow="WORDS FROM SONGS" heading="노래로 만나는 일본어."
    lead="노래에서 고른 단어와 문법을 노래별로 모았어요. 노래를 누르면 그 노래의 단어와 문법을 볼 수 있어요."
    extra={data.status === 'ready' && songs.length > 0 && <span className="pill">{songs.length}곡</span>} />;
  const detail = (song: Song | undefined) => data.status === 'ready' && (
    <section className="detail-panel song-detail" aria-label="선택한 노래 상세">
      {song ? <SongDetail song={song} shelf={data.data} headingRef={detailHeading} /> : (
        <div className="empty">
          <h2>찾는 노래가 없어요.</h2>
          <p>주소가 바뀌었거나 지워진 노래일 수 있어요.</p>
          <a className="btn primary" href="#/songs">노래 목록 보기 →</a>
        </div>
      )}
    </section>
  );
  const status = (
    <>
      {data.status === 'loading' && <p className="subtle" role="status">노래를 불러오는 중이에요…</p>}
      {data.status === 'error' && (
        <p className="study-problem" role="alert">{data.message} <button className="text-button" type="button" onClick={data.retry}>다시 시도</button></p>
      )}
    </>
  );

  // On a phone a chosen song opens on its own page, with a way back to the list.
  if (isPhone && routeId) {
    return <>{title}<a className="text-button back-link" href="#/songs">← 노래 목록으로</a>{status}{detail(selected)}</>;
  }

  return (
    <>
      {title}
      {status}
      {data.status === 'ready' && (songs.length === 0 ? (
        <div className="empty">
          <div className="empty-mark" aria-hidden="true"><Icon name="music" /></div>
          <h2>아직 들어온 노래가 없어요.</h2>
          <p>노래에서 고른 단어와 문법이 들어오면 여기에 노래별로 모여요.</p>
          <a className="btn primary" href="#/words">단어장 둘러보기 →</a>
        </div>
      ) : (
        <div className="library-layout">
          <ul className="word-list" aria-label="노래 목록">
            {songs.map(song => {
              const current = shown?.id === song.id;
              return (
                <li key={song.id}>
                  <a className={`grammar-row song-row ${current ? 'selected' : ''}`} href={`#/songs/${song.id}`} aria-current={current ? 'true' : undefined}>
                    <strong lang="ja">{song.title}</strong>
                    <span><span lang="ja">{song.artist}</span> · 단어 {song.wordIds.length}개 · 문법 {song.grammarIds.length}개</span>
                  </a>
                </li>
              );
            })}
          </ul>
          {(shown || routeId) && detail(shown)}
        </div>
      ))}
      <p className="bottom-note">노래에서 고른 단어와 문법은 검수 전 초안이에요. 같은 단어는 단어장과 문법에서도 볼 수 있어요.</p>
    </>
  );
}
