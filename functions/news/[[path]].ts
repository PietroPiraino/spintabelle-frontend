/**
 * SSR all'edge per la sezione news — Cloudflare Pages Function, DIRECTORY MODE.
 *
 * SOSTITUISCE `functions/news/[id].ts` (tappa 1), che rendeva a mano soltanto
 * gli articoli che il prerender aveva mancato. Da qui in poi rende TUTTO:
 * `/news` (l'indice) e `/news/<id>` sono `RenderMode.Server` in
 * `app.routes.server.ts`, e l'HTML lo produce l'app Angular vera — stesso
 * template, stessi componenti, stessi meta del resto del sito. Niente piu'
 * chirurgia sulla shell CSR, niente piu' markdown duplicato all'edge.
 *
 * ⚠️ IL NOME DEL FILE E' IL PUNTO. `[[path]]` e' il catch-all OPZIONALE di
 * Cloudflare Pages: cattura sia `/news` (prefisso nudo) sia `/news/<id>`. Un
 * `[path]` normale prenderebbe solo i figli e l'indice resterebbe scoperto —
 * e' la stessa trappola del prefisso nudo gia' pagata in `_redirects` con
 * `/live/*` (li' al contrario: catturava anche `/live`). Rinominarlo
 * `[path].ts` spegne l'indice senza rompere niente a vista.
 *
 * ⚠️ DIRECTORY MODE, MAI `_worker.js`. In advanced mode il worker riceve OGNI
 * richiesta e `_headers`/`_redirects` smettono di applicarsi alle sue risposte:
 * la deindicizzazione delle rotte client del 17/08/2026 (`X-Robots-Tag` in
 * `public/_headers`) decadrebbe IN SILENZIO. `scripts/check-routes.mjs`
 * fallisce se compare un `_worker.js`, e `scripts/check-news-live.mjs` verifica
 * dal vivo che quell'header ci sia ancora.
 *
 * ⚠️ MAI UN 5xx. Un guasto qui non e' un incidente del sito: e' una pagina che
 * non si vede. Id inesistente -> 404 VERO (mai un soft-404 a 200: e' il difetto
 * che `public/404.html` ha chiuso il 16/08/2026); qualsiasi eccezione -> shell
 * CSR a 200, che monta la SPA e carica l'articolo da sola.
 *
 * ⚠️ E MAI IN CACHE UN 404. La chiave della cache di bordo e' l'URL: un articolo
 * pubblicato un minuto dopo resterebbe coperto dal proprio 404 per un minuto.
 * In cache ci va solo il 200.
 */

// ⚠️ L'artefatto esiste solo DOPO `npm run build` (`"ssr": {"entry":
// "src/server.ts"}` in angular.json). Non passa dal typecheck di Angular —
// nessun tsconfig del repo include `functions/` — e Cloudflare compila le
// Function con esbuild, che segue l'import relativo e ci impacchetta dentro
// l'app server (main.server.mjs + i chunk + gli HTML incorporati).
// @ts-ignore: modulo generato dal build, assente in sorgente.
import ssrHandler from '../../dist/frontend/server/server.mjs';

/**
 * ⚠️ SENZA `.html`. Cloudflare toglie l'estensione: `/index.csr.html` risponde
 * 308 verso `/index.csr`. E' l'incidente del 12/07/2026, documentato in
 * `public/_redirects`.
 */
const SHELL = '/index.csr';
const PAGINA_404 = '/404.html';

/** Vita della copia di bordo. Nessuna purge: vedi il commento su `caches`. */
const S_MAXAGE = 60;

// ---- Tipi minimi -------------------------------------------------------
//
// Dichiarati qui invece di dipendere da `@cloudflare/workers-types`: nessun
// tsconfig del repo include `functions/`, e Cloudflare compila con esbuild, che
// i tipi li cancella e basta. Una dipendenza in piu' non proteggerebbe nulla.

interface Assets {
  fetch(input: Request | string | URL): Promise<Response>;
}

interface EdgeContext {
  request: Request;
  params: Record<string, string | string[]>;
  env: { ASSETS: Assets };
  next(): Promise<Response>;
  waitUntil(promise: Promise<unknown>): void;
}

interface CacheDefault {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

declare const caches: { default: CacheDefault };

type Ssr = (request: Request) => Promise<Response | null>;

const rendi = ssrHandler as unknown as Ssr;

// ---- Handler -----------------------------------------------------------

export async function onRequestGet(ctx: EdgeContext): Promise<Response> {
  // Cache di bordo. Chiave = URL richiesta, quindi `/news/x` e `/news/x/` sono
  // due voci: accettato, il costo e' una resa in piu' al minuto.
  // ⚠️ Nessuna purge: `cache.delete()` pulisce UN SOLO colo, quindi
  // prometterebbe un ritiro immediato che non avviene. Il ritiro immediato,
  // quando servira', e' una Cache Rule di zona + purge del singolo URL (azione
  // owner sul pannello Cloudflare), non una riga di codice qui.
  const chiave = ctx.request.url;
  const inCache = await caches.default.match(chiave);
  if (inCache) return inCache;

  let reso: Response | null;
  try {
    reso = await rendi(ctx.request);
  } catch {
    return await shellFallback(ctx);
  }

  // `null` = nessuna rotta ha risposto. Non dovrebbe capitare (il `**` di
  // app.routes.ts copre tutto), ma se capita e' un 404 vero, non un 500.
  if (!reso) return await paginaNonTrovata(ctx);

  // 404 dell'applicazione: lo scrive `news-detail.component.ts` mutando
  // RESPONSE_INIT quando l'articolo non esiste. Il corpo e' la NOSTRA pagina
  // (header, footer, "torna alle news"), quindi si tiene: 404.html serve solo
  // quando non abbiamo niente di renderizzato da mostrare.
  if (reso.status === 404) return conIntestazioni(reso, 'edge-404', false);
  if (reso.status >= 500) return await shellFallback(ctx);

  // 3xx (i futuri 301 slug della Fase 4) passano intatti, senza cache.
  if (reso.status >= 300 && reso.status < 400) return conIntestazioni(reso, 'edge-redirect', false);

  // ⚠️ QUI SI ARRIVA SOLO CON UN 200, ed e' voluto che il controllo sia questo e
  // non `reso.ok`. L'engine di Angular puo' rispondere **400 Bad Request** con un
  // corpo di testo quando l'hostname non e' in `allowedHosts` (vedi src/server.ts):
  // un 400 non e' ne' un 404 ne' un 5xx, quindi senza questa riga verrebbe
  // trattato come una pagina buona, marcato `edge` e MESSO IN CACHE per 60
  // secondi per colo — cioe' l'errore piu' probabile di tutta la migrazione
  // diventerebbe anche il piu' appiccicoso. Ripieghiamo sulla shell: il lettore
  // vede comunque la pagina (la monta la SPA), e niente entra in cache.
  if (reso.status !== 200) return await shellFallback(ctx);

  const out = conIntestazioni(reso, 'edge', true, deveEssereDeindicizzata(ctx.request.url));
  // ⚠️ `.catch()`: la Cache API rifiuta certe risposte (per esempio un `no-store`)
  // e una promise respinta dentro `waitUntil` diventa un'eccezione del Worker
  // DOPO che la risposta e' gia' partita — un errore nei log per una copia in
  // cache non riuscita, che non e' un guasto.
  ctx.waitUntil(caches.default.put(chiave, out.clone()).catch(() => undefined));
  return out;
}

/**
 * ⚠️ HEAD, e non e' una formalita'. In directory mode Cloudflare instrada una
 * richiesta al gestore del SUO metodo: esportando solo `onRequestGet`, un HEAD
 * su `/news/<id>/` non trova gestore e finisce sugli asset, dove un articolo non
 * esiste piu' — cioe' risponderebbe 404 mentre il GET risponde 200. Se ne
 * accorgerebbe per prima la verifica del piano (§1.7), che e' scritta con
 * `curl -sI` (= HEAD) e direbbe "la Function non viene invocata" mentre invece
 * funziona. Ci passano anche i link checker e qualche scraper.
 * L'engine di Angular non guarda il metodo (verificato in @angular/ssr 22:
 * `AngularServerApp.handle` instrada solo sull'URL), quindi il corpo viene
 * prodotto lo stesso e a scartarlo e' il protocollo, come deve.
 */
export const onRequestHead = onRequestGet;

/**
 * Riscrive le intestazioni tenendo corpo e stato dell'app.
 * `x-bff-news` e' il marcatore per curl e per `scripts/check-news-live.mjs`:
 * dice da dove e' uscita la pagina.
 * ⚠️ `x-content-type-options` va messo qui: gli header di `public/_headers` NON
 * si applicano alle risposte delle Function.
 */
function conIntestazioni(
  res: Response,
  marcatore: string,
  cacheabile: boolean,
  noindex = false,
): Response {
  const headers = new Headers(res.headers);
  headers.set('cache-control', cacheabile ? `public, max-age=0, s-maxage=${S_MAXAGE}` : 'no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-bff-news', marcatore);
  if (noindex) headers.set('x-robots-tag', 'noindex, follow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/**
 * ⚠️ Rete di sicurezza per le URL SOTTO `/news/` che non sono ne' l'indice ne'
 * un articolo (`/news/abc/def`). Quelle finiscono sul `**` di app.routes.ts,
 * che e' `RenderMode.Client`: l'engine risponde con la shell CSR presa dagli
 * asset INCORPORATI NEL BUNDLE SERVER — cioe' la copia prodotta da `ng build`,
 * PRIMA che `scripts/inject-csr-noindex.mjs` scriva il meta `noindex` dentro
 * `dist/frontend/browser/index.csr.html`. Quella copia il meta non ce l'ha, e
 * nessuna guardia puo' vederlo: `check-prerender-content.mjs` misura `dist/`, e
 * questa risposta in `dist/` non esiste. Qui si rimette il segnale come header.
 * Il controllo e' sulla FORMA dell'URL, non sul corpo: deterministico.
 */
function deveEssereDeindicizzata(url: string): boolean {
  const pathname = new URL(url).pathname.replace(/\/+$/, '');
  if (pathname === '/news' || pathname === '') return false;
  // `/news/<un solo segmento>` = un articolo.
  return !/^\/news\/[^/]+$/.test(pathname);
}

// ---- Risposte di servizio ----------------------------------------------

/**
 * 404 vero col corpo di `public/404.html`, per quando non abbiamo una pagina
 * renderizzata da mostrare. ⚠️ `no-store`: vedi l'intestazione del file.
 */
async function paginaNonTrovata(ctx: EdgeContext): Promise<Response> {
  try {
    const res = await ctx.env.ASSETS.fetch(new URL(PAGINA_404, ctx.request.url));
    return new Response(res.body, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-bff-news': 'edge-404',
      },
    });
  } catch {
    return ultimaSpiaggia(404, 'Articolo non trovato');
  }
}

/**
 * La shell CSR a 200: la SPA si monta e carica la pagina da sola.
 * ⚠️ Qui il `noindex` iniettato NON si toglie (e questo file legge l'asset
 * vero, quello patchato): un corpo degradato non deve entrare nell'indice.
 */
async function shellFallback(ctx: EdgeContext): Promise<Response> {
  try {
    const res = await ctx.env.ASSETS.fetch(new URL(SHELL, ctx.request.url));
    return new Response(res.body, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-bff-news': 'edge-shell',
      },
    });
  } catch {
    return ultimaSpiaggia(200, 'Caricamento della pagina non riuscito');
  }
}

/**
 * Ultima spiaggia: nemmeno gli asset rispondono. Pagina minima, in italiano,
 * `noindex`. Non e' una bella pagina — e' il modo di non restituire un 5xx, che
 * `SentryExceptionFilter` conterebbe come incidente e che a un lettore direbbe
 * "il sito e' rotto" invece di "questa pagina no".
 */
function ultimaSpiaggia(status: number, messaggio: string): Response {
  const html =
    '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="robots" content="noindex, follow">' +
    `<title>${escapeHtml(messaggio)} — Best Fish Forever</title></head><body>` +
    `<main><h1>${escapeHtml(messaggio)}</h1>` +
    '<p><a href="/news/">Torna alle news</a></p></main></body></html>';
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-bff-news': 'edge-minima',
    },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
