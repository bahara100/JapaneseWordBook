import { useEffect, useState } from 'react';
import { Icon } from '../art/icons';
import { mediaUrl } from '../content/loader';
import type { SessionCard, StudySession } from '../content/types';
import { browserRecognition, LISTEN_MESSAGES, Recognizer } from '../speech/recognition';
import { SpeakButton, useSpeech } from '../speech/SpeechProvider';
import { useStorage } from '../storage/StorageProvider';
import type { SessionActions } from './useDailySession';

const readingOf = (card: SessionCard) => card.wordSnapshot.readings.find(r => r.id === card.promptSnapshot.readingId)!;
const audioOf = (card: SessionCard) => card.mediaSnapshots.find(m => m.id === card.promptSnapshot.audioAssetId)?.path;

/** Listening mode, question side: only the sound, then pick the meaning (docs/01 §5). */
export function ListeningFront({ card, actions, busy }: { card: SessionCard; actions: SessionActions; busy: boolean }) {
  const answer = card.wordSnapshot.id;
  return (
    <>
      <div className="card-front listening-front">
        <span className="caption">LISTEN · CHOOSE</span>
        <h2 className="card-question" tabIndex={-1}>소리를 듣고 뜻을 골라요</h2>
        <p>그림과 글자 없이 소리만 들려드려요. 여러 번 들어도 괜찮아요.</p>
        <div className="button-row">
          <SpeakButton id={`listen:${card.promptSnapshot.id}`} reading={readingOf(card).kana} audioPath={audioOf(card)} label="소리 듣기" className="btn primary" />
        </div>
        <div className="choices" role="group" aria-label="뜻 고르기">
          {(card.choices ?? []).map(choice => (
            <button key={choice.wordId} className="choice" type="button" disabled={busy}
              onClick={() => void actions.answer(choice.wordId === answer ? 'correct' : 'incorrect', 'choice', choice.label)}>
              {choice.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card-actions">
        <button className="btn wide" type="button" disabled={busy} onClick={() => void actions.answer('revealed', 'reveal')}>
          <Icon name="flip" />모르겠어요 · 정답 보기
        </button>
      </div>
    </>
  );
}

/** Repeat mode: the answer and its sound are shown; saying it along is practice only. */
export function RepeatCard({ card, session, actions, tryRepeat, busy }: {
  card: SessionCard; session: StudySession; actions: SessionActions; tryRepeat: (heard: string[] | null) => Promise<boolean>; busy: boolean;
}) {
  const { settings } = useStorage();
  const speech = useSpeech();
  const [recognizer] = useState(() => new Recognizer(browserRecognition()));
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState('');
  const reading = readingOf(card);
  const sense = card.wordSnapshot.senses.find(s => s.id === card.promptSnapshot.senseId)!;
  const image = card.mediaSnapshots.find(m => m.id === card.promptSnapshot.imageAssetId);
  const last = session.currentIndex === session.cards.length - 1;

  useEffect(() => () => recognizer.cancel(), [recognizer]);

  const sayAlong = async () => {
    if (listening) { recognizer.cancel(); return; }
    if (!recognizer.supported) { setMessage('이 브라우저에서는 말하기 확인을 지원하지 않아요. 소리를 듣고 소리 내어 따라 해 보세요.'); return; }
    speech.stop();
    setMessage(LISTEN_MESSAGES.listening);
    setListening(true);
    const result = await recognizer.listen();
    setListening(false);
    if (result.kind === 'heard') {
      const ok = await tryRepeat(result.alternatives);
      setMessage(ok ? '정답 단어로 인식했어요.' : `‘${result.alternatives[0]}’(으)로 들렸어요. 소리를 다시 듣고 따라 해 보세요.`);
    } else if (result.kind === 'no-speech' || result.kind === 'failed') {
      await tryRepeat(null);
      setMessage(result.kind === 'no-speech'
        ? '잘 듣지 못했어요. 소리를 다시 듣고 따라 말해 보세요.'
        : '말하기 확인이 연결되지 않았어요. 소리를 듣고 소리 내어 따라 해 보세요.');
    } else if (result.kind === 'denied') {
      setMessage('마이크를 사용할 수 없어요. 소리를 듣고 소리 내어 따라 해 보세요.');
    } else {
      setMessage(LISTEN_MESSAGES[result.kind]);
    }
  };

  return (
    <>
      <div className="card-back repeat-card">
        <span className="caption">LISTEN · SAY</span>
        {image && <img className="illustration repeat-picture" src={mediaUrl(image.path)} alt={image.description} />}
        <h2 lang="ja" tabIndex={-1}>{card.wordSnapshot.written}</h2>
        <div className="kana" lang="ja">{reading.kana}</div>
        {settings.showRomaji && reading.romaji && <div className="romaji">{reading.romaji}</div>}
        <div className="meaning">{sense.korean.join(', ')}</div>
        <div className="button-row">
          <SpeakButton id={`repeat:${card.promptSnapshot.id}`} reading={reading.kana} audioPath={audioOf(card)} label="발음 듣기" />
          <button className={`btn ${listening ? 'listening' : ''}`} type="button" aria-pressed={listening}
            disabled={busy && !listening} onClick={() => void sayAlong()}>
            <Icon name="mic" />{listening ? '듣는 중 · 취소' : '따라 말하기'}
          </button>
          {message && <p className="speak-status" role="status">{message}</p>}
        </div>
      </div>
      <div className="card-actions">
        <button className="btn primary wide" type="button" disabled={busy} onClick={() => void actions.next()}>
          {last ? '연습 마치기' : '다음 카드'} →
        </button>
      </div>
    </>
  );
}
