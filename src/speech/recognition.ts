// Speech recognition adapter (docs/03 §6). It listens once, only after the learner presses the
// button, in ja-JP, and returns what it heard as text; no audio is kept. Each kind of failure is told
// apart so a refused microphone or a dropped connection is never taken as a wrong answer.

export type ListenResult =
  | { kind: 'heard'; alternatives: string[] }
  /** Nothing was understood (silence, or speech it could not turn into words). */
  | { kind: 'no-speech' }
  /** The microphone is refused or missing. */
  | { kind: 'denied' }
  | { kind: 'unsupported' }
  | { kind: 'cancelled' }
  /** Network or service failure. */
  | { kind: 'failed' };

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}
export type RecognitionConstructor = new () => RecognitionLike;

export function browserRecognition(): RecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const DENIED = ['not-allowed', 'service-not-allowed', 'audio-capture'];

export class Recognizer {
  private active?: RecognitionLike;
  private cancelled = false;

  constructor(private Recognition: RecognitionConstructor | undefined) {}

  get supported(): boolean { return !!this.Recognition; }

  listen(): Promise<ListenResult> {
    if (!this.Recognition) return Promise.resolve({ kind: 'unsupported' });
    this.cancel();
    this.cancelled = false;
    return new Promise(resolve => {
      let result: ListenResult | undefined;
      let recognition: RecognitionLike;
      try {
        recognition = new this.Recognition!();
      } catch {
        resolve({ kind: 'unsupported' });
        return;
      }
      recognition.lang = 'ja-JP';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.maxAlternatives = 5;
      recognition.onresult = event => {
        const first = event.results[0];
        const alternatives = first ? Array.from(first, a => a.transcript.trim()).filter(Boolean) : [];
        result = alternatives.length ? { kind: 'heard', alternatives } : { kind: 'no-speech' };
      };
      recognition.onerror = event => {
        if (event.error === 'aborted') result = { kind: 'cancelled' };
        else if (DENIED.includes(event.error)) result = { kind: 'denied' };
        else if (event.error === 'no-speech') result = { kind: 'no-speech' };
        else result = { kind: 'failed' };
      };
      recognition.onend = () => {
        if (this.active === recognition) this.active = undefined;
        resolve(this.cancelled ? { kind: 'cancelled' } : result ?? { kind: 'no-speech' });
      };
      this.active = recognition;
      try {
        recognition.start();
      } catch {
        this.active = undefined;
        resolve({ kind: 'failed' });
      }
    });
  }

  cancel(): void {
    if (!this.active) return;
    this.cancelled = true;
    this.active.abort();
  }
}

export const LISTEN_MESSAGES = {
  listening: '듣고 있어요. 일본어로 말해 주세요.',
  denied: '마이크를 사용할 수 없어요. 직접 입력으로 계속할 수 있어요.',
  'no-speech': '잘 듣지 못했어요. 다시 말하거나 직접 입력해 주세요.',
  failed: '말하기 확인이 연결되지 않았어요. 다시 말하거나 직접 입력해 주세요.',
  unsupported: '이 브라우저에서는 말하기를 지원하지 않아요. 직접 입력으로 답해 주세요.',
  cancelled: '말하기를 취소했어요.',
} as const;
