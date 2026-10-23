import { STATUSES, MIN_DAYS_BEFORE_DEFENSE } from '../../shared/statuses.js';
import { fmtDate } from '../api.js';

const FIPU_TEME = 'https://fipu.unipu.hr/fipu/za_studente/teme_zavrsnih_i_diplomskih_radova';
const WHO = { student: 'Student', mentor: 'Mentor', komisija: 'Povjerenstvo' };

export function Deadlines({ deadlines = [] }) {
  const today = new Date().toISOString().slice(0, 10);
  if (!deadlines.length) return <p className="muted">Rokovi još nisu objavljeni.</p>;
  return (
    <table className="table compact">
      <thead><tr><th>Datum</th><th>Rok</th><th>Napomena</th></tr></thead>
      <tbody>
        {deadlines.map((d) => (
          <tr key={d.id} className={d.date && d.date < today ? 'past' : ''}>
            <td className="nowrap"><b>{fmtDate(d.date)}</b></td>
            <td>{d.label}</td>
            <td className="muted">{d.note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Guide({ settings, goTo }) {
  return (
    <div className="guide">
      <section className="card">
        <h2>Proces u aplikaciji</h2>
        <p>Rad prolazi kroz sljedeće statuse. Uz svaku promjenu statusa dobit ćete obavijest emailom.</p>
        <ol className="process">
          {STATUSES.map((s) => (
            <li key={s.key}><b>{s.label}</b> <span className="pill">{WHO[s.who]}</span><br /><span className="muted">{s.hint}</span></li>
          ))}
        </ol>
      </section>

      <section className="card step">
        <div className="step-num">1</div>
        <div>
          <h2>Prijava teme</h2>
          <p>Službeni postupak opisan je na stranici fakulteta:{' '}
            <a href={FIPU_TEME} target="_blank" rel="noreferrer">Teme završnih i diplomskih radova (FIPU)</a>.
            {' '}<a href="https://fipu.unipu.hr/_download/repository/FIPU-prijava-teme-rada.pdf" target="_blank" rel="noreferrer">Dijagram procesa (PDF)</a>.</p>
          <ol>
            <li><b>Dogovor s mentorom.</b> Javite se na konzultacije ili emailom. Ne pokrećite formalne korake dok mentor barem okvirno ne pristane.</li>
            <li><b>Prijedlog teme.</b> U aplikaciji (kartica „Moj rad”) unesite naslov na hrvatskom i engleskom te kratak opis problema (1–2 stranice), okvirnu strukturu i literaturu. Prijedlog možete priložiti i kao datoteku (PDF, DOCX, LaTeX ili Markdown).</li>
            <li><b>Mentor zadaje temu.</b> Mentor pregledava prijedlog i zadaje konačni naslov i opis (HR i EN) te temu unosi u Nastavnički portal (ISVU). Dok to nije napravljeno, tema Vam neće biti vidljiva u Studomatu.</li>
            <li><b>Odabir u Studomatu</b> (izbornik „Završetak studija”): <i>izbor teme</i>, <i>izbor mentora</i> (samo u razdoblju definiranom u Studomatu) i <i>izbor predmeta</i>.{' '}
              <a href="https://wiki.srce.hr/spaces/TUT/pages/26116123/Završetak+studija+-+Studomat" target="_blank" rel="noreferrer">Upute za Studomat</a>.</li>
            <li><b>Potvrda u aplikaciji.</b> Nakon odabira u Studomatu kliknite „Potvrđujem odabir teme” – Studomat mentoru ne šalje obavijest, a ovo šalje.</li>
            <li>Ako je rok za odabir u Studomatu prošao, temu ručno prijavljuje mentor preko Ureda za studente (USOP).</li>
          </ol>
        </div>
      </section>

      <section className="card step">
        <div className="step-num">2</div>
        <div>
          <h2>Pisanje rada</h2>
          <ul>
            <li>Rad pišite u službenom predlošku – <b>DOCX</b> ili <b>LaTeX</b> (kartica <button className="link" onClick={() => goTo?.('materials')}>Predlošci i materijali</button>). Predložak za prezentaciju obrane nalazi se na istom mjestu.</li>
            <li>Dodatne materijale (literaturu, podatke, primjere) mentor dodaje individualno, prema potrebi ili na Vaš zahtjev – pojavit će se u istoj kartici, a o novom materijalu dobivate email.</li>
            <li>Verzije rada za pregled šaljite kroz <button className="link" onClick={() => goTo?.('upload')}>Predaja rada</button> kao „Verzija za pregled”. Povratnu informaciju (komentar i/ili datoteku s komentarima) vidjet ćete uz svaku predaju.</li>
            <li>Ne čekajte kraj – šaljite dijelove rada (npr. poglavlje po poglavlje) kako biste ranije dobili povratnu informaciju.</li>
          </ul>
        </div>
      </section>

      <section className="card step">
        <div className="step-num">3</div>
        <div>
          <h2>Rokovi i prijava obrane</h2>
          <div className="alert warn">
            <b>Konačnu verziju rada pošaljite najmanje {MIN_DAYS_BEFORE_DEFENSE} dana (2 tjedna) prije željenog datuma obrane.</b>
            <br />
            Imajte na umu: ovisno o kvaliteti i stanju rada te o temi, pregled može trajati i dulje, a često je potrebno više krugova ispravaka.
            Dva tjedna je <i>minimum</i>, a ne preporuka – planirajte ranije. Željeni datum obrane možete unijeti u kartici „Moj rad”.
          </div>
          <h3>Rokovi</h3>
          <Deadlines deadlines={settings?.deadlines} />
        </div>
      </section>

      <section className="card step">
        <div className="step-num">4</div>
        <div>
          <h2>Ocjenjivanje i obrana</h2>
          <p>Nakon predaje konačne verzije rad ocjenjuje mentor, a zatim povjerenstvo. Prezentaciju za obranu pripremite u predlošku za obranu. Status ćete moći pratiti u aplikaciji.</p>
        </div>
      </section>
    </div>
  );
}
