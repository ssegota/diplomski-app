// Redoslijed statusa procesa izrade rada. Koristi ga i klijent i funkcija.
export const STATUSES = [
  { key: 'inicijalni_kontakt', label: 'Inicijalni kontakt', who: 'student',
    hint: 'Student se javio mentoru. Sljedeći korak: student dostavlja prijedlog teme.' },
  { key: 'prijedlog_teme', label: 'Dostavljen prijedlog teme', who: 'mentor',
    hint: 'Mentor pregledava prijedlog i zadaje temu (naslov i opis na HR i EN).' },
  { key: 'tema_zadana', label: 'Tema zadana', who: 'student',
    hint: 'Tema je zadana i unesena u Nastavnički portal. Student je odabire u Studomatu i potvrđuje ovdje.' },
  { key: 'pisanje', label: 'Tema odabrana – pisanje rada', who: 'student',
    hint: 'Pisanje rada. Verzije za pregled šalju se kroz „Predaja rada”.' },
  { key: 'rad_predan', label: 'Rad predan', who: 'mentor',
    hint: 'Konačna verzija je predana. Mentor je pregledava.' },
  { key: 'ocjenjivanje_mentor', label: 'Ocjenjivanje mentora', who: 'mentor',
    hint: 'Mentor ocjenjuje rad.' },
  { key: 'ocjenjivanje_komisija', label: 'Ocjenjivanje komisije', who: 'komisija',
    hint: 'Rad je kod povjerenstva; slijedi obrana.' },
];

export const STATUS_KEYS = STATUSES.map((s) => s.key);
export const statusIndex = (key) => STATUS_KEYS.indexOf(key);
export const statusLabel = (key) => STATUSES.find((s) => s.key === key)?.label ?? key;

export const STUDY_TYPES = { zavrsni: 'Završni rad', diplomski: 'Diplomski rad' };

// Minimalni razmak između predaje konačne verzije i željenog datuma obrane.
export const MIN_DAYS_BEFORE_DEFENSE = 14;
