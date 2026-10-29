import { useSyncExternalStore } from 'react';

// Hash routes keep direct links working on GitHub Pages, which has no SPA fallback.
export type Route =
  | { name: 'home' }
  | { name: 'study' }
  | { name: 'words'; id?: string }
  | { name: 'grammar'; id?: string }
  | { name: 'favorites' }
  | { name: 'settings' }
  /** "이 기기 확인": what this device supports, for device checks (not in the menu). */
  | { name: 'check' }
  | { name: 'not-found'; path: string };

export type Section = Exclude<Route['name'], 'not-found'>;

const SECTIONS: Section[] = ['home', 'study', 'words', 'grammar', 'favorites', 'settings', 'check'];
const WITH_DETAIL: Section[] = ['words', 'grammar'];

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!path) return { name: 'home' };
  const [first, second, ...rest] = path.split('/');
  const section = SECTIONS.find(s => s === first);
  if (!section || rest.length) return { name: 'not-found', path };
  if (second === undefined) return { name: section } as Route;
  if (!WITH_DETAIL.includes(section) || !second) return { name: 'not-found', path };
  return { name: section as 'words' | 'grammar', id: decodeURIComponent(second) };
}

export function hrefFor(route: Route): string {
  if (route.name === 'not-found') return '#/home';
  const id = 'id' in route && route.id ? `/${encodeURIComponent(route.id)}` : '';
  return `#/${route.name}${id}`;
}

/** A stable string for effects that should run once per navigation. */
export function routeKey(route: Route): string {
  return route.name === 'not-found' ? `not-found:${route.path}` : hrefFor(route);
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash, () => '');
}
