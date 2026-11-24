// Adds a song's words and grammar (a JSON file, e.g. from Grok) to content/ as drafts.
// Run: node tools/import-song.ts <file.json> [more files...] [--dry-run]
//   --dry-run  shows what would be added, without changing any file.
// The result is checked like every build; if anything is wrong, no file is changed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSong, type ContentState } from '../src/content/songImport.ts';
import { LEVEL_IDS, type Level, type LevelGrammar, type LevelWords } from '../src/content/types.ts';
import { filePath, formatIssue, SONGS_FILE, validateContent } from '../src/content/validate.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const inputs = args.filter(a => a !== '--dry-run');
if (!inputs.length) {
  console.error('사용법: node tools/import-song.ts <노래.json> [더 많은 파일...] [--dry-run]');
  process.exit(1);
}

const read = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
let state: ContentState = {
  words: Object.fromEntries(LEVEL_IDS.map(l => [l, read(filePath('words', l))])) as Record<Level, LevelWords>,
  grammar: Object.fromEntries(LEVEL_IDS.map(l => [l, read(filePath('grammar', l))])) as Record<Level, LevelGrammar>,
  songs: existsSync(path.join(root, SONGS_FILE)) ? read(SONGS_FILE) : { songs: [] },
};
const before = JSON.stringify(state);

/** Chat answers often wrap the JSON in ```json fences; take what is inside. */
function parseInput(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return JSON.parse((fenced ? fenced[1] : text).replace(/^﻿/, ''));
}

let failed = false;
for (const input of inputs) {
  let data: unknown;
  try {
    data = parseInput(readFileSync(input, 'utf8'));
  } catch (e) {
    console.error(`${input}: JSON을 읽지 못했어요 (${(e as Error).message})`);
    failed = true;
    continue;
  }
  const result = importSong(state, data);
  if (!result.ok) {
    console.error(`${input}: 가져오지 못했어요.`);
    for (const p of result.problems) console.error(`  - ${p}`);
    failed = true;
    continue;
  }
  state = result.state;
  const r = result.report;
  const list = (items: { level: Level }[], name: (i: never) => string) =>
    items.map(i => `${name(i as never)}(${i.level})`).join(', ') || '없음';
  console.log(`「${r.song.title}」 ${r.song.artist}  ${r.songExisted ? '· 이미 있던 노래에 더했어요' : `· 새 노래 ${r.song.id}`}`);
  console.log(`  새 단어 ${r.addedWords.length}개: ${list(r.addedWords, (w: { written: string }) => w.written)}`);
  console.log(`  이미 있던 단어 ${r.linkedWords.length}개(연결만): ${list(r.linkedWords, (w: { written: string }) => w.written)}`);
  console.log(`  새 문법 ${r.addedGrammar.length}개: ${list(r.addedGrammar, (g: { expression: string }) => g.expression)}`);
  console.log(`  이미 있던 문법 ${r.linkedGrammar.length}개(연결만): ${list(r.linkedGrammar, (g: { expression: string }) => g.expression)}`);
}

// Check the whole result exactly like the build does.
const { errors } = validateContent(
  { words: state.words, grammar: state.grammar, songs: state.songs },
  p => existsSync(path.join(root, 'public', p)),
);
if (errors.length) {
  for (const e of errors) console.error(`오류  ${formatIssue(e)}`);
  console.error(`\n오류 ${errors.length}개 — 파일을 바꾸지 않았어요. 노래 파일을 고친 뒤 다시 실행해 주세요.`);
  process.exit(1);
}
if (failed) {
  console.error('\n가져오지 못한 파일이 있어서 아무 파일도 바꾸지 않았어요.');
  process.exit(1);
}
if (dryRun) { console.log('\n--dry-run: 파일은 바꾸지 않았어요.'); process.exit(0); }
if (JSON.stringify(state) === before) { console.log('\n새로 더할 것이 없어요.'); process.exit(0); }

const write = (rel: string, value: unknown) => writeFileSync(path.join(root, rel), JSON.stringify(value, null, 2) + '\n');
for (const level of LEVEL_IDS) {
  write(filePath('words', level), state.words[level]);
  write(filePath('grammar', level), state.grammar[level]);
}
write(SONGS_FILE, state.songs);
console.log('\ncontent/에 반영했어요. 모두 draft(검수 전)이에요. npm run content로 다시 확인할 수 있어요.');
