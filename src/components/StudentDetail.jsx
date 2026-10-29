import { useState } from 'react';
import { api, fmtDate, fmtDateTime } from '../api.js';
import { STATUSES, STUDY_TYPES, statusLabel, MIN_DAYS_BEFORE_DEFENSE } from '../../shared/statuses.js';
import { StatusStepper, StatusBadge, TopicView, TopicFields, FilePicker, Progress, DownloadButton, Msg, useAction, useUploader } from './common.jsx';
import { UploadList } from './StudentDashboard.jsx';
import Materials from './Materials.jsx';
import Reports from './Reports.jsx';

const enc = encodeURIComponent;

function FeedbackForm({ student, upload, onSaved }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(upload.feedback || '');
  const [file, setFile] = useState(null);
  const up = useUploader();
  const a = useAction();
  if (!open) return <button className="link small" onClick={() => setOpen(true)}>{upload.feedbackAt ? 'Uredi povratnu informaciju' : '+ Povratna informacija'}</button>;
  return (
    <form className="form feedback-form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => {
        const feedbackFileId = file ? await up.upload(file) : null;
        onSaved(await api(`/students/${enc(student.email)}/uploads/${upload.id}`, { method: 'POST', body: { feedback: text, feedbackFileId } }));
        setOpen(false);
      });
    }}>
      <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Komentar studentu…" />
      <FilePicker file={file} setFile={setFile} label="Datoteka s komentarima (neobavezno)" />
      <Progress value={up.progress} />
      <Msg error={a.error} />
      <div className="row">
        <button className="btn primary small" disabled={a.busy}>Spremi i obavijesti studenta</button>
        <button type="button" className="btn small" onClick={() => setOpen(false)}>Odustani</button>
      </div>
    </form>
  );
}

// Osnovni podaci studenta; otvara se gumbom „Uredi podatke” u zaglavlju.
function ProfileForm({ s, path, onSaved, onCancel }) {
  const [f, setF] = useState({
    name: s.name || '', aliases: (s.aliases || []).join(', '), jmbag: s.jmbag || '', type: s.type, program: s.program || '',
    desiredDefenseDate: s.desiredDefenseDate || '', githubUrl: s.githubUrl || '', studyMode: s.studyMode || '', course: s.course || '',
  });
  const a = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      a.run(async () => onSaved(await api(path, { method: 'PATCH', body: { ...f, aliases: f.aliases.split(/[\s,;]+/).filter(Boolean) } })));
    }}>
      <div className="grid2">
        <label>Ime i prezime<input required value={f.name} onChange={set('name')} /></label>
        <label>Email (primarni)<input value={s.email} disabled /></label>
        <label>Alternativni emailovi (odvojeni zarezom) – prijava s njima otvara isti račun
          <input value={f.aliases} onChange={set('aliases')} placeholder="npr. ihorvat@student.unipu.hr" /></label>
        <label>JMBAG<input value={f.jmbag} onChange={set('jmbag')} /></label>
        <label>Vrsta rada<select value={f.type} onChange={set('type')}>{Object.entries(STUDY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Status studenta<select value={f.studyMode} onChange={set('studyMode')}>
          <option value="">—</option><option value="redoviti">Redoviti</option><option value="izvanredni">Izvanredni</option>
        </select></label>
        <label>Studij<input list="programs" value={f.program} onChange={set('program')} /></label>
        <datalist id="programs"><option value="Informatika" /><option value="Nastavni smjer informatike" /></datalist>
        <label>Kolegij (za obrazac prijave teme)<input value={f.course} onChange={set('course')} /></label>
        <label>Željeni datum obrane<input type="date" value={f.desiredDefenseDate} onChange={set('desiredDefenseDate')} /></label>
        <label>GitHub repozitorij<input value={f.githubUrl} onChange={set('githubUrl')} placeholder="https://github.com/korisnik/repozitorij" /></label>
      </div>
      <p className="muted small">Naslov i opis rada uređuju se u kartici „Zadana tema” (gumb „Samo spremi” ne šalje obavijest).</p>
      <Msg error={a.error} />
      <div className="row">
        <button className="btn primary" disabled={a.busy}>Spremi podatke</button>
        <button type="button" className="btn" onClick={onCancel}>Odustani</button>
      </div>
    </form>
  );
}

// Preuzima obrazac prijave teme popunjen podacima studenta.
async function downloadPrijava(s) {
  const buf = await api(`/students/${enc(s.email)}/prijava`);
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `Prijava-teme-${s.name}.docx` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function ManualApplication({ s, path, onSaved }) {
  const a = useAction();
  return (
    <div className="stack manual-app">
      <label className="check"><input type="checkbox" checked={Boolean(s.manualApplication)} disabled={a.busy}
        onChange={(e) => a.run(async () => onSaved(await api(path, { method: 'PATCH', body: { manualApplication: e.target.checked } })))} /> Potrebna ručna prijava</label>
      <button className={`btn small ${s.manualApplication ? 'primary' : ''}`} disabled={a.busy}
        onClick={() => a.run(() => downloadPrijava(s))}>Obrazac prijave teme (.docx)</button>
      <a className="small" href="/predlosci/Obrazac-prijava-teme.docx" download>prazan obrazac</a>
      <Msg error={a.error} />
    </div>
  );
}

export default function StudentDetail({ student: initial, students, onBack, onChange }) {
  const [s, setS] = useState(initial);
  const update = (next) => { setS(next); onChange(next); };
  const path = `/students/${enc(s.email)}`;

  const [status, setStatus] = useState(s.status);
  const [statusNote, setStatusNote] = useState('');
  const [notify, setNotify] = useState(true);
  const st = useAction();

  const [topic, setTopic] = useState(s.topic || { titleHr: '', titleEn: '', descriptionHr: '', descriptionEn: '' });
  const [topicNote, setTopicNote] = useState('');
  const tp = useAction();

  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState({ adminMessage: s.adminMessage, notes: s.notes });
  const [notifyMsg, setNotifyMsg] = useState(false);
  const inf = useAction();
  const setI = (k) => (e) => setInfo({ ...info, [k]: e.target.value });

  const del = async () => {
    if (!confirm(`Trajno obrisati studenta ${s.name} i sve njegove datoteke?`)) return;
    await api(path, { method: 'DELETE' });
    onChange(null, s.email); onBack();
  };

  return (
    <div className="stack">
      <div className="row between">
        <button className="link" onClick={onBack}>← Svi studenti</button>
        <button className="btn small danger" onClick={del}>Obriši studenta</button>
      </div>
      {editing ? (
        <section className="card">
          <h2>Uredi podatke – {s.name}</h2>
          <ProfileForm s={s} path={path} onSaved={(next) => { update(next); setEditing(false); }} onCancel={() => setEditing(false)} />
        </section>
      ) : (
      <div className="card detail-head">
        <div>
          <h2 style={{ margin: 0 }}>{s.name}</h2>
          <div className="muted">{s.email}{s.aliases?.length > 0 && ` (i ${s.aliases.join(', ')})`}{s.jmbag && ` · JMBAG ${s.jmbag}`} · {STUDY_TYPES[s.type]}{s.program && ` · ${s.program}`}</div>
          {s.githubUrl && <div className="small">GitHub: <a href={s.githubUrl} target="_blank" rel="noreferrer">{s.githubUrl.replace('https://github.com/', '')}</a></div>}
          {s.desiredDefenseDate && <div className="small">Željeni datum obrane: <b>{fmtDate(s.desiredDefenseDate)}</b> (konačna verzija do {fmtDate(new Date(new Date(s.desiredDefenseDate) - MIN_DAYS_BEFORE_DEFENSE * 86400000).toISOString())})</div>}
        </div>
        <div className="stack detail-head-side">
          <StatusBadge status={s.status} />
          <button className="btn small" onClick={() => setEditing(true)}>Uredi podatke</button>
          <ManualApplication s={s} path={path} onSaved={update} />
        </div>
      </div>
      )}

      <div className="cols">
        <section className="card form">
          <h2>Status</h2>
          <StatusStepper status={s.status} history={s.history} />
          <h3>Postavi / pregazi status</h3>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <textarea rows={2} placeholder="Napomena studentu (ide u mail i povijest)…" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          <label className="check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Obavijesti studenta emailom</label>
          <Msg error={st.error} ok={st.ok} />
          <button className="btn primary" disabled={st.busy} onClick={() => st.run(async () => {
            update(await api(`${path}/status`, { method: 'POST', body: { status, note: statusNote, notify } }));
            setStatusNote('');
          }, 'Status postavljen.')}>Postavi status</button>
        </section>

        <div className="stack">
          {s.proposal && (
            <section className="card">
              <h2>Prijedlog studenta <span className="muted small">{fmtDateTime(s.proposal.submittedAt)}</span></h2>
              <TopicView topic={s.proposal} />
              <div className="row">
                {s.proposal.fileId && <DownloadButton fileId={s.proposal.fileId} className="btn small">Preuzmi prilog</DownloadButton>}
                <button className="btn small" onClick={() => setTopic({ titleHr: s.proposal.titleHr, titleEn: s.proposal.titleEn, descriptionHr: s.proposal.descriptionHr, descriptionEn: s.proposal.descriptionEn })}>Kopiraj u temu ↓</button>
              </div>
            </section>
          )}
          <section className="card form">
            <h2>Zadana tema</h2>
            <TopicFields value={topic} onChange={setTopic} />
            <textarea rows={2} placeholder="Napomena uz temu (neobavezno, ide u mail)…" value={topicNote} onChange={(e) => setTopicNote(e.target.value)} />
            <Msg error={tp.error} ok={tp.ok} />
            <div className="row">
              <button className="btn primary" disabled={tp.busy} onClick={() => tp.run(async () => update(await api(`${path}/assign-topic`, { method: 'POST', body: { ...topic, note: topicNote } })), 'Tema zadana, student obaviješten.')}>
                Zadaj temu i obavijesti
              </button>
              <button className="btn" disabled={tp.busy} onClick={() => tp.run(async () => update(await api(`${path}/assign-topic`, { method: 'POST', body: { ...topic, note: topicNote, notify: false } })), 'Tema zadana (bez obavijesti studentu).')}>
                Zadaj temu bez obavijesti
              </button>
              <button className="btn" disabled={tp.busy} onClick={() => tp.run(async () => update(await api(path, { method: 'PATCH', body: { topic } })), 'Spremljeno (bez obavijesti i promjene statusa).')}>
                Samo spremi
              </button>
            </div>
          </section>
        </div>
      </div>

      <section className="card">
        <h2>Predaje</h2>
        <UploadList uploads={s.uploads} admin renderFeedbackForm={(u) => <FeedbackForm student={s} upload={u} onSaved={update} />} />
      </section>

      <section className={`card ${s.status === 'ocjenjivanje_komisija' ? 'card-highlight' : ''}`}>
        <h2>Izvještaji komisije</h2>
        <Reports student={s} />
      </section>

      <div className="cols">
        <section className="card form">
          <h2>Poruka i bilješke</h2>
          <label>Poruka studentu (prikazuje se na vrhu njegove stranice)<textarea rows={3} value={info.adminMessage} onChange={setI('adminMessage')} /></label>
          <label className="check"><input type="checkbox" checked={notifyMsg} onChange={(e) => setNotifyMsg(e.target.checked)} /> Pošalji poruku i emailom</label>
          <label>Privatne bilješke (student ih ne vidi)<textarea rows={3} value={info.notes} onChange={setI('notes')} /></label>
          <Msg error={inf.error} ok={inf.ok} />
          <button className="btn primary" disabled={inf.busy} onClick={() => inf.run(async () => { update(await api(path, { method: 'PATCH', body: { ...info, notifyMessage: notifyMsg } })); setNotifyMsg(false); }, 'Spremljeno.')}>Spremi</button>
        </section>
        <section className="card">
          <h2>Individualni materijali</h2>
          <Materials admin students={students} onlyStudent={s.email} />
        </section>
      </div>

      <section className="card">
        <h2>Povijest</h2>
        <table className="table compact">
          <tbody>
            {[...(s.history || [])].reverse().map((h, i) => (
              <tr key={i}><td className="nowrap muted">{fmtDateTime(h.at)}</td><td><b>{statusLabel(h.status)}</b></td><td className="muted">{h.by}</td><td className="prewrap">{h.note}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
