import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../art/icons';
import { mediaUrl } from '../content/loader';
import { useStorage } from '../storage/StorageProvider';
import { browserEnvironment, Speech, SPEAK_MESSAGES, type SpeakResult } from './speech';

interface SpeechContext {
  /** Key of the reading now playing, if any. */
  playing?: string;
  play(key: string, reading: string, audioPath?: string): Promise<SpeakResult>;
  stop(): void;
  supported: boolean;
}

const Context = createContext<SpeechContext | null>(null);

/** One player for the whole app, so only one reading sounds at a time. */
export function SpeechProvider({ children }: { children: ReactNode }) {
  const { settings } = useStorage();
  const [speech] = useState(() => new Speech(browserEnvironment()));
  const [playing, setPlaying] = useState<string>();

  const stop = useCallback(() => { speech.stop(); setPlaying(undefined); }, [speech]);
  const play = useCallback(async (key: string, reading: string, audioPath?: string) => {
    setPlaying(key);
    const result = await speech.play({
      reading, audioUrl: audioPath ? mediaUrl(audioPath) : undefined, rate: settings.speechRate,
      onEnd: () => setPlaying(current => current === key ? undefined : current),
    });
    if (result !== 'playing') setPlaying(current => current === key ? undefined : current);
    return result;
  }, [speech, settings.speechRate]);

  // Moving to another screen ends the sound.
  useEffect(() => {
    window.addEventListener('hashchange', stop);
    return () => { window.removeEventListener('hashchange', stop); speech.stop(); };
  }, [stop, speech]);

  const value = useMemo(() => ({ playing, play, stop, supported: speech.supported }), [playing, play, stop, speech]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSpeech(): SpeechContext {
  const value = useContext(Context);
  if (!value) throw new Error('useSpeech outside SpeechProvider');
  return value;
}

/**
 * A play/stop button for one reading. Problems (no Japanese voice, no speech in this browser) are
 * said next to the button; `onPlay` runs only when sound really started.
 */
export function SpeakButton({ id, reading, audioPath, label, className = 'btn soft', onPlay }: {
  id: string; reading: string; audioPath?: string; label: string; className?: string; onPlay?: () => void;
}) {
  const { playing, play, stop, supported } = useSpeech();
  const [message, setMessage] = useState('');
  const active = playing === id;

  if (!supported) return <p className="speak-note subtle">{SPEAK_MESSAGES.unsupported}</p>;

  const click = async () => {
    if (active) { stop(); return; }
    setMessage('');
    const result = await play(id, reading, audioPath);
    if (result === 'playing') onPlay?.();
    else setMessage(SPEAK_MESSAGES[result]);
  };

  return (
    <>
      <button className={className} type="button" aria-pressed={active} onClick={() => void click()}>
        <Icon name="sound" />{active ? '정지' : label}
      </button>
      {message && <p className="speak-note" role="status">{message}</p>}
    </>
  );
}
