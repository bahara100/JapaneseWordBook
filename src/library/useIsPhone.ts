import { useSyncExternalStore } from 'react';

const PHONE = '(max-width: 719px)';

/** Matches the single-column layout in the styles (below 720px). */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    notify => { const m = window.matchMedia(PHONE); m.addEventListener('change', notify); return () => m.removeEventListener('change', notify); },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}
