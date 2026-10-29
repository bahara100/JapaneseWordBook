// Personal records on this device (docs/03 §2, §4). Screens use RecordStore and never touch IndexedDB,
// so a server sync can replace it later. When IndexedDB cannot open, a memory store keeps the visit
// working and the app says plainly that nothing is being kept.
import type { AnswerAttempt, Favorite, Level, StudySession, WordProgress } from '../content/types';
import type { DeviceRecords } from './backup';

export const DB_NAME = 'haru-japanese';
export const DB_VERSION = 1;

export class StorageError extends Error {}
/** The session changed elsewhere (another tab) since this copy was read. */
export class ConflictError extends StorageError {}
const SAVE_FAILED = '이 기기에 기록을 저장하지 못했어요.';
const CHANGED_ELSEWHERE = '다른 탭에서 학습이 이어졌어요. 그 내용으로 맞출게요.';

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
  getSession(id: string): Promise<StudySession | undefined>;
  /** The daily session with the latest study date, finished or not. */
  latestDailySession(): Promise<StudySession | undefined>;
  /** The newest unfinished practice or favorites session, if any. */
  activePractice(): Promise<StudySession | undefined>;
  /**
   * Saves a session and, in the same transaction, the attempt that changed it and the word's new
   * review schedule (computed from the stored progress). The stored session must be exactly one
   * revision older (or absent for revision 0); otherwise nothing is written and a ConflictError
   * says another tab got there first.
   */
  saveSession(session: StudySession, change?: SessionChange): Promise<void>;
  listAttempts(sessionId: string): Promise<AnswerAttempt[]>;
  listProgress(level: Level): Promise<WordProgress[]>;
  /** Every personal record, for a backup. */
  exportRecords(): Promise<DeviceRecords>;
  /** Replaces every personal record in one transaction: all of `records`, or nothing changes. */
  replaceRecords(records: DeviceRecords): Promise<void>;
  getMeta(key: string): Promise<unknown>;
  setMeta(key: string, value: unknown): Promise<void>;
  close(): void;
}

const RECORD_STORES = ['favorites', 'wordProgress', 'studySessions', 'answerAttempts'] as const;

export interface SessionChange {
  attempt?: AnswerAttempt;
  progress?: { promptId: string; next: (previous: WordProgress | undefined) => WordProgress };
}

function checkRevision(stored: StudySession | undefined, next: StudySession) {
  const expected = next.revision === 0 ? undefined : next.revision - 1;
  if ((stored?.revision) !== expected) throw new ConflictError(CHANGED_ELSEWHERE);
}

const latestDaily = (sessions: StudySession[]) =>
  sessions.filter(s => s.type === 'daily').sort((a, b) => b.studyDate.localeCompare(a.studyDate))[0];
const newestPractice = (sessions: StudySession[]) =>
  sessions.filter(s => (s.type === 'practice' || s.type === 'favorites') && s.status === 'active').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];

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

  async getSession(id: string): Promise<StudySession | undefined> {
    return request(this.db.transaction('studySessions').objectStore('studySessions').get(id));
  }

  async latestDailySession(): Promise<StudySession | undefined> {
    const index = this.db.transaction('studySessions').objectStore('studySessions').index('type');
    return latestDaily(await request(index.getAll('daily') as IDBRequest<StudySession[]>));
  }

  async activePractice(): Promise<StudySession | undefined> {
    const index = this.db.transaction('studySessions').objectStore('studySessions').index('status');
    return newestPractice(await request(index.getAll('active') as IDBRequest<StudySession[]>));
  }

  saveSession(session: StudySession, change: SessionChange = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      let conflict: ConflictError | undefined;
      try {
        tx = this.db.transaction(['studySessions', 'answerAttempts', 'wordProgress'], 'readwrite');
        const sessions = tx.objectStore('studySessions');
        const read = sessions.get(session.id);
        read.onsuccess = () => {
          try {
            checkRevision(read.result, session);
          } catch (e) {
            conflict = e as ConflictError;
            tx.abort();
            return;
          }
          sessions.put(session);
          if (change.attempt) tx.objectStore('answerAttempts').put(change.attempt);
          const progress = change.progress;
          if (progress) {
            const store = tx.objectStore('wordProgress');
            const previous = store.get(progress.promptId);
            previous.onsuccess = () => { store.put(progress.next(previous.result)); };
          }
        };
      } catch {
        reject(new StorageError(SAVE_FAILED));
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(conflict ?? new StorageError(SAVE_FAILED));
    });
  }

  async listAttempts(sessionId: string): Promise<AnswerAttempt[]> {
    const index = this.db.transaction('answerAttempts').objectStore('answerAttempts').index('sessionCard');
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity]);
    return request(index.getAll(range) as IDBRequest<AnswerAttempt[]>);
  }

  async listProgress(level: Level): Promise<WordProgress[]> {
    const index = this.db.transaction('wordProgress').objectStore('wordProgress').index('level');
    return request(index.getAll(level) as IDBRequest<WordProgress[]>);
  }

  async exportRecords(): Promise<DeviceRecords> {
    const tx = this.db.transaction([...RECORD_STORES]);
    const all = <T,>(name: string) => request(tx.objectStore(name).getAll() as IDBRequest<T[]>);
    const [favorites, progress, sessions, attempts] = await Promise.all([
      all<Favorite>('favorites'), all<WordProgress>('wordProgress'), all<StudySession>('studySessions'), all<AnswerAttempt>('answerAttempts'),
    ]);
    return { favorites, progress, sessions, attempts };
  }

  replaceRecords(records: DeviceRecords): Promise<void> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = this.db.transaction([...RECORD_STORES], 'readwrite');
        const fill = (name: string, items: unknown[]) => {
          const store = tx.objectStore(name);
          store.clear();
          for (const item of items) store.put(item);
        };
        fill('favorites', records.favorites);
        fill('wordProgress', records.progress);
        fill('studySessions', records.sessions);
        fill('answerAttempts', records.attempts);
      } catch {
        // A bad record throws before commit; abort so the clears above are undone too.
        try { tx!.abort(); } catch { /* already finished */ }
        reject(new StorageError(SAVE_FAILED));
        return;
      }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new StorageError(SAVE_FAILED));
    });
  }

  async getMeta(key: string): Promise<unknown> {
    const row = await request(this.db.transaction('metadata').objectStore('metadata').get(key) as IDBRequest<{ value: unknown } | undefined>);
    return row?.value;
  }

  setMeta(key: string, value: unknown): Promise<void> {
    return this.write('metadata', s => s.put({ key, value }));
  }

  close() { this.db.close(); }
}

export class MemoryStore implements RecordStore {
  readonly durable = false;
  private favorites = new Map<string, Favorite>();
  private sessions = new Map<string, StudySession>();
  private attempts: AnswerAttempt[] = [];
  private progress = new Map<string, WordProgress>();
  private meta = new Map<string, unknown>();

  async listFavorites() {
    return [...this.favorites.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async setFavorite(wordId: string, on: boolean) {
    if (on) this.favorites.set(wordId, { wordId, createdAt: new Date().toISOString() });
    else this.favorites.delete(wordId);
  }

  async getSession(id: string) {
    return structuredClone(this.sessions.get(id));
  }

  async latestDailySession() {
    return structuredClone(latestDaily([...this.sessions.values()]));
  }

  async activePractice() {
    return structuredClone(newestPractice([...this.sessions.values()]));
  }

  async saveSession(session: StudySession, change: SessionChange = {}) {
    checkRevision(this.sessions.get(session.id), session);
    this.sessions.set(session.id, structuredClone(session));
    if (change.attempt) this.attempts.push(structuredClone(change.attempt));
    if (change.progress) {
      const { promptId, next } = change.progress;
      this.progress.set(promptId, next(this.progress.get(promptId)));
    }
  }

  async listAttempts(sessionId: string) {
    return this.attempts.filter(a => a.sessionId === sessionId).sort((a, b) => a.cardIndex - b.cardIndex);
  }

  async listProgress(level: Level) {
    return [...this.progress.values()].filter(p => p.level === level);
  }

  async exportRecords(): Promise<DeviceRecords> {
    return structuredClone({
      favorites: [...this.favorites.values()], progress: [...this.progress.values()],
      sessions: [...this.sessions.values()], attempts: this.attempts,
    });
  }

  async replaceRecords(records: DeviceRecords) {
    const copy = structuredClone(records);
    this.favorites = new Map(copy.favorites.map(f => [f.wordId, f]));
    this.progress = new Map(copy.progress.map(p => [p.promptId, p]));
    this.sessions = new Map(copy.sessions.map(s => [s.id, s]));
    this.attempts = copy.attempts;
  }

  async getMeta(key: string) { return this.meta.get(key); }
  async setMeta(key: string, value: unknown) { this.meta.set(key, value); }

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
