import { describe, expect, it } from 'vitest';
import { convertRomaji, toHiragana, toKatakana } from './kana';

const hira = (s: string) => convertRomaji(s).hiragana;

describe('convertRomaji', () => {
  it('converts plain syllables both ways', () => {
    expect(convertRomaji('neko')).toMatchObject({ hiragana: 'ねこ', katakana: 'ネコ', complete: true });
  });

  it('handles ん before consonants, at the end and doubled', () => {
    expect(hira('shinbun')).toBe('しんぶん');
    expect(hira('hon')).toBe('ほん');
    expect(hira('konnichiha')).toBe('こんにちは');
    expect(hira('kinn')).toBe('きん');
    expect(hira("kin'en")).toBe('きんえん');
    expect(hira('kinen')).toBe('きねん');
  });

  it('makes a small っ from doubled consonants', () => {
    expect(hira('gakkou')).toBe('がっこう');
    expect(hira('kattou')).toBe('かっとう');
    expect(hira('matcha')).toBe('まっちゃ');
  });

  it('handles 요음 and the long-vowel mark', () => {
    expect(hira('kyou')).toBe('きょう');
    expect(hira('junbi')).toBe('じゅんび');
    expect(hira('ko-hi-')).toBe('こーひー');
  });

  it('reports unfinished and impossible input', () => {
    expect(convertRomaji('nek')).toMatchObject({ hiragana: 'ね', pending: 'k', invalid: false, complete: false });
    expect(convertRomaji('neq')).toMatchObject({ pending: 'q', invalid: true, complete: false });
    expect(convertRomaji('')).toMatchObject({ complete: false });
  });

  it('accepts typed or pasted kana and full-width letters', () => {
    expect(hira('ねコ')).toBe('ねこ');
    expect(hira('ｎｅｋｏ')).toBe('ねこ');
  });
});

describe('kana script helpers', () => {
  it('switches between hiragana and katakana', () => {
    expect(toKatakana('がっこう')).toBe('ガッコウ');
    expect(toHiragana('コーヒー')).toBe('こーひー');
  });
});
