# AGENTS.md — Best Fish Forever (frontend)

Istruzioni per agenti AI che lavorano in questo repo. Dettaglio operativo in [`README.md`](./README.md); architettura completa nel `CLAUDE.md` della root del monorepo (`../CLAUDE.md`, se presente).

## Cosa è
SPA **Angular 22 standalone, signals, ZONELESS** (no NgModules, no Zone.js) di **spintabelle.it**, scuola di poker italiana. Sezioni: `/tabelle`, `/lezioni`, `/allenamento`, `/live` (+ `/live/:id/stanza`), `/docs`, `/abbonati`, `/negozio`, `/account`, `/chi-siamo`, `/admin`.

## Regole critiche (leggere PRIMA di toccare il codice)
- **Node 24** obbligatorio (il globale è 20). Anteporre alla PATH nella stessa invocazione:
  `export PATH="/c/Users/Pietro Piraino/AppData/Roaming/nvm/v24.16.0:$PATH"`
- **Zoneless**: il rendering è asincrono. Le guard aspettano `auth.ready$` (`ReplaySubject`), NON `toObservable(signal)`. Nei test/Playwright fare polling, non leggere il DOM subito dopo un click.
- **Niente colori brand hardcoded**: usare i token CSS in `styles/_tokens.scss` (3 temi via `data-theme`).
- Gli script `e2e-*.mjs` / `shot-*.mjs` / `deck-*.mjs` sono **gitignored** (tooling locale): non committarli.

## Comandi
```bash
npm start                                              # ng serve (:4200)
npm run build                                          # build di produzione
npx ng test --watch=false --browsers=ChromeHeadless    # Karma headless
```
Dopo modifiche significative: `npx ng build` + Karma.

## Convenzioni
- Stringhe rivolte all'utente **e commenti in ITALIANO**; documentazione in inglese.
- Token d'accesso in memoria, refresh via cookie httpOnly; le navigazioni a URL del backend (download/token) usano XHR per allegare il Bearer.
- Per la navigazione: voci/gruppi sono meta-driven in `header.component.ts` (nessun cambio CSS/markup per aggiungere una voce).
- SEO: meta dinamici via `core/services/seo.service.ts` (utili a Google; per anteprime social per-pagina servirebbe SSR).
- UI riusabile: icone via **`app-icon`** (`shared/ui/icon/`, **non emoji**), notifiche via **`ToastService`** (`shared/ui/toast/`, montato una volta in `app-root`); utility solo-screen-reader = **`.visually-hidden`/`.sr-only`** (`styles/_utilities.scss`).

## Deploy
Push su `main` → **Cloudflare Pages** auto-deploy (`spintabelle.it`). **Frontend DOPO il backend**, verificando che le nuove rotte API rispondano (vedi `../backend/AGENTS.md`). Commit/push solo quando l'utente lo chiede.
