import { Fragment, useEffect, useMemo, useState } from 'react';
import { api, fmtDate, fmtDateTime } from '../api.js';
import { STATUSES, STUDY_TYPES, statusIndex } from '../../shared/statuses.js';
import { StatusBadge, Msg, useAction } from './common.jsx';
import StudentDetail from './StudentDetail.jsx';
import Materials from './Materials.jsx';
import Guide, { Deadlines } from './Guide.jsx';

const TABS = [
  ['students', 'Studenti'],
  ['materials', 'Predlošci i materijali'],
  ['deadlines', 'Rokovi'],
  ['guide', 'Upute (pregled)'],
  ['outbox', 'Poslani mailovi'],
];

function AddStudent({ onAdded }) {
  const empty = { email: '', name: '', jmbag: '', type: 'diplomski', program: '', status: 'inicijalni_kontakt' };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const a = useAction();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  if (!open) return <button className="btn primary" onClick={() => setOpen(true)}>+ Dodaj studenta</button>;
  return (
    <form className="card form" onSubmit={(e) => { e.preventDefault(); a.run(async () => { onAdded(await api('/students', { method: 'POST', body: f })); setF(empty); setOpen(false); }); }}>
      <h3>Novi student</h3>
      <div className="grid3">
        <label>Email (@unipu.hr)<input type="email" required value={f.email} onChange={set('email')} /></label>
        <label>Ime i prezime<input required value={f.name} onChange={set('name')} /></label>
        <label>JMBAG<input value={f.jmbag} onChange={set('jmbag')} /></label>
        <label>Vrsta rada<select value={f.type} onChange={set('type')}>{Object.entries(STUDY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Studij<input value={f.program} onChange={set('program')} placeholder="npr. Informatika" /></label>
        <label>Početni status<select value={f.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>
      </div>
      <Msg error={a.error} />
      <div className="row"><button className="btn primary" disabled={a.busy}>Dodaj</button><button type="button" className="btn" onClick={() => setOpen(false)}>Odustani</button></div>
    </form>
  );
}

// Što čeka mentora: prijedlog teme, nepregledane predaje, predan rad.
function needsAttention(s) {
  const unreviewed = (s.uploads || []).filter((u) => !u.feedbackAt).length;
  const reasons = [];
  if (s.status === 'prijedlog_teme') reasons.push('prijedlog teme');
  if (unreviewed) reasons.push(`${unreviewed} nepregledano`);
  if (s.status === 'rad_predan') reasons.push('rad predan');
  return reasons;
}

function StudentsTable({ students, setStudents, openStudent }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('');
  const [type, setType] = useState('');
  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s.key, students.filter((x) => x.status === s.key).length])), [students]);
  const shown = students.filter((s) =>
    (!filter || (filter === '__attn' ? needsAttention(s).length : s.status === filter)) &&
    (!type || s.type === type) &&
    (!q || `${s.name} ${s.email} ${s.jmbag} ${s.topic?.titleHr || ''} ${s.topic?.titleEn || ''}`.toLowerCase().includes(q.toLowerCase())));
  const attn = students.filter((s) => needsAttention(s).length).length;

  return (
    <div className="stack">
      <div className="chips">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => setFilter('')}>Svi <b>{students.length}</b></button>
        <button className={filter === '__attn' ? 'chip on attn' : 'chip attn'} onClick={() => setFilter('__attn')}>Čeka mene <b>{attn}</b></button>
        {STATUSES.map((s, i) => (
          <button key={s.key} className={filter === s.key ? `chip on st-${i}` : 'chip'} onClick={() => setFilter(s.key)}>{s.label} <b>{counts[s.key]}</b></button>
        ))}
      </div>
      <div className="row">
        <input className="grow" placeholder="Traži po imenu, emailu, JMBAG-u ili temi…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Svi radovi</option>
          {Object.entries(STUDY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <AddStudent onAdded={(s) => setStudents((list) => [s, ...list])} />
      </div>
      <div className="card table-wrap">
        <table className="table students">
          <thead><tr><th>Student</th><th>Rad</th><th>Tema</th><th>Status</th><th>Obrana</th><th>Ažurirano</th></tr></thead>
          <tbody>
            {shown.map((s) => {
              const attnR = needsAttention(s);
              return (
                <tr key={s.email} onClick={() => openStudent(s)} className="clickable">
                  <td><b>{s.name}</b>{s.selfRegistered && statusIndex(s.status) === 0 && <span className="pill pill-new">novi</span>}<div className="muted small">{s.email}</div></td>
                  <td className="small">{STUDY_TYPES[s.type]}</td>
                  <td className="topic-cell">{s.topic?.titleHr || (s.proposal ? <i className="muted">Prijedlog: {s.proposal.titleHr || s.proposal.titleEn}</i> : <span className="muted">—</span>)}</td>
                  <td><StatusBadge status={s.status} />{attnR.length > 0 && <div className="attn-note">● {attnR.join(', ')}</div>}</td>
                  <td className="nowrap small">{s.desiredDefenseDate ? fmtDate(s.desiredDefenseDate) : '—'}</td>
                  <td className="nowrap small muted">{fmtDate(s.updatedAt)}</td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={6} className="muted center">Nema studenata.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeadlinesEditor({ settings, setSettings }) {
  const [rows, setRows] = useState(settings?.deadlines || []);
  const a = useAction();
  useEffect(() => { setRows(settings?.deadlines || []); }, [settings]);
  const set = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)));
  return (
    <div className="stack">
      <section className="card form">
        <h2>Rokovi</h2>
        <p className="muted">Rokovi se prikazuju studentima u „Upute i rokovi” (npr. rokovi obrana, rokovi za predaju konačne verzije, rokovi za odabir u Studomatu).</p>
        {rows.map((r, i) => (
          <div className="deadline-row" key={r.id || i}>
            <input type="date" value={r.date} onChange={set(i, 'date')} />
            <input placeholder="Naziv roka (npr. Obrane – rujanski rok)" value={r.label} onChange={set(i, 'label')} />
            <input placeholder="Napomena" value={r.note} onChange={set(i, 'note')} />
            <button className="btn small danger" onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <div className="row">
          <button className="btn" onClick={() => setRows([...rows, { id: '', date: '', label: '', note: '' }])}>+ Dodaj rok</button>
          <button className="btn primary" disabled={a.busy} onClick={() => a.run(async () => setSettings(await api('/settings', { method: 'PUT', body: { deadlines: rows } })), 'Rokovi spremljeni.')}>Spremi rokove</button>
        </div>
        <Msg error={a.error} ok={a.ok} />
      </section>
      <section className="card"><h3>Pregled</h3><Deadlines deadlines={settings?.deadlines} /></section>
    </div>
  );
}

function Outbox({ mailConfigured }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => { api('/outbox').then(setItems).catch(() => setItems([])); }, []);
  return (
    <section className="card">
      <h2>Poslani mailovi</h2>
      {!mailConfigured && <div className="alert warn">SMTP nije konfiguriran – mailovi se samo bilježe ovdje i ne šalju se. Postavite SMTP_HOST, SMTP_USER i SMTP_PASS.</div>}
      {items === null ? <p className="muted">Učitavanje…</p> : !items.length ? <p className="muted">Još nema mailova.</p> : (
        <table className="table compact">
          <thead><tr><th>Vrijeme</th><th>Prima</th><th>Naslov</th><th>Status</th></tr></thead>
          <tbody>
            {items.map((m, i) => (
              <Fragment key={i}>
                <tr className="clickable" onClick={() => setOpen(open === i ? null : i)}>
                  <td className="nowrap small">{fmtDateTime(m.at)}</td><td className="small">{m.to.join(', ')}</td><td>{m.subject}</td>
                  <td className="small">{m.sent ? <span className="ok-text">poslano</span> : <span className="muted" title={m.error}>{m.error?.startsWith('SMTP nije') ? 'zabilježeno' : 'greška'}</span>}</td>
                </tr>
                {open === i && <tr><td colSpan={4}><pre className="mail-body">{m.text}</pre>{m.error && <div className="error small">{m.error}</div>}</td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function AdminDashboard({ mailConfigured }) {
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState(null);
  const [current, setCurrent] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/students').then(setStudents).catch((e) => setError(e.message));
    api('/settings').then(setSettings).catch(() => {});
  }, []);

  const openStudent = async (s) => { setCurrent(s); try { setCurrent(await api(`/students/${encodeURIComponent(s.email)}`)); } catch { /* koristi listu */ } };
  const onChange = (next, deletedEmail) => setStudents((list) =>
    deletedEmail ? list.filter((x) => x.email !== deletedEmail) : list.map((x) => (x.email === next.email ? next : x)));

  return (
    <>
      <div className="subhead">
        <div className="wrap subhead-inner">
          <div><div className="muted small">Administracija</div><div className="subhead-title">Mentorstvo – završni i diplomski radovi</div></div>
        </div>
        <nav className="tabs wrap">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setCurrent(null); }}>{l}</button>)}
        </nav>
      </div>
      <main className="wrap main">
        {error && <Msg error={error} />}
        {tab === 'students' && (students === null ? <p className="muted">Učitavanje…</p>
          : current ? <StudentDetail key={current.email + (current.updatedAt || '')} student={current} students={students} onBack={() => setCurrent(null)} onChange={onChange} />
            : <StudentsTable students={students} setStudents={setStudents} openStudent={openStudent} />)}
        {tab === 'materials' && <Materials admin students={students || []} />}
        {tab === 'deadlines' && <DeadlinesEditor settings={settings} setSettings={setSettings} />}
        {tab === 'guide' && <Guide settings={settings} />}
        {tab === 'outbox' && <Outbox mailConfigured={mailConfigured} />}
      </main>
    </>
  );
}
