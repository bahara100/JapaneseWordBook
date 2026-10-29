import { useEffect, useState } from 'react';
import { loadManifest } from '../content/loader';
import { browserRecognition, LISTEN_MESSAGES, Recognizer } from '../speech/recognition';
import { pickJapaneseVoice } from '../speech/speech';
import { SpeakButton, useSpeech } from '../speech/SpeechProvider';
import { gradeTyped } from '../study/grading';
import { useStorage } from '../storage/StorageProvider';
import { PageTitle } from './PageTitle';

type Mark = 'ok' | 'warn' | 'no' | 'info';
interface Row { label: string; value: string; mark: Mark }
interface Group { title: string; rows: Row[] }

/** A short browser and OS name from the user agent, for the report only (never to decide features). */
export function describeBrowser(ua: string): string {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '알 수 없는 OS';
  const version = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0] ?? '';
  const browser = /Edg(?:A|iOS)?\//.test(ua) ? `Edge ${version(/Edg(?:A|iOS)?\/([\d.]+)/)}`
    : /SamsungBrowser\//.test(ua) ? `Samsung Internet ${version(/SamsungBrowser\/([\d.]+)/)}`
    : /CriOS\//.test(ua) ? `Chrome ${version(/CriOS\/([\d.]+)/)} (iOS)`
    : /FxiOS\//.test(ua) ? `Firefox ${version(/FxiOS\/([\d.]+)/)} (iOS)`
    : /Firefox\//.test(ua) ? `Firefox ${version(/Firefox\/([\d.]+)/)}`
    : /Chrome\//.test(ua) ? `Chrome ${version(/Chrome\/([\d.]+)/)}`
    : /Safari\//.test(ua) && /Version\//.test(ua) ? `Safari ${version(/Version\/([\d.]+)/)}`
    : '알 수 없는 브라우저';
  return `${browser} · ${os}`;
}

async function voicesNow(): Promise<SpeechSynthesisVoice[]> {
  if (!('speechSynthesis' in window) || !window.speechSynthesis) return [];
  const synth = window.speechSynthesis;
  if (synth.getVoices().length) return synth.getVoices();
  return new Promise(resolve => {
    const done = () => { synth.removeEventListener('voiceschanged', done); resolve(synth.getVoices()); };
    synth.addEventListener('voiceschanged', done);
    setTimeout(done, 1500);
  });
}

async function microphoneState(): Promise<string> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return { granted: '허용됨', denied: '거부됨', prompt: '처음 말할 때 물어봄' }[status.state] ?? status.state;
  } catch {
    return '이 브라우저에서는 미리 알 수 없음';
  }
}

function useReport(): Group[] | undefined {
  const { records, settingsSaved } = useStorage();
  const [groups, setGroups] = useState<Group[]>();

  useEffect(() => {
    if (records.status !== 'ready') return;
    let current = true;
    (async () => {
      const voices = await voicesNow();
      const japanese = voices.filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja'));
      const chosen = pickJapaneseVoice(voices);
      const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
      const manifest = await loadManifest().catch(() => undefined);
      const speechOk = 'speechSynthesis' in window && !!window.speechSynthesis;
      const recognition = browserRecognition();
      const mb = (n?: number) => n === undefined ? '알 수 없음' : `${(n / 1024 / 1024).toFixed(1)}MB`;
      const result: Group[] = [
        { title: '이 기기', rows: [
          { label: '브라우저', value: describeBrowser(navigator.userAgent), mark: 'info' },
          { label: '화면', value: `${innerWidth}×${innerHeight} · 배율 ${devicePixelRatio} · ${navigator.maxTouchPoints > 0 ? '터치' : '마우스'}`, mark: 'info' },
          { label: '인터넷', value: navigator.onLine ? '연결됨' : '끊김', mark: navigator.onLine ? 'ok' : 'warn' },
        ] },
        { title: '기록 저장', rows: [
          { label: '학습 기록', value: records.store.durable ? '이 기기에 저장돼요' : '저장되지 않아요(창을 닫으면 사라짐)', mark: records.store.durable ? 'ok' : 'no' },
          { label: '설정', value: settingsSaved ? '이 기기에 저장돼요' : '저장되지 않아요', mark: settingsSaved ? 'ok' : 'no' },
          { label: '기록 보호', value: records.persistence === 'granted' ? '브라우저가 지우지 않도록 보호 중' : records.persistence === 'not-granted' ? '보호 안 됨(첫 학습 때 요청해요)' : '확인할 수 없음', mark: records.persistence === 'granted' ? 'ok' : 'warn' },
          { label: '사용 공간', value: `${mb(estimate?.usage)} / ${mb(estimate?.quota)}`, mark: 'info' },
        ] },
        { title: '발음 듣기', rows: [
          { label: '음성 합성', value: speechOk ? `지원 · 음성 ${voices.length}개` : '지원 안 됨', mark: speechOk ? 'ok' : 'no' },
          { label: '일본어 음성', value: japanese.length ? japanese.map(v => `${v.name}(${v.localService ? '기기' : '온라인'})`).join(', ') : '없음', mark: japanese.length ? 'ok' : 'no' },
          { label: '사용할 음성', value: chosen ? chosen.name : '없음', mark: chosen ? 'ok' : 'no' },
        ] },
        { title: '말하기', rows: [
          { label: '음성 인식', value: recognition ? '지원' : '지원 안 됨(직접 입력으로 학습)', mark: recognition ? 'ok' : 'no' },
          { label: '마이크 권한', value: await microphoneState(), mark: 'info' },
        ] },
        { title: '콘텐츠', rows: [
          { label: '콘텐츠 버전', value: manifest?.contentVersion ?? '불러오지 못함', mark: manifest ? 'info' : 'warn' },
        ] },
      ];
      if (current) setGroups(result);
    })();
    return () => { current = false; };
  }, [records, settingsSaved]);

  return groups;
}

const MARK_TEXT: Record<Mark, string> = { ok: '가능', warn: '주의', no: '안 됨', info: '' };

/**
 * "이 기기 확인" (backlog 5-2): what this browser and device support, two quick tests, and a text
 * report to copy into a device check. Reads only; nothing here changes records.
 */
export function DeviceCheck() {
  const groups = useReport();
  const speech = useSpeech();
  const [sound, setSound] = useState('아직 안 해 봄');
  const [listen, setListen] = useState('아직 안 해 봄');
  const [listening, setListening] = useState(false);
  const [recognizer] = useState(() => new Recognizer(browserRecognition()));
  const [copied, setCopied] = useState('');

  useEffect(() => () => recognizer.cancel(), [recognizer]);

  const testListen = async () => {
    if (listening) { recognizer.cancel(); return; }
    speech.stop();
    setListening(true);
    setListen(LISTEN_MESSAGES.listening);
    const result = await recognizer.listen();
    setListening(false);
    if (result.kind === 'heard') {
      const ok = result.alternatives.some(a => gradeTyped(a, { acceptedKanaForms: ['ねこ'], acceptedWrittenForms: ['猫'] }) === 'correct');
      setListen(`${ok ? '‘ねこ’로 인식됨' : '다른 말로 인식됨'} · 들은 말: ${result.alternatives.join(' / ')}`);
    } else {
      setListen(LISTEN_MESSAGES[result.kind]);
    }
  };

  const report = () => [
    `하루일본어 기기 확인 · ${new Date().toLocaleString('ko-KR')}`,
    `주소: ${location.href}`,
    ...(groups ?? []).flatMap(g => [`[${g.title}]`, ...g.rows.map(r => `- ${r.label}: ${r.value}${r.mark !== 'info' ? ` (${MARK_TEXT[r.mark]})` : ''}`)]),
    '[직접 해 본 시험]',
    `- 소리 시험(ねこ): ${sound}`,
    `- 말하기 시험(ねこ): ${listen}`,
  ].join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report());
      setCopied('결과를 복사했어요. 메시지나 메모에 붙여 넣어 보내 주세요.');
    } catch {
      setCopied('자동 복사가 막혀 있어요. 아래 글을 길게 눌러 직접 복사해 주세요.');
    }
  };

  return (
    <>
      <PageTitle eyebrow="DEVICE CHECK" heading="이 기기 확인"
        lead="이 브라우저에서 기록 저장·발음 듣기·말하기가 되는지 확인해요. 학습 기록은 바뀌지 않아요." />
      {!groups ? <p className="subtle" role="status">이 기기를 확인하는 중이에요…</p> : (
        <div className="check-groups">
          {groups.map(group => (
            <section key={group.title} className="settings-panel check-group" aria-label={group.title}>
              <h2>{group.title}</h2>
              <dl>
                {group.rows.map(row => (
                  <div key={row.label} className={`check-row mark-${row.mark}`}>
                    <dt>{row.label}</dt>
                    <dd>{row.mark !== 'info' && <span className="check-mark">{MARK_TEXT[row.mark]}</span>}{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="settings-panel check-group" aria-label="직접 해 보기">
            <h2>직접 해 보기</h2>
            <p>소리가 나는지, ‘ねこ’라고 말하면 알아듣는지 확인해요.</p>
            <div className="button-row">
              <SpeakButton id="check:sound" reading="ねこ" label="소리 시험 · ねこ"
                onPlay={() => setSound('재생됨(실제로 들렸는지 귀로 확인해 주세요)')} />
              <button className={`btn ${listening ? 'listening' : ''}`} type="button" aria-pressed={listening} onClick={() => void testListen()}>
                {listening ? '듣는 중 · 취소' : '말하기 시험 · ‘ねこ’라고 말하기'}
              </button>
            </div>
            <dl>
              <div className="check-row"><dt>소리 시험</dt><dd>{sound}</dd></div>
              <div className="check-row"><dt>말하기 시험</dt><dd role="status">{listen}</dd></div>
            </dl>
            <p className="subtle">소리가 안 들리면 음량과 무음 모드(iPhone 옆 스위치)를 확인해 주세요. 일본어 음성이 없으면 기기 설정에서 일본어 언어 팩을 추가해 주세요.</p>
          </section>
          <section className="settings-panel check-group" aria-label="결과 보내기">
            <h2>결과 보내기</h2>
            <button className="btn primary" type="button" onClick={() => void copy()}>결과 복사</button>
            <p className="settings-saved" role="status">{copied}</p>
            <textarea className="check-report" readOnly value={report()} aria-label="확인 결과" rows={12} />
          </section>
        </div>
      )}
    </>
  );
}
