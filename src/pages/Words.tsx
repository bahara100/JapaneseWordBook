import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Icon } from '../art/icons';
import { mediaUrl } from '../content/loader';
import type { Level, Word } from '../content/types';
import { LEVELS } from '../levels';
import { searchWords } from '../library/search';
import { useLibrary, type Library } from '../library/useLibrary';
import { useStorage } from '../storage/StorageProvider';
import { useFavorites } from '../storage/useFavorites';
import { cardForWord } from '../study/selection';
import { useDailySession } from '../study/useDailySession';
import { PageTitle } from './PageTitle';

const PHONE = '(max-width: 719px)';
function useIsPhone(): boolean {
  return useSyncExternalStore(
    notify => { const m = window.matchMedia(PHONE); m.addEventListener('change', notify); return () => m.removeEventListener('change', notify); },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

type Favorites = ReturnType<typeof useFavorites>;

function Star({ word, favorites }: { word: Word; favorites: Favorites }) {
  const on = favorites.ids.has(word.id);
  return (
    <button className="star" type="button" aria-pressed={on} onClick={() => void favorites.toggle(word.id)}
      aria-label={`${word.written} 즐겨찾기 ${on ? '해제' : '추가'}`}><Icon name="star" /></button>
  );
}

function WordDetail({ word, library, favorites, headingRef }: {
  word: Word; library: Library; favorites: Favorites; headingRef: React.Ref<HTMLHeadingElement>;
}) {
  const { settings } = useStorage();
  const content = library.contentOf.get(word.id)!;
  const prompt = content.prompts.find(p => p.wordId === word.id);
  const image = prompt && content.media.find(m => m.id === prompt.imageAssetId);
  const many = word.readings.length > 1;
  return (
    <>
      <div className="detail-title"><span className="pill">{word.level}</span><Star word={word} favorites={favorites} /></div>
      {image && <img className="illustration" src={mediaUrl(image.path)} alt={image.description} />}
      <h2 lang="ja" ref={headingRef} tabIndex={-1}>{word.written}</h2>
      {!many && <div className="kana" lang="ja">{word.readings[0].kana}</div>}
      {!many && settings.showRomaji && word.readings[0].romaji && <div className="romaji">{word.readings[0].romaji}</div>}
      {word.senses.map((sense, i) => (
        <div key={sense.id} className="sense">
          {many && (
            <div className="kana" lang="ja">
              {sense.readingIds.map(id => word.readings.find(r => r.id === id)!.kana).join(' · ')}
            </div>
          )}
          <p className="meaning">
            {word.senses.length > 1 && <span className="sense-number">{i + 1}. </span>}
            {sense.korean.join(', ')} <small className="subtle">{sense.partOfSpeech}</small>
          </p>
          {sense.examples.map(example => (
            <div key={example.id} className="example">
              <span className="example-label">EXAMPLE SENTENCE</span>
              <p lang="ja">{example.japanese}</p>
              <p className="example-reading" lang="ja">{example.reading}</p>
              <small>{example.korean}</small>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

export function WordLibrary({ mode, routeId }: { mode: 'words' | 'favorites'; routeId?: string }) {
  const library = useLibrary();
  const favorites = useFavorites();
  const { studyFavorites, busy } = useDailySession();
  const isPhone = useIsPhone();
  const favoritesMode = mode === 'favorites';
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const [picked, setPicked] = useState<string | undefined>();
  const [startProblem, setStartProblem] = useState('');
  const ids = { search: useId(), level: useId() };
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (library.status !== 'ready') return [];
    if (!favoritesMode) return searchWords(library.data.index, query, level);
    const saved = new Set(favorites.ids);
    const found = searchWords(library.data.index, query, level).filter(w => saved.has(w.id));
    // Without a query, show the most recently saved first.
    return query.trim() ? found : favorites.order.map(id => found.find(w => w.id === id)).filter((w): w is Word => !!w);
  }, [library, favoritesMode, favorites.ids, favorites.order, query, level]);

  // The word library takes its selection from the address (#/words/<id>); favorites keep it on the page.
  const selectedId = favoritesMode ? picked : routeId;
  const selected = library.status === 'ready' && selectedId ? library.data.words.find(w => w.id === selectedId) : undefined;
  // On a wide screen the first result is shown until one is chosen; an unknown id shows "not found".
  const shown = selected ?? (isPhone || (routeId && !favoritesMode) ? undefined : results[0]);

  // Choosing a word moves focus to its heading; on a phone, bring it into view.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!selectedId) return;
    // On a phone the library detail is its own page (start at the top, back link first); favorites
    // show it under the list, so bring the whole detail box into view.
    if (isPhone && !favoritesMode) window.scrollTo(0, 0);
    else if (isPhone) detailHeading.current?.closest('.detail-panel')?.scrollIntoView({ block: 'start' });
    detailHeading.current?.focus({ preventScroll: true });
  }, [selectedId, isPhone, favoritesMode]);

  // A removed favorite that was open closes with it.
  useEffect(() => {
    if (favoritesMode && picked && !favorites.ids.has(picked)) setPicked(undefined);
  }, [favoritesMode, picked, favorites.ids]);

  const clear = () => { setQuery(''); setLevel('all'); searchInput.current?.focus(); };

  const study = async () => {
    if (library.status !== 'ready') return;
    setStartProblem('');
    const cards = results.map(w => cardForWord(library.data.contentOf.get(w.id)!, w.id)).filter(c => c !== undefined);
    if (!cards.length) { setStartProblem('학습할 그림카드가 있는 단어가 없어요.'); return; }
    if (await studyFavorites(cards)) window.location.hash = '#/study';
    else setStartProblem('모아 학습을 시작하지 못했어요. 다시 눌러 주세요.');
  };

  const title = favoritesMode
    ? <PageTitle eyebrow="WORDS TO KEEP" heading="다시 만나고 싶은 단어." lead="카드와 단어장에서 별을 눌러 나만의 단어장을 만들어요."
        extra={<span className="pill">{favorites.ids.size}개 보관</span>} />
    : <PageTitle eyebrow="YOUR WORD LIBRARY" heading="궁금한 단어를 찾아보세요." lead="단어와 읽기, 한국어 뜻으로 검색할 수 있어요. 영문으로 쳐도 돼요." />;

  // On a phone, a word chosen from the library opens on its own page with a way back.
  if (!favoritesMode && isPhone && routeId) {
    return (
      <>
        {title}
        <a className="text-button back-link" href="#/words">← 단어 목록으로</a>
        <section className="detail-panel" aria-label="선택한 단어 상세">
          {library.status === 'loading' && <p role="status">단어를 불러오는 중이에요…</p>}
          {library.status === 'error' && <LoadError message={library.message} retry={library.retry} />}
          {library.status === 'ready' && (selected
            ? <WordDetail word={selected} library={library.data} favorites={favorites} headingRef={detailHeading} />
            : <MissingWord />)}
        </section>
      </>
    );
  }

  return (
    <>
      {title}
      <div className="searchbar">
        <div className="field search-field">
          <label htmlFor={ids.search}>단어 검색</label>
          <input id={ids.search} ref={searchInput} type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="한자 · 히라가나 · 한국어 뜻 · 로마자" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor={ids.level}>학습 수준</label>
          <select id={ids.level} value={level} onChange={e => setLevel(e.target.value as Level | 'all')}>
            <option value="all">전체 수준</option>
            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.id} · {l.label}</option>)}
          </select>
        </div>
      </div>
      {favorites.problem && <p className="study-problem" role="alert">{favorites.problem}</p>}
      {startProblem && <p className="study-problem" role="alert">{startProblem}</p>}

      {library.status === 'loading' && <p className="subtle" role="status">단어를 불러오는 중이에요…</p>}
      {library.status === 'error' && <LoadError message={library.message} retry={library.retry} />}
      {library.status === 'ready' && (results.length === 0 ? (
        favoritesMode && favorites.ids.size === 0 ? (
          <div className="empty">
            <div className="empty-mark" aria-hidden="true"><Icon name="star" /></div>
            <h2>다시 보고 싶은 단어를 모아 보세요.</h2>
            <p>단어장이나 학습 카드에서 별을 누르면 이곳에서 다시 볼 수 있어요.</p>
            <a className="btn primary" href="#/words">단어장 둘러보기 →</a>
          </div>
        ) : (
          <div className="empty">
            <div className="empty-mark" aria-hidden="true"><Icon name="search" /></div>
            <h2>일치하는 단어가 없어요.</h2>
            <p>검색어를 바꾸거나 다른 수준을 살펴보세요.</p>
            <button className="btn primary" type="button" onClick={clear}>검색 조건 지우기</button>
          </div>
        )
      ) : (
        <>
          <div className="study-topline">
            <p className="result-count" aria-live="polite">{results.length}개의 단어</p>
            {favoritesMode && (
              <button className="text-button" type="button" disabled={busy} onClick={() => void study()}>
                {query.trim() || level !== 'all' ? '찾은 단어' : '모은 단어'} 학습하기 →
              </button>
            )}
          </div>
          <div className="library-layout">
            <ul className="word-list" aria-label="단어 목록">
              {results.map(word => {
                const current = shown?.id === word.id;
                const inner = (
                  <>
                    <span className="word-written" lang="ja">{word.written}</span>
                    <span className="word-kana" lang="ja">{word.readings.map(r => r.kana).join(' · ')}</span>
                    <span className="word-meta"><span>{word.senses.map(s => s.korean.join(', ')).join(' / ')}</span><span className="pill">{word.level}</span></span>
                  </>
                );
                return (
                  <li key={word.id} className={`word-row ${current ? 'selected' : ''}`}>
                    {favoritesMode
                      ? <button className="word-select" type="button" aria-current={current ? 'true' : undefined} onClick={() => setPicked(word.id)}>{inner}</button>
                      : <a className="word-select" href={`#/words/${word.id}`} aria-current={current ? 'true' : undefined}>{inner}</a>}
                    <Star word={word} favorites={favorites} />
                  </li>
                );
              })}
            </ul>
            {shown ? (
              <section className="detail-panel" aria-label="선택한 단어 상세">
                <WordDetail word={shown} library={library.data} favorites={favorites} headingRef={detailHeading} />
              </section>
            ) : routeId && !isPhone ? (
              <section className="detail-panel" aria-label="선택한 단어 상세"><MissingWord /></section>
            ) : null}
          </div>
        </>
      ))}
      <p className="bottom-note">지금은 수준별 3개, 모두 15개의 작성 예시 단어예요. 수준 분류와 내용은 공개 전 검수가 필요해요.</p>
    </>
  );
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <p className="study-problem" role="alert">{message} <button className="text-button" type="button" onClick={retry}>다시 시도</button></p>;
}

function MissingWord() {
  return (
    <div className="empty">
      <h2>찾는 단어가 없어요.</h2>
      <p>주소가 바뀌었거나 지워진 단어일 수 있어요.</p>
      <a className="btn primary" href="#/words">단어 목록 보기 →</a>
    </div>
  );
}
