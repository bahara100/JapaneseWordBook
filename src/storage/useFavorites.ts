import { useCallback, useEffect, useState } from 'react';
import { useStorage } from './StorageProvider';

/** Favorite word ids on this device, with a toggle that reports failure instead of pretending. */
export function useFavorites() {
  const { records } = useStorage();
  const store = records.status === 'ready' ? records.store : undefined;
  const [ids, setIds] = useState<Set<string>>(new Set());
  /** Most recently saved first. */
  const [order, setOrder] = useState<string[]>([]);
  const [problem, setProblem] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!store) return;
    store.listFavorites().then(list => {
      setIds(new Set(list.map(f => f.wordId)));
      setOrder(list.map(f => f.wordId).reverse());
      setLoaded(true);
    }, () => setProblem('즐겨찾기를 읽지 못했어요.'));
  }, [store]);

  const toggle = useCallback(async (wordId: string) => {
    if (!store) return;
    const on = !ids.has(wordId);
    setProblem('');
    try {
      await store.setFavorite(wordId, on);
      setIds(previous => {
        const next = new Set(previous);
        if (on) next.add(wordId); else next.delete(wordId);
        return next;
      });
      setOrder(previous => on ? [wordId, ...previous.filter(id => id !== wordId)] : previous.filter(id => id !== wordId));
    } catch {
      setProblem('즐겨찾기를 저장하지 못했어요. 다시 눌러 주세요.');
    }
  }, [store, ids]);

  return { ids, order, toggle, problem, loaded };
}
