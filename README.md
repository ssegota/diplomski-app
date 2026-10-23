# Diplomski-App — završni i diplomski radovi (FIPU)

Aplikacija za praćenje mentorstva: studenti, teme (HR/EN), statusi, predaja rada, povratne informacije, predlošci, upute i rokovi, obavijesti emailom.

**Stack:** Vite + React · jedna Netlify funkcija (`netlify/functions/api.mjs`, ruta `/api/*`) · Netlify Blobs (podaci + datoteke) · Google prijava (kao menzapp) · SMTP preko nodemailera.

## Proces

| Status | Tko pomiče | Kako |
|---|---|---|
| Inicijalni kontakt | – | admin doda studenta ili se student sam prijavi |
| Dostavljen prijedlog teme | student | šalje prijedlog (HR/EN naslov, opis, prilog) → mail adminu |
| Tema zadana | admin | „Zadaj temu i obavijesti” → mail studentu |
| Tema odabrana – pisanje rada | student | „Potvrđujem odabir teme” (nakon Studomata) → mail adminu |
| Rad predan | student | predaja „Konačne verzije” → mail adminu (+ upozorenje ako je < 14 dana do obrane) |
| Ocjenjivanje mentora / komisije | admin | ručno |

Automatski prijelazi idu samo naprijed; admin može postaviti **bilo koji** status (override) uz napomenu i mail studentu. Svaka predaja „Na pregled” šalje mail adminu; povratna informacija (tekst + datoteka) šalje mail studentu.

## Lokalno

```bash
npm install
netlify dev --offline        # http://localhost:8888
```

`.env` (ne commita se, vidi `.env.example`) sadrži `DEV_LOGIN=true` – prijava bilo kojim emailom bez Googlea, samo lokalno (u produkciji `CONTEXT=production` je isključuje). Lokalni podaci su u `.netlify/blobs-serve`.

Za Google prijavu lokalno: u Google Cloud Console (OAuth klijent iz menzappa) dodaj `http://localhost:8888` u **Authorized JavaScript origins**.

## Okruženje

| Varijabla | Opis |
|---|---|
| `SESSION_SECRET` | nasumični string (`openssl rand -hex 32`) za potpis sesije |
| `GOOGLE_CLIENT_ID` | OAuth Client ID (isti kao menzapp) |
| `ADMIN_EMAILS` | admin(i), zadano `sbaressis@unipu.hr` |
| `ALLOWED_DOMAIN` | `unipu.hr` (dopušta i poddomene, npr. `student.unipu.hr`) |
| `APP_URL` | javni URL (za poveznice u mailovima) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | slanje maila (npr. Gmail + app lozinka). Bez njih se mailovi samo bilježe u „Poslani mailovi”. |
| `NOTIFY_EMAIL` | kamo idu obavijesti adminu (zadano = `ADMIN_EMAILS`) |

## Deploy (nakon testiranja)

```bash
gh repo create ssegota/diplomski-app --private --source . --push
netlify sites:create --name diplomski-fipu
netlify env:set SESSION_SECRET "$(openssl rand -hex 32)"
netlify env:set GOOGLE_CLIENT_ID "<client-id>"
netlify env:set ADMIN_EMAILS sbaressis@unipu.hr
netlify env:set APP_URL https://diplomski-fipu.netlify.app
# + SMTP_* po želji
netlify deploy --build --prod
```

Zatim u Google Cloud Console dodaj `https://diplomski-fipu.netlify.app` u Authorized JavaScript origins.

## Predlošci

`public/predlosci/` su kopije iz repozitorija `sbs-fipu-diplomski` (`../diplomski-template`). Osvježavanje: `npm run sync-templates`.

## Ograničenja

- Datoteke do 60 MB, šalju se u komadima od 4 MB (limit Netlify funkcija je 6 MB po zahtjevu).
