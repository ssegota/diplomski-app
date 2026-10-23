// Renderira docs/src/upute-*.html u PDF: naslovnica bez podnožja + ostatak s brojevima stranica.
import puppeteer from 'puppeteer-core';
const [src, out, label] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('file://' + src, { waitUntil: 'networkidle0' });
await p.evaluate(() => document.fonts.ready);
const css = await p.addStyleTag({ content: 'body > :not(.cover){display:none !important}' });
await p.pdf({ path: out + '.cover.pdf', format: 'A4', printBackground: true, preferCSSPageSize: true });
await css.evaluate((n) => n.remove());
await p.addStyleTag({ content: '.cover{display:none !important} @page :first { margin: 18mm 17mm 20mm; }' });
await p.pdf({
  path: out + '.body.pdf', format: 'A4', printBackground: true, displayHeaderFooter: true,
  margin: { top: '18mm', bottom: '20mm', left: '17mm', right: '17mm' },
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-size:8px;color:#5A6B72;padding:0 17mm;display:flex;justify-content:space-between;font-family:system-ui,sans-serif"><span>${label} · Završni i diplomski radovi · FIPU</span><span>str. <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
});
await b.close();
