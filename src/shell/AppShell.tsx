import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from '../art/icons';
import { routeKey, type Route, type Section } from '../router';
import { useStorage, useStorageProblem } from '../storage/StorageProvider';

const NAV: { id: Section; icon: IconName; label: string; short: string }[] = [
  { id: 'home', icon: 'home', label: '홈', short: '홈' },
  { id: 'study', icon: 'cards', label: '오늘의 학습', short: '학습' },
  { id: 'words', icon: 'book', label: '단어장', short: '단어' },
  { id: 'grammar', icon: 'grammar', label: '문법', short: '문법' },
  { id: 'favorites', icon: 'star', label: '즐겨찾기', short: '보관함' },
];

const CONTEXT: Record<Section, string> = {
  home: '나의 학습 공간',
  study: '오늘의 학습',
  words: '단어 라이브러리',
  grammar: '문법 노트',
  favorites: '나의 보관함',
  settings: '학습 설정',
};

function NavLinks({ active, short }: { active: Route['name']; short?: boolean }) {
  return NAV.map(item => (
    <a key={item.id} className={`nav-item ${active === item.id ? 'active' : ''}`}
      aria-current={active === item.id ? 'page' : undefined} href={`#/${item.id}`}>
      <span className="nav-icon"><Icon name={item.icon} /></span>
      {short ? item.short : item.label}
    </a>
  ));
}

/** Shown on every screen while changes cannot be kept on this device. */
function StorageAlert() {
  const problem = useStorageProblem();
  const { retryStorage } = useStorage();
  if (!problem) return null;
  return (
    <div className="storage-alert" role="alert">
      <p><strong>이 기기에 기록을 저장하지 못했어요.</strong> 지금 바꾼 설정과 기록은 창을 닫으면 사라져요.
        브라우저의 사생활 보호 모드나 저장 공간을 확인해 주세요.</p>
      <button className="btn" type="button" onClick={retryStorage}>다시 시도</button>
    </div>
  );
}

export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  const key = routeKey(route);

  // After a navigation, start at the top and move focus to the page title.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    window.scrollTo(0, 0);
    main.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [key]);

  const skipToMain = (event: React.MouseEvent) => {
    event.preventDefault();
    main.current?.focus();
    main.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <>
      <a className="skip" href="#main" onClick={skipToMain}>본문으로 이동</a>
      <div className="app-shell">
        <aside className="sidebar">
          <a className="brand" href="#/home">
            <span className="brand-symbol" lang="ja">日</span>
            <span>하루일본어<small>A LITTLE, EVERY DAY</small></span>
          </a>
          <nav aria-label="주요 메뉴"><NavLinks active={route.name} /></nav>
          <div className="sidebar-foot">
            <span className="sidebar-leaf" aria-hidden="true">✳</span>
            <span className="tiny-label">AT YOUR OWN PACE</span>
            <p>작은 배움이 쌓여,<br />나의 일본어가 되는 하루.</p>
            <a className="text-button" href="#/settings">학습 설정</a>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <a href="#/home" className="mobile-brand"><span lang="ja">日</span> 하루일본어</a>
            <span className="topbar-context">{route.name === 'not-found' ? '하루일본어' : CONTEXT[route.name]}</span>
            <span className="prototype-label"><i /> 개발 중</span>
            <a className="settings-link" href="#/settings" aria-label="설정"
              aria-current={route.name === 'settings' ? 'page' : undefined}>
              <Icon name="settings" /><span>설정</span>
            </a>
          </header>
          <main id="main" ref={main} tabIndex={-1}><StorageAlert />{children}</main>
          <footer className="page-foot">
            <span className="footer-brand">하루일본어</span>
            <span>매일 조금씩, 나의 속도로.</span>
            <small>개발 중 · 샘플 콘텐츠 · 기록 저장 전</small>
          </footer>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="모바일 주요 메뉴"><NavLinks active={route.name} short /></nav>
    </>
  );
}
