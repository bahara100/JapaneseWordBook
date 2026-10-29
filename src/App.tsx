import { useEffect } from 'react';
import { Home } from './pages/Home';
import { NotFound, Planned } from './pages/Planned';
import { Settings } from './pages/Settings';
import { Study } from './pages/Study';
import { WordLibrary } from './pages/Words';
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
      return <WordLibrary mode="words" routeId={route.id} />;
    case 'grammar':
      return <Planned eyebrow="GRAMMAR, IN CONTEXT" heading="문법도, 문장 속에서." icon="grammar" step="3-2"
        lead="접속 방법부터 예문까지, 표현이 쓰이는 맥락을 살펴보세요." prototypeHash="#/grammar" detailId={route.id} />;
    case 'favorites':
      return <WordLibrary key="favorites" mode="favorites" />;
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
