import { useEffect, useState } from 'react';
import { api, fmtSize, fmtDate } from '../api.js';
import { DownloadButton, FilePicker, Progress, Msg, useAction, useUploader } from './common.jsx';

export const TEMPLATES = [
  { file: 'Predlozak-DOCX.docx', title: 'Predložak rada – Word (DOCX)', desc: 'Za pisanje u Microsoft Wordu / LibreOfficeu.' },
  { file: 'Predlozak-DOCX.pdf', title: 'Predložak rada – Word (PDF pregled)', desc: 'Kako predložak izgleda.' },
  { file: 'Predlozak-LaTeX.tex', title: 'Predložak rada – LaTeX (.tex)', desc: 'Za pisanje u LaTeX-u (npr. Overleaf).' },
  { file: 'Predlozak-LaTeX.pdf', title: 'Predložak rada – LaTeX (PDF pregled)', desc: 'Prevedeni LaTeX predložak.' },
  { file: 'Predlozak-obrana-diplomskog.pptx', title: 'Predložak prezentacije za obranu (PPTX)', desc: 'Prezentacija za obranu rada.' },
  { file: 'Predlozak-obrana-diplomskog.pdf', title: 'Predložak prezentacije za obranu (PDF)', desc: 'PDF pregled prezentacije.' },
];

function MaterialRow({ m, admin, students, onDelete }) {
  const target = m.studentEmail ? (students?.find((s) => s.email === m.studentEmail)?.name || m.studentEmail) : null;
  return (
    <li className="mat">
      <div>
        <b>{m.title}</b>
        {admin && <span className={`pill ${target ? '' : 'pill-all'}`}>{target ? `Samo: ${target}` : 'Svi studenti'}</span>}
        {!admin && m.studentEmail && <span className="pill">Za Vas</span>}
        {m.description && <div className="muted prewrap">{m.description}</div>}
        <div className="muted small">{fmtDate(m.createdAt)}{m.size ? ` · ${fmtSize(m.size)}` : ''}</div>
      </div>
      <div className="mat-actions">
        {m.fileId && <DownloadButton fileId={m.fileId} className="btn small">Preuzmi</DownloadButton>}
        {m.url && <a className="btn small" href={m.url} target="_blank" rel="noreferrer">Otvori</a>}
        {admin && <button className="btn small danger" onClick={() => onDelete(m)}>Obriši</button>}
      </div>
    </li>
  );
}

function AddMaterial({ students, onAdded, presetStudent }) {
  const [f, setF] = useState({ title: '', description: '', url: '', studentEmail: presetStudent || '' });
  const [file, setFile] = useState(null);
  const [key, setKey] = useState(0);
  const { progress, upload } = useUploader();
  const a = useAction();
  const submit = (e) => {
    e.preventDefault();
    a.run(async () => {
      const fileId = file ? await upload(file) : null;
      const m = await api('/materials', { method: 'POST', body: { ...f, fileId } });
      setF({ title: '', description: '', url: '', studentEmail: presetStudent || '' }); setFile(null); setKey((k) => k + 1);
      onAdded(m);
    }, 'Materijal dodan.');
  };
  return (
    <form className="card form" onSubmit={submit} key={key}>
      <h3>Dodaj materijal</h3>
      <div className="grid2">
        <label>Naslov<input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        {!presetStudent && (
          <label>Vidljivo
            <select value={f.studentEmail} onChange={(e) => setF({ ...f, studentEmail: e.target.value })}>
              <option value="">Svi studenti</option>
              {students?.map((s) => <option key={s.email} value={s.email}>{s.name} ({s.email})</option>)}
            </select>
          </label>
        )}
      </div>
      <label>Opis<textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
      <div className="grid2">
        <FilePicker file={file} setFile={setFile} label="Datoteka" />
        <label>ili poveznica (URL)<input type="url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></label>
      </div>
      <Progress value={progress} />
      <Msg error={a.error} ok={a.ok} />
      <button className="btn primary" disabled={a.busy}>{a.busy ? 'Spremanje…' : 'Dodaj'}</button>
    </form>
  );
}

export default function Materials({ admin, students, onlyStudent }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const load = () => api('/materials').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const del = async (m) => {
    if (!confirm(`Obrisati „${m.title}”?`)) return;
    await api(`/materials/${m.id}`, { method: 'DELETE' }).catch((e) => alert(e.message));
    load();
  };
  const shown = (items || []).filter((m) => !onlyStudent || m.studentEmail === onlyStudent);

  if (onlyStudent) {
    return (
      <div>
        {shown.length ? <ul className="mats">{shown.map((m) => <MaterialRow key={m.id} m={m} admin students={students} onDelete={del} />)}</ul>
          : <p className="muted">Nema individualnih materijala.</p>}
        <AddMaterial students={students} presetStudent={onlyStudent} onAdded={load} />
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card">
        <h2>Predlošci</h2>
        <p className="muted">Službeni predlošci za pisanje rada i prezentaciju obrane.</p>
        <ul className="mats">
          {TEMPLATES.map((t) => (
            <li className="mat" key={t.file}>
              <div><b>{t.title}</b><div className="muted">{t.desc}</div></div>
              <div className="mat-actions"><a className="btn small" href={`/predlosci/${t.file}`} download>Preuzmi</a></div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card">
        <h2>{admin ? 'Svi materijali' : 'Materijali'}</h2>
        {error && <Msg error={error} />}
        {items === null ? <p className="muted">Učitavanje…</p>
          : shown.length ? <ul className="mats">{shown.map((m) => <MaterialRow key={m.id} m={m} admin={admin} students={students} onDelete={del} />)}</ul>
            : <p className="muted">{admin ? 'Još nema materijala.' : 'Mentor još nije dodao dodatne materijale. Ako Vam nešto treba, javite se.'}</p>}
      </section>
      {admin && <AddMaterial students={students} onAdded={load} />}
    </div>
  );
}
