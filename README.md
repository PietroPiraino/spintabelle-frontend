# Best Fish Forever — Frontend

Frontend di **bestfishforever.it** ("Best Fish Forever"), scuola di poker italiana per Spin & Go / Twister. SPA **Angular 22 standalone, signals, zoneless** (no NgModules, no Zone.js).

> 📖 **L'architettura completa (pattern, header, theming, viewer tabelle, sala live, 3D) è in [`../CLAUDE.md`](../CLAUDE.md).** Questo README è il riassunto operativo.

## Stack & sezioni

Angular 22 (zoneless, `provideZonelessChangeDetection`) · Three.js (hero/diorami/mascotte/banco particellare) · `livekit-client` (sala live, lazy) · 3 temi via `data-theme` (token CSS in `styles/_tokens.scss`).

Sezioni: `/tabelle` (viewer preflop GTO, stato in query param) · `/lezioni` (video gated paginati) · `/allenamento` (drill) · `/live` + `/live/:id/stanza` (**lezioni dal vivo on-site**) · `/docs` (file scaricabili) · `/abbonati` (pubblica) · `/negozio` (punti) · `/account` · `/chi-siamo` · `/admin` (pannello a tab).

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

## Pattern che contano (vedi CLAUDE.md per i dettagli)

- **Zoneless**: niente Zone.js → il rendering è async, le guardie aspettano `auth.ready$` (un `ReplaySubject`, non `toObservable(signal)`).
- **Bootstrap sessione** da `provideEnvironmentInitializer` in `app.config.ts` (non dal costruttore di `AuthService`: ciclo DI), non bloccante (resiliente a un'API lenta / al restart dopo un deploy; il backend è su Render **Starter a pagamento**, niente cold-start del free tier).
- **Access token in memoria**, refresh via cookie; 401 → singolo refresh → retry (interceptor).
- **Router scroll** custom: scroll-to-top solo al cambio di path (i query-param della tabella mantengono la posizione).

## SEO (leggera, senza SSR)

`public/robots.txt` + `public/sitemap.xml` (solo pagine pubbliche). `index.html`: OG + Twitter card + canonical + JSON-LD `EducationalOrganization`. `core/services/seo.service.ts` imposta meta dinamici per-pagina + JSON-LD (usato su `news-detail`). ⚠️ Senza SSR i meta dinamici aiutano Google (esegue il JS) ma non gli scraper social puri (anteprime per-pagina → servirebbe il prerender/SSG). Dettagli e roadmap in `../CLAUDE.md` e `../PLAN-product-improvements.md`.

## Deploy

Push su `main` → **Cloudflare Pages** (`bestfishforever.it`) auto-deploy (~2 min, Node da `.node-version` = 24.16.0). Deploy del **frontend dopo** il backend, verificando che le nuove rotte API rispondano (vedi `../backend/README.md`).
