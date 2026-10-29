import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Icon } from '../art/icons';
import { loadLevel } from '../content/loader';
import { LEVEL_IDS, type Grammar as GrammarPoint, type Level } from '../content/types';
import { useLoaded } from '../content/useContent';
import { LEVELS } from '../levels';
import { buildGrammarIndex, search } from '../library/search';
import { useIsPhone } from '../library/useIsPhone';
import { PageTitle } from './PageTitle';

async function loadGrammar() {
  const levels = await Promise.all(LEVEL_IDS.map(loadLevel));
  const grammar = levels.flatMap(l => l.grammar.grammar);
  return { grammar, index: buildGrammarIndex(grammar) };
}

/** Meaning → how it attaches → when to use it → examples → cautions (docs/02 §3). */
function GrammarDetail({ point, all, headingRef }: {
  point: GrammarPoint; all: GrammarPoint[]; headingRef: React.Ref<HTMLHeadingElement>;
}) {
  // Related points are shown only when the data names them (docs/02: comparisons need reviewed data).
  const related = point.relatedGrammarIds.map(id => all.find(g => g.id === id)).filter(g => g !== undefined);
  return (
    <>
      <span className="pill">{point.level}</span>
      <h2 lang="ja" ref={headingRef} tabIndex={-1}>{point.expression}</h2>
      <p className="meaning">{point.koreanMeaning}</p>
      <h3>접속 형태</h3>
      <div className="connection">{point.connection}</div>
      <h3>이럴 때 사용해요</h3>
      <p>{point.explanation}</p>
      <h3>예문으로 익히기</h3>
      {point.examples.map(example => (
        <div key={example.id} className="example grammar-example">
          <p lang="ja">{example.japanese}</p>
          <p className="example-reading" lang="ja">{example.reading}</p>
          <small>{example.korean}</small>
        </div>
      ))}
      {point.cautions.length > 0 && (
        <>
          <h3>알아두면 좋아요</h3>
          {point.cautions.length === 1 ? <p>{point.cautions[0]}</p> : <ul className="cautions">{point.cautions.map(c => <li key={c}>{c}</li>)}</ul>}
        </>
      )}
      {related.length > 0 && (
        <>
          <h3>함께 보면 좋은 문법</h3>
          <ul className="related-grammar">
            {related.map(g => <li key={g.id}><a href={`#/grammar/${g.id}`}><span lang="ja">{g.expression}</span> · {g.koreanMeaning}</a></li>)}
          </ul>
        </>
      )}
    </>
  );
}

export function Grammar({ routeId }: { routeId?: string }) {
  const load = useCallback(loadGrammar, []);
  const data = useLoaded(load, []);
  const isPhone = useIsPhone();
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<Level | 'all'>('all');
  const ids = { search: useId(), level: useId() };
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const results = useMemo(() => data.status === 'ready' ? search(data.data.index, query, level) : [], [data, query, level]);
  const selected = data.status === 'ready' && routeId ? data.data.grammar.find(g => g.id === routeId) : undefined;
  // On a wide screen the first result is shown until one is chosen; an unknown id shows "not found".
  const shown = selected ?? (isPhone || routeId ? undefined : results[0]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!routeId) return;
    if (isPhone) window.scrollTo(0, 0);
    detailHeading.current?.focus({ preventScroll: true });
  }, [routeId, isPhone]);

  const clear = () => { setQuery(''); setLevel('all'); searchInput.current?.focus(); };
  const title = <PageTitle eyebrow="GRAMMAR, IN CONTEXT" heading="문법도, 문장 속에서."
    lead="접속 방법부터 예문까지, 표현이 쓰이는 맥락을 살펴보세요." />;
  const detail = (point: GrammarPoint | undefined) => (
    <section className="detail-panel grammar-detail" aria-label="선택한 문법 상세">
      {data.status === 'ready' && (point
        ? <GrammarDetail point={point} all={data.data.grammar} headingRef={detailHeading} />
        : (
          <div className="empty">
            <h2>찾는 문법이 없어요.</h2>
            <p>주소가 바뀌었거나 지워진 문법일 수 있어요.</p>
            <a className="btn primary" href="#/grammar">문법 목록 보기 →</a>
          </div>
        ))}
    </section>
  );
  const problem = data.status === 'error' && (
    <p className="study-problem" role="alert">{data.message} <button className="text-button" type="button" onClick={data.retry}>다시 시도</button></p>
  );

  // On a phone a chosen grammar point opens on its own page, with a way back that keeps the search.
  if (isPhone && routeId) {
    return (
      <>
        {title}
        <a className="text-button back-link" href="#/grammar">← 문법 목록으로</a>
        {data.status === 'loading' && <p className="subtle" role="status">문법을 불러오는 중이에요…</p>}
        {problem}
        {data.status === 'ready' && detail(selected)}
      </>
    );
  }

  return (
    <>
      {title}
      <div className="searchbar">
        <div className="field search-field">
          <label htmlFor={ids.search}>문법 검색</label>
          <input id={ids.search} ref={searchInput} type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="표현 · 한국어 의미 · 설명 · 로마자" autoComplete="off" autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="field">
          <label htmlFor={ids.level}>학습 수준</label>
          <select id={ids.level} value={level} onChange={e => setLevel(e.target.value as Level | 'all')}>
            <option value="all">전체 수준</option>
            {LEVELS.map(l => <option key={l.id} value={l.id}>{l.id} · {l.label}</option>)}
          </select>
        </div>
      </div>
      {data.status === 'loading' && <p className="subtle" role="status">문법을 불러오는 중이에요…</p>}
      {problem}
      {data.status === 'ready' && (results.length === 0 ? (
        <div className="empty">
          <div className="empty-mark" aria-hidden="true"><Icon name="search" /></div>
          <h2>일치하는 문법이 없어요.</h2>
          <p>검색어를 바꾸거나 다른 수준을 살펴보세요.</p>
          <button className="btn primary" type="button" onClick={clear}>검색 조건 지우기</button>
        </div>
      ) : (
        <>
          <div className="study-topline"><p className="result-count" aria-live="polite">{results.length}개의 문법</p></div>
          <div className="library-layout">
            <ul className="word-list" aria-label="문법 목록">
              {results.map(point => {
                const current = shown?.id === point.id;
                return (
                  <li key={point.id}>
                    <a className={`grammar-row ${current ? 'selected' : ''}`} href={`#/grammar/${point.id}`} aria-current={current ? 'true' : undefined}>
                      <span className="pill">{point.level}</span>
                      <strong lang="ja">{point.expression}</strong>
                      <span>{point.koreanMeaning}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
            {(shown || routeId) && detail(shown)}
          </div>
        </>
      ))}
      <p className="bottom-note">지금은 수준별 1개, 모두 5개의 작성 예시 문법이에요. 수준 분류와 해설은 공개 전 검수가 필요해요.</p>
    </>
  );
}
