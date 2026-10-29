import { useEffect } from 'react';
import { Home } from './pages/Home';
import { Grammar } from './pages/Grammar';
import { NotFound } from './pages/NotFound';
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
      return <Grammar routeId={route.id} />;
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
