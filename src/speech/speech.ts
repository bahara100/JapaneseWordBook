// Speech adapter (docs/03 §6). Screens ask it to play a reading; it uses a reviewed audio file when the
// content has one, otherwise the device's Japanese voice reading the kana (never the kanji, which a
// voice may read wrongly). It reports plainly when the browser or device cannot speak Japanese.

export type SpeakResult = 'playing' | 'unsupported' | 'no-voice' | 'failed';

export interface SpeechEnvironment {
  synth?: Pick<SpeechSynthesis, 'getVoices' | 'speak' | 'cancel' | 'addEventListener' | 'removeEventListener'>;
  makeUtterance?: (text: string) => SpeechSynthesisUtterance;
  makeAudio?: (src: string) => HTMLAudioElement;
}

export function browserEnvironment(): SpeechEnvironment {
  if (typeof window === 'undefined') return {};
  return {
    synth: 'speechSynthesis' in window ? window.speechSynthesis : undefined,
    makeUtterance: typeof SpeechSynthesisUtterance === 'function' ? text => new SpeechSynthesisUtterance(text) : undefined,
    makeAudio: typeof Audio === 'function' ? src => new Audio(src) : undefined,
  };
}

/** Japanese voices, best first: ja-JP, then on-device (works offline), then the device default. */
export function pickJapaneseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const japanese = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.replace('_', '-').toLowerCase() === 'ja-jp' ? 4 : 0) + (v.localService ? 2 : 0) + (v.default ? 1 : 0);
  return japanese.sort((a, b) => score(b) - score(a))[0];
}

export interface PlayRequest {
  /** Kana to read when there is no audio file. */
  reading: string;
  /** A reviewed recording, already resolved to a URL. */
  audioUrl?: string;
  rate: number;
  onEnd: () => void;
}

export class Speech {
  private current?: { stop: () => void };

  constructor(private env: SpeechEnvironment, private voiceWaitMs = 1500) {}

  get supported(): boolean {
    return !!(this.env.synth && this.env.makeUtterance) || !!this.env.makeAudio;
  }

  /** Voices often arrive a moment after page load; wait briefly for voiceschanged. */
  private async voices(): Promise<SpeechSynthesisVoice[]> {
    const synth = this.env.synth!;
    const now = synth.getVoices();
    if (now.length) return now;
    return new Promise(resolve => {
      const done = () => { synth.removeEventListener('voiceschanged', done); clearTimeout(timer); resolve(synth.getVoices()); };
      const timer = setTimeout(done, this.voiceWaitMs);
      synth.addEventListener('voiceschanged', done);
    });
  }

  stop(): void {
    this.current?.stop();
    this.current = undefined;
  }

  /** Plays one reading, stopping anything already playing. Resolves once playback has started or failed. */
  async play(request: PlayRequest): Promise<SpeakResult> {
    this.stop();
    if (request.audioUrl && this.env.makeAudio) {
      const audio = this.env.makeAudio(request.audioUrl);
      audio.playbackRate = request.rate;
      audio.onended = audio.onerror = () => { if (this.current?.stop === stopAudio) this.current = undefined; request.onEnd(); };
      const stopAudio = () => { audio.pause(); request.onEnd(); };
      this.current = { stop: stopAudio };
      try {
        await audio.play();
        return 'playing';
      } catch {
        this.current = undefined;
        audio.onended = audio.onerror = null;
        // Fall through to the device voice if the file could not play.
      }
    }
    const { synth, makeUtterance } = this.env;
    if (!synth || !makeUtterance) return 'unsupported';
    const voice = pickJapaneseVoice(await this.voices());
    if (!voice) return 'no-voice';
    const utterance = makeUtterance(request.reading);
    utterance.lang = 'ja-JP';
    utterance.voice = voice;
    utterance.rate = request.rate;
    let ended = false;
    const end = () => { if (ended) return; ended = true; if (this.current?.stop === stopVoice) this.current = undefined; request.onEnd(); };
    utterance.onend = end;
    utterance.onerror = end;
    const stopVoice = () => { synth.cancel(); end(); };
    this.current = { stop: stopVoice };
    try {
      synth.speak(utterance);
      return 'playing';
    } catch {
      this.current = undefined;
      return 'failed';
    }
  }
}

export const SPEAK_MESSAGES: Record<Exclude<SpeakResult, 'playing'>, string> = {
  unsupported: '이 브라우저에서는 발음 듣기를 지원하지 않아요.',
  'no-voice': '일본어 음성을 찾지 못했어요. 기기 설정에서 일본어 음성(언어 팩)을 추가하면 들을 수 있어요.',
  failed: '소리를 재생하지 못했어요. 다시 눌러 주세요.',
};
