import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEVEL_IDS } from './types';
import { filePath, validateContent, type ContentFiles } from './validate';

const root = path.resolve(__dirname, '../..');
const onDisk = (p: string) => existsSync(path.join(root, 'public', p));

function realFiles(): ContentFiles {
  const files: ContentFiles = { words: {}, grammar: {} };
  for (const level of LEVEL_IDS) {
    for (const kind of ['words', 'grammar'] as const) {
      files[kind][level] = JSON.parse(readFileSync(path.join(root, filePath(kind, level)), 'utf8'));
    }
  }
  return files;
}

// The content files as plain JSON, for breaking one thing at a time.
type Json = any;
function withN5(change: (words: Json, grammar: Json) => void) {
  const files = realFiles();
  change(files.words.N5, files.grammar.N5);
  return validateContent(files, onDisk).errors.map(e => e.message);
}

describe('validateContent', () => {
  it('accepts the content in the repository', () => {
    const { errors } = validateContent(realFiles(), onDisk);
    expect(errors).toEqual([]);
  });

  it('reports a missing level file', () => {
    const files = realFiles();
    delete files.grammar.N3;
    expect(validateContent(files, onDisk).errors).toContainEqual({ file: 'content/n3/grammar.json', where: '', message: '파일이 없어요.' });
  });

  it('catches duplicate ids across levels', () => {
    expect(withN5(w => { w.words[0].id = 'w004'; })).toContainEqual(expect.stringContaining('id "w004"가 이미'));
  });

  it('catches a word in the wrong level file', () => {
    expect(withN5(w => { w.words[0].level = 'N4'; })).toContain('level이 N5이 아니에요.');
  });

  it('catches readings that are not kana', () => {
    expect(withN5(w => { w.words[0].readings[0].kana = 'neko'; })).toContain('kana "neko"에 가나 밖의 글자가 있어요.');
    expect(withN5(w => { w.words[0].senses[0].examples[0].reading = '猫がねています。'; }))
      .toContainEqual(expect.stringContaining('가나·문장부호 밖의 글자'));
  });

  it('catches broken references from a card', () => {
    expect(withN5(w => { w.prompts[0].wordId = 'w999'; })).toContain('wordId "w999"가 이 수준의 단어에 없어요.');
    expect(withN5(w => { w.prompts[0].readingId = 'w002-r1'; })).toContain('readingId "w002-r1"가 단어 w001의 읽기에 없어요.');
    expect(withN5(w => { w.prompts[0].imageAssetId = 'img-none'; })).toContain('imageAssetId "img-none"가 이 파일의 media에 없어요.');
  });

  it('requires the asked reading among the accepted answers', () => {
    expect(withN5(w => { w.prompts[0].acceptedKanaForms = ['ネコ']; })).toContain('acceptedKanaForms에 출제 읽기 "ねこ"가 없어요.');
  });

  it('catches missing media files and bad paths', () => {
    expect(withN5(w => { w.media[0].path = 'media/images/missing.svg'; })).toContain('파일 public/media/images/missing.svg가 없어요.');
    expect(withN5(w => { w.media[0].path = '/media/Cat.svg'; })).toContainEqual(expect.stringContaining('media/로 시작하는'));
  });

  it('stops a picture description from giving the answer away', () => {
    expect(withN5(w => { w.media[0].description = '앉아 있는 猫'; })).toContain('그림 설명이 정답 "猫"를 드러내요.');
  });

  it('requires a review date on reviewed content', () => {
    expect(withN5(w => { w.words[0].provenance.status = 'reviewed'; })).toContain('검수된 항목에는 reviewedAt 날짜가 있어야 해요.');
  });

  it('checks related grammar ids', () => {
    expect(withN5((_, g) => { g.grammar[0].relatedGrammarIds = ['g999']; })).toContain('relatedGrammarIds의 "g999"가 없는 문법이에요.');
    expect(withN5((_, g) => { g.grammar[0].relatedGrammarIds = ['g002']; })).toEqual([]);
  });

  it('warns, without failing, when a word has no card', () => {
    const files = realFiles();
    (files.words.N5 as Json).prompts.shift();
    const { errors, warnings } = validateContent(files, onDisk);
    expect(errors).toEqual([]);
    expect(warnings.map(w => `${w.where}: ${w.message}`)).toEqual([
      'w001: 학습 카드(prompts)가 없는 단어예요.',
      'img-cat: 어떤 카드도 쓰지 않는 매체예요.',
    ]);
  });
});
