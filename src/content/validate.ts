// Checks hand-edited content files before every build. Runs in Node (tools/build-content.ts) and in Vitest,
// so it only reads the parsed JSON it is given and asks the caller whether a media file exists.
import { LEVEL_IDS, type Level } from './types.ts';

export interface Issue { file: string; where: string; message: string }
export interface ValidationResult { errors: Issue[]; warnings: Issue[] }
/** Parsed JSON of content/<level>/words.json and grammar.json, keyed by level. */
export interface ContentFiles {
  words: Partial<Record<Level, unknown>>;
  grammar: Partial<Record<Level, unknown>>;
}

const KANA = /^[ぁ-ゖァ-ヺー]+$/;
const KANA_TEXT = /^[ぁ-ゖァ-ヺー、。！？「」・…\s]+$/;
const ROMAJI = /^[a-zāīūēō' -]+$/i;
const MEDIA_PATH = /^media\/[a-z0-9_\-/]+\.(svg|png|webp|jpg|mp3|m4a|ogg)$/;
const IMAGE_EXT = /\.(svg|png|webp|jpg)$/;
const AUDIO_EXT = /\.(mp3|m4a|ogg)$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function filePath(kind: 'words' | 'grammar', level: Level): string {
  return `content/${level.toLowerCase()}/${kind}.json`;
}

export function validateContent(files: ContentFiles, mediaExists: (path: string) => boolean): ValidationResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  let file = '';
  const error = (where: string, message: string) => errors.push({ file, where, message });
  const warn = (where: string, message: string) => warnings.push({ file, where, message });

  // Every id is unique across all content, so favorites and progress never point at the wrong thing.
  const seen = new Map<string, string>();
  const claim = (id: unknown, where: string): id is string => {
    if (!isText(id)) { error(where, 'id가 비어 있어요.'); return false; }
    if (!/^[a-z0-9-]+$/.test(id)) error(where, `id "${id}"에는 영문 소문자·숫자·-만 쓸 수 있어요.`);
    const first = seen.get(id);
    if (first) { error(where, `id "${id}"가 이미 ${first}에서 쓰였어요.`); return false; }
    seen.set(id, `${file} ${where}`);
    return true;
  };
  const text = (o: Obj, key: string, where: string) => {
    if (!isText(o[key])) error(where, `${key}가 비어 있어요.`);
    return isText(o[key]) ? (o[key] as string) : '';
  };
  const list = (o: Obj, key: string, where: string, min = 1): unknown[] => {
    const v = o[key];
    if (!Array.isArray(v)) { error(where, `${key}는 목록이어야 해요.`); return []; }
    if (v.length < min) error(where, `${key}가 ${min}개 이상 있어야 해요.`);
    return v;
  };
  const provenance = (v: unknown, where: string) => {
    if (!isObj(v)) { error(where, 'provenance(출처·검수 정보)가 없어요.'); return 'draft'; }
    text(v, 'author', `${where}.provenance`);
    text(v, 'usageTerms', `${where}.provenance`);
    if (v.status !== 'draft' && v.status !== 'reviewed') error(`${where}.provenance`, 'status는 draft 또는 reviewed여야 해요.');
    if (v.status === 'reviewed' && !(isText(v.reviewedAt) && !Number.isNaN(Date.parse(v.reviewedAt))))
      error(`${where}.provenance`, '검수된 항목에는 reviewedAt 날짜가 있어야 해요.');
    return v.status;
  };
  const example = (v: unknown, where: string) => {
    if (!isObj(v)) { error(where, '예문 형식이 아니에요.'); return; }
    claim(v.id, where);
    text(v, 'japanese', where);
    const reading = text(v, 'reading', where);
    if (reading && !KANA_TEXT.test(reading)) error(where, `읽기 "${reading}"에 가나·문장부호 밖의 글자가 있어요.`);
    text(v, 'korean', where);
    provenance(v.provenance, where);
  };

  const grammarIds = new Set<string>();
  const related: { file: string; where: string; ids: unknown[]; self: string }[] = [];
  const mediaPaths = new Map<string, string>();

  for (const level of LEVEL_IDS) {
    // ---- words ----
    file = filePath('words', level);
    const raw = files.words[level];
    if (raw === undefined) { error('', '파일이 없어요.'); }
    else if (!isObj(raw)) { error('', 'JSON 객체가 아니에요.'); }
    else {
      if (raw.level !== level) error('level', `폴더 수준(${level})과 파일의 level(${String(raw.level)})이 달라요.`);
      const words = new Map<string, { readings: Map<string, string>; senses: Map<string, Set<string>>; written: string }>();
      const orders = new Set<number>();
      list(raw, 'words', 'words', 0).forEach((w, i) => {
        const at = `words[${i}]`;
        if (!isObj(w)) { error(at, '단어 형식이 아니에요.'); return; }
        const ok = claim(w.id, at);
        const where = ok ? `${at} ${w.id}` : at;
        if (w.level !== level) error(where, `level이 ${level}이 아니에요.`);
        if (!Number.isInteger(w.curriculumOrder) || (w.curriculumOrder as number) < 1) error(where, 'curriculumOrder는 1 이상의 정수여야 해요.');
        else if (orders.has(w.curriculumOrder as number)) error(where, `curriculumOrder ${w.curriculumOrder}가 겹쳐요.`);
        else orders.add(w.curriculumOrder as number);
        const written = text(w, 'written', where);
        const readings = new Map<string, string>();
        list(w, 'readings', where).forEach((r, j) => {
          const rw = `${where} readings[${j}]`;
          if (!isObj(r)) { error(rw, '읽기 형식이 아니에요.'); return; }
          if (!claim(r.id, rw)) return;
          const kana = text(r, 'kana', rw);
          if (kana && !KANA.test(kana)) error(rw, `kana "${kana}"에 가나 밖의 글자가 있어요.`);
          if (r.romaji !== undefined && !(isText(r.romaji) && ROMAJI.test(r.romaji))) error(rw, `romaji "${String(r.romaji)}"는 영문 로마자여야 해요.`);
          readings.set(r.id as string, kana);
        });
        const senses = new Map<string, Set<string>>();
        list(w, 'senses', where).forEach((s, j) => {
          const sw = `${where} senses[${j}]`;
          if (!isObj(s)) { error(sw, '의미 형식이 아니에요.'); return; }
          if (!claim(s.id, sw)) return;
          const korean = list(s, 'korean', sw);
          if (korean.some(k => !isText(k))) error(sw, 'korean 뜻에 빈 값이 있어요.');
          text(s, 'partOfSpeech', sw);
          const ids = new Set<string>();
          for (const id of list(s, 'readingIds', sw)) {
            if (typeof id !== 'string' || !readings.has(id)) error(sw, `readingIds의 "${String(id)}"가 이 단어의 읽기에 없어요.`);
            else ids.add(id);
          }
          list(s, 'examples', sw, 0).forEach((e, k) => {
            example(e, `${sw} examples[${k}]`);
            if (isObj(e) && isText(e.japanese) && written && !e.japanese.includes(written))
              warn(`${sw} examples[${k}]`, `예문에 단어 표기 "${written}"가 그대로 나오지 않아요(활용형이면 괜찮아요).`);
          });
          senses.set(s.id as string, ids);
        });
        provenance(w.provenance, where);
        if (ok) words.set(w.id as string, { readings, senses, written });
      });

      const media = new Map<string, { kind: unknown; description: string }>();
      list(raw, 'media', 'media', 0).forEach((m, i) => {
        const at = `media[${i}]`;
        if (!isObj(m)) { error(at, '매체 형식이 아니에요.'); return; }
        const id = m.id;
        if (isText(id) && media.has(id)) { error(at, `id "${id}"가 이 파일에서 두 번 나와요.`); return; }
        // The same asset may be listed by more than one level, as long as it is the same file.
        const elsewhere = isText(id) ? mediaPaths.get(id) : undefined;
        if (elsewhere === undefined) { if (!claim(id, at)) return; }
        else if (elsewhere !== m.path) { error(at, `id "${id}"가 다른 수준에서 다른 파일(${elsewhere})로 쓰였어요.`); return; }
        const where = `${at} ${id}`;
        if (m.kind !== 'image' && m.kind !== 'audio') error(where, 'kind는 image 또는 audio여야 해요.');
        const path = text(m, 'path', where);
        if (path) {
          if (!MEDIA_PATH.test(path)) error(where, `path "${path}"는 media/로 시작하는 영문 소문자 경로여야 해요.`);
          else if (!mediaExists(path)) error(where, `파일 public/${path}가 없어요.`);
          if (m.kind === 'image' && !IMAGE_EXT.test(path)) error(where, '그림 파일 확장자가 아니에요.');
          if (m.kind === 'audio' && !AUDIO_EXT.test(path)) error(where, '소리 파일 확장자가 아니에요.');
          mediaPaths.set(id as string, path);
        }
        const description = text(m, 'description', where);
        provenance(m.provenance, where);
        media.set(id as string, { kind: m.kind, description });
      });

      const usedMedia = new Set<string>();
      const prompted = new Set<string>();
      list(raw, 'prompts', 'prompts', 0).forEach((p, i) => {
        const at = `prompts[${i}]`;
        if (!isObj(p)) { error(at, '카드 형식이 아니에요.'); return; }
        if (!claim(p.id, at)) return;
        const where = `${at} ${p.id}`;
        const word = typeof p.wordId === 'string' ? words.get(p.wordId) : undefined;
        if (!word) { error(where, `wordId "${String(p.wordId)}"가 이 수준의 단어에 없어요.`); return; }
        prompted.add(p.wordId as string);
        const sense = typeof p.senseId === 'string' ? word.senses.get(p.senseId) : undefined;
        if (!sense) error(where, `senseId "${String(p.senseId)}"가 단어 ${p.wordId}의 의미에 없어요.`);
        const kana = typeof p.readingId === 'string' ? word.readings.get(p.readingId) : undefined;
        if (kana === undefined) error(where, `readingId "${String(p.readingId)}"가 단어 ${p.wordId}의 읽기에 없어요.`);
        else if (sense && !sense.has(p.readingId as string)) error(where, `readingId "${p.readingId}"는 의미 ${p.senseId}의 읽기가 아니에요.`);
        const kanaForms = list(p, 'acceptedKanaForms', where);
        for (const k of kanaForms) if (!(isText(k) && KANA.test(k))) error(where, `acceptedKanaForms의 "${String(k)}"는 가나만 써야 해요.`);
        if (kana && !kanaForms.includes(kana)) error(where, `acceptedKanaForms에 출제 읽기 "${kana}"가 없어요.`);
        const writtenForms = list(p, 'acceptedWrittenForms', where);
        if (writtenForms.some(f => !isText(f))) error(where, 'acceptedWrittenForms에 빈 값이 있어요.');
        const checkAsset = (key: 'imageAssetId' | 'audioAssetId', kind: 'image' | 'audio') => {
          const id = p[key];
          if (id === undefined) return; // both are optional: no picture means a reading card
          const asset = typeof id === 'string' ? media.get(id) : undefined;
          if (!asset) { error(where, `${key} "${String(id)}"가 이 파일의 media에 없어요.`); return; }
          if (asset.kind !== kind) error(where, `${key} "${id}"는 ${kind}가 아니에요.`);
          usedMedia.add(id as string);
          // The picture's description is read aloud before the answer, so it must not give it away.
          const leaks = [word.written, ...word.readings.values()].filter(t => t && asset.description.includes(t));
          if (kind === 'image' && leaks.length) error(where, `그림 설명이 정답 "${leaks[0]}"를 드러내요.`);
        };
        checkAsset('imageAssetId', 'image');
        if (p.situationHint !== undefined) {
          if (!isText(p.situationHint)) error(where, 'situationHint가 비어 있어요.');
          else if ([word.written, ...word.readings.values()].some(t => t && (p.situationHint as string).includes(t)))
            error(where, '상황 힌트가 정답을 드러내요.');
        }
        checkAsset('audioAssetId', 'audio');
        if (p.status !== 'draft' && p.status !== 'reviewed') error(where, 'status는 draft 또는 reviewed여야 해요.');
      });
      for (const id of words.keys()) if (!prompted.has(id)) warn(id, '학습 카드(prompts)가 없는 단어예요.');
      for (const id of media.keys()) if (!usedMedia.has(id)) warn(id, '어떤 카드도 쓰지 않는 매체예요.');
    }

    // ---- grammar ----
    file = filePath('grammar', level);
    const rawGrammar = files.grammar[level];
    if (rawGrammar === undefined) { error('', '파일이 없어요.'); continue; }
    if (!isObj(rawGrammar)) { error('', 'JSON 객체가 아니에요.'); continue; }
    if (rawGrammar.level !== level) error('level', `폴더 수준(${level})과 파일의 level(${String(rawGrammar.level)})이 달라요.`);
    list(rawGrammar, 'grammar', 'grammar', 0).forEach((g, i) => {
      const at = `grammar[${i}]`;
      if (!isObj(g)) { error(at, '문법 형식이 아니에요.'); return; }
      if (!claim(g.id, at)) return;
      const where = `${at} ${g.id}`;
      grammarIds.add(g.id as string);
      if (g.level !== level) error(where, `level이 ${level}이 아니에요.`);
      for (const key of ['expression', 'koreanMeaning', 'connection', 'explanation']) text(g, key, where);
      if (list(g, 'cautions', where, 0).some(c => !isText(c))) error(where, 'cautions에 빈 값이 있어요.');
      list(g, 'examples', where).forEach((e, k) => example(e, `${where} examples[${k}]`));
      related.push({ file, where, ids: list(g, 'relatedGrammarIds', where, 0), self: g.id as string });
      provenance(g.provenance, where);
    });
  }

  for (const r of related) {
    file = r.file;
    for (const id of r.ids) {
      if (id === r.self) error(r.where, '관련 문법에 자기 자신이 들어 있어요.');
      else if (typeof id !== 'string' || !grammarIds.has(id)) error(r.where, `relatedGrammarIds의 "${String(id)}"가 없는 문법이에요.`);
    }
  }
  return { errors, warnings };
}

export function formatIssue(issue: Issue): string {
  return `${issue.file}${issue.where ? ` · ${issue.where}` : ''}: ${issue.message}`;
}
