import { useState } from 'react';
import { STATUSES, statusIndex, statusLabel } from '../../shared/statuses.js';
import { uploadFile, downloadFile, fmtDateTime } from '../api.js';

export function StatusBadge({ status }) {
  const i = statusIndex(status);
  return <span className={`badge st-${i}`}>{statusLabel(status)}</span>;
}

export function StatusStepper({ status, history = [] }) {
  const cur = statusIndex(status);
  const reachedAt = {};
  for (const h of history) reachedAt[h.status] = h.at;
  return (
    <ol className="stepper">
      {STATUSES.map((s, i) => (
        <li key={s.key} className={i < cur ? 'done' : i === cur ? 'current' : ''}>
          <span className="dot">{i < cur ? '✓' : i + 1}</span>
          <div>
            <div className="step-label">{s.label}</div>
            {i === cur && <div className="step-hint">{s.hint}</div>}
            {i <= cur && reachedAt[s.key] && <div className="step-date">{fmtDateTime(reachedAt[s.key])}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TopicView({ topic, empty = 'Tema još nije zadana.' }) {
  const [lang, setLang] = useState('hr');
  if (!topic) return <p className="muted">{empty}</p>;
  const title = lang === 'hr' ? topic.titleHr : topic.titleEn;
  const desc = lang === 'hr' ? topic.descriptionHr : topic.descriptionEn;
  return (
    <div className="topic">
      <div className="seg">
        <button className={lang === 'hr' ? 'on' : ''} onClick={() => setLang('hr')}>Hrvatski</button>
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
      </div>
      <h3 className="topic-title">{title || <span className="muted">(nije uneseno)</span>}</h3>
      {desc ? <p className="prewrap">{desc}</p> : <p className="muted">{lang === 'hr' ? 'Opis nije unesen.' : 'No description provided.'}</p>}
    </div>
  );
}

export function TopicFields({ value, onChange, labels = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid2">
      <label>Naslov (HR)<input value={value.titleHr || ''} onChange={set('titleHr')} /></label>
      <label>Title (EN)<input value={value.titleEn || ''} onChange={set('titleEn')} /></label>
      <label>{labels.descHr || 'Opis (HR)'}<textarea rows={7} value={value.descriptionHr || ''} onChange={set('descriptionHr')} /></label>
      <label>{labels.descEn || 'Description (EN)'}<textarea rows={7} value={value.descriptionEn || ''} onChange={set('descriptionEn')} /></label>
    </div>
  );
}

// Odabir + učitavanje datoteke; vraća fileId preko onUploaded.
export function FilePicker({ file, setFile, accept, label = 'Datoteka' }) {
  return (
    <label className="file-picker">
      {label}
      <input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {file && <span className="muted small">{file.name}</span>}
    </label>
  );
}

export function useUploader() {
  const [progress, setProgress] = useState(null);
  const upload = async (file) => {
    setProgress(0);
    try { return await uploadFile(file, setProgress); } finally { setProgress(null); }
  };
  return { progress, upload };
}

export function Progress({ value }) {
  if (value == null) return null;
  return <div className="progress"><div style={{ width: `${Math.round(value * 100)}%` }} /></div>;
}

export function DownloadButton({ fileId, children, className = 'link' }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <>
      <button className={className} disabled={busy} onClick={async () => {
        setBusy(true); setErr('');
        try { await downloadFile(fileId); } catch (e) { setErr(e.message); } finally { setBusy(false); }
      }}>{busy ? 'Preuzimanje…' : children}</button>
      {err && <span className="error small"> {err}</span>}
    </>
  );
}

export function Msg({ error, ok }) {
  if (error) return <div className="alert error">{error}</div>;
  if (ok) return <div className="alert ok">{ok}</div>;
  return null;
}

// Pomoćnik za async akcije s porukom o grešci/uspjehu.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const run = async (fn, okMsg) => {
    setBusy(true); setError(''); setOk('');
    try { const r = await fn(); if (okMsg) setOk(okMsg); return r; }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return { busy, error, ok, run, setOk, setError };
}
