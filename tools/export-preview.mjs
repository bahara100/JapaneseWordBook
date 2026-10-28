import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = name => readFile(path.join(root, 'prototype', name), 'utf8');
const [html, css, polish, content, art, kana, visuals, app] = await Promise.all(['index.html', 'styles.css', 'polish.css', 'content.js', 'art.js', 'kana-input.js', 'visuals.js', 'app.js'].map(source));
const script = [content, art, kana, visuals, app.replace(/^import .*;\r?\n/gm, '')].join('\n').replace(/^export /gm, '').replace(/<\/script/gi, '<\\/script');
const output = html.replace('<link rel="stylesheet" href="./styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<link rel="stylesheet" href="./polish.css">', () => `<style>\n${polish}\n</style>`)
  .replace('<script type="module" src="./app.js"></script>', () => `<script type="module">\n${script}\n</script>`);
const destination = path.join(root, 'design', 'preview.html');
await writeFile(destination, output, 'utf8');
console.log(`Standalone design preview: ${destination}`);
