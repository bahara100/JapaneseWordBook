// Validates content/ and writes the files the app loads: public/content/manifest.json and
// public/content/<level>/{words,grammar}.json. Any error stops here, before the app build.
// Run: node tools/build-content.ts   (Node runs TypeScript directly by stripping types)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVEL_IDS, SCHEMA_VERSION, type ContentManifest, type Level, type LevelGrammar, type LevelSummary, type LevelWords } from '../src/content/types.ts';
import { filePath, formatIssue, validateContent, type ContentFiles } from '../src/content/validate.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'content');

const files: ContentFiles = { words: {}, grammar: {} };
const parseErrors: string[] = [];
for (const level of LEVEL_IDS) {
  for (const kind of ['words', 'grammar'] as const) {
    const rel = filePath(kind, level);
    const full = path.join(root, rel);
    if (!existsSync(full)) continue; // reported by the validator
    try {
      files[kind][level] = JSON.parse(readFileSync(full, 'utf8'));
    } catch (e) {
      parseErrors.push(`${rel}: JSON을 읽지 못했어요 (${(e as Error).message})`);
    }
  }
}
if (parseErrors.length) {
  console.error(parseErrors.join('\n'));
  process.exit(1);
}

const { errors, warnings } = validateContent(files, p => existsSync(path.join(root, 'public', p)));
for (const w of warnings) console.warn(`주의  ${formatIssue(w)}`);
if (errors.length) {
  for (const e of errors) console.error(`오류  ${formatIssue(e)}`);
  console.error(`\n콘텐츠 오류 ${errors.length}개 — 빌드를 멈춰요.`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
const hash = createHash('sha256');
const levels = {} as Record<Level, LevelSummary>;
for (const level of LEVEL_IDS) {
  const words = files.words[level] as LevelWords;
  const grammar = files.grammar[level] as LevelGrammar;
  const dir = `content/${level.toLowerCase()}`;
  mkdirSync(path.join(root, 'public', dir), { recursive: true });
  const out = { words: JSON.stringify(words), grammar: JSON.stringify(grammar) };
  writeFileSync(path.join(root, 'public', dir, 'words.json'), out.words);
  writeFileSync(path.join(root, 'public', dir, 'grammar.json'), out.grammar);
  hash.update(out.words).update(out.grammar);
  levels[level] = {
    wordsPath: `${dir}/words.json`,
    grammarPath: `${dir}/grammar.json`,
    wordCount: words.words.length,
    grammarCount: grammar.grammar.length,
    promptCount: words.prompts.length,
    reviewedPromptCount: words.prompts.filter(p => p.status === 'reviewed').length,
  };
}
const manifest: ContentManifest = { schemaVersion: SCHEMA_VERSION, contentVersion: hash.digest('hex').slice(0, 12), levels };
writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const total = Object.values(levels).reduce((n, l) => ({ w: n.w + l.wordCount, g: n.g + l.grammarCount }), { w: 0, g: 0 });
console.log(`콘텐츠 ${manifest.contentVersion}: 단어 ${total.w}개, 문법 ${total.g}개, 주의 ${warnings.length}개 → public/content/`);
