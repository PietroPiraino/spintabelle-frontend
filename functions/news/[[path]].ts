/**
 * La sezione news resa all'edge — Cloudflare Pages Function, DIRECTORY MODE.
 *
 * ⚠️ QUI NON GIRA ANGULAR, ED E' UNA DECISIONE PRESA DOPO AVER PROVATO IL
 * CONTRARIO. La prima stesura di questo file importava l'handler SSR
 * (`dist/frontend/server/server.mjs`): il build passava, e Cloudflare rifiutava
 * il caricamento con «Your Worker exceeded the size limit of 3 MiB» — quella
 * cartella pesa 11 MB non compressi / 2,84 MB gzip, e il pezzo dominante e' un
 * chunk lazy che con le notizie non c'entra niente. Non e' solo la via
 * economica: la superficie che serve davvero a un articolo (titolo, meta,
 * canonical, OG, JSON-LD, corpo Markdown) e' piccola, e sta tutta in
 * `functions/lib/render-news.mjs`, che questo file avvolge.
 *
 * DIVISIONE DEI COMPITI: li' la pagina (funzioni pure, testate da `npm run
 * test:scripts`), qui la busta — cache di bordo, intestazioni, 404 vero e la
 * regola che nessun guasto diventi un 5xx.
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
 * non si vede. Articolo inesistente -> 404 VERO (mai un soft-404 a 200: e' il
 * difetto che `public/404.html` ha chiuso il 16/08/2026); API muta o scheletro
 * irriconoscibile -> shell CSR a 200, che monta la SPA e carica la pagina da
 * sola.
 *
 * ⚠️ UN SOLO INDIRIZZO BUONO PER OGNI ARTICOLO. L'API apre tre porte sulla
 * stessa pagina — slug corrente, slug storico, ObjectId — e fino al 19/08/2026
 * rispondevano tutte e tre 200: tre URL per un contenuto solo, con lo stesso
 * canonical. Ora le due porte vecchie rispondono **301** verso `/news/<slug>/`,
 * la stessa forma che il canonical dichiara. Con loro cade il quarto doppione,
 * la forma senza slash finale. Misurato in produzione lo stesso giorno:
 * `/news/<slug>` rispondeva 200 con la stessa identica pagina, perche' quando una
 * richiesta la prende una Function Cloudflare non normalizza un bel niente.
 * La regola e' pura e sta in `render-news.mjs` (`redirezione`); qui c'e' solo la
 * busta.
 *
 * ⚠️ E MAI IN CACHE UN 404. La chiave della cache di bordo e' l'URL: un articolo
 * pubblicato un minuto dopo resterebbe coperto dal proprio 404 per un minuto.
 * In cache ci va solo il 200.
 */

// ⚠️ Import RELATIVI di moduli del repo: Cloudflare compila le Function con
// esbuild, che li segue e li impacchetta. Non passano dal typecheck di Angular
// (nessun tsconfig del repo include `functions/`), quindi qui la rete di
// sicurezza sono i test di `scripts/lib/news-render.test.mjs`.
// @ts-ignore: modulo .mjs senza dichiarazioni di tipo.
import { escapeHtml, redirezione, renderArticolo, renderIndice } from '../lib/render-news.mjs';

/** Stessa origine di `environments/environment.prod.ts`. */
const API = 'https://api.bestfishforever.it';

/**
 * ⚠️ SENZA `.html`. Cloudflare toglie l'estensione: `/index.csr.html` risponde
 * 308 verso `/index.csr`. E' l'incidente del 12/07/2026, documentato in
 * `public/_redirects`.
 */
const SHELL = '/index.csr';
const PAGINA_404 = '/404.html';

/** Vita della copia di bordo. Nessuna purge: vedi il commento su `caches`. */
const S_MAXAGE = 60;

/**
 * Vita di bordo di un 301. Volutamente la stessa delle pagine, e volutamente
 * NON di piu': vedi `rispostaRedirect`.
 */
const S_MAXAGE_301 = 60;

/** Quanti articoli mostra l'indice: la prima pagina di `news-list.component.ts`. */
const PER_PAGINA = 9;

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

/** Cosa e' uscito dal render: una pagina, un salto, un "non esiste", o "ripiega". */
type Esito =
  | { tipo: 'html'; html: string }
  | { tipo: 'redirect'; a: string }
  | { tipo: 'nonTrovata' }
  | { tipo: 'ripiego' };

// ---- Handler -----------------------------------------------------------

export async function onRequestGet(ctx: EdgeContext): Promise<Response> {
  // Cache di bordo. Chiave = URL richiesta, quindi `/news/x` e `/news/x/` restano
  // due voci — ma da quando la prima risponde 301 verso la seconda quelle due
  // voci sono un salto e una pagina, non due copie della stessa pagina.
  // ⚠️ Nessuna purge: `cache.delete()` pulisce UN SOLO colo, quindi
  // prometterebbe un ritiro immediato che non avviene. Il ritiro immediato,
  // quando servira', e' una Cache Rule di zona + purge del singolo URL (azione
  // owner sul pannello Cloudflare), non una riga di codice qui.
  const chiave = ctx.request.url;
  const inCache = await caches.default.match(chiave);
  if (inCache) return inCache;

  let esito: Esito;
  try {
    esito = await rendi(ctx);
  } catch {
    // Scheletro cambiato di forma, JSON illeggibile, rete che cade a meta':
    // qualunque cosa sia, il lettore riceve la pagina — gliela monta la SPA.
    return await shellFallback(ctx);
  }

  if (esito.tipo === 'nonTrovata') return await paginaNonTrovata(ctx);
  if (esito.tipo === 'ripiego') return await shellFallback(ctx);

  if (esito.tipo === 'redirect') {
    const salto = rispostaRedirect(esito.a);
    // In cache come il 200, stessa chiave e stessa vita breve: un indirizzo
    // vecchio molto condiviso non deve interrogare l'API a ogni colpo.
    ctx.waitUntil(caches.default.put(chiave, salto.clone()).catch(() => undefined));
    return salto;
  }

  const out = rispostaHtml(esito.html);
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
 * Il renderer non guarda il metodo (produce la stessa pagina); a scartare il
 * corpo e' il protocollo, come deve.
 */
export const onRequestHead = onRequestGet;

// ---- Instradamento e resa ----------------------------------------------

/**
 * Le uniche due pagine di questa Function. Tutto il resto sotto `/news/`
 * (`/news/a/b`) non e' una rotta dell'app: 404 vero, non una shell con dentro
 * il nulla.
 */
async function rendi(ctx: EdgeContext): Promise<Esito> {
  const pathname = new URL(ctx.request.url).pathname;
  // Via lo slash finale (e i doppi): `/news/` e `/news` sono la stessa pagina.
  const pulito = pathname.replace(/\/+$/, '');
  const segmenti = pulito.split('/').filter(Boolean); // ['news'] | ['news', chiave]

  // ⚠️ Anche l'indice ha UNA forma buona. `/news` e `/news/` rispondevano
  // tutte e due 200 con lo stesso HTML e lo stesso canonical: un doppione, cioe'
  // lo stesso difetto degli indirizzi vecchi.
  if (segmenti.length === 1) {
    const salto = redirezione(pathname, '');
    return salto ? { tipo: 'redirect', a: salto } : await rendiIndice(ctx);
  }
  if (segmenti.length !== 2) return { tipo: 'nonTrovata' };

  // ⚠️ `decodeURIComponent` LANCIA su una percentuale malformata (`/news/%zz`),
  // e un'eccezione qui finirebbe nel ripiego: una URL inventata risponderebbe
  // 200 con la shell invece che 404 — un soft-404 ottenuto scrivendo male una
  // percentuale. Chi non e' decodificabile non e' un articolo.
  let chiave: string;
  try {
    chiave = decodeURIComponent(segmenti[1]);
  } catch {
    return { tipo: 'nonTrovata' };
  }
  return await rendiArticolo(ctx, chiave, pathname);
}

async function rendiArticolo(ctx: EdgeContext, chiave: string, pathname: string): Promise<Esito> {
  if (!chiave) return { tipo: 'nonTrovata' };
  const res = await fetch(`${API}/news/${encodeURIComponent(chiave)}`, {
    headers: { accept: 'application/json' },
  });
  // ⚠️ Solo il 404 dell'API e' un "non esiste": un 429 o un 500 sono un guasto
  // NOSTRO, e cancellare un articolo vero dall'indice per un minuto di
  // sovraccarico sarebbe il danno peggiore fra i due.
  if (res.status === 404) return { tipo: 'nonTrovata' };
  if (!res.ok) return { tipo: 'ripiego' };
  const articolo = await res.json();

  // ⚠️ IL CONFRONTO SI FA DOPO IL FETCH, e non prima: e' l'API a sapere qual e'
  // lo slug corrente (risolve per slug, per slug storico e per ObjectId). Farlo
  // dopo costa zero e vale due cose che prima non si potevano avere insieme: un
  // ObjectId senza slash finale arriva a destinazione in UN salto solo, e una
  // chiave che non esiste riceve il suo 404 invece di un 301 verso il nulla.
  // ⚠️ Slug corrente assente o vuoto -> il bersaglio resta la chiave richiesta,
  // cioe' non si reindirizza da nessuna parte e la pagina si rende. Costruire un
  // bersaglio su una stringa vuota vorrebbe dire spedire l'articolo sull'indice.
  const slugCorrente = typeof articolo?.slug === 'string' ? articolo.slug.trim() : '';
  const salto = redirezione(pathname, slugCorrente || chiave);
  if (salto) return { tipo: 'redirect', a: salto };

  return { tipo: 'html', html: renderArticolo(await scheletro(ctx), articolo, chiave) };
}

async function rendiIndice(ctx: EdgeContext): Promise<Esito> {
  const res = await fetch(`${API}/news?page=1&limit=${PER_PAGINA}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) return { tipo: 'ripiego' };
  const dati: unknown = await res.json();
  // L'elenco pubblico e' una busta `{items,…}`; la forma ad array e' il vecchio
  // contratto, tenuto perche' costa una riga e non sapere quale delle due arriva
  // significherebbe un indice vuoto senza alcun errore.
  const items = Array.isArray(dati) ? dati : ((dati as { items?: unknown[] })?.items ?? []);
  return { tipo: 'html', html: renderIndice(await scheletro(ctx), items) };
}

/**
 * Lo scheletro della pagina = la shell CSR vera, con i nomi dei chunk di QUESTO
 * build (hashati: scriverla a mano vorrebbe dire riscriverla a ogni deploy).
 *
 * Memoizzata a livello di modulo: in un isolate di Workers il modulo sopravvive
 * fra una richiesta e l'altra, quindi la si legge una volta sola. ⚠️ La memo
 * tiene solo i successi: memorizzare un errore vorrebbe dire che un isolate
 * nato in un momento sfortunato servirebbe il ripiego per tutta la sua vita.
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

// ---- Risposte ----------------------------------------------------------

/**
 * ⚠️ `x-content-type-options` va messo qui: gli header di `public/_headers` NON
 * si applicano alle risposte delle Function.
 * `x-bff-news` e' il marcatore per curl e per `scripts/check-news-live.mjs`:
 * dice da dove e' uscita la pagina.
 */
function rispostaHtml(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `public, max-age=0, s-maxage=${S_MAXAGE}`,
      'x-content-type-options': 'nosniff',
      'x-bff-news': 'edge',
    },
  });
}

/**
 * Il 301 verso l'unico indirizzo buono.
 *
 * ⚠️ `max-age=0` PER IL BROWSER, e non e' prudenza generica: un 301 e'
 * "permanente" e senza una direttiva esplicita un browser se lo tiene per un
 * tempo suo, indefinito. Un bersaglio sbagliato resterebbe inchiodato nei
 * browser dei lettori, dove non arriva nessun purge di Cloudflare e nessun
 * deploy: l'unico modo di ritirarlo sarebbe tenere in piedi per sempre una
 * pagina all'indirizzo sbagliato. Con `max-age=0` il browser richiede ogni
 * volta e una correzione entra in vigore al colpo dopo.
 *
 * ⚠️ `s-maxage=60`, cioe' lo stesso minuto delle pagine, e non di piu': il
 * bersaglio NON e' un fatto immutabile — cambia ogni volta che l'admin ri-conia
 * uno slug (il vecchio finisce in `slugStorici` e da quel momento punta al
 * nuovo). Un minuto e' quanto puo' durare un bersaglio vecchio ai bordi; piu' in
 * la' non si va, perche' una purge qui non c'e' (vedi l'intestazione).
 *
 * ⚠️ 301 e non 308: la differenza e' che il 308 conserva il metodo, che qui non
 * serve (si risponde solo a GET e HEAD), mentre il 301 e' il segnale di
 * "trasloco definitivo" che gli strumenti SEO e Search Console leggono senza
 * ambiguita'. E il `Location` e' un PERCORSO, non una URL assoluta: cosi' su
 * un'anteprima di ramo il salto resta dentro l'anteprima.
 */
function rispostaRedirect(percorso: string): Response {
  return new Response(null, {
    status: 301,
    headers: {
      location: percorso,
      'cache-control': `public, max-age=0, s-maxage=${S_MAXAGE_301}`,
      'x-content-type-options': 'nosniff',
      'x-bff-news': 'edge-301',
    },
  });
}

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
 * E' l'esatto contrario di cio' che fa il renderer sulla pagina vera.
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
