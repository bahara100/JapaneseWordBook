import { describe, expect, it, vi } from 'vitest';
import { pickJapaneseVoice, Speech, type SpeechEnvironment } from './speech';

const voice = (name: string, lang: string, localService = true, isDefault = false) =>
  ({ name, lang, localService, default: isDefault, voiceURI: name }) as SpeechSynthesisVoice;

function fakeSynth(voices: SpeechSynthesisVoice[], late = false) {
  const listeners = new Set<() => void>();
  let list = late ? [] : voices;
  const spoken: SpeechSynthesisUtterance[] = [];
  const synth = {
    getVoices: () => list,
    speak: vi.fn((u: SpeechSynthesisUtterance) => { spoken.push(u); }),
    cancel: vi.fn(),
    addEventListener: (_: string, f: () => void) => listeners.add(f),
    removeEventListener: (_: string, f: () => void) => listeners.delete(f),
  };
  return { synth, spoken, arrive: () => { list = voices; listeners.forEach(f => f()); } };
}
const env = (synth: ReturnType<typeof fakeSynth>['synth'], extra: Partial<SpeechEnvironment> = {}): SpeechEnvironment => ({
  synth: synth as never,
  makeUtterance: text => ({ text, lang: '', rate: 1, voice: null }) as unknown as SpeechSynthesisUtterance,
  ...extra,
});

describe('pickJapaneseVoice', () => {
  it('prefers ja-JP, then on-device, then the default; ignores other languages', () => {
    const voices = [voice('Korean', 'ko-KR'), voice('Online JA', 'ja-JP', false), voice('Kyoko', 'ja-JP', true), voice('ja other', 'ja')];
    expect(pickJapaneseVoice(voices)?.name).toBe('Kyoko');
    expect(pickJapaneseVoice([voice('Korean', 'ko-KR')])).toBeUndefined();
    expect(pickJapaneseVoice([voice('Android', 'ja_JP')])?.name).toBe('Android');
  });
});

describe('Speech', () => {
  it('reads the kana with a Japanese voice at the chosen rate', async () => {
    const f = fakeSynth([voice('Kyoko', 'ja-JP')]);
    const speech = new Speech(env(f.synth));
    expect(await speech.play({ reading: 'ねこ', rate: 0.85, onEnd: () => {} })).toBe('playing');
    expect(f.spoken[0]).toMatchObject({ text: 'ねこ', lang: 'ja-JP', rate: 0.85 });
    expect(f.spoken[0].voice?.name).toBe('Kyoko');
  });

  it('waits for voices that arrive late', async () => {
    const f = fakeSynth([voice('Kyoko', 'ja-JP')], true);
    const playing = new Speech(env(f.synth)).play({ reading: 'ねこ', rate: 1, onEnd: () => {} });
    f.arrive();
    expect(await playing).toBe('playing');
  });

  it('says so when there is no Japanese voice or no speech at all', async () => {
    const f = fakeSynth([voice('Korean', 'ko-KR')]);
    expect(await new Speech(env(f.synth), 10).play({ reading: 'ねこ', rate: 1, onEnd: () => {} })).toBe('no-voice');
    expect(await new Speech({}, 10).play({ reading: 'ねこ', rate: 1, onEnd: () => {} })).toBe('unsupported');
    expect(new Speech({}).supported).toBe(false);
  });

  it('stops what is playing before the next one, and reports the end once', async () => {
    const f = fakeSynth([voice('Kyoko', 'ja-JP')]);
    const speech = new Speech(env(f.synth));
    const ended = vi.fn();
    await speech.play({ reading: 'ねこ', rate: 1, onEnd: ended });
    await speech.play({ reading: 'がっこう', rate: 1, onEnd: () => {} });
    expect(f.synth.cancel).toHaveBeenCalled();
    expect(ended).toHaveBeenCalledTimes(1);
    f.spoken[0].onend?.({} as SpeechSynthesisEvent);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('plays a reviewed recording first, and falls back to the voice if it cannot', async () => {
    const f = fakeSynth([voice('Kyoko', 'ja-JP')]);
    const audio = { play: vi.fn(async () => {}), pause: vi.fn(), playbackRate: 1 } as unknown as HTMLAudioElement;
    const withFile = new Speech(env(f.synth, { makeAudio: () => audio }));
    expect(await withFile.play({ reading: 'ねこ', audioUrl: '/a.mp3', rate: 0.7, onEnd: () => {} })).toBe('playing');
    expect(audio.playbackRate).toBe(0.7);
    expect(f.spoken).toHaveLength(0);

    const broken = { play: vi.fn(async () => { throw new Error('404'); }), pause: vi.fn() } as unknown as HTMLAudioElement;
    const fallback = new Speech(env(f.synth, { makeAudio: () => broken }));
    expect(await fallback.play({ reading: 'ねこ', audioUrl: '/missing.mp3', rate: 1, onEnd: () => {} })).toBe('playing');
    expect(f.spoken).toHaveLength(1);
  });
});
