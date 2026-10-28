// Ships the design prototype next to the app, at <base>/prototype/, so unfinished screens can link to it.
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
cpSync(path.join(root, 'prototype'), path.join(root, 'dist', 'prototype'), { recursive: true });
console.log('Copied prototype/ to dist/prototype/');
