# Best Fish Forever — Frontend

Frontend di **bestfishforever.it** ("Best Fish Forever"), scuola di poker italiana per Spin & Go / Twister. SPA **Angular 22 standalone, signals, zoneless** (no NgModules, no Zone.js).

> 📖 **L'architettura completa (pattern, header, theming, viewer tabelle, sala live, 3D) è in [`../CLAUDE.md`](../CLAUDE.md).** Questo README è il riassunto operativo.

## Stack & sezioni

Angular 22 (zoneless, `provideZonelessChangeDetection`) · Three.js (hero/diorami/mascotte/banco particellare) · `livekit-client` (sala live, lazy) · 3 temi via `data-theme` (token CSS in `styles/_tokens.scss`).

Sezioni: `/tabelle` (viewer preflop GTO, stato in query param) · `/lezioni` (video gated paginati) · `/allenamento` (drill) · `/simulatore-varianza` (**pubblico**, simulatore Monte Carlo di varianza per Spin & Go / Twister) · `/live` + `/live/:id/stanza` (**lezioni dal vivo on-site**) · `/docs` (file scaricabili) · `/abbonati` (pubblica) · `/negozio` (punti) · `/affiliazioni` (**pubblica ma col catalogo dietro login**, LIVE dal 02/08/2026: quadro di controllo delle proprie pratiche presso le poker room — vedi sotto) · `/account` · `/chi-siamo` · `/admin` (pannello a tab: lezioni · live · news · documenti · negozio · iscritti · richieste · sconti · **affiliazioni** · partecipazione · statistiche · log).

### `/affiliazioni` — il programma di affiliazione

Il giocatore chiede il link affiliato di una sala, apre il conto, dichiara il suo username e l'owner **approva a mano**; da lì in poi riceve punti BFF (assegnati a mano, in proporzione al gioco) spendibili nel Negozio. La pagina è un **quadro di controllo a righe**, non una vetrina di card: la riga chiusa porta piastrella del logo · nome e circuito · offerta · stato · **una** azione, e il resto sta in un dettaglio che si apre **su richiesta** (`aria-expanded`/`aria-controls`, **una riga aperta per volta**; con una sola pratica quella riga nasce aperta). Misurato: tenendo tutti i dettagli aperti, con otto sale la pagina era alta **4770px** contro i **3524** della griglia di card che sostituisce, e ripeteva cinque volte nella stessa schermata la frase sul primo accesso al client. Le righe che aspettano una mossa **dell'utente** — e solo quelle — portano il **gettone**, la fiche CSS che riusa il linguaggio di `.header__points`: se lo portassero tutte non direbbe più niente.

⚠️ **Il vincolo che regge tutto: la rotta è pubblica e prerenderizzata, ma il catalogo sta dietro `JwtAuthGuard`** → nell'HTML indicizzabile non compare alcun marchio di operatore, nessuna percentuale, nessun importo. `title`/`description` in `app.routes.ts` sono deliberatamente **neutri**: non "migliorarli" per SEO. Per lo stesso motivo il blocco **"punti BFF" vive solo dietro login** — un premio in cambio di gioco nell'HTML indicizzato è un *incentivo*, mentre il perimetro approvato è un *programma di affiliazione* — e non porta cifre; una spec verifica entrambe le cose. ⚠️ Verso la sala **non parte nulla di nostro**: il codice `AFF-…` non viene iniettato in alcun URL (decisione owner), è interno (numero di pratica per l'utente, chiave di ricerca nel pannello) e la verifica si fa a mano sull'username dichiarato.

**Tab admin "Affiliazioni"** (`features/admin/admin-affiliations/`): coda delle richieste (approva · rifiuta · revoca · rinvia l'email · nota interna; su rifiuto e revoca la **nota è obbligatoria**, lato server) + CRUD delle sale, che **nascono inattive**. ⚠️ Le frecce ▲▼ dell'ordine **rinumerano** la scala (10, 20, 30…) invece di scambiare due valori: tutte le sale nascono con `ordine = 100` e uno scambio fra pari non produrrebbe alcun movimento. Sono disabilitate quando l'elenco è paginato — una rinumerazione è sicura solo se vede tutte le righe.

## Prerequisiti

- **Node 24** (il Node globale è 20). Su Windows, anteporre alla PATH nella stessa invocazione:
  ```bash
  export PATH="/c/Users/Pietro Piraino/AppData/Roaming/nvm/v24.16.0:$PATH"
  ```
- Per lo sviluppo completo: backend su `:3000` + Mongo locale (vedi `../backend/README.md`).

## Comandi

```bash
npm start          # ng serve (http://localhost:4200), rebuild on change
npm run build      # build di produzione in dist/
npm test           # Karma; headless: npx ng test --watch=false --browsers=ChromeHeadless
```

`environments/environment.prod.ts` → `https://api.bestfishforever.it`.

### E2E (script locali, gitignorati)

`node e2e-preflop.mjs` (viewer + tabelle) · `node e2e-seed-lessons.mjs && node e2e-lessons.mjs` (lezioni) · `node e2e-shop.mjs` (negozio, solo API). Richiedono backend locale + utenti di test; alcuni anche `ng serve`. (Attenzione al throttle 10/min su `/auth/login`.)

Famiglia `e2e-cls-*.mjs`: misure di CLS/INP/byte sul filo (`e2e-cls-bytes-local.mjs` per i byte, con Slow 4G + CPU 4x). Rimisurare **prima e dopo**, sullo stesso rig, prima di toccare il layout riservato.

## Pattern che contano (vedi CLAUDE.md per i dettagli)

- **Zoneless**: niente Zone.js → il rendering è async, le guardie aspettano `auth.ready$` (un `ReplaySubject`, non `toObservable(signal)`).
- **Bootstrap sessione** da `provideEnvironmentInitializer` in `app.config.ts` (non dal costruttore di `AuthService`: ciclo DI), non bloccante (resiliente a un'API lenta / al restart dopo un deploy; il backend è su Render **Starter a pagamento**, niente cold-start del free tier).
- **Access token in memoria**, refresh via cookie; 401 → singolo refresh → retry (interceptor).
- **Un dato che richiede la sessione si carica da un `effect()` sul signal `auth.user()`** (con una guardia "già caricato per questo id"), lasciando alla chiamata il percorso normale 401 → refresh → retry. Le due scorciatoie tentanti sono **entrambe sbagliate**, provate e scartate su `/affiliazioni` (e pinnate da una spec): `ready$.pipe(take(1))` legge lo stato **una volta sola** e il cap di 8s del bootstrap può far emettere `ready` col refresh ancora in volo → pagina da anonimo a un utente loggato; `SKIP_REFRESH` sulla chiamata direbbe "accedi" a chi è loggato da venti minuti, perché l'access token vive 15 minuti e non esiste alcun refresh proattivo. (Le **guardie di rotta** restano su `auth.ready$`: lì la domanda è un'altra, "posso entrare adesso".)
- **Temi e token** (`styles/_tokens.scss`, 3 blocchi): i componenti non scrivono mai un colore di marca a mano. ⚠️ **Leggere i valori, non i nomi**: `--cream-100` **non è un crema** — è un alias storico che vale **#16223f (navy) in light** e **#46213c (prugna) in tramonto**, cioè il colore del **testo**, ed è crema solo in dark. `--logo-plate: #ffffff` è invece l'**unico** token identico nei tre temi, e non è una dimenticanza: è il substrato bianco su cui si stampano i marchi di terzi (le piastrelle delle sale in `/affiliazioni`), che non si ricolorano mai.
- **Router scroll** custom: scroll-to-top solo al cambio di path (i query-param della tabella mantengono la posizione).
- **Spazio riservato al contenuto** (`app.component.scss`): `.app-main { min-height: 100dvh }` + `> router-outlet { display: none }` → CLS su `/lezioni` da 0,72 a 0,007. ⚠️ `<router-outlet>` è un **segnaposto**: il componente della rotta gli viene inserito **accanto**, non dentro. Non rimuovere nessuna delle due righe senza rimisurare (vedi `../CLAUDE.md`, *Reserved layout & CLS*).

## SEO & SSG

**SSG attivo dal 12/07/2026** (`outputMode: 'static'`, prerender al build — **nessun server SSR a runtime**): 9 pagine pubbliche + un HTML per articolo news (`app.routes.server.ts`), con meta/canonical/OG/JSON-LD **nell'HTML grezzo** → anteprime social per-pagina. `npm run build` = **`ng build && node scripts/gen-sitemap.mjs && node scripts/check-routes.mjs`** (la sitemap è *derivata* dal manifest del build, poi la **guardia rotte** la verifica — vedi sotto). A runtime `core/services/seo.service.ts` applica i meta per-pagina (listener `NavigationEnd` in `app.config.ts`); `news-detail` li ridefinisce coi dati veri dell'articolo.

**`public/_redirects` serve la shell vuota alle rotte client** (risolto 16/07/2026): senza, il fallback automatico di Cloudflare serve `index.html` — la **home** — su `/login`, `/lezioni`, `/admin`… (l'utente guardava la landing per 10-22s). Tre regole intoccabili: target **`/index.csr` senza `.html`** (col `.html` fa 308 → loop, il crash del 12/07), **mai** una catch-all `/*`, e **mai** elencare le prerenderizzate (riceverebbero la shell al posto dell'HTML coi meta). ⚠️ `_redirects` si allinea **a mano** con `app.routes.server.ts`; provare sempre su una **preview branch**.

**Guardia rotte** (`scripts/check-routes.mjs`, in coda a `npm run build`, blocca il deploy su una deriva): confronta **artefatti** (`dist/frontend/prerendered-routes.json`, `_redirects`) e trova le rotte client senza regola, le prerenderizzate catturate per errore, i target con `.html`, le catch-all. La sitemap non è più una lista a mano: è derivata dal manifest. L'unica lista editoriale rimasta è la mappa `ESCLUSE` di `gen-sitemap.mjs` — pagine prerenderizzate volutamente **fuori** dalla sitemap, ognuna col suo perché scritto accanto: oggi c'è solo `/affiliazioni`, perché il programma è riservato agli iscritti e la parte pubblica non ha condizioni da indicizzare (⚠️ la motivazione scritta lì dice ancora «placeholder»: è rimasta indietro rispetto alla pagina vera). Test puri con `npm run test:scripts` (`node --test`). Valvola d'emergenza: `SKIP_ROUTE_CHECK=1`. Dettagli in `../PLAN-ssg-prerender.md`.

**Rebuild automatico alla pubblicazione news**: essendo SSG, un articolo pubblicato/modificato dall'admin non è prerenderizzato finché non si rideploya. Il backend lo risolve con un **Cloudflare Deploy Hook** (`DeployHookService`, vedi `../CLAUDE.md`): pubblichi e il sito si ricostruisce da solo in pochi minuti.

## Privacy — vincoli di codice

⚠️ **Il player Bunny deve restare click-to-load**: `<app-bunny-player>` (`shared/ui/bunny-player/`, **unico** punto di mount di un iframe) si monta solo al clic su play. Montarlo al caricamento della pagina farebbe **cadere l'esenzione dell'art. 122** (il player scrive 2 chiavi in localStorage già al load dell'iframe, prima di qualunque play): è un vincolo legale, non una preferenza. Il clic **non è consenso** — mai scrivere "acconsenti cliccando". Lo **stesso clic** registra anche l'apertura della lezione (`POST /lessons/:id/view`) e, mentre il video scorre, l'avanzamento arrivato dal player via **Player.js**: nessuna delle due cose scrive nel terminale, quindi l'analisi dell'art. 122 non cambia — ciò che non deve mai spostarsi è il **punto di mount**. Guardie in `lessons.component.spec.ts` e `bunny-player.component.spec.ts`. **Cloudflare Web Analytics è attivo dal 27/06/2026** via auto-inject di zona: **non è nel sorgente**, e `curl | grep cloudflareinsights` dà **0** perché CF inietta solo con uno User-Agent da browser (falso negativo già preso due volte — verificare con Playwright o un UA da browser). Motivazioni e prove in `../gdpr/`.

⚠️ **Affiliazioni**: l'informativa (aggiornata al **2 agosto 2026**) dichiara il trattamento e pubblica **verbatim** la formula di conservazione — *"Una richiesta mai completata, o annullata, si chiude dopo 6 mesi di inattività"* — che è la stessa stringa stampata dalla pagina (`RETENTION_NOTICE`) e spedita dal backend nell'email del link. In v1 è una **copia**, non un testo servito dall'API: **se cambia una cambiano tutte** (stessa disciplina per `FIRST_CLIENT_LOGIN_REMINDER`, duplicato fra `affiliations.component.ts` e `affiliations.types.ts`). Valutazione, prove e voce **A13** del registro in `../gdpr/` (`valutazione-affiliazioni.md`, `prove-affiliazioni.md` — quest'ultimo marca **«da acquisire»**, cioè *non verificato* e non "verificato assente", tutto ciò che riguarda la sala come soggetto giuridico: concessione, termini, sede, informativa).

## Deploy

Push su `main` → **Cloudflare Pages** (`bestfishforever.it`) auto-deploy (~2 min, Node da `.node-version` = 24.16.0). Deploy del **frontend dopo** il backend, verificando che le nuove rotte API rispondano (vedi `../backend/README.md`).

⚠️ **Eccezione — testi legali**: se il cambiamento inizia a raccogliere un dato personale nuovo, l'informativa aggiornata va pubblicata **prima** che la raccolta parta (art. 13.3 GDPR). In quel caso si spezza in tre push: **frontend dei soli testi legali** → backend → frontend del resto — così sono uscite le **affiliazioni il 02/08/2026**, verificando in produzione ogni push prima del successivo. E si **bumpa la data** in `privacy.component.ts` / `cookie-policy.component.ts`: un testo cambiato senza data nuova è un difetto legale silenzioso.
