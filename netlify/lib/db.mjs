import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

// Sve stanje živi u jednom Netlify Blobs storeu:
//   student/<email>      JSON zapis studenta
//   material/<id>        JSON metapodaci materijala
//   filemeta/<id>        JSON metapodaci datoteke
//   file/<id>/<n>        binarni komad datoteke (CHUNK_SIZE)
//   settings             JSON (rokovi, …)
//   outbox/<ts>-<id>     JSON zapis poslanog/zabilježenog maila
export const CHUNK_SIZE = 4 * 1024 * 1024; // ispod 6 MB limita Netlify funkcija
export const MAX_FILE_SIZE = 60 * 1024 * 1024;

const store = () => getStore({ name: 'diplomski', consistency: 'strong' });

export const newId = () => crypto.randomBytes(9).toString('base64url');
const sKey = (email) => `student/${email.toLowerCase()}`;

async function listJSON(prefix) {
  const st = store();
  const { blobs } = await st.list({ prefix });
  const items = await Promise.all(blobs.map((b) => st.get(b.key, { type: 'json' })));
  return items.filter(Boolean);
}

export const getStudent = (email) => store().get(sKey(email), { type: 'json' });
export const saveStudent = (s) => store().setJSON(sKey(s.email), { ...s, updatedAt: new Date().toISOString() });
export const deleteStudent = (email) => store().delete(sKey(email));
export const listStudents = () => listJSON('student/');

// Alternativni emailovi: alias/<email> → { email: <primarni email> }.
const aKey = (email) => `alias/${email.toLowerCase()}`;
export const getAlias = async (email) => (await store().get(aKey(email), { type: 'json' }))?.email || null;
export const saveAlias = (alias, email) => store().setJSON(aKey(alias), { email: email.toLowerCase() });
export const deleteAlias = (alias) => store().delete(aKey(alias));

export const getMaterial = (id) => store().get(`material/${id}`, { type: 'json' });
export const saveMaterial = (m) => store().setJSON(`material/${m.id}`, m);
export const deleteMaterial = (id) => store().delete(`material/${id}`);
export const listMaterials = () => listJSON('material/');

const DEFAULT_SETTINGS = { deadlines: [] };
export const getSettings = async () => ({ ...DEFAULT_SETTINGS, ...((await store().get('settings', { type: 'json' })) || {}) });
export const saveSettings = (s) => store().setJSON('settings', s);

export const getFileMeta = (id) => store().get(`filemeta/${id}`, { type: 'json' });
export const saveFileMeta = (m) => store().setJSON(`filemeta/${m.id}`, m);
export const putChunk = (id, n, buf) => store().set(`file/${id}/${n}`, buf);
export const getChunk = (id, n) => store().get(`file/${id}/${n}`, { type: 'arrayBuffer' });
export async function deleteFile(id) {
  const meta = await getFileMeta(id);
  if (!meta) return;
  const st = store();
  for (let i = 0; i < meta.chunks; i++) await st.delete(`file/${id}/${i}`);
  await st.delete(`filemeta/${id}`);
}

export const logMail = (m) => store().setJSON(`outbox/${Date.now()}-${newId()}`, m);
export async function listOutbox(limit = 100) {
  const st = store();
  const { blobs } = await st.list({ prefix: 'outbox/' });
  const keys = blobs.map((b) => b.key).sort().reverse().slice(0, limit);
  return (await Promise.all(keys.map((k) => st.get(k, { type: 'json' })))).filter(Boolean);
}

// Izvještaji komisije: report/<id> (JSON), rtoken/<token> → id (javni link),
// reportpdf/<id> (potpisana verzija), sigimg/<id>/<sigId> (PNG potpisa).
export const getReport = (id) => store().get(`report/${id}`, { type: 'json' });
export const saveReport = (r) => store().setJSON(`report/${r.id}`, r);
export const listReports = () => listJSON('report/');
export async function getReportByToken(token) {
  const ref = await store().get(`rtoken/${token}`, { type: 'json' });
  return ref ? getReport(ref.id) : null;
}
export const saveReportToken = (token, id) => store().setJSON(`rtoken/${token}`, { id });
export const putSignedPdf = (id, bytes) => store().set(`reportpdf/${id}`, bytes);
export const getSignedPdf = (id) => store().get(`reportpdf/${id}`, { type: 'arrayBuffer' });
export const putSigImage = (id, sigId, bytes) => store().set(`sigimg/${id}/${sigId}`, bytes);
export const getSigImage = (id, sigId) => store().get(`sigimg/${id}/${sigId}`, { type: 'arrayBuffer' });
export async function deleteReport(r) {
  const st = store();
  for (const s of r.signatures || []) await st.delete(`sigimg/${r.id}/${s.id}`);
  await st.delete(`reportpdf/${r.id}`);
  await st.delete(`rtoken/${r.token}`);
  await deleteFile(r.fileId);
  await st.delete(`report/${r.id}`);
}

export async function readFileBytes(fileId) {
  const meta = await getFileMeta(fileId);
  if (!meta) return null;
  const parts = [];
  for (let i = 0; i < meta.chunks; i++) parts.push(new Uint8Array(await getChunk(fileId, i)));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
