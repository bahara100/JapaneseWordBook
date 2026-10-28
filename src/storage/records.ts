// Personal records on this device (docs/03 §2, §4). Screens use RecordStore and never touch IndexedDB,
// so a server sync can replace it later. When IndexedDB cannot open, a memory store keeps the visit
// working and the app says plainly that nothing is being kept.
import type { Favorite } from '../content/types';

export const DB_NAME = 'haru-japanese';
export const DB_VERSION = 1;

export class StorageError extends Error {}
const SAVE_FAILED = '이 기기에 기록을 저장하지 못했어요.';

/**
 * One step per database version. Steps run in order inside the upgrade transaction; if any step
 * throws, IndexedDB aborts the upgrade and the previous version and its records stay as they were.
 */
const MIGRATIONS: Record<number, (db: IDBDatabase) => void> = {
  1: db => {
    db.createObjectStore('favorites', { keyPath: 'wordId' }).createIndex('createdAt', 'createdAt');
    const progress = db.createObjectStore('wordProgress', { keyPath: 'promptId' });
    progress.createIndex('dueAt', 'dueAt');
    progress.createIndex('level', 'level');
    const sessions = db.createObjectStore('studySessions', { keyPath: 'id' });
    sessions.createIndex('studyDate', 'studyDate');
    sessions.createIndex('type', 'type');
    sessions.createIndex('status', 'status');
    db.createObjectStore('answerAttempts', { keyPath: 'id' }).createIndex('sessionCard', ['sessionId', 'cardIndex']);
    db.createObjectStore('metadata', { keyPath: 'key' });
  },
};

export interface RecordStore {
  /** false when records only last until the page closes. */
  readonly durable: boolean;
  listFavorites(): Promise<Favorite[]>;
  setFavorite(wordId: string, on: boolean): Promise<void>;
  close(): void;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function openDatabase(factory: IDBFactory = indexedDB, version = DB_VERSION): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let open: IDBOpenDBRequest;
    try {
      open = factory.open(DB_NAME, version);
    } catch (e) {
      reject(e);
      return;
    }
    open.onupgradeneeded = event => {
      const db = open.result;
      for (let v = event.oldVersion + 1; v <= version; v++) MIGRATIONS[v]?.(db);
      open.transaction!.objectStore('metadata').put({ key: 'schemaVersion', value: version });
    };
    open.onsuccess = () => {
      const db = open.result;
      // Another tab is upgrading: step aside so it is not blocked.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    open.onerror = () => reject(open.error);
  });
}

class IndexedDbStore implements RecordStore {
  readonly durable = true;
  constructor(private db: IDBDatabase) {}

  /** Resolves only after the transaction commits, so callers never move on from an unsaved change. */
  private write(store: string, change: (s: IDBObjectStore) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction(store, 'readwrite');
        change(tx.objectStore(store));
      } catch {
        reject(new StorageError(SAVE_FAILED));
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new StorageError(SAVE_FAILED));
    });
  }

  async listFavorites(): Promise<Favorite[]> {
    const index = this.db.transaction('favorites').objectStore('favorites').index('createdAt');
    return request(index.getAll() as IDBRequest<Favorite[]>);
  }

  setFavorite(wordId: string, on: boolean): Promise<void> {
    return this.write('favorites', s => {
      if (on) s.put({ wordId, createdAt: new Date().toISOString() } satisfies Favorite);
      else s.delete(wordId);
    });
  }

  close() { this.db.close(); }
}

export class MemoryStore implements RecordStore {
  readonly durable = false;
  private favorites = new Map<string, Favorite>();

  async listFavorites() {
    return [...this.favorites.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async setFavorite(wordId: string, on: boolean) {
    if (on) this.favorites.set(wordId, { wordId, createdAt: new Date().toISOString() });
    else this.favorites.delete(wordId);
  }

  close() {}
}

export async function openRecordStore(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<RecordStore> {
  if (!factory) return new MemoryStore();
  try {
    return new IndexedDbStore(await openDatabase(factory));
  } catch {
    return new MemoryStore();
  }
}

export type Persistence = 'granted' | 'not-granted' | 'unsupported';

/** Whether the browser has promised not to clear our records under storage pressure. */
export async function checkPersistence(): Promise<Persistence> {
  try {
    if (!navigator.storage?.persisted) return 'unsupported';
    return (await navigator.storage.persisted()) ? 'granted' : 'not-granted';
  } catch {
    return 'unsupported';
  }
}

/**
 * Asks for that promise. Firefox shows a permission prompt, so call this only after the learner
 * has something worth keeping (a started session), never on page load.
 */
export async function requestPersistence(): Promise<Persistence> {
  try {
    if (!navigator.storage?.persist) return 'unsupported';
    if (await navigator.storage.persisted()) return 'granted';
    return (await navigator.storage.persist()) ? 'granted' : 'not-granted';
  } catch {
    return 'unsupported';
  }
}
