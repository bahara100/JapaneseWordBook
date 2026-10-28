import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { convertRomaji } from './kana';

/**
 * Typing an answer without a Japanese keyboard (docs/02 §3): romaji turns into hiragana/katakana
 * candidates above the input, and picking one adds it to the answer. Enter adds hiragana; only
 * the 입력 완료 button submits.
 */
export function KanaAnswer({ onSubmit, disabled }: { onSubmit: (answer: string) => void; disabled: boolean }) {
  const [answer, setAnswer] = useState('');
  const [roman, setRoman] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const ids = { candidates: useId(), help: useId(), input: useId() };
  const result = convertRomaji(roman);

  const add = (script: 'hiragana' | 'katakana') => {
    if (!result.complete) { setMessage('로마자 입력을 마친 뒤 후보를 선택해 주세요.'); return null; }
    const next = answer + result[script];
    setAnswer(next);
    setRoman('');
    setMessage('');
    input.current?.focus({ preventScroll: true });
    return next;
  };

  const finish = () => {
    let final = answer;
    if (roman.trim()) {
      const added = add('hiragana');
      if (added === null) return;
      final = added;
    }
    if (!final) { setMessage('영문으로 입력한 뒤 변환 후보를 선택해 주세요.'); input.current?.focus(); return; }
    onSubmit(final);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Never act on Enter while a Korean (or any) IME is still composing.
    if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
  };
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (roman.trim()) add('hiragana');
  };

  return (
    <form className="practice-input" onSubmit={onFormSubmit}>
      <span className="input-label">나의 답안</span>
      <div className={`kana-answer ${answer ? '' : 'empty-answer'}`} lang="ja" aria-live="polite">
        {answer || '선택한 문자가 여기에 표시돼요'}
      </div>
      <div className="answer-tools">
        <button className="text-button" type="button" disabled={!answer}
          onClick={() => setAnswer(Array.from(answer).slice(0, -1).join(''))}>한 글자 지우기</button>
        <button className="text-button" type="button" disabled={!answer && !roman}
          onClick={() => { setAnswer(''); setRoman(''); input.current?.focus({ preventScroll: true }); }}>모두 지우기</button>
      </div>
      <span className="input-label" id={ids.candidates}>변환 후보</span>
      <div className="kana-candidates" role="group" aria-labelledby={ids.candidates}>
        {!roman.trim() ? (
          <span className="candidate-help">영문을 입력하면 히라가나·가타카나 후보가 보여요.</span>
        ) : !result.complete ? (
          <span className="candidate-help" role="status">
            {result.invalid ? '영문 로마자로 입력해 주세요.' : '이어서 입력해 주세요.'}
            {result.hiragana && <> <span lang="ja">{result.hiragana}</span></>}
            {' '}<span className="pending-roman">{result.pending}</span>
          </span>
        ) : (
          (['hiragana', 'katakana'] as const).map(script => (
            <button key={script} className="kana-candidate" type="button" onClick={() => add(script)}>
              <span lang="ja">{result[script]}</span><small>{script === 'hiragana' ? '히라가나' : '가타카나'}</small>
            </button>
          ))
        )}
      </div>
      <label htmlFor={ids.input}>영문 자판으로 입력</label>
      <input id={ids.input} ref={input} lang="en" inputMode="text" autoComplete="off" autoCapitalize="none"
        autoCorrect="off" spellCheck={false} aria-describedby={ids.help} placeholder="예: neko, gakkou"
        value={roman} onChange={e => { setRoman(e.target.value); setMessage(''); }} onKeyDown={onKeyDown} autoFocus />
      <p id={ids.help} className="subtle">위의 후보를 눌러 답안에 추가하세요.<br />Enter는 히라가나 추가 · nn → ん · 자음 반복 → っ</p>
      {message && <p className="input-message" role="alert">{message}</p>}
      <button className="btn primary wide" type="button" disabled={disabled} onClick={finish}>입력 완료 · 정답 확인</button>
    </form>
  );
}
