import { Icon } from '../art/icons';
import { loadManifest, mediaUrl } from '../content/loader';
import { useLoaded } from '../content/useContent';
import { LEVELS } from '../levels';
import { useStorage } from '../storage/StorageProvider';
import type { Level } from '../content/types';
import { PageTitle } from './PageTitle';

function HomeArtwork() {
  return (
    <div className="home-artwork" aria-label="그림카드 미리보기">
      <span className="art-orbit orbit-one" aria-hidden="true" />
      <span className="art-orbit orbit-two" aria-hidden="true" />
      <span className="art-sun" aria-hidden="true"><Icon name="sun" /></span>
      <div className="preview-stack">
        <div className="stack-paper paper-back" aria-hidden="true" />
        <div className="stack-paper paper-middle" aria-hidden="true" />
        <div className="preview-paper">
          <div className="preview-paper-top"><span>DAILY WORD CARD</span><Icon name="leaf" /></div>
          {/* A fixed sample card; it does not follow the chosen level. */}
          <div className="preview-picture">
            <img className="illustration" src={mediaUrl('media/images/cat.svg')} alt="편안하게 앉아 있는 동물" />
          </div>
          <div className="preview-paper-bottom">
            <span lang="ja">ねこ</span><span>고양이</span>
            <span className="preview-paper-dot" aria-hidden="true" />
          </div>
        </div>
        <span className="stack-caption" lang="ja">まいにち、すこしずつ。</span>
      </div>
      <span className="art-kana kana-one" lang="ja" aria-hidden="true">あ</span>
      <span className="art-kana kana-two" lang="ja" aria-hidden="true">日</span>
      <div className="art-note">A little Japanese,<br />every day.</div>
    </div>
  );
}

/** What the chosen level has ready, so the start button never promises cards that don't exist. */
function Availability({ level }: { level: Level }) {
  const manifest = useLoaded(loadManifest, []);
  if (manifest.status === 'loading') return <span className="hero-sample-note" role="status">학습 자료를 확인하는 중이에요…</span>;
  if (manifest.status === 'error') {
    return (
      <div className="content-error" role="alert">
        <span>{manifest.message}</span>
        <button className="text-button" type="button" onClick={manifest.retry}>다시 시도</button>
      </div>
    );
  }
  const { promptCount, reviewedPromptCount } = manifest.data.levels[level];
  if (!promptCount) {
    return (
      <>
        <span className="hero-sample-note">{level} 카드는 아직 준비 중이에요.</span>
        <a className="btn hero-start" href="#/settings">설정에서 수준 바꾸기<Icon name="arrow" /></a>
      </>
    );
  }
  return (
    <>
      <a className="btn primary hero-start" href="#/study">오늘의 학습 시작<Icon name="arrow" /></a>
      <span className="hero-sample-note">
        준비된 {level} 카드 {promptCount}장
        {reviewedPromptCount < promptCount ? ` · 검수 전 초안 ${promptCount - reviewedPromptCount}장 포함` : ''}
      </span>
    </>
  );
}

export function Home() {
  const { level, dailyTarget } = useStorage().settings;
  const levelLabel = LEVELS.find(l => l.id === level)?.label;
  return (
    <>
      <PageTitle eyebrow="YOUR DAILY JAPANESE" heading="오늘도, 일본어 한 장."
        lead="그림으로 기억하고, 소리로 익히는 매일의 작은 습관." />
      <section className="hero" aria-label="오늘의 학습">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="kicker-line" /> LITTLE BY LITTLE</div>
          <h2>작은 배움이 쌓여,<br /><em>나의 일본어</em>가<br />되는 하루.</h2>
          <p>새로운 단어를 만나고, 나의 목소리로 읽어봐요.<br />오늘도 부담 없이 한 장부터 시작해 볼까요?</p>
          <div className="hero-meta">
            <span className="pill">{level} · {levelLabel}</span>
            <span className="hero-meta-divider" />
            <span>하루 {dailyTarget}장</span>
          </div>
          <Availability level={level} />
        </div>
        <div className="hero-art"><HomeArtwork /></div>
      </section>
      <p className="prototype-callout">
        <Icon name="leaf" />
        <span>지금은 앱의 뼈대를 만드는 중이에요. 학습·검색·저장·음성 기능은 차례로 연결할 예정이에요.</span>
      </p>
    </>
  );
}
