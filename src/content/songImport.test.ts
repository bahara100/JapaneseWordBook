import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSong, type ContentState } from './songImport';
import { LEVEL_IDS, type Level, type LevelGrammar, type LevelWords } from './types';
import { filePath, validateContent } from './validate';

const root = path.resolve(__dirname, '../..');
const read = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const current = (): ContentState => ({
  words: Object.fromEntries(LEVEL_IDS.map(l => [l, read(filePath('words', l))])) as Record<Level, LevelWords>,
  grammar: Object.fromEntries(LEVEL_IDS.map(l => [l, read(filePath('grammar', l))])) as Record<Level, LevelGrammar>,
  songs: { songs: [] },
});

const extraction = {
  source: { song: '시험 노래', artist: '시험 가수', extractedBy: 'Grok' },
  words: [
    { written: '猫', kana: 'ネコ', korean: ['고양이'], partOfSpeech: '명사', level: 'N5' },
    { written: '星空', kana: 'ほしぞら', romaji: 'Hoshizora', korean: '별하늘, 밤하늘', partOfSpeech: '명사', level: 'n3',
      example: { japanese: '山の上で星空を見ました。', reading: 'やまのうえでほしぞらをみました。', korean: '산 위에서 별하늘을 봤어요.' } },
  ],
  grammar: [
    { expression: '〜ながら', koreanMeaning: '~하면서', connection: '', explanation: '', level: 'N4' },
    { expression: '〜てしまう', koreanMeaning: '~해 버리다', connection: '동사 て형 + しまう', explanation: '끝나 버린 일을 나타내요.', level: 'N4',
      cautions: ['말할 때는 〜ちゃう로 줄여 써요.'],
      example: { japanese: '全部食べてしまいました。', reading: 'ぜんぶたべてしまいました。', korean: '전부 먹어 버렸어요.' } },
  ],
};

describe('importSong', () => {
  it('adds new words and grammar as drafts and links what is already there', () => {
    const result = importSong(current(), extraction);
    if (!result.ok) throw new Error(result.problems.join('\n'));
    const { state, report } = result;
    expect(report.linkedWords.map(w => w.written)).toEqual(['猫']); // katakana reading still matches ねこ
    expect(report.addedWords.map(w => [w.id, w.level, w.written])).toEqual([['w251', 'N3', '星空']]);
    expect(report.linkedGrammar.map(g => g.expression)).toEqual(['〜ながら']);
    expect(report.addedGrammar.map(g => [g.id, g.level])).toEqual([['g006', 'N4']]);
    expect(report.song).toMatchObject({ id: 's001', title: '시험 노래', wordIds: ['w001', 'w251'], grammarIds: ['g002', 'g006'] });

    const added = state.words.N3.words.at(-1)!;
    expect(added).toMatchObject({ curriculumOrder: 51, readings: [{ kana: 'ほしぞら', romaji: 'hoshizora' }], provenance: { status: 'draft' } });
    expect(added.senses[0].korean).toEqual(['별하늘', '밤하늘']);
    expect(state.words.N3.prompts.at(-1)).toMatchObject({ id: 'w251-p1', acceptedKanaForms: ['ほしぞら'], status: 'draft' });
    // The result passes the same checks as every build.
    const files = { words: state.words, grammar: state.grammar, songs: state.songs };
    expect(validateContent(files, p => existsSync(path.join(root, 'public', p))).errors).toEqual([]);
  });

  it('adds to a song that is already there, without repeating anything', () => {
    const first = importSong(current(), extraction);
    if (!first.ok) throw new Error();
    const again = importSong(first.state, {
      source: extraction.source,
      words: [...extraction.words, { written: '夜', kana: 'よる', korean: ['밤'], partOfSpeech: '명사', level: 'N5' }],
    });
    if (!again.ok) throw new Error(again.problems.join('\n'));
    expect(again.report.songExisted).toBe(true);
    expect(again.state.songs.songs).toHaveLength(1);
    expect(again.report.addedWords).toHaveLength(0); // 夜 is already among the N5 words
    expect(again.state.songs.songs[0].wordIds).toHaveLength(3);
  });

  it('explains what is missing instead of guessing', () => {
    const result = importSong(current(), { source: { song: '노래' }, words: [{ written: '空', kana: 'そら', level: 'N7', korean: '하늘' }] });
    expect(result).toEqual({ ok: false, problems: ['source.artist(가수)가 비어 있어요.'] });
    const level = importSong(current(), { source: { song: '노래', artist: '가수' }, words: [{ written: '青空', kana: 'あおぞら', level: 'N7', korean: '하늘' }] });
    expect(level).toEqual({ ok: false, problems: ['words[0] 青空: level은 N5~N1 중 하나여야 해요.'] });
  });
});
