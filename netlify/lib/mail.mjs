import nodemailer from 'nodemailer';
import { logMail } from './db.mjs';
import { adminEmails } from './auth.mjs';

const env = (k, d = '') => process.env[k] ?? d;
export const appUrl = () => env('APP_URL', env('URL', 'http://localhost:8888'));
export const mailConfigured = () => Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS'));

let transport;
function getTransport() {
  if (!transport) {
    const port = Number(env('SMTP_PORT', '465'));
    transport = nodemailer.createTransport({
      host: env('SMTP_HOST'),
      port,
      secure: port === 465,
      auth: { user: env('SMTP_USER'), pass: env('SMTP_PASS') },
    });
  }
  return transport;
}

// Šalje mail ako je SMTP konfiguriran; u svakom slučaju zapisuje ga u outbox
// (vidljiv adminu), pa se obavijesti mogu testirati i lokalno bez SMTP-a.
export async function sendMail({ to, subject, text }) {
  const recipients = [].concat(to).filter(Boolean);
  if (!recipients.length) return;
  const body = `${text}\n\n—\nAplikacija: ${appUrl()}\n(Automatska obavijest – Završni i diplomski radovi, FIPU)`;
  const record = { to: recipients, subject, text: body, at: new Date().toISOString(), sent: false, error: null };
  if (mailConfigured()) {
    try {
      await getTransport().sendMail({
        from: env('MAIL_FROM', env('SMTP_USER')),
        to: recipients.join(', '),
        subject,
        text: body,
      });
      record.sent = true;
    } catch (e) {
      record.error = String(e.message || e);
      console.error('Slanje maila nije uspjelo:', e);
    }
  } else {
    record.error = 'SMTP nije konfiguriran – mail samo zabilježen';
    console.log(`[mail] → ${recipients.join(', ')} | ${subject}\n${body}`);
  }
  await logMail(record);
}

export const notifyAdmin = (subject, text) =>
  sendMail({ to: env('NOTIFY_EMAIL') ? env('NOTIFY_EMAIL').split(',') : adminEmails(), subject, text });
