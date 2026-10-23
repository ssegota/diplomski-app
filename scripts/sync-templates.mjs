// Kopira predloške iz repozitorija sbs-fipu-diplomski (../diplomski-template) u public/predlosci.
import { cpSync, readdirSync } from 'node:fs';
const src = process.argv[2] || '../diplomski-template';
for (const f of readdirSync(src).filter((f) => f.startsWith('Predlozak-'))) {
  cpSync(`${src}/${f}`, `public/predlosci/${f}`);
  console.log('✓', f);
}
