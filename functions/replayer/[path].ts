/**
 * La pagina di una MANO resa all'edge — Cloudflare Pages Function, directory
 * mode. Gemella di `functions/news/[[path]].ts`, e le differenze sono due, non
 * una: leggerle prima di toccare qualsiasi cosa.
 *
 * ⚠️ **DIFFERENZA 1 — IL NOME DEL FILE È `[path].ts`, NON `[[path]].ts`.**
 * Il catch-all *opzionale* delle news serve perché lì anche il prefisso nudo
 * (`/news`) è servito dalla Function. Qui **no**: `/replayer` è una pagina
 * **prerenderizzata**, con il suo HTML, i suoi meta e le sue 961 parole, e
 * `_routes.json` include soltanto `/replayer/*`. Usare `[[path]]` non
 * romperebbe niente a vista — l'include decide comunque chi arriva qui — ma
 * dichiarerebbe un'intenzione falsa. Un segmento, una mano.
 *
 * ⚠️⚠️ **DIFFERENZA 2 — IL `noindex` NON SI TOGLIE, SI CONFERMA.**
 * Il renderer delle news **rimuove** il meta che `inject-csr-noindex.mjs` mette
 * nello scheletro, perché un articolo deve essere indicizzabile. Qui il meta
 * resta, ed è imposto esplicitamente: le pagine delle mani sono `noindex` per
 * decisione D2, e su quel `noindex` poggia la difendibilità dell'intero
 * trattamento — i nickname di terzi sono accettabili perché raggiungibili da chi
 * ha il collegamento e **non cercabili per nome**. Nessuna guardia di build può
 * vederlo: `check-prerender-content.mjs` legge `dist/`, e queste risposte in
 * `dist/` non esistono. Lo verifica `scripts/check-news-live.mjs` dal vivo.
 *
 * ⚠️ **MAI UN 5xx.** Un guasto qui non è un incidente del sito: è una pagina che
 * non si vede. Mano inesistente → **404 vero** col corpo di `public/404.html`
 * (senza quel ramo ogni indirizzo inventato risponde 200 = soft-404 su URL
 * infinite); API muta o scheletro irriconoscibile → shell CSR a 200 `no-store`,
 * che monta la SPA e carica la pagina da sé.
 *
 * ⚠️ **UN SOLO INDIRIZZO BUONO.** La forma senza barra finale risponde **301**
 * verso `/replayer/<publicId>/`, la stessa stringa che il canonical dichiara —
 * quando una richiesta la prende una Function, Cloudflare **non normalizza
 * niente** (misurato in produzione sulle news il 19/08/2026).
 *
 * ⚠️ **E MAI IN CACHE UN 404**: la chiave è l'URL, e una mano caricata un minuto
 * dopo resterebbe coperta dal proprio 404.
 */

// ⚠️ Import RELATIVO: Cloudflare compila le Function con esbuild, che lo segue.
// Non passa dal typecheck di Angular (nessun tsconfig del repo include
// `functions/`), quindi qui la rete di sicurezza sono i test di
// `scripts/lib/hand-render.test.mjs`.
// @ts-ignore: modulo .mjs senza dichiarazioni di tipo.
import { escapeHtml, redirezione, renderMano } from '../lib/render-hand.mjs';

/** Stessa origine di `environments/environment.prod.ts`. */
const API = 'https://api.bestfishforever.it';

/**
 * ⚠️ SENZA `.html`. Cloudflare toglie l'estensione: `/index.csr.html` risponde
 * 308 verso `/index.csr`. È l'incidente del 12/07/2026, documentato in
 * `public/_redirects`.
 */
const SHELL = '/index.csr';
const PAGINA_404 = '/404.html';

/** Vita della copia di bordo. Nessuna purge: stessa scelta delle news. */
const S_MAXAGE = 60;

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

type Esito =
  | { tipo: 'html'; html: string }
  | { tipo: 'asset' }
  | { tipo: 'redirect'; a: string }
  | { tipo: 'nonTrovata' }
  | { tipo: 'ripiego' };

export async function onRequestGet(ctx: EdgeContext): Promise<Response> {
  const chiave = ctx.request.url;
  const inCache = await caches.default.match(chiave);
  if (inCache) return inCache;

  let esito: Esito;
  try {
    esito = await rendi(ctx);
  } catch {
    // Scheletro cambiato di forma, JSON illeggibile, rete che cade a metà:
    // qualunque cosa sia, il lettore riceve la pagina — gliela monta la SPA.
    return await shellFallback(ctx);
  }

  // La pagina indice della sezione: la serve il server degli asset.
  if (esito.tipo === 'asset') return await ctx.next();
  if (esito.tipo === 'nonTrovata') return await paginaNonTrovata(ctx);
  if (esito.tipo === 'ripiego') return await shellFallback(ctx);

  if (esito.tipo === 'redirect') {
    const salto = rispostaRedirect(esito.a);
    ctx.waitUntil(caches.default.put(chiave, salto.clone()).catch(() => undefined));
    return salto;
  }

  const out = rispostaHtml(esito.html);
  // ⚠️ `.catch()`: la Cache API rifiuta certe risposte, e una promise respinta
  // dentro `waitUntil` diventa un'eccezione del Worker DOPO che la risposta è
  // già partita — un errore nei log per una copia non riuscita, che non è un
  // guasto.
  ctx.waitUntil(caches.default.put(chiave, out.clone()).catch(() => undefined));
  return out;
}

/**
 * ⚠️ HEAD, e non è una formalità. In directory mode Cloudflare instrada al
 * gestore del **suo** metodo: esportando solo `onRequestGet`, un `curl -sI` —
 * cioè ogni verifica post-deploy — troverebbe 404 mentre il GET risponde 200, e
 * direbbe «la Function non viene invocata» mentre funziona.
 */
export const onRequestHead = onRequestGet;

async function rendi(ctx: EdgeContext): Promise<Esito> {
  const pathname = new URL(ctx.request.url).pathname;
  const segmenti = pathname.replace(/\/+$/, '').split('/').filter(Boolean);

  /**
   * ⚠️ **RETE DI SICUREZZA sul prefisso nudo.** `/replayer` e `/replayer/` sono
   * la pagina **prerenderizzata** della sezione, e `public/_routes.json` le
   * ritaglia fuori con un `exclude` — quindi normalmente qui non arrivano mai.
   * Se però quell'`exclude` sparisse, `/replayer/*` le catturerebbe e questa
   * Function risponderebbe **404 sulla pagina indice**, con l'HTML statico
   * intatto sul disco e nessun errore da nessuna parte.
   * `ctx.next()` passa la richiesta al server degli asset, che serve la pagina
   * vera. Costa una riga e trasforma una regressione muta in un non-evento.
   */
  if (segmenti.length === 1 && segmenti[0] === 'replayer') {
    return { tipo: 'asset' };
  }

  // ['replayer', publicId] — qualunque altra cosa sotto `/replayer/` non è una
  // rotta dell'app: 404 vero, non una shell con dentro il nulla.
  if (segmenti.length !== 2 || segmenti[0] !== 'replayer') return { tipo: 'nonTrovata' };

  // ⚠️ `decodeURIComponent` LANCIA su una percentuale malformata (`/replayer/%zz`),
  // e un'eccezione qui finirebbe nel ripiego: una URL inventata risponderebbe
  // 200 con la shell invece che 404 — un soft-404 ottenuto scrivendo male una
  // percentuale.
  let publicId: string;
  try {
    publicId = decodeURIComponent(segmenti[1]);
  } catch {
    return { tipo: 'nonTrovata' };
  }
  if (!publicId) return { tipo: 'nonTrovata' };

  const res = await fetch(`${API}/hands/${encodeURIComponent(publicId)}`, {
    headers: { accept: 'application/json' },
  });
  // ⚠️ Solo il 404 dell'API è un «non esiste»: un 429 o un 500 sono un guasto
  // NOSTRO, e togliere una mano vera per un minuto di sovraccarico sarebbe il
  // danno peggiore fra i due.
  if (res.status === 404) return { tipo: 'nonTrovata' };
  if (!res.ok) return { tipo: 'ripiego' };
  const mano = await res.json();

  // ⚠️ Il confronto si fa DOPO il fetch: costa zero e fa sì che una chiave
  // inesistente riceva il suo 404 invece di un 301 verso il nulla.
  const salto = redirezione(pathname, mano?.publicId || publicId);
  if (salto) return { tipo: 'redirect', a: salto };

  return { tipo: 'html', html: renderMano(await scheletro(ctx), mano) };
}

/**
 * Lo scheletro = la shell CSR vera, con i nomi dei chunk di QUESTO build.
 * Memoizzata a livello di modulo: in un isolate di Workers il modulo sopravvive
 * fra una richiesta e l'altra. ⚠️ La memo tiene solo i successi: memorizzare un
 * errore vorrebbe dire che un isolate nato in un momento sfortunato servirebbe
 * il ripiego per tutta la sua vita.
 */
let scheletroMemo: string | null = null;

async function scheletro(ctx: EdgeContext): Promise<string> {
  if (scheletroMemo) return scheletroMemo;
  const res = await ctx.env.ASSETS.fetch(new URL(SHELL, ctx.request.url));
  if (!res.ok) throw new Error(`scheletro non disponibile (${res.status})`);
  const html = await res.text();
  if (!html.includes('<app-root')) throw new Error('scheletro senza <app-root>');
  scheletroMemo = html;
  return html;
}

/**
 * ⚠️ `x-content-type-options` va messo qui: gli header di `public/_headers` NON
 * si applicano alle risposte delle Function. ⚠️ E `X-Robots-Tag` **anche**: la
 * riga `/replayer/:publicId` di `_headers` non copre queste risposte, e il
 * `noindex` nel corpo da solo lascerebbe scoperto chi legge solo le
 * intestazioni. Due strade indipendenti, come per la shell CSR.
 */
function rispostaHtml(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=0, s-maxage=${S_MAXAGE}`,
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, follow',
      'x-bff-hand': 'edge',
    },
  });
}

/**
 * ⚠️ `max-age=0` per il browser: un 301 è «permanente» e senza direttiva
 * esplicita un browser se lo tiene per un tempo suo, dove non arriva nessun
 * purge e nessun deploy. ⚠️ 301 e non 308: il 308 conserva il metodo, che qui
 * non serve (si risponde solo a GET e HEAD), mentre il 301 è il segnale che gli
 * strumenti SEO leggono senza ambiguità. Il `Location` è un **percorso**, così
 * su un'anteprima di ramo il salto resta dentro l'anteprima.
 */
function rispostaRedirect(percorso: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      location: percorso,
      'cache-control': `public, max-age=0, s-maxage=${S_MAXAGE}`,
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, follow',
      'x-bff-hand': 'edge-301',
    },
  });
}

/** 404 vero col corpo di `public/404.html`. ⚠️ `no-store`: vedi l'intestazione. */
async function paginaNonTrovata(ctx: EdgeContext): Promise<Response> {
  try {
    const res = await ctx.env.ASSETS.fetch(new URL(PAGINA_404, ctx.request.url));
    return new Response(res.body, {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, follow',
        'x-bff-hand': 'edge-404',
      },
    });
  } catch {
    return ultimaSpiaggia(404, 'Mano non trovata');
  }
}

/**
 * La shell CSR a 200: la SPA si monta e carica la pagina da sé.
 * ⚠️ Qui il `noindex` iniettato resta com'è (questo file legge l'asset vero,
 * quello patchato): un corpo degradato non deve entrare nell'indice — e per una
 * mano non deve entrarci **nemmeno** quello buono.
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
        'x-robots-tag': 'noindex, follow',
        'x-bff-hand': 'edge-shell',
      },
    });
  } catch {
    return ultimaSpiaggia(200, 'Caricamento della mano non riuscito');
  }
}

/**
 * Ultima spiaggia: nemmeno gli asset rispondono. Non è una bella pagina — è il
 * modo di non restituire un 5xx, che `SentryExceptionFilter` conterebbe come
 * incidente e che a un lettore direbbe «il sito è rotto» invece di «questa
 * pagina no».
 */
function ultimaSpiaggia(status: number, messaggio: string): Response {
  const html =
    '<!doctype html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="robots" content="noindex, follow">' +
    `<title>${escapeHtml(messaggio)} — Best Fish Forever</title></head><body>` +
    `<main><h1>${escapeHtml(messaggio)}</h1>` +
    '<p><a href="/replayer/">Torna al Replayer</a></p></main></body></html>';
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, follow',
      'x-bff-hand': 'edge-minima',
    },
  });
}
