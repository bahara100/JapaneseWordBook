import { useEffect, useRef, useState } from 'react';
import { Icon } from '../art/icons';
import { loadLevel, mediaUrl } from '../content/loader';
import type { SessionCard, StudySession } from '../content/types';
import { useLoaded } from '../content/useContent';
import { LEVELS } from '../levels';
import { effectiveTimeZone } from '../storage/settings';
import { useStorage } from '../storage/StorageProvider';
import { studyDate } from '../study/dates';
import { useFavorites } from '../storage/useFavorites';
import { gradeTyped } from '../study/grading';
import { KanaAnswer } from '../study/KanaAnswer';
import { INCLUDE_DRAFTS, selectDailyCards } from '../study/selection';
import { missedCards, summarize } from '../study/session';
import { useDailySession, type SessionActions } from '../study/useDailySession';
import { PageTitle } from './PageTitle';

function Problem({ text }: { text: string }) {
  return text ? <p className="study-problem" role="alert">{text}</p> : null;
}

/** "2026-10-30" → "10월 30일" */
function longDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${m}월 ${d}일`;
}

function StartPanel({ start, busy }: { start: () => void; busy: boolean }) {
  const { settings, records } = useStorage();
  const { level, dailyTarget } = settings;
  // Preview with the same selection the start button will use.
  const preview = useLoaded(async () => {
    if (records.status !== 'ready') return null;
    const content = await loadLevel(level);
    const progress = await records.store.listProgress(level);
    const cards = selectDailyCards({ target: dailyTarget, content: content.words, progress, now: new Date() });
    // When nothing is new or due, say when the next review comes rather than "no cards".
    const nextDue = progress.map(p => p.dueAt).sort()[0];
    return { cards, studied: progress.length > 0, nextDue };
  }, [level, dailyTarget, records]);
  const timeZone = effectiveTimeZone(settings);

  const label = LEVELS.find(l => l.id === level)?.label;
  return (
    <section className="summary start-panel" aria-label="오늘의 학습 시작">
      <span className="pill">{level} · {label}</span>
      <h2>그림을 보고, 일본어로 떠올려요.</h2>
      {preview.status === 'error' ? (
        <p role="alert">{preview.message} <button className="text-button" type="button" onClick={preview.retry}>다시 시도</button></p>
      ) : preview.status === 'loading' || !preview.data ? (
        <p className="subtle" role="status">오늘의 카드를 고르는 중이에요…</p>
      ) : preview.data.cards.length === 0 ? (
        preview.data.studied ? (
          <>
            <p className="subtle">
              준비된 {level} 카드를 모두 학습했고, 오늘 돌아올 복습은 없어요.
              {preview.data.nextDue && <><br />다음 복습은 {longDate(studyDate(new Date(preview.data.nextDue), timeZone))}에 시작돼요.</>}
            </p>
            <a className="btn" href="#/settings">다른 수준 고르기 →</a>
          </>
        ) : (
          <>
            <p className="subtle">{level} 수준에는 아직 학습할 카드가 없어요.</p>
            <a className="btn" href="#/settings">설정에서 수준 바꾸기 →</a>
          </>
        )
      ) : (
        <>
          <p className="subtle">
            하루 목표 {dailyTarget}장
            {preview.data.cards.length < dailyTarget && <><br />오늘은 준비된 카드 {preview.data.cards.length}장으로 학습해요.</>}
            {INCLUDE_DRAFTS && <><br />아직 검수 전인 초안 카드가 포함돼 있어요.</>}
          </p>
          <button className="btn primary" type="button" disabled={busy} onClick={start}>오늘의 학습 시작 →</button>
        </>
      )}
    </section>
  );
}

function Feedback({ card }: { card: SessionCard }) {
  const first = card.firstEvaluation?.outcome;
  if (first === 'correct') return <div className="feedback" role="status">정답이에요.</div>;
  if (first === 'incorrect') return <div className="feedback retry" role="status">다시 연습할 단어로 기록했어요.</div>;
  return <div className="feedback" role="status">정답을 확인했어요.</div>;
}

function CardFront({ card, actions, busy }: { card: SessionCard; actions: SessionActions; busy: boolean }) {
  const [typing, setTyping] = useState(card.state === 'answering');
  const [lastAnswer, setLastAnswer] = useState('');
  const [speechNote, setSpeechNote] = useState(false);
  const image = card.mediaSnapshots.find(m => m.id === card.promptSnapshot.imageAssetId)!;
  const wrong = card.state === 'feedback';

  const submit = (text: string) => {
    setLastAnswer(text);
    void actions.answer(gradeTyped(text, card.promptSnapshot), 'typing', text);
  };

  return (
    <>
      <div className="card-front">
        <span className="caption">LOOK · THINK · SAY</span>
        <img className="illustration" src={mediaUrl(image.path)} alt={image.description} />
        <h2 className="card-question" tabIndex={-1}>일본어로 무엇일까요?</h2>
        {wrong ? (
          <>
            <div className="feedback retry" role="status">읽기를 다시 확인해 볼까요?</div>
            {lastAnswer && <p className="submitted-answer">내가 입력한 답 <span lang="ja">{lastAnswer}</span></p>}
            <div className="button-row">
              <button className="btn primary" type="button" disabled={busy} onClick={() => { setTyping(true); void actions.retry(); }}>다시 시도</button>
            </div>
          </>
        ) : (
          <>
            <p>그림을 보고 일본어 읽기를 떠올려 보세요.</p>
            <div className="button-row">
              <button className="btn" type="button" onClick={() => { setSpeechNote(true); setTyping(true); }}>
                <Icon name="mic" />말하기
              </button>
              <button className="btn" type="button" aria-expanded={typing} onClick={() => setTyping(t => !t)}>
                <Icon name="keyboard" />직접 입력
              </button>
            </div>
            {speechNote && <p className="subtle" role="status">말하기는 아직 준비 중이에요. 직접 입력으로 답해 주세요.</p>}
            {typing && <KanaAnswer onSubmit={submit} disabled={busy} />}
          </>
        )}
      </div>
      <div className="card-actions">
        <button className="btn wide" type="button" disabled={busy} onClick={() => void actions.answer('revealed', 'reveal')}>
          <Icon name="flip" />카드 뒤집어 정답 보기
        </button>
      </div>
    </>
  );
}

function CardBack({ card, session, actions, busy }: { card: SessionCard; session: StudySession; actions: SessionActions; busy: boolean }) {
  const { settings } = useStorage();
  const favorites = useFavorites();
  const word = card.wordSnapshot;
  const sense = word.senses.find(s => s.id === card.promptSnapshot.senseId)!;
  const reading = word.readings.find(r => r.id === card.promptSnapshot.readingId)!;
  const example = sense.examples[0];
  const favorite = favorites.ids.has(word.id);
  const last = session.currentIndex === session.cards.length - 1;
  return (
    <>
      <div className="card-back">
        <Feedback card={card} />
        <div className="card-back-top">
          <span className="pill">{session.level}{card.kind === 'review' ? ' · 복습' : ''}</span>
          <button className="star" type="button" aria-pressed={favorite} onClick={() => void favorites.toggle(word.id)}
            aria-label={`${word.written} 즐겨찾기 ${favorite ? '해제' : '추가'}`}><Icon name="star" /></button>
        </div>
        <Problem text={favorites.problem} />
        <h2 lang="ja" tabIndex={-1}>{word.written}</h2>
        <div className="kana" lang="ja">{reading.kana}</div>
        {settings.showRomaji && reading.romaji && <div className="romaji">{reading.romaji}</div>}
        <div className="meaning">{sense.korean.join(', ')}</div>
        {example && (
          <div className="example">
            <span className="example-label">EXAMPLE SENTENCE</span>
            <p lang="ja">{example.japanese}</p>
            <small className="example-reading" lang="ja">{example.reading}</small>
            <small>{example.korean}</small>
          </div>
        )}
      </div>
      <div className="card-actions">
        <button className="btn primary wide" type="button" disabled={busy} onClick={() => void actions.next()}>
          {!last ? '다음 카드' : session.type === 'practice' ? '연습 마치기' : '오늘의 결과 보기'} →
        </button>
      </div>
    </>
  );
}

function StudyCard({ session, actions, busy }: { session: StudySession; actions: SessionActions; busy: boolean }) {
  const index = session.currentIndex;
  const card = session.cards[index];
  const shown = card.state === 'revealed';
  const article = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // When the card turns or moves on, bring it into view (the answer button can sit far below on a
  // phone) and put focus on its heading so screen readers follow.
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const top = article.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.5) article.current?.scrollIntoView({ block: 'start' });
    article.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, [index, shown]);

  return (
    <div className="study-layout">
      <section aria-label="그림카드">
        <div className="study-topline">
          <span>{session.type === 'practice' ? '틀린 단어 다시 보기' : `${session.studyDate} · ${card.kind === 'review' ? '복습 카드' : '새 카드'}`}</span>
          <span>{index + 1} / {session.cards.length}장</span>
        </div>
        <div className="progress" role="progressbar" aria-label="카드 진행률" aria-valuemin={0}
          aria-valuemax={session.cards.length} aria-valuenow={index}>
          <span style={{ width: `${(index / session.cards.length) * 100}%` }} />
        </div>
        <article ref={article} className="study-card" aria-label={shown ? '정답 카드' : '문제 카드'}>
          {shown
            ? <CardBack card={card} session={session} actions={actions} busy={busy} />
            : <CardFront key={index} card={card} actions={actions} busy={busy} />}
        </article>
      </section>
      <aside className="study-side">
        <section className="study-note">
          <span className="eyebrow">ONE CARD, THREE STEPS</span>
          <h3>천천히, 나의 속도로.</h3>
          <ol className="learning-steps">
            <li><span>01</span><div>그림으로 떠올려요<small>어떤 단어인지 생각해 보세요.</small></div></li>
            <li><span>02</span><div>나의 말로 답해요<small>영문으로 입력하면 가나로 바뀌어요.</small></div></li>
            <li><span>03</span><div>뒤집어서 확인해요<small>읽기와 뜻, 예문을 익혀요.</small></div></li>
          </ol>
        </section>
        <section className="study-note">
          <h3>처음 답이 기록돼요.</h3>
          <p>카드마다 처음 낸 답(또는 정답 보기)이 결과에 남아요. 다시 시도한 답은 연습 기록으로만 남겨요.</p>
        </section>
        <a className="text-button study-home" href="#/home">홈으로 돌아가기 ↗</a>
      </aside>
    </div>
  );
}

const MISS_LABEL = { incorrect: '다시 연습', revealed: '답 확인', correct: '힌트 사용' } as const;

function Summary({ session, practice, busy }: { session: StudySession; practice: () => void; busy: boolean }) {
  const s = summarize(session);
  const missed = missedCards(session);
  return (
    <section className="summary" aria-label="오늘의 결과">
      <span className="pill">{session.studyDate} · {session.level}</span>
      <div className="summary-number">{s.completed}<small> / {session.cards.length}</small></div>
      <p className="subtle">오늘의 그림카드를 모두 확인했어요.</p>
      <div className="summary-stats">
        <span><strong>{s.correct}</strong>바로 정답</span>
        <span><strong>{s.retried}</strong>다시 연습</span>
        <span><strong>{s.revealedOrHinted}</strong>답 확인·힌트</span>
      </div>
      {s.accuracy !== null && <p>정답률 {Math.round(s.accuracy * 100)}% <small className="subtle">(처음 답 기준, 힌트 없이 맞힌 카드)</small></p>}
      {missed.length > 0 ? (
        <div className="missed">
          <h2>다시 볼 단어 {missed.length}개</h2>
          <ul className="missed-list">
            {missed.map(card => {
              const reading = card.wordSnapshot.readings.find(r => r.id === card.promptSnapshot.readingId);
              const sense = card.wordSnapshot.senses.find(x => x.id === card.promptSnapshot.senseId);
              return (
                <li key={card.promptSnapshot.id}>
                  <span className="missed-word" lang="ja">{card.wordSnapshot.written}</span>
                  <span lang="ja">{reading?.kana}</span>
                  <span>{sense?.korean.join(', ')}</span>
                  <small className="missed-tag">{MISS_LABEL[card.firstEvaluation!.outcome as keyof typeof MISS_LABEL]}</small>
                </li>
              );
            })}
          </ul>
          <p className="subtle">이 단어들은 내일 복습 카드로 다시 나와요. 바로 맞힌 단어는 1 → 3 → 7 → 14 → 30일 간격으로 돌아와요.</p>
          <div className="button-row">
            <button className="btn primary" type="button" disabled={busy} onClick={practice}>틀린 단어 다시 보기 ({missed.length}장) →</button>
            <a className="btn" href="#/words">단어 더 살펴보기</a>
          </div>
        </div>
      ) : (
        <>
          <p className="subtle">모두 바로 맞혔어요. 다음 복습은 1 → 3 → 7 → 14 → 30일 간격으로 찾아와요.</p>
          <div className="button-row"><a className="btn primary" href="#/words">단어 더 살펴보기 →</a></div>
        </>
      )}
    </section>
  );
}

export function Study() {
  const { daily, practice, actions, start, practiceMissed, leavePractice, busy, problem, notice, today } = useDailySession();
  const active = daily.status === 'active' ? daily.session : undefined;
  const shown = practice ?? active;
  return (
    <>
      <PageTitle eyebrow={practice ? 'ONE MORE TIME' : 'DAILY PRACTICE'} heading={practice ? '틀린 단어 다시 보기' : '오늘의 그림카드'}
        lead={practice ? '오늘 놓친 단어를 한 번 더 떠올려 봐요.' : '한 장씩 떠올리고, 뒤집어서 확인해 보세요.'}
        extra={shown && <span className="pill">{shown.level}</span>} />
      {notice && <p className="study-notice" role="status">{notice}</p>}
      <Problem text={problem} />
      {daily.status === 'loading' && <p className="subtle" role="status">학습 기록을 불러오는 중이에요…</p>}
      {practice ? (
        <>
          <div className="study-notice practice-bar">
            <span>연습한 답은 기록만 남고, 오늘의 결과와 복습 일정은 바뀌지 않아요.</span>
            <button className="text-button" type="button" disabled={busy} onClick={() => void leavePractice()}>연습 그만하기</button>
          </div>
          <StudyCard key={practice.id} session={practice} actions={actions} busy={busy} />
        </>
      ) : (
        <>
          {daily.status === 'none' && <StartPanel start={() => void start()} busy={busy} />}
          {active && (
            <>
              {active.studyDate < today && (
                <p className="study-notice">{active.studyDate}에 시작한 학습이에요. 마저 마치면 새 학습을 시작할 수 있어요.</p>
              )}
              <StudyCard key={active.id} session={active} actions={actions} busy={busy} />
            </>
          )}
          {daily.status === 'done' && <Summary session={daily.session} practice={() => void practiceMissed()} busy={busy} />}
        </>
      )}
    </>
  );
}
