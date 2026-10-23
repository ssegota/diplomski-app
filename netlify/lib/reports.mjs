import crypto from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import * as db from './db.mjs';

export const newToken = () => crypto.randomBytes(24).toString('base64url');

export async function pageCount(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPageCount();
}

// Potpisana verzija = izvornik + svi potpisi (PNG) na zadanim relativnim pozicijama.
// x, y: gornji lijevi kut kao udio širine/visine stranice (ishodište gore lijevo); w: udio širine.
export async function rebuildSignedPdf(report) {
  const original = await db.readFileBytes(report.fileId);
  const doc = await PDFDocument.load(original, { ignoreEncryption: true });
  const page = doc.getPage(0);
  const { width: W, height: H } = page.getSize();
  for (const s of report.signatures || []) {
    const png = await db.getSigImage(report.id, s.id);
    if (!png) continue;
    const img = await doc.embedPng(png);
    const w = s.w * W;
    const h = w * (img.height / img.width);
    page.drawImage(img, { x: s.x * W, y: H - s.y * H - h, width: w, height: h });
  }
  const bytes = await doc.save();
  await db.putSignedPdf(report.id, bytes);
  return bytes;
}

// Predani rad za javnu stranicu: zadnja konačna verzija, inače zadnja predaja.
export function thesisUpload(student) {
  const ups = student?.uploads || [];
  return ups.find((u) => u.kind === 'final') || ups[0] || null;
}
