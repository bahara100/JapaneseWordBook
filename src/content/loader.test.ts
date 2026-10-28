import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentError, loadLevel, loadManifest, mediaUrl, resetContentCache } from './loader';

const manifest = {
  schemaVersion: 1,
  contentVersion: 'abc',
  levels: { N5: { wordsPath: 'content/n5/words.json', grammarPath: 'content/n5/grammar.json' } },
};
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetContentCache();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('content loader', () => {
  it('resolves paths under the site base', () => {
    expect(mediaUrl('media/images/cat.svg')).toBe(`${import.meta.env.BASE_URL}media/images/cat.svg`);
  });

  it('loads the manifest once', async () => {
    fetchMock.mockResolvedValue(ok(manifest));
    await loadManifest();
    await loadManifest();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}content/manifest.json`);
  });

  it('loads a level from the paths in the manifest', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      ok(url.endsWith('manifest.json') ? manifest : url.endsWith('words.json') ? { level: 'N5', words: [] } : { level: 'N5', grammar: [] }));
    const level = await loadLevel('N5');
    expect(level.words).toEqual({ level: 'N5', words: [] });
    expect(level.grammar).toEqual({ level: 'N5', grammar: [] });
  });

  it('tries again after a failure instead of keeping the error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(ok(manifest));
    await expect(loadManifest()).rejects.toThrow('인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    await expect(loadManifest()).resolves.toMatchObject({ contentVersion: 'abc' });
  });

  it('reports a missing file and an unknown schema version', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(loadManifest()).rejects.toThrow('학습 자료를 찾지 못했어요. (404)');
    fetchMock.mockResolvedValueOnce(ok({ ...manifest, schemaVersion: 2 }));
    await expect(loadManifest()).rejects.toBeInstanceOf(ContentError);
  });
});
