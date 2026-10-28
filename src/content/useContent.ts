import { useCallback, useEffect, useState } from 'react';

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; retry: () => void }
  | { status: 'ready'; data: T };

/** Runs a content load for a screen and exposes loading / error (with retry) / ready. */
export function useLoaded<T>(load: () => Promise<T>, deps: unknown[]): Loaded<T> {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const retry = useCallback(() => setAttempt(n => n + 1), []);

  useEffect(() => {
    let current = true;
    setState({ status: 'loading' });
    load().then(
      data => { if (current) setState({ status: 'ready', data }); },
      (e: unknown) => {
        if (current) setState({ status: 'error', message: e instanceof Error ? e.message : String(e), retry });
      },
    );
    return () => { current = false; };
  }, [...deps, attempt]);

  return state;
}
