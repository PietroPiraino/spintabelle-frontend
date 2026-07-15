# Best Fish Forever — Frontend

Frontend di **bestfishforever.it** ("Best Fish Forever"), scuola di poker italiana per Spin & Go / Twister. SPA **Angular 22 standalone, signals, zoneless** (no NgModules, no Zone.js).

> 📖 **L'architettura completa (pattern, header, theming, viewer tabelle, sala live, 3D) è in [`../CLAUDE.md`](../CLAUDE.md).** Questo README è il riassunto operativo.

## Stack & sezioni

Angular 22 (zoneless, `provideZonelessChangeDetection`) · Three.js (hero/diorami/mascotte/banco particellare) · `livekit-client` (sala live, lazy) · 3 temi via `data-theme` (token CSS in `styles/_tokens.scss`).

Sezioni: `/tabelle` (viewer preflop GTO, stato in query param) · `/lezioni` (video gated paginati) · `/allenamento` (drill) · `/simulatore-varianza` (**pubblico**, simulatore Monte Carlo di varianza per Spin & Go / Twister) · `/live` + `/live/:id/stanza` (**lezioni dal vivo on-site**) · `/docs` (file scaricabili) · `/abbonati` (pubblica) · `/negozio` (punti) · `/account` · `/chi-siamo` · `/admin` (pannello a tab).

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
- **Router scroll** custom: scroll-to-top solo al cambio di path (i query-param della tabella mantengono la posizione).
- **Spazio riservato al contenuto** (`app.component.scss`): `.app-main { min-height: 100dvh }` + `> router-outlet { display: none }` → CLS su `/lezioni` da 0,72 a 0,007. ⚠️ `<router-outlet>` è un **segnaposto**: il componente della rotta gli viene inserito **accanto**, non dentro. Non rimuovere nessuna delle due righe senza rimisurare (vedi `../CLAUDE.md`, *Reserved layout & CLS*).

## SEO & SSG

**SSG attivo dal 12/07/2026** (`outputMode: 'static'`, prerender al build — **nessun server SSR a runtime**): 9 pagine pubbliche + un HTML per articolo news (`app.routes.server.ts`), con meta/canonical/OG/JSON-LD **nell'HTML grezzo** → anteprime social per-pagina. `npm run build` = `ng build && node scripts/gen-sitemap.mjs`. A runtime `core/services/seo.service.ts` applica i meta per-pagina (listener `NavigationEnd` in `app.config.ts`); `news-detail` li ridefinisce coi dati veri dell'articolo.

⚠️ **Debito aperto**: `_redirects` non esiste, quindi le rotte `RenderMode.Client` (`/login`, `/lezioni`, `/admin`…) ricevono l'**HTML della home** e l'utente guarda la landing per 10-22s. Il fallback automatico di Cloudflare **non** basta (serve `index.html`). Il bersaglio giusto è `/index.csr` **senza estensione**, con regole **esplicite per rotta** e **mai** una catch-all `/*` (una catch-all ha buttato giù il sito ~2 min il 12/07). Da provare su una **preview**, mai al buio. Dettagli in `../CLAUDE.md` e `../PLAN-ssg-prerender.md`.

## Privacy — vincoli di codice

⚠️ **Il player Bunny deve restare click-to-load**: `<app-bunny-player>` (`shared/ui/bunny-player/`, **unico** punto di mount di un iframe) si monta solo al clic su play. Montarlo al caricamento della pagina farebbe **cadere l'esenzione dell'art. 122** (il player scrive 2 chiavi in localStorage già al load dell'iframe, prima di qualunque play): è un vincolo legale, non una preferenza. Il clic **non è consenso** — mai scrivere "acconsenti cliccando". **Cloudflare Web Analytics è attivo dal 27/06/2026** via auto-inject di zona: **non è nel sorgente**, e `curl | grep cloudflareinsights` dà **0** perché CF inietta solo con uno User-Agent da browser (falso negativo già preso due volte — verificare con Playwright o un UA da browser). Motivazioni e prove in `../gdpr/`.

## Deploy

Push su `main` → **Cloudflare Pages** (`bestfishforever.it`) auto-deploy (~2 min, Node da `.node-version` = 24.16.0). Deploy del **frontend dopo** il backend, verificando che le nuove rotte API rispondano (vedi `../backend/README.md`).
