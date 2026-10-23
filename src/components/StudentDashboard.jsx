import { useEffect, useState } from 'react';
import { api, fmtDate, fmtDateTime, fmtSize } from '../api.js';
import { statusIndex, STUDY_TYPES, MIN_DAYS_BEFORE_DEFENSE } from '../../shared/statuses.js';
import { StatusStepper, StatusBadge, TopicView, TopicFields, FilePicker, Progress, DownloadButton, Msg, useAction, useUploader } from './common.jsx';
import Materials from './Materials.jsx';
import Guide from './Guide.jsx';

const GITHUB_RE = /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+(\/.*)?$/;

const TABS = [
  ['work', 'Moj rad'],
  ['upload', 'Predaja rada'],
  ['materials', 'Predlošci i materijali'],
  ['guide', 'Upute i rokovi'],
];

function daysUntil(date) {
  return date ? Math.ceil((new Date(date) - new Date(new Date().toDateString())) / 86400000) : null;
}

function Proposal({ student, setStudent }) {
  const [t, setT] = useState(student.proposal || { titleHr: '', titleEn: '', descriptionHr: '', descriptionEn: '' });
  const [file, setFile] = useState(null);
  const { progress, upload } = useUploader();
  const a = useAction();
  const submit = (e) => {
    e.preventDefault();
    a.run(async () => {
      const fileId = file ? await upload(file) : null;
      setStudent(await api('/me/proposal', { method: 'POST', body: { ...t, fileId } }));
      setFile(null);
    }, 'Prijedlog je poslan mentoru.');
  };
  return (
    <form className="form" onSubmit={submit}>
      <p className="muted">
        {student.proposal
          ? `Prijedlog poslan ${fmtDateTime(student.proposal.submittedAt)}. Možete ga izmijeniti i ponovno poslati.`
          : 'Unesite prijedlog teme (naslov na hrvatskom i engleskom, kratak opis problema, okvirnu strukturu i literaturu). Možete priložiti i datoteku.'}
      </p>
      <TopicFields value={t} onChange={setT} labels={{ descHr: 'Opis, struktura i literatura (HR)', descEn: 'Description (EN, optional)' }} />
      <FilePicker file={file} setFile={setFile} label="Prilog (neobavezno)" accept=".pdf,.docx,.doc,.tex,.md,.zip" />
      <Progress value={progress} />
      <Msg error={a.error} ok={a.ok} />
      <button className="btn primary" disabled={a.busy}>{a.busy ? 'Slanje…' : student.proposal ? 'Pošalji izmijenjeni prijedlog' : 'Pošalji prijedlog teme'}</button>
    </form>
  );
}

function Work({ student, setStudent }) {
  const a = useAction();
  const p = useAction();
  const [jmbag, setJmbag] = useState(student.jmbag || '');
  const [defense, setDefense] = useState(student.desiredDefenseDate || '');
  const idx = statusIndex(student.status);
  const days = daysUntil(student.desiredDefenseDate);
  const finalSubmitted = (student.uploads || []).some((u) => u.kind === 'final');

  return (
    <div className="stack">
      {student.adminMessage && (
        <div className="alert info"><b>Poruka mentora:</b><div className="prewrap">{student.adminMessage}</div></div>
      )}
      <div className="cols">
        <section className="card">
          <h2>Status rada</h2>
          <StatusStepper status={student.status} history={student.history} />
        </section>
        <div className="stack">
          <section className="card">
            <h2>Tema rada</h2>
            {student.topic ? (
              <>
                <TopicView topic={student.topic} />
                {idx === statusIndex('tema_zadana') && !student.topicAcceptedAt && (
                  <div className="alert warn">
                    Tema je zadana. Odaberite temu, mentora i predmet u <b>Studomatu</b> (Završetak studija), a zatim potvrdite ovdje.
                    <div style={{ marginTop: 10 }}>
                      <button className="btn primary" disabled={a.busy} onClick={() => a.run(async () => setStudent(await api('/me/accept-topic', { method: 'POST', body: {} })))}>
                        Potvrđujem odabir teme
                      </button>
                    </div>
                    <Msg error={a.error} />
                  </div>
                )}
                {student.topicAcceptedAt && <p className="muted small">Odabir teme potvrđen {fmtDate(student.topicAcceptedAt)}</p>}
              </>
            ) : idx <= statusIndex('prijedlog_teme') ? (
              <Proposal student={student} setStudent={setStudent} />
            ) : <p className="muted">Tema još nije unesena.</p>}
          </section>

          <section className="card form">
            <h2>Podaci</h2>
            <div className="kv"><span>Ime</span><b>{student.name}</b></div>
            <div className="kv"><span>Email</span><b>{student.email}</b></div>
            <div className="kv"><span>Vrsta rada</span><b>{STUDY_TYPES[student.type]}</b></div>
            {student.program && <div className="kv"><span>Studij</span><b>{student.program}</b></div>}
            <div className="grid2">
              <label>JMBAG<input value={jmbag} onChange={(e) => setJmbag(e.target.value)} /></label>
              <label>Željeni datum obrane<input type="date" value={defense} onChange={(e) => setDefense(e.target.value)} /></label>
            </div>
            {days != null && !finalSubmitted && (
              days < MIN_DAYS_BEFORE_DEFENSE
                ? <div className="alert error">Do željenog datuma obrane ostalo je {days} dana – konačna verzija morala je biti predana najmanje {MIN_DAYS_BEFORE_DEFENSE} dana prije. Javite se mentoru.</div>
                : <div className="alert warn">Konačnu verziju predajte najkasnije <b>{fmtDate(new Date(new Date(student.desiredDefenseDate) - MIN_DAYS_BEFORE_DEFENSE * 86400000).toISOString())}</b> (2 tjedna prije obrane). Ovisno o stanju rada, ispravci mogu trajati i dulje – predajte ranije.</div>
            )}
            <Msg error={p.error} ok={p.ok} />
            <button className="btn" disabled={p.busy} onClick={() => p.run(async () => setStudent(await api('/me/profile', { method: 'PATCH', body: { jmbag, desiredDefenseDate: defense } })), 'Spremljeno.')}>Spremi</button>
          </section>
        </div>
      </div>
    </div>
  );
}

export function UploadList({ uploads, admin, renderFeedbackForm }) {
  if (!uploads?.length) return <p className="muted">Još nema predanih datoteka.</p>;
  return (
    <ul className="uploads">
      {uploads.map((u) => (
        <li key={u.id} className={`upload ${u.kind}`}>
          <div className="upload-head">
            <span className={`pill ${u.kind === 'final' ? 'pill-final' : ''}`}>{u.kind === 'final' ? 'Konačna verzija' : 'Na pregled'}</span>
            <b>{u.name}</b>
            <span className="muted small">{fmtDateTime(u.at)} · {fmtSize(u.size)}</span>
            <DownloadButton fileId={u.fileId} className="btn small">Preuzmi</DownloadButton>
          </div>
          {u.githubUrl && <div className="small"><span className="muted">GitHub:</span> <a href={u.githubUrl} target="_blank" rel="noreferrer">{u.githubUrl.replace('https://github.com/', '')}</a></div>}
          {u.note && <div className="prewrap small"><span className="muted">{admin ? 'Poruka studenta:' : 'Vaša poruka:'}</span> {u.note}</div>}
          {(u.feedback || u.feedbackFileId) ? (
            <div className="feedback">
              <div className="muted small">Povratna informacija mentora · {fmtDateTime(u.feedbackAt)}</div>
              {u.feedback && <div className="prewrap">{u.feedback}</div>}
              {u.feedbackFileId && <DownloadButton fileId={u.feedbackFileId}>📎 {u.feedbackFileName}</DownloadButton>}
            </div>
          ) : !admin && <div className="muted small">Čeka pregled mentora.</div>}
          {admin && renderFeedbackForm?.(u)}
        </li>
      ))}
    </ul>
  );
}

function Upload({ student, setStudent }) {
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState('draft');
  const [note, setNote] = useState('');
  const [github, setGithub] = useState(student.githubUrl || '');
  const [key, setKey] = useState(0);
  const { progress, upload } = useUploader();
  const a = useAction();
  const early = statusIndex(student.status) < statusIndex('pisanje');
  const submit = (e) => {
    e.preventDefault();
    if (!file) return a.setError('Odaberite datoteku.');
    if (!GITHUB_RE.test(github.trim())) return a.setError('Unesite poveznicu na GitHub repozitorij rada (https://github.com/korisnik/repozitorij).');
    if (kind === 'final' && !confirm('Predajete KONAČNU verziju rada. Status će se promijeniti u „Rad predan”. Nastaviti?')) return;
    a.run(async () => {
      const fileId = await upload(file);
      setStudent(await api('/me/uploads', { method: 'POST', body: { fileId, kind, note, githubUrl: github.trim() } }));
      setFile(null); setNote(''); setKey((k) => k + 1);
    }, 'Datoteka je predana; mentor je obaviješten emailom.');
  };
  return (
    <div className="stack">
      <form className="card form" onSubmit={submit} key={key}>
        <h2>Predaj datoteku</h2>
        {early && <div className="alert warn">Tema još nije odabrana. Možete poslati materijal na pregled, ali konačna verzija predaje se nakon odabira teme.</div>}
        <div className="seg">
          <button type="button" className={kind === 'draft' ? 'on' : ''} onClick={() => setKind('draft')}>Verzija za pregled</button>
          <button type="button" className={kind === 'final' ? 'on' : ''} onClick={() => setKind('final')} disabled={early}>Konačna verzija</button>
        </div>
        <p className="muted small">
          {kind === 'draft' ? 'Dio rada ili cijeli rad za provjeru i komentare.' : `Konačna verzija za ocjenjivanje – najmanje ${MIN_DAYS_BEFORE_DEFENSE} dana prije željenog datuma obrane.`}
        </p>
        <FilePicker file={file} setFile={setFile} label="Datoteka (PDF, DOCX, ZIP…, do 60 MB)" />
        <label>GitHub repozitorij rada (obavezno)<input type="url" required value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/korisnik/repozitorij" /></label>
        <label>Poruka mentoru (neobavezno)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Npr. što je novo u ovoj verziji, na što da obrati pažnju…" /></label>
        <Progress value={progress} />
        <Msg error={a.error} ok={a.ok} />
        <button className="btn primary" disabled={a.busy}>{a.busy ? 'Učitavanje…' : 'Predaj'}</button>
      </form>
      <section className="card">
        <h2>Moje predaje</h2>
        <UploadList uploads={student.uploads} />
      </section>
    </div>
  );
}

export default function StudentDashboard({ student: initial }) {
  const [student, setStudent] = useState(initial);
  const [tab, setTab] = useState('work');
  const [settings, setSettings] = useState(null);
  useEffect(() => { api('/settings').then(setSettings).catch(() => {}); }, []);

  return (
    <>
      <div className="subhead">
        <div className="wrap subhead-inner">
          <div>
            <div className="muted small">{STUDY_TYPES[student.type]}</div>
            <div className="subhead-title">{student.topic?.titleHr || student.proposal?.titleHr || 'Tema još nije zadana'}</div>
          </div>
          <StatusBadge status={student.status} />
        </div>
        <nav className="tabs wrap">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
      </div>
      <main className="wrap main">
        {tab === 'work' && <Work student={student} setStudent={setStudent} />}
        {tab === 'upload' && <Upload student={student} setStudent={setStudent} />}
        {tab === 'materials' && <Materials />}
        {tab === 'guide' && <Guide settings={settings} goTo={setTab} />}
      </main>
    </>
  );
}
