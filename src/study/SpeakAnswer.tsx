import { useEffect, useState } from 'react';
import { Icon } from '../art/icons';
import { browserRecognition, LISTEN_MESSAGES, Recognizer } from '../speech/recognition';
import { useSpeech } from '../speech/SpeechProvider';
import type { SessionActions } from './useDailySession';

/**
 * Answering by voice (docs/01 §5). Listens only after the button is pressed and can be cancelled.
 * A refused microphone, silence or a dropped connection is never a wrong answer; typing stays
 * available for all of them.
 */
export function SpeakAnswer({ actions, busy, openTyping, onHeard }: {
  actions: SessionActions; busy: boolean; openTyping: () => void; onHeard: (text: string) => void;
}) {
  const [recognizer] = useState(() => new Recognizer(browserRecognition()));
  const speech = useSpeech();
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => () => recognizer.cancel(), [recognizer]);

  const click = async () => {
    if (listening) { recognizer.cancel(); return; }
    if (!recognizer.supported) { setMessage(LISTEN_MESSAGES.unsupported); openTyping(); return; }
    speech.stop(); // never record while a reading is playing
    setMessage(LISTEN_MESSAGES.listening);
    setListening(true);
    const result = await recognizer.listen();
    setListening(false);
    switch (result.kind) {
      case 'heard': {
        onHeard(result.alternatives[0]);
        const graded = await actions.spoken(result.alternatives);
        setMessage(graded === 'again' ? `‘${result.alternatives[0]}’(으)로 들렸어요. 한 번 더 또렷하게 말해 볼까요?` : '');
        return;
      }
      case 'no-speech':
      case 'failed':
        // Kept as an attempt that did not count, so the record shows what happened.
        await actions.answer('unrecognized', 'speech');
        setMessage(LISTEN_MESSAGES[result.kind]);
        return;
      case 'denied':
        setMessage(LISTEN_MESSAGES.denied);
        openTyping();
        return;
      default:
        setMessage(LISTEN_MESSAGES[result.kind]);
    }
  };

  return (
    <>
      <button className={`btn ${listening ? 'listening' : ''}`} type="button" aria-pressed={listening}
        disabled={busy && !listening} onClick={() => void click()}>
        <Icon name="mic" />{listening ? '듣는 중 · 취소' : '말하기'}
      </button>
      {message && <p className="speak-status" role="status">{message}</p>}
    </>
  );
}
