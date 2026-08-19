import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { slugGuide } from './features/guides/guides.data';

/**
 * Mappa RenderMode (outputMode 'static': solo Prerender e Client).
 *
 * - PRERENDER: pagine pubbliche statiche ad alto valore SEO → HTML generato al
 *   build con meta/canonical/OG/JSON-LD già nel sorgente (li applica il listener
 *   NavigationEnd + i componenti, che girano anche in prerender). Chiude il gap
 *   delle anteprime social (scraper che leggono solo l'HTML iniziale).
 * - CLIENT (default via `**`): rotte gated/auth/token-based/404 → nessun HTML
 *   statico, servite dalla shell SPA vuota (index.csr.html, ~12,7 KB) tramite
 *   le regole in `public/_redirects`.
 *
 * ⚠️ `RenderMode.Server` NON è un'opzione qui: richiede `outputMode: 'server'`
 * in angular.json, e ci si è tornati indietro il 19/08/2026 (il bundle SSR pesa
 * 11 MB e Cloudflare rifiuta una Function sopra i 3 MiB — la storia intera è nel
 * commento di angular.json). Le news arrivano lo stesso con l'HTML pieno, ma per
 * un'altra strada: le compone la Pages Function `functions/news/[[path]].ts`,
 * che intercetta PRIMA del server degli asset grazie a `public/_routes.json`.
 *
 * ⚠️ `public/_redirects` VA TENUTO ALLINEATO A MANO con questo file: è l'unico
 * punto che non si aggiorna da solo. Aggiungendo qui una rotta Client, aggiungi
 * lì la regola — se te ne dimentichi NON si rompe niente: quella rotta torna a
 * ricevere l'HTML della HOME (71 KB) e l'utente guarda la landing per ~10s
 * prima che Angular monti la pagina vera. Un difetto silenzioso, ed è
 * esattamente com'è vissuto dal 12/07 al 16/07/2026.
 *
 * ⚠️ E le PRERENDER non vanno mai messe in `_redirects`: riceverebbero la shell
 * vuota al posto del loro HTML coi meta → addio anteprime social e SEO.
 * Il perché delle regole (target `/index.csr` senza `.html`, niente catch-all)
 * è in `public/_redirects` e in PLAN-ssg-prerender.md.
 *
 * ⚠️ E le rotte servite dalla Function hanno la loro lista a mano, ed è un TERZO
 * file: `public/_routes.json` decide quali URL invocano `functions/`. Una rotta
 * che non è in un `include` non arriva alla Function e riceve la shell vuota
 * (regola di `_redirects`) o un 404. Lì `/news/*` NON copre `/news` — il
 * prefisso letterale include la barra, il contrario di `_redirects` — ed è per
 * questo che la Function è `[[path]]` (catch-all opzionale: prende sia il
 * prefisso nudo sia i figli). Lo verifica `scripts/check-routes.mjs`.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'tabelle', renderMode: RenderMode.Prerender },
  { path: 'simulatore-varianza', renderMode: RenderMode.Prerender },
  { path: 'chi-siamo', renderMode: RenderMode.Prerender },
  { path: 'abbonati', renderMode: RenderMode.Prerender },
  // Pagina prodotto: prerenderizzata dal 16/08/2026, quando le e' stato tolto
  // `authGuard` (una rotta guardata non stabilizza in prerender). Il ramo che
  // finisce nell'HTML statico e' il teaser anonimo; il catalogo vero resta
  // dietro il JWT, lato backend. ⚠️ Va tolta anche da public/_redirects.
  { path: 'lezioni', renderMode: RenderMode.Prerender },
  { path: 'docs', renderMode: RenderMode.Prerender },
  { path: 'live', renderMode: RenderMode.Prerender },
  { path: 'guide', renderMode: RenderMode.Prerender },

  // Guide per-slug. ⚠️ A differenza di `news/:id`, gli slug NON arrivano da una
  // fetch all'API: stanno in un file TS del repo, quindi il prerender non puo'
  // ne' fallire ne' saltare una pagina perche' il backend era lento. Fallback
  // `None`: uno slug sconosciuto non e' una pagina che uscira' domani, e' un
  // link rotto — Cloudflare risponde 404 con public/404.html.
  {
    path: 'guide/:slug',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.None,
    getPrerenderParams: async () => slugGuide().map((slug) => ({ slug })),
  },
  // ⚠️ INDICE NEWS — Client QUI, ma NON e' una pagina vuota per il lettore:
  // l'HTML iniziale (titolo, h1, elenco degli articoli, meta, canonical) lo
  // produce `functions/news/[[path]].ts`, che Cloudflare invoca prima di cercare
  // un asset perche' `/news` e' in un `include` di `public/_routes.json`. Il
  // render mode qui sotto vale solo per la navigazione interna dello SPA, cioe'
  // per chi ci arriva cliccando da un'altra pagina del sito.
  //
  // E NON prerenderizzata, che era la forma fino al 19/08/2026: al build
  // l'indice resterebbe congelato agli articoli esistenti al momento del deploy,
  // mentre le news si pubblicano dall'admin SENZA deploy.
  //
  // ⚠️ Da qui discende un dovere non ovvio: `/news` NON compare in
  // `prerendered-routes.json`, quindi non e' nella sitemap principale (che e'
  // DERIVATA dal manifest) — l'unico posto che lo pubblica e' la prima <loc> di
  // `/sitemap-articoli.xml`. Se togli quella riga, `/news` non e' in nessuna
  // sitemap e nessuno se ne accorge.
  //
  // ⚠️ E niente regola in `public/_redirects`: le regole sono valutate PRIMA
  // delle Function, quindi una riga li' spegnerebbe l'SSR all'edge lasciando la
  // shell vuota col canonical della home — e la Function esisterebbe,
  // configurata e mai chiamata. Lo verifica `scripts/check-routes.mjs`.
  { path: 'news', renderMode: RenderMode.Client },
  { path: 'affiliazioni', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'cookie-policy', renderMode: RenderMode.Prerender },

  // Responsabilita' editoriale della sezione notizie: chi firma, chi risponde,
  // con che procedura si chiede una rettifica. ⚠️ Prerender e PUBBLICHE: niente
  // regola in `public/_redirects` (riceverebbero la shell CSR al posto del loro
  // HTML), niente riga in `public/_headers` e niente voce in `NOINDEX_ATTESO` —
  // sono esattamente le pagine su cui si argomenta la responsabilita', devono
  // essere raggiungibili e indicizzabili.
  { path: 'redazione', renderMode: RenderMode.Prerender },
  { path: 'policy-editoriale', renderMode: RenderMode.Prerender },

  // NEWS PER-ARTICOLO — stessa storia dell'indice qui sopra: l'HTML iniziale lo
  // scrive la Pages Function, questo `Client` riguarda solo la navigazione
  // interna dello SPA.
  //
  // ⚠️ QUI C'ERA UN `getPrerenderParams` CHE ENUMERAVA GLI ID DALL'API AL BUILD,
  // ed e' stato tolto insieme a tre modi di rompere il deploy che morivano solo
  // con lui (PLAN-news-redazione.md, Fase 1):
  //   1. il ThrottlerGuard del backend e' 120 richieste/minuto per IP: intorno
  //      ai 120-150 articoli le fetch DEL BUILD prendevano 429, la pagina usciva
  //      col ramo "News non trovata" (~15 parole, zero <h1>) e
  //      check-prerender-content.mjs faceva fallire `npm run build` — cioe' NON
  //      si deployava piu' NIENTE del sito, per colpa di un articolo;
  //   2. un solo articolo legittimo sotto le 120 parole otteneva lo stesso;
  //   3. oltre i 1.000 articoli il ciclo `for (page <= 20; limit=50)` smetteva
  //      di enumerare in silenzio, e `PrerenderFallback.Client` era inerte
  //      perche' `_redirects` non ha (e non deve avere) una regola `/news/*`:
  //      l'articolo vero riceveva public/404.html.
  // Rendendo all'edge, l'articolo esiste appena e' pubblicato e il build non
  // parla piu' col backend.
  //
  // ⚠️ Il 404 vero di un id inesistente NON e' piu' un file e non e' nemmeno
  // l'app: lo produce la Function, che risponde 404 col corpo di
  // `public/404.html` quando l'API dice 404. Se quel ramo sparisce, ogni id
  // inventato risponde 200 = soft-404 su infinite URL inventabili.
  //
  // ⚠️ Quando la Fase 4 rinominera' il parametro in `:slug`, va rinominato QUI e
  // in `app.routes.ts` insieme: check-routes.mjs confronta i due file.
  { path: 'news/:id', renderMode: RenderMode.Client },

  // Tutto il resto (allenamento, lezioni, live, docs, negozio, account,
  // admin e le sue figlie /admin/<sezione>, login, registrazione,
  // verifica/reset token, wildcard 404) → client.
  { path: '**', renderMode: RenderMode.Client },
];
