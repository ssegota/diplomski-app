import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

const env = (k, d = '') => process.env[k] ?? d;

export const ALLOWED_DOMAIN = () => env('ALLOWED_DOMAIN', 'unipu.hr');
export const adminEmails = () =>
  env('ADMIN_EMAILS', 'sbaressis@unipu.hr').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (email) => adminEmails().includes(String(email).toLowerCase());
export const devLoginEnabled = () => env('DEV_LOGIN') === 'true' && env('CONTEXT') !== 'production';

// Skrivena test prijava: samo jedan fiksni studentski račun, uz lozinku.
export const testLoginEnabled = () => Boolean(env('TEST_STUDENT_EMAIL') && env('TEST_LOGIN_PASSWORD'));
export function checkTestPassword(password) {
  const a = crypto.createHash('sha256').update(String(password || '')).digest();
  const b = crypto.createHash('sha256').update(env('TEST_LOGIN_PASSWORD')).digest();
  return testLoginEnabled() && !isAdminEmail(env('TEST_STUDENT_EMAIL')) && crypto.timingSafeEqual(a, b);
}

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

function secret() {
  const s = env('SESSION_SECRET');
  if (!s) throw new Error('SESSION_SECRET nije postavljen');
  return s;
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function issueSession({ email, name, picture }) {
  const payload = {
    email: email.toLowerCase(),
    name: name || email,
    picture: picture || null,
    role: isAdminEmail(email) ? 'admin' : 'student',
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  return { token: `${body}.${sign(body)}`, user: payload };
}

export function readSession(req) {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!p.exp || p.exp < Date.now()) return null;
    // Uloga se ponovno izvodi iz ADMIN_EMAILS da promjena env varijable odmah vrijedi.
    p.role = isAdminEmail(p.email) ? 'admin' : 'student';
    return p;
  } catch {
    return null;
  }
}

// Provjera Google ID tokena; domena se provjerava preko potpisanog `hd` claima.
export async function verifyGoogle(credential) {
  const clientId = env('GOOGLE_CLIENT_ID');
  if (!clientId) throw Object.assign(new Error('Google prijava nije konfigurirana'), { status: 500 });
  const client = new OAuth2Client(clientId);
  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  } catch {
    throw Object.assign(new Error('Neispravna Google prijava – pokušajte ponovno.'), { status: 401 });
  }
  const p = ticket.getPayload();
  const domain = ALLOWED_DOMAIN();
  const hd = p.hd || '';
  if (!p.email_verified || !(hd === domain || hd.endsWith(`.${domain}`))) {
    throw Object.assign(new Error(`Prijava je dozvoljena samo s ${domain} računom.`), { status: 403 });
  }
  return { email: p.email, name: p.name, picture: p.picture };
}
