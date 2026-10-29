import { describe, expect, it } from 'vitest';
import { matchSpoken } from '../study/grading';
import { Recognizer, type RecognitionConstructor } from './recognition';

type Script = { alternatives?: string[]; error?: string; throwOnStart?: boolean; hang?: boolean };

/** A recognizer that plays back `script` asynchronously, like the browser does. */
function fakeRecognition(script: Script) {
  const made: { lang: string; maxAlternatives: number }[] = [];
  class Fake {
    lang = ''; interimResults = true; maxAlternatives = 1; continuous = true;
    onresult: ((e: { results: { transcript: string }[][] }) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() { made.push(this); }
    start() {
      if (script.throwOnStart) throw new Error('busy');
      if (script.hang) return;
      setTimeout(() => {
        if (script.error) this.onerror?.({ error: script.error });
        else this.onresult?.({ results: [(script.alternatives ?? []).map(transcript => ({ transcript }))] });
        this.onend?.();
      }, 0);
    }
    abort() { setTimeout(() => { this.onerror?.({ error: 'aborted' }); this.onend?.(); }, 0); }
  }
  return { Recognition: Fake as unknown as RecognitionConstructor, made };
}

describe('Recognizer', () => {
  it('listens once in Japanese and returns its guesses', async () => {
    const { Recognition, made } = fakeRecognition({ alternatives: [' 猫 ', 'ネコ', ''] });
    expect(await new Recognizer(Recognition).listen()).toEqual({ kind: 'heard', alternatives: ['猫', 'ネコ'] });
    expect(made[0]).toMatchObject({ lang: 'ja-JP', maxAlternatives: 5, interimResults: false, continuous: false });
  });

  it('tells a refused microphone, silence, a network failure and no support apart', async () => {
    const listen = (s: Script) => new Recognizer(fakeRecognition(s).Recognition).listen();
    expect(await listen({ error: 'not-allowed' })).toEqual({ kind: 'denied' });
    expect(await listen({ error: 'audio-capture' })).toEqual({ kind: 'denied' });
    expect(await listen({ error: 'no-speech' })).toEqual({ kind: 'no-speech' });
    expect(await listen({ alternatives: [] })).toEqual({ kind: 'no-speech' });
    expect(await listen({ error: 'network' })).toEqual({ kind: 'failed' });
    expect(await listen({ throwOnStart: true })).toEqual({ kind: 'failed' });
    expect(await new Recognizer(undefined).listen()).toEqual({ kind: 'unsupported' });
  });

  it('can be cancelled while listening', async () => {
    const recognizer = new Recognizer(fakeRecognition({ hang: true }).Recognition);
    const listening = recognizer.listen();
    recognizer.cancel();
    expect(await listening).toEqual({ kind: 'cancelled' });
  });
});

describe('matchSpoken', () => {
  const prompt = { acceptedKanaForms: ['ねこ'], acceptedWrittenForms: ['猫'] };
  it('accepts any guess that is the word in kana, katakana or its written form', () => {
    expect(matchSpoken(['寝子', '猫'], prompt)).toBe('猫');
    expect(matchSpoken(['ネコ'], prompt)).toBe('ネコ');
    expect(matchSpoken(['ねこ。'], prompt)).toBe('ねこ。');
  });
  it('does not accept something merely similar', () => {
    expect(matchSpoken(['ねっこ', '猫が'], prompt)).toBeUndefined();
  });
});
