import { useEffect, useState } from 'react';
import { api, fmtDateTime } from '../api.js';
import { FilePicker, Progress, Msg, useAction, useUploader } from './common.jsx';

const enc = encodeURIComponent;
const shareUrl = (r) => `${window.location.origin}/potpis/${r.token}`;
const pdfUrl = (r) => `/api/public/r/${r.token}/pdf`;

function ReportRow({ r, onChange, onDelete }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareUrl(r)); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { prompt('Kopirajte poveznicu:', shareUrl(r)); }
  };
  const removeSig = async (sig) => {
    if (!confirm(`Ukloniti potpis: ${sig.name}?`)) return;
    try { onChange(await api(`/reports/${r.id}/signatures/${sig.id}`, { method: 'DELETE' })); } catch (e) { alert(e.message); }
  };
  return (
    <li className="mat report">
      <div>
        <b>{r.title}</b>
        <span className={`pill ${r.signatures?.length ? 'pill-final' : 'pill-all'}`}>
          {r.signatures?.length ? `Potpisa: ${r.signatures.length}` : 'Nije potpisan'}
        </span>
        <div className="muted small">{r.fileName} · učitano {fmtDateTime(r.createdAt)}</div>
        {r.signatures?.length > 0 && (
          <ul className="sig-list">
            {r.signatures.map((s) => (
              <li key={s.id}>✍ {s.name} <span className="muted small">· {fmtDateTime(s.at)}</span>{' '}
                <button className="link small" onClick={() => removeSig(s)}>ukloni</button></li>
            ))}
          </ul>
        )}
        <div className="share-url small"><code>{shareUrl(r)}</code></div>
      </div>
      <div className="mat-actions wrap-actions">
        <button className="btn small primary" onClick={copy}>{copied ? 'Kopirano ✓' : 'Kopiraj link'}</button>
        <a className="btn small" href={`/potpis/${r.token}`} target="_blank" rel="noreferrer">Otvori</a>
        <a className="btn small" href={pdfUrl(r)} target="_blank" rel="noreferrer">PDF{r.signatures?.length ? ' (potpisani)' : ''}</a>
        <button className="btn small danger" onClick={() => onDelete(r)}>Obriši</button>
      </div>
    </li>
  );
}

export default function Reports({ student }) {
  const path = `/students/${enc(student.email)}/reports`;
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState('Izvještaj povjerenstva');
  const [file, setFile] = useState(null);
  const [key, setKey] = useState(0);
  const { progress, upload } = useUploader();
  const a = useAction();
  const load = () => api(path).then(setItems).catch((e) => a.setError(e.message));
  useEffect(() => { load(); }, [student.email]);

  const submit = (e) => {
    e.preventDefault();
    if (!file) return a.setError('Odaberite PDF izvještaja.');
    a.run(async () => {
      const fileId = await upload(file);
      await api(path, { method: 'POST', body: { fileId, title } });
      setFile(null); setKey((k) => k + 1); load();
    }, 'Izvještaj učitan – kopirajte link i pošaljite ga članovima povjerenstva.');
  };
  const del = async (r) => {
    if (!confirm(`Obrisati izvještaj „${r.title}” i sve potpise? Dijeljeni link prestaje raditi.`)) return;
    try { await api(`/reports/${r.id}`, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); }
  };

  return (
    <div className="stack">
      <p className="muted small" style={{ margin: 0 }}>
        Jednostrani PDF izvještaja. Svaki izvještaj dobiva javni link (bez prijave) na kojem se izvještaj potpisuje;
        na stranici su i GitHub repozitorij te predani rad. O svakom potpisu dobivate email.
      </p>
      {items === null ? <p className="muted">Učitavanje…</p>
        : items.length ? <ul className="mats">{items.map((r) => <ReportRow key={r.id} r={r} onDelete={del} onChange={(n) => setItems(items.map((x) => (x.id === n.id ? n : x)))} />)}</ul>
          : <p className="muted">Još nema izvještaja.</p>}
      <form className="form report-form" onSubmit={submit} key={key}>
        <div className="grid2">
          <label>Naziv<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <FilePicker file={file} setFile={setFile} accept="application/pdf,.pdf" label="PDF izvještaja (1 stranica)" />
        </div>
        <Progress value={progress} />
        <Msg error={a.error} ok={a.ok} />
        <button className="btn primary" disabled={a.busy}>{a.busy ? 'Učitavanje…' : 'Učitaj izvještaj'}</button>
      </form>
    </div>
  );
}
