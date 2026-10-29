import { useEffect, useRef, useState } from 'react';
import { backupFileName, makeBackup, MAX_BACKUP_BYTES, parseBackup, summarize, type BackupSummary } from '../storage/backup';
import type { Backup as BackupFile } from '../content/types';
import { useStorage } from '../storage/StorageProvider';

const time = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Counts = Omit<BackupSummary, 'exportedAt' | 'level' | 'dailyTarget'>;
const ROWS: [keyof Counts, string][] = [
  ['favorites', '즐겨찾기'], ['words', '복습 일정이 있는 단어'], ['days', '마친 학습일'], ['attempts', '답변 기록'], ['lastStudyDate', '마지막 학습일'],
];

/**
 * Backup on the settings screen (docs/03 §7): export everything to a file; import checks the whole
 * file, shows what it holds next to what is here, and replaces only when asked.
 */
export function BackupPanel() {
  const { settings, updateSettings, records } = useStorage();
  const store = records.status === 'ready' ? records.store : undefined;
  const [lastBackup, setLastBackup] = useState<string | undefined>();
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<{ backup: BackupFile; summary: BackupSummary; here: Counts } | undefined>();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const preview = useRef<HTMLElement>(null);

  useEffect(() => {
    store?.getMeta('lastBackupAt').then(v => setLastBackup(typeof v === 'string' ? v : undefined), () => {});
  }, [store]);

  useEffect(() => { if (pending) preview.current?.focus(); }, [pending]);

  const exportNow = async () => {
    if (!store) return;
    setErrors([]);
    try {
      const now = new Date();
      const name = backupFileName(now);
      download(name, JSON.stringify(makeBackup(settings, await store.exportRecords(), now), null, 1));
      await store.setMeta('lastBackupAt', now.toISOString()).catch(() => {});
      setLastBackup(now.toISOString());
      setStatus(`백업 파일 ${name}을(를) 내려받았어요.`);
    } catch {
      setErrors(['백업 파일을 만들지 못했어요. 다시 시도해 주세요.']);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file || !store) return;
    setStatus('');
    setErrors([]);
    setPending(undefined);
    if (file.size > MAX_BACKUP_BYTES) { setErrors(['파일이 너무 커요. 하루일본어 백업 파일이 맞는지 확인해 주세요.']); return; }
    const result = parseBackup(await file.text());
    if (!result.ok) { setErrors(result.errors); return; }
    setPending({ backup: result.backup, summary: result.summary, here: summarize(await store.exportRecords()) });
  };

  const apply = async () => {
    if (!store || !pending) return;
    setBusy(true);
    setErrors([]);
    try {
      await store.replaceRecords(pending.backup);
      updateSettings(pending.backup.settings);
      setStatus(`${time(pending.summary.exportedAt)}에 만든 백업으로 바꿨어요.`);
      setPending(undefined);
    } catch {
      setErrors(['백업을 적용하지 못했어요. 이 기기의 기록은 그대로예요.']);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => { setPending(undefined); setStatus('가져오기를 취소했어요. 이 기기의 기록은 그대로예요.'); };

  return (
    <div className="backup">
      <h3>백업 파일</h3>
      <p>
        기록을 파일로 내려받아 두면, 브라우저가 기록을 지우거나 다른 기기로 옮길 때 다시 불러올 수 있어요.
        {lastBackup ? ` 마지막 내보내기: ${time(lastBackup)}.` : ' 아직 내보낸 적이 없어요.'}
      </p>
      <div className="button-row backup-actions">
        <button className="btn" type="button" disabled={!store} onClick={() => void exportNow()}>기록 내보내기</button>
        <button className="btn" type="button" disabled={!store} onClick={() => fileInput.current?.click()}>백업 파일 가져오기</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden aria-label="백업 파일 선택"
          onChange={e => { void choose(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      <p className="settings-saved" role="status">{status}</p>
      {errors.length > 0 && (
        <div className="study-problem" role="alert">
          <strong>이 파일은 가져올 수 없어요. 이 기기의 기록은 그대로예요.</strong>
          <ul className="backup-errors">{errors.map(e => <li key={e}>{e}</li>)}</ul>
        </div>
      )}
      {pending && (
        <section ref={preview} tabIndex={-1} className="backup-preview" aria-label="가져올 백업 확인">
          <h3>가져올 백업 확인</h3>
          <p>{time(pending.summary.exportedAt)}에 만든 백업이에요. 학습 설정: {pending.summary.level} · 하루 {pending.summary.dailyTarget}장</p>
          <table>
            <thead><tr><th scope="col">항목</th><th scope="col">지금 이 기기</th><th scope="col">백업 파일</th></tr></thead>
            <tbody>
              {ROWS.map(([key, label]) => (
                <tr key={key}><th scope="row">{label}</th><td>{pending.here[key] ?? '없음'}</td><td>{pending.summary[key] ?? '없음'}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="storage-warning">적용하면 이 기기의 기록과 설정이 백업 내용으로 모두 바뀌어요. 두 기록이 합쳐지지는 않아요.</p>
          <div className="button-row">
            <button className="btn" type="button" disabled={busy} onClick={() => void exportNow()}>지금 기록 먼저 내보내기</button>
            <button className="btn primary" type="button" disabled={busy} onClick={() => void apply()}>이 백업으로 바꾸기</button>
            <button className="text-button" type="button" disabled={busy} onClick={cancel}>취소</button>
          </div>
        </section>
      )}
    </div>
  );
}
