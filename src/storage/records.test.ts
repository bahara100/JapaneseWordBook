import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { DB_NAME, DB_VERSION, MemoryStore, openDatabase, openRecordStore } from './records';

describe('device records', () => {
  it('creates every store with its indexes on first open', async () => {
    const db = await openDatabase(new IDBFactory());
    expect([...db.objectStoreNames].sort()).toEqual(['answerAttempts', 'favorites', 'metadata', 'studySessions', 'wordProgress']);
    const tx = db.transaction(['wordProgress', 'studySessions', 'answerAttempts']);
    expect([...tx.objectStore('wordProgress').indexNames].sort()).toEqual(['dueAt', 'level']);
    expect([...tx.objectStore('studySessions').indexNames].sort()).toEqual(['status', 'studyDate', 'type']);
    expect([...tx.objectStore('answerAttempts').indexNames]).toEqual(['sessionCard']);
    const meta = await new Promise(r => { const q = db.transaction('metadata').objectStore('metadata').get('schemaVersion'); q.onsuccess = () => r(q.result); });
    expect(meta).toEqual({ key: 'schemaVersion', value: DB_VERSION });
    expect(db.name).toBe(DB_NAME);
    db.close();
  });

  it('keeps favorites after the page is opened again', async () => {
    const factory = new IDBFactory();
    const first = await openRecordStore(factory);
    expect(first.durable).toBe(true);
    await first.setFavorite('w002', true);
    await first.setFavorite('w001', true);
    await first.setFavorite('w002', false);
    await first.setFavorite('w003', true);
    first.close();

    const again = await openRecordStore(factory);
    expect((await again.listFavorites()).map(f => f.wordId)).toEqual(['w001', 'w003']);
    again.close();
  });

  it('falls back to memory when the browser refuses IndexedDB', async () => {
    const refusing = { open: () => { throw new DOMException('denied', 'SecurityError'); } } as unknown as IDBFactory;
    const store = await openRecordStore(refusing);
    expect(store).toBeInstanceOf(MemoryStore);
    expect(store.durable).toBe(false);
    await store.setFavorite('w001', true);
    expect((await store.listFavorites()).map(f => f.wordId)).toEqual(['w001']);
    expect(await openRecordStore(undefined)).toBeInstanceOf(MemoryStore);
  });

  it('does not touch existing records when reopened at the same version', async () => {
    const factory = new IDBFactory();
    const store = await openRecordStore(factory);
    await store.setFavorite('w005', true);
    store.close();
    const db = await openDatabase(factory);
    expect(db.version).toBe(DB_VERSION);
    db.close();
    const again = await openRecordStore(factory);
    expect((await again.listFavorites()).map(f => f.wordId)).toEqual(['w005']);
    again.close();
  });
});
