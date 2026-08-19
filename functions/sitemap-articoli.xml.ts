/**
 * `/sitemap-articoli.xml` — l'archivio: tutti gli articoli pubblicati, formato
 * sitemap standard, generato all'edge.
 *
 * ⚠️ LA PRIMA <loc> E' L'INDICE `/news/` STESSO, e non e' una gentilezza: e' il
 * motivo per cui questo file e' obbligatorio e non un di piu'. Da quando la
 * sezione news si compone all'edge, l'indice NON e' piu' in
 * `prerendered-routes.json`, e `gen-sitemap.mjs` DERIVA la sitemap principale da
 * quel manifest: senza questa riga `/news` non comparirebbe in NESSUNA sitemap
 * del sito, in silenzio, e nessuna guardia potrebbe accorgersene (misurano
 * `dist/`, e questa risposta in `dist/` non esiste).
 *
 * ⚠️ MAI UN 5xx: API muta -> l'ultima copia buona di questo isolate, altrimenti
 * la sola riga dell'indice. Anche degradata, questa sitemap dice sempre almeno
 * la verita' minima ("esiste /news/").
 */

const API = 'https://api.bestfishforever.it';
const SITE = 'https://bestfishforever.it';

/** Un'ora: e' l'archivio, non la freschezza (quella e' /news-sitemap.xml). */
const S_MAXAGE = 3600;

interface Articolo {
  identificativo: string;
  /** Data della RETTIFICA se c'e', altrimenti della pubblicazione (regola D45). */
  aggiornatoIl: string;
}

interface EdgeContext {
  request: Request;
  waitUntil(promise: Promise<unknown>): void;
}

interface CacheDefault {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

declare const caches: { default: CacheDefault };

/** Ultima risposta valida di QUESTO isolate: vedi `/news-sitemap.xml`. */
let ultimaBuona: string | null = null;

export async function onRequestGet(ctx: EdgeContext): Promise<Response> {
  const chiave = ctx.request.url;
  const inCache = await caches.default.match(chiave);
  if (inCache) return inCache;

  let xml: string;
  try {
    xml = toXml(await caricaArticoli());
    ultimaBuona = xml;
  } catch {
    if (!ultimaBuona) return risposta(toXml([]), false);
    xml = ultimaBuona;
  }

  const out = risposta(xml, true);
  // ⚠️ `.catch()`: la Cache API rifiuta certe risposte (per esempio un `no-store`)
  // e una promise respinta dentro `waitUntil` diventa un'eccezione del Worker
  // DOPO che la risposta e' gia' partita — un errore nei log per una copia in
  // cache non riuscita, che non e' un guasto.
  ctx.waitUntil(caches.default.put(chiave, out.clone()).catch(() => undefined));
  return out;
}

function risposta(xml: string, cacheabile: boolean): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': cacheabile ? `public, max-age=0, s-maxage=${S_MAXAGE}` : 'no-store',
      'x-content-type-options': 'nosniff',
      'x-bff-news': 'sitemap-articoli',
    },
  });
}

// ---- Dati ---------------------------------------------------------------

/**
 * Fonte = `GET /news/sitemap-data?all=1`.
 *
 * ⚠️ RIPIEGO DICHIARATO, DA TOGLIERE quando la Fase 0/4 pubblichera' quella
 * rotta: fino ad allora il backend risponde 404 e questo archivio sarebbe vuoto
 * proprio mentre gli articoli lasciano il manifest del prerender. Il ripiego e'
 * l'elenco pubblico paginato, che oggi esiste. Due fonti per la stessa lista
 * sono un difetto (lo documenta `gen-sitemap.mjs` su se' stesso): appena la
 * prima risponde, la seconda va CANCELLATA.
 */
async function caricaArticoli(): Promise<Articolo[]> {
  const proiezione = await fetch(`${API}/news/sitemap-data?all=1`, {
    headers: { accept: 'application/json' },
  });
  if (proiezione.ok) return normalizza(await proiezione.json());
  return await elencoPubblico();
}

/**
 * `<lastmod>` = `ultimaRettificaAt ?? publishedAt` (D45): la data si muove per
 * una RETTIFICA, mai per `updatedAt`. Un refuso corretto non e' freschezza, e
 * spacciarlo per tale e' esattamente il segnale che i motori puniscono.
 * Sul ripiego dell'elenco pubblico quel campo non esiste ancora: si usa
 * `createdAt`, cioe' la stessa data di pubblicazione, mai `updatedAt`.
 */
function normalizza(dati: unknown): Articolo[] {
  if (!Array.isArray(dati)) return [];
  const out: Articolo[] = [];
  for (const riga of dati as Record<string, unknown>[]) {
    const identificativo = riga['slug'] ?? riga['_id'];
    if (typeof identificativo !== 'string') continue;
    const rettifica = riga['ultimaRettificaAt'];
    const pubblicazione = riga['publishedAt'] ?? riga['createdAt'];
    const quando =
      typeof rettifica === 'string'
        ? rettifica
        : typeof pubblicazione === 'string'
          ? pubblicazione
          : '';
    out.push({ identificativo, aggiornatoIl: quando.slice(0, 10) });
  }
  return out;
}

/** Ripiego: l'elenco pubblico paginato (envelope `{items, totalPages}`). */
async function elencoPubblico(): Promise<Articolo[]> {
  const out: Articolo[] = [];
  // Il backend rifiuta `limit` ≥ 500: si pagina a 50, con un tetto a 20 pagine
  // (1.000 articoli) che e' anche la guardia anti-ciclo.
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${API}/news?page=${page}&limit=50`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) break;
    const dati: unknown = await res.json();
    const items = Array.isArray(dati)
      ? dati
      : ((dati as { items?: unknown[] })?.items ?? []);
    out.push(...normalizza(items));
    const totalPages = Number((dati as { totalPages?: unknown })?.totalPages) || 1;
    if (items.length === 0 || page >= totalPages) break;
  }
  return out;
}

// ---- XML ----------------------------------------------------------------

function toXml(articoli: Articolo[]): string {
  // ⚠️ L'indice per primo: vedi l'intestazione del file.
  const righe = [voce(`${SITE}/news/`, '', 'daily', '0.6')];
  for (const a of articoli)
    righe.push(voce(`${SITE}/news/${escapeXml(a.identificativo)}/`, a.aggiornatoIl, 'monthly', '0.5'));
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${righe.join('\n')}\n` +
    '</urlset>\n'
  );
}

function voce(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return (
    '  <url>\n' +
    `    <loc>${loc}</loc>\n` +
    (lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : '') +
    `    <changefreq>${changefreq}</changefreq>\n` +
    `    <priority>${priority}</priority>\n` +
    '  </url>'
  );
}

/**
 * ⚠️ Gli identificativi finiscono dentro XML: una `&` non scappata rende il file
 * MALFORMATO e Search Console scarta l'intera sitemap, non la singola riga.
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
