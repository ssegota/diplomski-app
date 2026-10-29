// Studenti UNIPU-a često imaju dva emaila: ime.prezime@student.unipu.hr i iprezime@student.unipu.hr.
// Ovdje se izvodi onaj drugi i održava indeks alias → primarni email.
import * as db from './db.mjs';

// „Beletić” → „beletic”; đ se ne rastavlja kroz NFD pa ide posebno.
const slug = (s) => s.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

export function suggestAlias(email, name) {
  const [local, domain] = email.toLowerCase().split('@');
  if (!local || !domain) return null;
  const parts = local.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) return `${parts[0][0]}${parts[1]}@${domain}`;
  if (parts.length !== 1) return null;
  // iprezime → ime.prezime samo kad se jednoznačno slaže s imenom i prezimenom.
  const words = String(name || '').trim().split(/\s+/).map(slug).filter(Boolean);
  if (words.length !== 2 || `${words[0][0]}${words[1]}` !== local) return null;
  return `${words[0]}.${words[1]}@${domain}`;
}

// Primarni email (ključ zapisa) ako email pripada nekom studentu, inače null.
export async function emailOwner(email) {
  email = email.toLowerCase();
  if (await db.getStudent(email)) return email;
  return db.getAlias(email);
}

// Postavlja listu aliasa studenta i usklađuje indeks. Baca grešku ako je neki alias zauzet.
export async function setAliases(s, aliases, Err = Error) {
  const next = [...new Set(aliases.map((a) => String(a).trim().toLowerCase()).filter(Boolean))].filter((a) => a !== s.email);
  for (const a of next) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) throw new Err(`Neispravan email: ${a}`);
    const owner = await emailOwner(a);
    if (owner && owner !== s.email) throw new Err(`Email ${a} već pripada drugom studentu (${owner}).`);
  }
  for (const a of s.aliases || []) if (!next.includes(a)) await db.deleteAlias(a);
  for (const a of next) await db.saveAlias(a, s.email);
  s.aliases = next;
}

// Dodaje predloženi alias ako nije zauzet. Zapisi koji već imaju `aliases` se ne diraju.
export async function autoAliases(s) {
  if (Array.isArray(s.aliases)) return false;
  const a = suggestAlias(s.email, s.name);
  s.aliases = [];
  if (a && !(await emailOwner(a))) await setAliases(s, [a]);
  return true;
}

// Popunjavanje za postojeće zapise (bez polja `aliases`); idempotentno.
export async function backfillAliases(students) {
  for (const s of students) if (await autoAliases(s)) await db.saveStudent(s);
  return students;
}
