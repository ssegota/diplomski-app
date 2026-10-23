import { STATUS_KEYS, statusIndex, statusLabel, STUDY_TYPES, MIN_DAYS_BEFORE_DEFENSE } from '../../shared/statuses.js';
import { issueSession, readSession, verifyGoogle, devLoginEnabled, ALLOWED_DOMAIN } from '../lib/auth.mjs';
import * as db from '../lib/db.mjs';
import { sendMail, notifyAdmin, appUrl, mailConfigured } from '../lib/mail.mjs';

export const config = { path: '/api/*' };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const now = () => new Date().toISOString();
const str = (v, max = 20000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('hr-HR') : '—');

// ---------- Pomoćne funkcije za studenta ----------

function newStudent({ email, name, jmbag, type, program }, by) {
  return {
    email: email.toLowerCase(),
    name: name || email,
    jmbag: jmbag || '',
    type: STUDY_TYPES[type] ? type : 'diplomski',
    program: program || '',
    status: 'inicijalni_kontakt',
    history: [{ status: 'inicijalni_kontakt', at: now(), by, note: '' }],
    proposal: null,
    topic: null,
    topicAcceptedAt: null,
    uploads: [],
    adminMessage: '',
    notes: '',
    desiredDefenseDate: '',
    createdAt: now(),
  };
}

function setStatus(s, status, by, note = '') {
  s.status = status;
  s.history = [...(s.history || []), { status, at: now(), by, note }];
}

// Automatski prijelaz: samo naprijed, nikad unatrag (admin to može ručno).
function advance(s, status, by, note) {
  if (statusIndex(status) > statusIndex(s.status)) { setStatus(s, status, by, note); return true; }
  return false;
}

const publicStudent = (s) => { const { notes, ...rest } = s; return rest; };

async function mailStudentStatus(s, note) {
  await sendMail({
    to: s.email,
    subject: `Status rada: ${statusLabel(s.status)}`,
    text: `Poštovani/a ${s.name},\n\nstatus Vašeg rada promijenjen je u: ${statusLabel(s.status)}.` +
      (note ? `\n\nNapomena mentora:\n${note}` : '') +
      `\n\nDetalje možete vidjeti u aplikaciji: ${appUrl()}`,
  });
}

function topicFrom(body) {
  const t = {
    titleHr: str(body.titleHr, 500), titleEn: str(body.titleEn, 500),
    descriptionHr: str(body.descriptionHr), descriptionEn: str(body.descriptionEn),
  };
  if (!t.titleHr && !t.titleEn) throw new HttpError(400, 'Naslov (HR ili EN) je obavezan.');
  return t;
}

// ---------- Datoteke ----------

function canReadFile(user, meta, student) {
  if (user.role === 'admin') return true;
  if (!meta.complete) return false;
  if (meta.visibleTo === 'all') return true;
  return meta.visibleTo === user.email || (student && meta.visibleTo === student.email);
}

// ---------- Router ----------

async function route(req, user, parts, method) {
  const body = method === 'POST' || method === 'PATCH' || method === 'PUT'
    ? (req.headers.get('content-type') || '').includes('application/json') ? await req.json().catch(() => ({})) : null
    : null;
  const [a, b, c, d] = parts;
  const isAdmin = user?.role === 'admin';
  const requireUser = () => { if (!user) throw new HttpError(401, 'Prijava je istekla – prijavite se ponovno.'); };
  const requireAdmin = () => { requireUser(); if (!isAdmin) throw new HttpError(403, 'Samo za administratora.'); };
  const requireStudent = async () => {
    requireUser();
    const s = await db.getStudent(user.email);
    if (!s) throw new HttpError(404, 'Studentski zapis ne postoji.');
    return s;
  };

  // --- javno ---
  if (a === 'config' && method === 'GET') {
    return json({
      googleClientId: process.env.GOOGLE_CLIENT_ID || null,
      devLogin: devLoginEnabled(),
      allowedDomain: ALLOWED_DOMAIN(),
    });
  }

  if (a === 'auth' && method === 'POST') {
    let identity;
    if (b === 'google') {
      identity = await verifyGoogle(body?.credential);
    } else if (b === 'dev') {
      if (!devLoginEnabled()) throw new HttpError(404, 'Nije dostupno.');
      const email = str(body?.email, 200).toLowerCase();
      if (!email.includes('@')) throw new HttpError(400, 'Neispravan email.');
      identity = { email, name: str(body?.name, 200) || email.split('@')[0] };
    } else throw new HttpError(404, 'Nepoznato.');

    const session = issueSession(identity);
    if (session.user.role === 'student') {
      let s = await db.getStudent(identity.email);
      if (!s) {
        // Nepoznati student se sam registrira kao „Inicijalni kontakt”.
        s = { ...newStudent(identity, 'student'), selfRegistered: true };
        await db.saveStudent(s);
        await notifyAdmin(`Novi student u aplikaciji: ${s.name}`,
          `${s.name} (${s.email}) prijavio/la se u aplikaciju i dodan/a je sa statusom „Inicijalni kontakt”.`);
      } else if (identity.name && (!s.name || s.name === s.email)) {
        s.name = identity.name; await db.saveStudent(s);
      }
    }
    return json(session);
  }

  requireUser();

  if (a === 'me' && !b && method === 'GET') {
    const student = isAdmin ? null : await db.getStudent(user.email);
    return json({ user, student: student ? publicStudent(student) : null, mailConfigured: isAdmin ? mailConfigured() : undefined });
  }

  // --- student akcije ---
  if (a === 'me' && b === 'profile' && method === 'PATCH') {
    const s = await requireStudent();
    if ('jmbag' in body) s.jmbag = str(body.jmbag, 20);
    if ('desiredDefenseDate' in body) s.desiredDefenseDate = str(body.desiredDefenseDate, 10);
    await db.saveStudent(s);
    return json(publicStudent(s));
  }

  if (a === 'me' && b === 'proposal' && method === 'POST') {
    const s = await requireStudent();
    s.proposal = { ...topicFrom(body), fileId: str(body.fileId, 40) || null, submittedAt: now() };
    if (s.proposal.fileId) await attachFile(s.proposal.fileId, s.email, s.email);
    advance(s, 'prijedlog_teme', 'student', 'Student je dostavio prijedlog teme.');
    await db.saveStudent(s);
    await notifyAdmin(`Prijedlog teme: ${s.name}`,
      `${s.name} (${s.email}) dostavio/la je prijedlog teme.\n\nHR: ${s.proposal.titleHr}\nEN: ${s.proposal.titleEn}\n\n${s.proposal.descriptionHr}\n\n${appUrl()}`);
    return json(publicStudent(s));
  }

  if (a === 'me' && b === 'accept-topic' && method === 'POST') {
    const s = await requireStudent();
    if (!s.topic) throw new HttpError(400, 'Tema još nije zadana.');
    s.topicAcceptedAt = now();
    advance(s, 'pisanje', 'student', 'Student je potvrdio odabir teme (Studomat).');
    await db.saveStudent(s);
    await notifyAdmin(`Tema potvrđena: ${s.name}`,
      `${s.name} (${s.email}) potvrdio/la je odabir teme „${s.topic.titleHr || s.topic.titleEn}”.\nNe zaboravite potvrditi odabir u Nastavničkom portalu.`);
    return json(publicStudent(s));
  }

  if (a === 'me' && b === 'uploads' && method === 'POST') {
    const s = await requireStudent();
    const kind = body.kind === 'final' ? 'final' : 'draft';
    const meta = await attachFile(str(body.fileId, 40), s.email, s.email);
    const up = { id: db.newId(), fileId: meta.id, name: meta.name, size: meta.size, kind, note: str(body.note, 4000), at: now(), feedback: '', feedbackFileId: null, feedbackFileName: null, feedbackAt: null };
    s.uploads = [up, ...(s.uploads || [])];
    if (kind === 'final') advance(s, 'rad_predan', 'student', 'Predana konačna verzija rada.');
    await db.saveStudent(s);
    let warn = '';
    if (kind === 'final' && s.desiredDefenseDate) {
      const days = (new Date(s.desiredDefenseDate) - new Date()) / 86400000;
      if (days < MIN_DAYS_BEFORE_DEFENSE) warn = `\n\n⚠ Željeni datum obrane (${fmtDate(s.desiredDefenseDate)}) je za manje od ${MIN_DAYS_BEFORE_DEFENSE} dana.`;
    }
    await notifyAdmin(`${kind === 'final' ? 'KONAČNA verzija' : 'Verzija za pregled'}: ${s.name}`,
      `${s.name} (${s.email}) predao/la je datoteku „${up.name}” (${kind === 'final' ? 'konačna verzija' : 'na pregled'}).` +
      (up.note ? `\n\nPoruka studenta:\n${up.note}` : '') + warn + `\n\n${appUrl()}`);
    return json(publicStudent(s));
  }

  // --- materijali i postavke (čitanje) ---
  if (a === 'materials' && method === 'GET') {
    const all = await db.listMaterials();
    const visible = isAdmin ? all : all.filter((m) => !m.studentEmail || m.studentEmail === user.email);
    return json(visible.sort((x, y) => (y.createdAt || '').localeCompare(x.createdAt || '')));
  }
  if (a === 'settings' && method === 'GET') return json(await db.getSettings());

  // --- datoteke ---
  if (a === 'files') {
    if (!b && method === 'POST') {
      const size = Number(body.size);
      if (!size || size > db.MAX_FILE_SIZE) throw new HttpError(400, `Datoteka mora biti manja od ${db.MAX_FILE_SIZE / 1048576} MB.`);
      const meta = {
        id: db.newId(), name: str(body.name, 255) || 'datoteka', type: str(body.type, 120) || 'application/octet-stream',
        size, chunks: Math.ceil(size / db.CHUNK_SIZE), uploadedBy: user.email, visibleTo: isAdmin ? 'admin' : user.email,
        complete: false, createdAt: now(),
      };
      await db.saveFileMeta(meta);
      return json({ id: meta.id, chunkSize: db.CHUNK_SIZE, chunks: meta.chunks });
    }
    const meta = b && await db.getFileMeta(b);
    if (!meta) throw new HttpError(404, 'Datoteka ne postoji.');
    const owner = meta.uploadedBy === user.email;

    if (c === 'chunks' && method === 'PUT') {
      if (!owner || meta.complete) throw new HttpError(403, 'Zabranjeno.');
      const n = Number(d);
      if (!(n >= 0 && n < meta.chunks)) throw new HttpError(400, 'Neispravan komad.');
      const buf = await req.arrayBuffer();
      if (buf.byteLength > db.CHUNK_SIZE) throw new HttpError(413, 'Komad prevelik.');
      await db.putChunk(meta.id, n, buf);
      return json({ ok: true });
    }
    if (c === 'complete' && method === 'POST') {
      if (!owner) throw new HttpError(403, 'Zabranjeno.');
      meta.complete = true; await db.saveFileMeta(meta);
      return json(meta);
    }
    if (!canReadFile(user, meta)) throw new HttpError(403, 'Nemate pristup ovoj datoteci.');
    if (!c && method === 'GET') return json(meta);
    if (c === 'chunks' && method === 'GET') {
      const buf = await db.getChunk(meta.id, Number(d));
      if (!buf) throw new HttpError(404, 'Komad ne postoji.');
      return new Response(buf, { headers: { 'content-type': 'application/octet-stream' } });
    }
  }

  // ---------- ADMIN ----------
  requireAdmin();

  if (a === 'students' && !b && method === 'GET') {
    const list = await db.listStudents();
    return json(list.sort((x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || '')));
  }
  if (a === 'students' && !b && method === 'POST') {
    const email = str(body.email, 200).toLowerCase();
    if (!email.includes('@')) throw new HttpError(400, 'Email je obavezan.');
    if (await db.getStudent(email)) throw new HttpError(409, 'Student s tim emailom već postoji.');
    const s = newStudent({ email, name: str(body.name, 200), jmbag: str(body.jmbag, 20), type: body.type, program: str(body.program, 200) }, 'admin');
    if (body.status && STATUS_KEYS.includes(body.status) && body.status !== s.status) setStatus(s, body.status, 'admin', 'Početni status');
    await db.saveStudent(s);
    return json(s, 201);
  }

  if (a === 'students' && b) {
    const email = decodeURIComponent(b);
    const s = await db.getStudent(email);
    if (!s) throw new HttpError(404, 'Student ne postoji.');

    if (!c && method === 'GET') return json(s);
    if (!c && method === 'DELETE') {
      for (const u of s.uploads || []) { await db.deleteFile(u.fileId); if (u.feedbackFileId) await db.deleteFile(u.feedbackFileId); }
      await db.deleteStudent(email);
      return json({ ok: true });
    }
    if (!c && method === 'PATCH') {
      for (const k of ['name', 'jmbag', 'program', 'notes', 'adminMessage', 'desiredDefenseDate']) if (k in body) s[k] = str(body[k]);
      if (body.type && STUDY_TYPES[body.type]) s.type = body.type;
      if ('topic' in body) s.topic = body.topic ? { ...topicFrom(body.topic), assignedAt: s.topic?.assignedAt || now() } : null;
      await db.saveStudent(s);
      if (body.notifyMessage && s.adminMessage) {
        await sendMail({ to: s.email, subject: 'Nova poruka mentora', text: `Poštovani/a ${s.name},\n\n${s.adminMessage}` });
      }
      return json(s);
    }
    if (c === 'status' && method === 'POST') {
      if (!STATUS_KEYS.includes(body.status)) throw new HttpError(400, 'Nepoznat status.');
      const note = str(body.note, 4000);
      setStatus(s, body.status, 'admin', note);
      await db.saveStudent(s);
      if (body.notify !== false) await mailStudentStatus(s, note);
      return json(s);
    }
    if (c === 'assign-topic' && method === 'POST') {
      s.topic = { ...topicFrom(body), assignedAt: now() };
      const note = str(body.note, 4000);
      if (!advance(s, 'tema_zadana', 'admin', note)) s.history.push({ status: s.status, at: now(), by: 'admin', note: `Tema ažurirana. ${note}`.trim() });
      await db.saveStudent(s);
      await sendMail({
        to: s.email, subject: 'Zadana je tema Vašeg rada',
        text: `Poštovani/a ${s.name},\n\nzadana je tema Vašeg rada:\n\nHR: ${s.topic.titleHr}\nEN: ${s.topic.titleEn}\n\n` +
          `Sljedeći korak: odaberite temu, mentora i predmet u Studomatu (Završetak studija) te potvrdite odabir u aplikaciji.` +
          (note ? `\n\nNapomena:\n${note}` : '') + `\n\n${appUrl()}`,
      });
      return json(s);
    }
    if (c === 'uploads' && d && method === 'POST') {
      const up = (s.uploads || []).find((u) => u.id === d);
      if (!up) throw new HttpError(404, 'Predaja ne postoji.');
      up.feedback = str(body.feedback);
      if (body.feedbackFileId) {
        const meta = await attachFile(str(body.feedbackFileId, 40), user.email, s.email);
        up.feedbackFileId = meta.id; up.feedbackFileName = meta.name;
      }
      up.feedbackAt = now();
      await db.saveStudent(s);
      await sendMail({
        to: s.email, subject: `Povratna informacija: ${up.name}`,
        text: `Poštovani/a ${s.name},\n\nmentor je ostavio povratnu informaciju na datoteku „${up.name}”.` +
          (up.feedback ? `\n\n${up.feedback}` : '') + (up.feedbackFileName ? `\n\nPriložena datoteka: ${up.feedbackFileName}` : '') + `\n\n${appUrl()}`,
      });
      return json(s);
    }
  }

  if (a === 'materials' && !b && method === 'POST') {
    const m = {
      id: db.newId(), title: str(body.title, 300), description: str(body.description, 4000),
      url: str(body.url, 1000) || null, fileId: null, fileName: null, size: null,
      studentEmail: str(body.studentEmail, 200).toLowerCase() || null, createdAt: now(),
    };
    if (!m.title) throw new HttpError(400, 'Naslov je obavezan.');
    if (body.fileId) {
      const meta = await attachFile(str(body.fileId, 40), user.email, m.studentEmail || 'all');
      Object.assign(m, { fileId: meta.id, fileName: meta.name, size: meta.size });
    }
    if (!m.fileId && !m.url) throw new HttpError(400, 'Dodajte datoteku ili poveznicu.');
    await db.saveMaterial(m);
    if (m.studentEmail && body.notify !== false) {
      const s = await db.getStudent(m.studentEmail);
      await sendMail({ to: m.studentEmail, subject: `Novi materijal: ${m.title}`,
        text: `Poštovani/a ${s?.name || ''},\n\nmentor Vam je dodao materijal „${m.title}”.${m.description ? `\n\n${m.description}` : ''}\n\n${appUrl()}` });
    }
    return json(m, 201);
  }
  if (a === 'materials' && b && method === 'DELETE') {
    const m = await db.getMaterial(b);
    if (m?.fileId) await db.deleteFile(m.fileId);
    await db.deleteMaterial(b);
    return json({ ok: true });
  }

  if (a === 'settings' && method === 'PUT') {
    const deadlines = (Array.isArray(body.deadlines) ? body.deadlines : []).map((x) => ({
      id: str(x.id, 40) || db.newId(), label: str(x.label, 300), date: str(x.date, 10), note: str(x.note, 2000),
    })).filter((x) => x.label || x.date);
    deadlines.sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    const s = { ...(await db.getSettings()), deadlines };
    await db.saveSettings(s);
    return json(s);
  }

  if (a === 'outbox' && method === 'GET') return json(await db.listOutbox());

  throw new HttpError(404, 'Nepostojeća ruta.');

  // Datoteku koju je učitao `uploader` veže uz zapis i postavlja tko je smije čitati.
  async function attachFile(fileId, uploader, visibleTo) {
    const meta = fileId && await db.getFileMeta(fileId);
    if (!meta || !meta.complete) throw new HttpError(400, 'Datoteka nije (potpuno) učitana.');
    if (meta.uploadedBy !== uploader) throw new HttpError(403, 'Zabranjeno.');
    meta.visibleTo = visibleTo; await db.saveFileMeta(meta);
    return meta;
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  try {
    const user = readSession(req);
    return await route(req, user, parts, req.method);
  } catch (e) {
    const status = e.status || (/token|audience|signature|expired/i.test(e.message) ? 401 : 500);
    if (status >= 500) console.error(e);
    return json({ error: e.message || 'Greška na poslužitelju' }, status);
  }
};
