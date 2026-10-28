import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Settings } from '../content/types';
import { checkPersistence, openRecordStore, type Persistence, type RecordStore } from './records';
import { browserStorage, readSettings, SETTINGS_KEY, parseSettings, writeSettings } from './settings';

export type Records =
  | { status: 'opening' }
  | { status: 'ready'; store: RecordStore; persistence: Persistence };

interface StorageContext {
  settings: Settings;
  /** false when the latest settings could not be saved on this device. */
  settingsSaved: boolean;
  updateSettings: (change: Partial<Settings>) => void;
  records: Records;
  /** Tries to open device storage again and to save the current settings. */
  retryStorage: () => void;
}

const Context = createContext<StorageContext | null>(null);

export function StorageProvider({ children, openStore = openRecordStore }: {
  children: ReactNode; openStore?: () => Promise<RecordStore>;
}) {
  const [initial] = useState(() => readSettings(browserStorage()));
  const [settings, setSettings] = useState(initial.settings);
  const latest = useRef(settings);
  latest.current = settings;
  const [settingsSaved, setSettingsSaved] = useState(initial.saved);
  const [records, setRecords] = useState<Records>({ status: 'opening' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let store: RecordStore | undefined;
    let current = true;
    openStore().then(async opened => {
      store = opened;
      const persistence = opened.durable ? await checkPersistence() : 'unsupported';
      if (current) setRecords({ status: 'ready', store: opened, persistence });
      else opened.close();
    });
    return () => { current = false; store?.close(); };
  }, [openStore, attempt]);

  // Keep tabs in step when settings change in another tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SETTINGS_KEY || !event.newValue) return;
      try { setSettings(parseSettings(JSON.parse(event.newValue))); } catch { /* ignore a bad write from elsewhere */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const updateSettings = useCallback((change: Partial<Settings>) => {
    const next = { ...latest.current, ...change };
    latest.current = next;
    setSettings(next);
    setSettingsSaved(writeSettings(browserStorage(), next));
  }, []);

  const retryStorage = useCallback(() => {
    setRecords({ status: 'opening' });
    setAttempt(n => n + 1);
    setSettingsSaved(writeSettings(browserStorage(), latest.current));
  }, []);

  const value = useMemo(
    () => ({ settings, settingsSaved, updateSettings, records, retryStorage }),
    [settings, settingsSaved, updateSettings, records, retryStorage],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStorage(): StorageContext {
  const value = useContext(Context);
  if (!value) throw new Error('useStorage outside StorageProvider');
  return value;
}

/** True when something the learner does now would be lost on closing the page. */
export function useStorageProblem(): boolean {
  const { settingsSaved, records } = useStorage();
  return !settingsSaved || (records.status === 'ready' && !records.store.durable);
}
