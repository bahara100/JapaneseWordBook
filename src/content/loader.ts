// Loads built content from <base>/content/. The manifest is small and loaded first;
// each level's words and grammar load only when a screen asks for that level.
import { SCHEMA_VERSION, type ContentManifest, type Level, type LevelGrammar, type LevelWords } from './types';

export interface LevelContent { manifest: ContentManifest; words: LevelWords; grammar: LevelGrammar }

export class ContentError extends Error {}

const base = import.meta.env.BASE_URL;

/** Site URL for a repository-relative media path such as "media/images/cat.svg". */
export function mediaUrl(path: string): string {
  return `${base}${path}`;
}

async function getJson<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`);
  } catch {
    throw new ContentError('인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
  }
  if (!response.ok) throw new ContentError(`학습 자료를 찾지 못했어요. (${response.status})`);
  return response.json() as Promise<T>;
}

// A failed load is forgotten, so "다시 시도" really tries again.
function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  let promise = cache.get(key);
  if (!promise) {
    promise = load();
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
  }
  return promise;
}

const manifests = new Map<string, Promise<ContentManifest>>();
const levelFiles = new Map<string, Promise<LevelContent>>();

export function loadManifest(): Promise<ContentManifest> {
  return cached(manifests, 'manifest', async () => {
    const manifest = await getJson<ContentManifest>('content/manifest.json');
    if (manifest.schemaVersion !== SCHEMA_VERSION)
      throw new ContentError('새 버전이 나왔어요. 페이지를 새로고침해 주세요.');
    return manifest;
  });
}

export function loadLevel(level: Level): Promise<LevelContent> {
  return cached(levelFiles, level, async () => {
    const manifest = await loadManifest();
    const summary = manifest.levels[level];
    const [words, grammar] = await Promise.all([
      getJson<LevelWords>(summary.wordsPath),
      getJson<LevelGrammar>(summary.grammarPath),
    ]);
    return { manifest, words, grammar };
  });
}

/** For tests: forget everything loaded so far. */
export function resetContentCache(): void {
  manifests.clear();
  levelFiles.clear();
}
