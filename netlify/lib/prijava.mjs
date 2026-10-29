// Popunjavanje FIPU obrasca za prijavu teme (public/predlosci/Obrazac-prijava-teme.docx).
// Obrazac koristi Wordove kontrole sadržaja (w:sdt); svaka se prepoznaje po w:id.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { PROGRAM_BY_TYPE } from '../../shared/statuses.js';

export const TEMPLATE_PATH = '/predlosci/Obrazac-prijava-teme.docx';

const IDS = {
  name: '-640415433', jmbag: '2118486780', redoviti: '-1416242268', izvanredni: '2118634623',
  type: '-653606983', mentor: '-1744014652', program: '-875232752', course: '-407613668',
  titleHr: '654653115', titleEn: '-25335002', date: '-667488969',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Upisuje tekst u kontrolu: makne oznaku rezerviranog mjesta i sivi stil, zamijeni prvi <w:t>, ostale isprazni.
function setText(sdt, value) {
  let first = true;
  return sdt
    .replace('<w:showingPlcHdr/>', '')
    .replace(/<w:rStyle w:val="Tekstrezerviranogmjesta"\/>/g, '')
    .replace(/(<w:sdtContent>[\s\S]*<\/w:sdtContent>)/, (c) => c.replace(/<w:t(?: [^>]*)?>[^<]*<\/w:t>/g, () => {
      if (!first) return '<w:t></w:t>';
      first = false;
      return `<w:t xml:space="preserve">${esc(value)}</w:t>`;
    }));
}

const setChecked = (sdt) => sdt.replace('<w14:checked w14:val="0"/>', '<w14:checked w14:val="1"/>').replace('<w:t>☐</w:t>', '<w:t>☒</w:t>');

export function fillPrijava(docx, s, { mentorName = '', course = '', date = new Date() } = {}) {
  const files = unzipSync(new Uint8Array(docx));
  const values = {
    name: s.name, jmbag: s.jmbag,
    type: s.type === 'zavrsni' ? 'ZAVRŠNOG' : 'DIPLOMSKOG',
    mentor: mentorName,
    program: PROGRAM_BY_TYPE[s.type],
    course,
    titleHr: s.topic?.titleHr, titleEn: s.topic?.titleEn,
    date: `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}.`,
  };
  const xml = strFromU8(files['word/document.xml']).replace(/<w:sdt>[\s\S]*?<\/w:sdt>/g, (sdt) => {
    const id = /<w:id w:val="([^"]*)"/.exec(sdt)?.[1];
    const key = Object.keys(IDS).find((k) => IDS[k] === id);
    if (key === 'redoviti' || key === 'izvanredni') return s.studyMode === key ? setChecked(sdt) : sdt;
    if (!key || !values[key]) return sdt; // nepoznato ostaje za ručni unos
    let out = setText(sdt, values[key]);
    // Word pri odabiru stavke primijeni veličinu iz kontrole (16 pt u naslovu).
    if (key === 'type') out = out.replace(/(<w:sdtContent>[\s\S]*?<w:rPr>[\s\S]*?)(<\/w:rPr>)/, '$1<w:sz w:val="32"/><w:szCs w:val="32"/>$2');
    // Studij je padajući popis; dodaje se stavka da odabir u Wordu odgovara upisanom tekstu.
    if (key === 'program') out = out.replace('</w:dropDownList>', `<w:listItem w:displayText="${esc(values.program)}" w:value="${esc(values.program)}"/></w:dropDownList>`);
    if (key === 'date') out = out.replace('<w:date>', `<w:date w:fullDate="${date.toISOString().slice(0, 10)}T00:00:00Z">`);
    return out;
  });
  files['word/document.xml'] = strToU8(xml);
  return zipSync(files);
}
