import type { Page } from '@playwright/test';

// Stand-ins for browser speech, so tests can check what is read and script what is "heard".

/** Replaces the browser's speech with a recorder; `voices` decides which voices the "device" has. */
export async function fakeSpeech(page: Page, voices: { name: string; lang: string }[] | 'none') {
  await page.addInitScript(list => {
    const w = window as unknown as Record<string, unknown>;
    if (list === 'none') {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true });
      return;
    }
    const spoken: unknown[] = [];
    w.__spoken = spoken;
    class FakeUtterance {
      lang = ''; rate = 1; voice: { name: string } | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true, writable: true });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        getVoices: () => list.map(v => ({ ...v, localService: true, default: false, voiceURI: v.name })),
        speak: (u: FakeUtterance) => { spoken.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.name }); w.__last = u; },
        cancel: () => { (w.__last as FakeUtterance | undefined)?.onend?.(); },
        addEventListener() {}, removeEventListener() {},
      },
    });
    w.__finish = () => (w.__last as FakeUtterance | undefined)?.onend?.();
  }, voices);
}

export const spoken = (page: Page) => page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken);

export type Reply = { heard: string[] } | { error: string } | 'hang';

/**
 * Replaces browser speech recognition with a scripted one: each listen takes the next reply.
 * `none` removes recognition, as in browsers without it.
 */
export async function fakeRecognition(page: Page, replies: Reply[] | 'none') {
  await page.addInitScript(list => {
    const w = window as unknown as Record<string, unknown>;
    if (list === 'none') {
      Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
      Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined, configurable: true });
      return;
    }
    const queue = [...list];
    const started: unknown[] = [];
    w.__started = started;
    class Fake {
      lang = ''; maxAlternatives = 1; interimResults = true; continuous = true;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() {
        started.push({ lang: this.lang, maxAlternatives: this.maxAlternatives });
        const reply = queue.shift();
        if (reply === 'hang') return;
        setTimeout(() => {
          if (reply && 'error' in reply) this.onerror?.({ error: reply.error });
          else if (reply) this.onresult?.({ results: [reply.heard.map(transcript => ({ transcript }))] });
          this.onend?.();
        }, 30);
      }
      abort() { setTimeout(() => { this.onerror?.({ error: 'aborted' }); this.onend?.(); }, 10); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { value: undefined, configurable: true });
    Object.defineProperty(window, 'webkitSpeechRecognition', { value: Fake, configurable: true });
  }, replies);
}
