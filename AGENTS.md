# AGENTS.md — Best Fish Forever (frontend)

Istruzioni per agenti AI che lavorano in questo repo. Dettaglio operativo in [`README.md`](./README.md); architettura completa nel `CLAUDE.md` della root del monorepo (`../CLAUDE.md`, se presente).

## Cosa è
SPA **Angular 22 standalone, signals, ZONELESS** (no NgModules, no Zone.js) di **bestfishforever.it**, scuola di poker italiana. Sezioni: `/tabelle`, `/lezioni`, `/allenamento`, `/live` (+ `/live/:id/stanza`), `/docs`, `/abbonati`, `/negozio`, `/account`, `/chi-siamo`, `/admin` (dashboard a sidebar con rotte figlie `/admin/<sezione>`).

## Regole critiche (leggere PRIMA di toccare il codice)
- **Node 24** obbligatorio (il globale è 20). Anteporre alla PATH nella stessa invocazione:
  `export PATH="/c/Users/Pietro Piraino/AppData/Roaming/nvm/v24.16.0:$PATH"`
- **Zoneless**: il rendering è asincrono. Le guard aspettano `auth.ready$` (`ReplaySubject`), NON `toObservable(signal)`. Nei test/Playwright fare polling, non leggere il DOM subito dopo un click.
- **Niente colori brand hardcoded**: usare i token CSS in `styles/_tokens.scss` (3 temi via `data-theme`).
- Gli script `e2e-*.mjs` / `shot-*.mjs` / `deck-*.mjs` / `_*.mjs` sono **tooling locale**: non committarli.
- ⚠️ **Il player Bunny si monta SOLO al clic** (`<app-bunny-player>`, unico iframe del frontend): è il presupposto dell'esenzione art. 122, non una scelta di UX. Vale anche per il tracking: si aggancia allo stesso clic, non lo anticipa. Guardie in `lessons.component.spec.ts`.
- ⚠️ **Testi legali**: se una modifica cambia quali dati raccogliamo, l'informativa va aggiornata **e deployata prima** del backend che raccoglie, con la **data bumpata** in `privacy.component.ts`/`cookie-policy.component.ts`.

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
Push su `main` → **Cloudflare Pages** auto-deploy (`bestfishforever.it`). **Frontend DOPO il backend**, verificando che le nuove rotte API rispondano (vedi `../backend/AGENTS.md`). ⚠️ **Eccezione**: i **testi legali** vanno pubblicati **prima** del backend che inizia a raccogliere (art. 13.3) → tre push: testi → backend → resto del frontend. Commit/push solo quando l'utente lo chiede.
