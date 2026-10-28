import { useEffect } from 'react';
import { Home } from './pages/Home';
import { NotFound, Planned } from './pages/Planned';
import { Settings } from './pages/Settings';
import { Study } from './pages/Study';
import { parseHash, useHash, type Route } from './router';
import { AppShell } from './shell/AppShell';

const TITLES: Record<Route['name'], string> = {
  home: '홈', study: '오늘의 학습', words: '단어장', grammar: '문법',
  favorites: '즐겨찾기', settings: '설정', 'not-found': '없는 화면',
};

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case 'home':
      return <Home />;
    case 'study':
      return <Study />;
    case 'words':
      return <Planned eyebrow="YOUR WORD LIBRARY" heading="궁금한 단어를 찾아보세요." icon="book" step="3-1"
        lead="단어와 읽기, 한국어 뜻으로 검색할 수 있어요." prototypeHash="#/words" detailId={route.id} />;
    case 'grammar':
      return <Planned eyebrow="GRAMMAR, IN CONTEXT" heading="문법도, 문장 속에서." icon="grammar" step="3-2"
        lead="접속 방법부터 예문까지, 표현이 쓰이는 맥락을 살펴보세요." prototypeHash="#/grammar" detailId={route.id} />;
    case 'favorites':
      return <Planned eyebrow="WORDS TO KEEP" heading="다시 만나고 싶은 단어." icon="star" step="3-1"
        lead="카드와 단어장에서 별을 눌러 나만의 단어장을 만들어요." prototypeHash="#/favorites" />;
    case 'settings':
      return <Settings />;
    case 'not-found':
      return <NotFound path={route.path} />;
  }
}

export function App() {
  const route = parseHash(useHash());
  useEffect(() => { document.title = `${TITLES[route.name]} · 하루일본어`; }, [route.name]);
  return <AppShell route={route}><Page route={route} /></AppShell>;
}
