import { useId, useMemo, useState } from 'react';
import { Icon } from '../art/icons';
import { type DailyTarget, type Level, type Settings as SettingsValue, type SpeechRate } from '../content/types';
import { LEVELS } from '../levels';
import { useStorage } from '../storage/StorageProvider';
import { DAILY_TARGETS, deviceTimeZone, SPEECH_RATES } from '../storage/settings';
import { PageTitle } from './PageTitle';

const RATE_LABELS: Record<SpeechRate, string> = { 0.7: '천천히', 0.85: '조금 천천히', 1: '기본 속도' };
const COMMON_ZONES = ['Asia/Seoul', 'Asia/Tokyo', 'UTC'];

function timeZones(current: string): string[] {
  let zones: string[] = [];
  try { zones = Intl.supportedValuesOf('timeZone'); } catch { /* older browsers: offer the common ones */ }
  const all = new Set([...COMMON_ZONES, ...zones]);
  if (current !== 'auto') all.add(current);
  return [...COMMON_ZONES, ...[...all].filter(z => !COMMON_ZONES.includes(z)).sort()];
}

function RecordsStatus() {
  const { records } = useStorage();
  if (records.status === 'opening') return <p role="status">기록 저장소를 여는 중이에요…</p>;
  if (!records.store.durable) {
    return <p className="storage-warning">이 브라우저가 기록 저장을 막고 있어요. 이번 방문의 기록은 창을 닫으면 사라져요.</p>;
  }
  return (
    <>
      <div className="connection">이 기기의 브라우저에 저장하고 있어요.</div>
      <p>
        {records.persistence === 'granted'
          ? '브라우저가 저장 공간이 부족해도 기록을 지우지 않도록 보호하고 있어요.'
          : '저장 공간이 부족하거나, iPhone Safari처럼 오래 방문하지 않으면 브라우저가 기록을 지울 수 있어요. 기록을 파일로 따로 보관하는 백업은 준비 중이에요.'}
      </p>
    </>
  );
}

export function Settings() {
  const { settings, updateSettings, settingsSaved } = useStorage();
  const [saved, setSaved] = useState('');
  const ids = { level: useId(), zone: useId(), rate: useId(), romaji: useId(), target: useId() };
  const zones = useMemo(() => timeZones(settings.timeZone), [settings.timeZone]);

  const change = (patch: Partial<SettingsValue>, message: string) => {
    updateSettings(patch);
    setSaved(message);
  };

  return (
    <>
      <PageTitle eyebrow="AT YOUR OWN PACE" heading="나에게 맞는 학습 설정." lead="꾸준히 이어 갈 수 있는 속도를 찾아보세요." />
      <p className="settings-saved" role="status">{settingsSaved && saved ? `${saved} 이 기기에 저장했어요.` : ''}</p>
      <div className="settings-grid">
        <section className="settings-panel" aria-labelledby="settings-study">
          <div className="panel-heading">
            <span className="panel-icon"><Icon name="cards" /></span>
            <div><h2 id="settings-study">나의 학습</h2><p>나에게 맞는 시작점을 정해요.</p></div>
          </div>
          <div className="field">
            <label htmlFor={ids.level}>학습 수준</label>
            <select id={ids.level} value={settings.level}
              onChange={e => change({ level: e.target.value as Level }, `학습 수준을 ${e.target.value}(으)로 바꿨어요.`)}>
              {LEVELS.map(l => (
                <option key={l.id} value={l.id}>{l.id} · {l.label} — {l.description}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <span id={ids.target} className="field-label">하루 카드 수</span>
            <div className="segmented" role="group" aria-labelledby={ids.target}>
              {DAILY_TARGETS.map(n => (
                <button key={n} type="button" className={`segment ${settings.dailyTarget === n ? 'active' : ''}`}
                  aria-pressed={settings.dailyTarget === n}
                  onClick={() => change({ dailyTarget: n as DailyTarget }, `하루 목표를 ${n}장으로 바꿨어요.`)}>
                  {n}장
                </button>
              ))}
            </div>
          </div>
          <p>오늘 이미 시작한 학습은 시작할 때의 설정 그대로 이어 가고, 바꾼 수준과 목표는 다음 학습일부터 적용해요.</p>
          <div className="field">
            <label htmlFor={ids.zone}>학습일 기준 시간대</label>
            <select id={ids.zone} value={settings.timeZone}
              onChange={e => change({ timeZone: e.target.value }, '학습일 기준 시간대를 바꿨어요.')}>
              <option value="auto">기기 시간대 따르기 ({deviceTimeZone()})</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <small className="subtle">이 시간대의 자정에 새 학습일이 시작돼요.</small>
          </div>
        </section>

        <section className="settings-panel" aria-labelledby="settings-reading">
          <div className="panel-heading">
            <span className="panel-icon"><Icon name="sound" /></span>
            <div><h2 id="settings-reading">읽기와 소리</h2><p>편안하게 읽고 들을 수 있도록.</p></div>
          </div>
          <label className="setting-switch" htmlFor={ids.romaji}>
            <span>로마자 함께 보기<small className="subtle" style={{ display: 'block' }}>히라가나 아래에 보조 표기</small></span>
            <input id={ids.romaji} type="checkbox" checked={settings.showRomaji}
              onChange={e => change({ showRomaji: e.target.checked }, `로마자 보조 표기를 ${e.target.checked ? '켰어요' : '껐어요'}.`)} />
          </label>
          <div className="field">
            <label htmlFor={ids.rate}>발음 재생 속도</label>
            <select id={ids.rate} value={settings.speechRate}
              onChange={e => change({ speechRate: Number(e.target.value) as SpeechRate }, '발음 재생 속도를 바꿨어요.')}>
              {SPEECH_RATES.map(r => <option key={r} value={r}>{RATE_LABELS[r]}</option>)}
            </select>
          </div>
          <p>발음 듣기는 다음 단계에서 연결해요. 고른 속도는 미리 저장해 둬요.</p>

          <h2 className="settings-records">내 학습 기록</h2>
          <RecordsStatus />
          <p>기록은 기기마다 따로 저장돼요. PC와 휴대폰의 기록이 자동으로 합쳐지지는 않아요.</p>
        </section>
      </div>
    </>
  );
}
