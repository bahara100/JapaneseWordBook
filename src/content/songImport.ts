// Turns a song extraction (a simple JSON file, e.g. written by Grok) into content: new words and
// grammar go into their level files as drafts, words and grammar already there are only linked, and
// the song lists them all. Pure, so it runs in Node (tools/import-song.ts) and in Vitest.
// The extraction format is described in content/README.md.
import { toHiragana } from '../study/kana.ts';
import { LEVEL_IDS, type ExampleSentence, type Grammar, type Level, type LevelGrammar, type LevelWords, type Provenance, type Song, type SongList, type Word } from './types.ts';

export interface ContentState {
  words: Record<Level, LevelWords>;
  grammar: Record<Level, LevelGrammar>;
  songs: SongList;
}

export interface ImportReport {
  song: Song;
  /** The song was already there; new words and grammar were added to it. */
  songExisted: boolean;
  addedWords: Word[];
  linkedWords: Word[];
  addedGrammar: Grammar[];
  linkedGrammar: Grammar[];
}

export type ImportResult =
  | { ok: true; state: ContentState; report: ImportReport }
  | { ok: false; problems: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v.normalize('NFC').trim() : '');
const same = (a: string, b: string) => a.normalize('NFKC').replace(/\s+/g, '') === b.normalize('NFKC').replace(/\s+/g, '');
const sameKana = (a: string, b: string) => toHiragana(a.normalize('NFKC')) === toHiragana(b.normalize('NFKC'));

function nextNumber(ids: string[], prefix: string): () => string {
  let n = Math.max(0, ...ids.map(id => new RegExp(`^${prefix}(\\d+)$`).exec(id)).map(m => (m ? Number(m[1]) : 0)));
  return () => `${prefix}${String(++n).padStart(3, '0')}`;
}

function readLevel(v: unknown): Level | undefined {
  const level = str(v).toUpperCase();
  return LEVEL_IDS.find(l => l === level);
}

/** Korean meanings may come as a list or as one string separated by commas. */
function readMeanings(v: unknown): string[] {
  const parts = Array.isArray(v) ? v.map(str) : str(v).split(/[,，、]/).map(s => s.trim());
  return parts.filter(Boolean);
}

export function importSong(current: ContentState, input: unknown, options: { draftBy?: string } = {}): ImportResult {
  const problems: string[] = [];
  if (!isObj(input)) return { ok: false, problems: ['파일이 JSON 객체({ ... })가 아니에요.'] };
  const source = isObj(input.source) ? input.source : {};
  const title = str(source.song);
  const artist = str(source.artist);
  if (!title) problems.push('source.song(곡 제목)이 비어 있어요.');
  if (!artist) problems.push('source.artist(가수)가 비어 있어요.');
  const by = str(source.extractedBy) || options.draftBy || 'AI';
  const words = Array.isArray(input.words) ? input.words : [];
  const grammar = Array.isArray(input.grammar) ? input.grammar : [];
  if (input.words !== undefined && !Array.isArray(input.words)) problems.push('words는 목록([ ... ])이어야 해요.');
  if (input.grammar !== undefined && !Array.isArray(input.grammar)) problems.push('grammar는 목록([ ... ])이어야 해요.');
  if (!words.length && !grammar.length) problems.push('words와 grammar가 모두 비어 있어요.');
  if (problems.length) return { ok: false, problems };

  const state: ContentState = structuredClone(current);
  const drafted: Provenance = { author: `${by}(노래에서 고른 초안)`, usageTerms: 'AI가 만든 초안 · 예문은 새로 지은 문장(가사 인용 없음)', status: 'draft' };
  const allWords = () => LEVEL_IDS.flatMap(l => state.words[l].words);
  const allGrammar = () => LEVEL_IDS.flatMap(l => state.grammar[l].grammar);
  const nextWord = nextNumber(allWords().map(w => w.id), 'w');
  const nextGrammar = nextNumber(allGrammar().map(g => g.id), 'g');
  const nextSong = nextNumber(state.songs.songs.map(s => s.id), 's');

  const example = (v: unknown, id: string, where: string): ExampleSentence | undefined => {
    if (v === undefined) return undefined;
    if (!isObj(v)) { problems.push(`${where}: example 형식이 아니에요.`); return undefined; }
    return { id, japanese: str(v.japanese), reading: str(v.reading), korean: str(v.korean), provenance: { ...drafted } };
  };

  const report: Omit<ImportReport, 'song' | 'songExisted'> = { addedWords: [], linkedWords: [], addedGrammar: [], linkedGrammar: [] };
  const wordIds: string[] = [];
  words.forEach((raw, i) => {
    const where = `words[${i}]`;
    if (!isObj(raw)) { problems.push(`${where}: 단어 형식이 아니에요.`); return; }
    const written = str(raw.written) || str(raw.kana);
    const kana = str(raw.kana);
    if (!written || !kana) { problems.push(`${where}: written과 kana가 필요해요.`); return; }
    // Same reading, and the same spelling or one of them written in kana only (りんご = 林檎).
    const found = allWords().find(w => w.readings.some(r => sameKana(r.kana, kana))
      && (same(w.written, written) || sameKana(w.written, kana) || sameKana(written, kana)));
    if (found) {
      if (!wordIds.includes(found.id)) { wordIds.push(found.id); if (!report.addedWords.includes(found)) report.linkedWords.push(found); }
      return;
    }
    const level = readLevel(raw.level);
    if (!level) { problems.push(`${where} ${written}: level은 N5~N1 중 하나여야 해요.`); return; }
    const korean = readMeanings(raw.korean);
    if (!korean.length) { problems.push(`${where} ${written}: korean(한국어 뜻)이 비어 있어요.`); return; }
    const file = state.words[level];
    const id = nextWord();
    const romaji = str(raw.romaji).toLowerCase();
    const sample = example(raw.example, `${id}-s1-e1`, `${where} ${written}`);
    const word: Word = {
      id, level, curriculumOrder: Math.max(0, ...file.words.map(w => w.curriculumOrder)) + 1, written,
      readings: [{ id: `${id}-r1`, kana, ...(romaji ? { romaji } : {}) }],
      senses: [{
        id: `${id}-s1`, korean, partOfSpeech: str(raw.partOfSpeech), readingIds: [`${id}-r1`],
        examples: sample ? [sample] : [],
      }],
      provenance: { ...drafted },
    };
    file.words.push(word);
    file.prompts.push({
      id: `${id}-p1`, wordId: id, senseId: `${id}-s1`, readingId: `${id}-r1`,
      acceptedWrittenForms: [written], acceptedKanaForms: [kana], status: 'draft',
    });
    wordIds.push(id);
    report.addedWords.push(word);
  });

  const grammarIds: string[] = [];
  grammar.forEach((raw, i) => {
    const where = `grammar[${i}]`;
    if (!isObj(raw)) { problems.push(`${where}: 문법 형식이 아니에요.`); return; }
    const expression = str(raw.expression);
    if (!expression) { problems.push(`${where}: expression이 필요해요.`); return; }
    const found = allGrammar().find(g => same(g.expression, expression));
    if (found) {
      if (!grammarIds.includes(found.id)) { grammarIds.push(found.id); if (!report.addedGrammar.includes(found)) report.linkedGrammar.push(found); }
      return;
    }
    const level = readLevel(raw.level);
    if (!level) { problems.push(`${where} ${expression}: level은 N5~N1 중 하나여야 해요.`); return; }
    const id = nextGrammar();
    const samples = (Array.isArray(raw.examples) ? raw.examples : raw.example !== undefined ? [raw.example] : [])
      .map((e, k) => example(e, `${id}-e${k + 1}`, `${where} ${expression}`)).filter(e => e !== undefined);
    const point: Grammar = {
      id, level, expression, koreanMeaning: str(raw.koreanMeaning), connection: str(raw.connection),
      explanation: str(raw.explanation),
      cautions: (Array.isArray(raw.cautions) ? raw.cautions.map(str) : [str(raw.cautions)]).filter(Boolean),
      examples: samples, relatedGrammarIds: [], provenance: { ...drafted },
    };
    state.grammar[level].grammar.push(point);
    grammarIds.push(id);
    report.addedGrammar.push(point);
  });
  if (problems.length) return { ok: false, problems };

  const existing = state.songs.songs.find(s => same(s.title, title) && same(s.artist, artist));
  const song: Song = existing ?? {
    id: nextSong(), title, artist, wordIds: [], grammarIds: [],
    provenance: { author: `${by}(노래에서 고른 초안)`, usageTerms: '곡 제목과 가수만 저장 · 가사는 저장하지 않음', status: 'draft' },
  };
  for (const id of wordIds) if (!song.wordIds.includes(id)) song.wordIds.push(id);
  for (const id of grammarIds) if (!song.grammarIds.includes(id)) song.grammarIds.push(id);
  if (!existing) state.songs.songs.push(song);
  return { ok: true, state, report: { ...report, song, songExisted: !!existing } };
}
