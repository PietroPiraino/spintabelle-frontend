/**
 * `/news-sitemap.xml` — sitemap in formato Google News, generata all'edge.
 *
 * PERCHE' UNA FUNCTION E NON `gen-sitemap.mjs`. La sitemap principale la DERIVA
 * il build da `prerendered-routes.json`: e' la sua forza (una pagina pubblica
 * nuova ci entra da sola) ed e' esattamente cio' che la rende inservibile per
 * le news, che si pubblicano dall'admin SENZA deploy. Da quando gli articoli
 * si compongono all'edge non sono piu' nel manifest e non sono piu' un file:
 * l'unico posto che puo' elencarli aggiornati e' l'edge.
 *
 * ⚠️ SOLO LE ULTIME 48 ORE. Google News ignora gli articoli piu' vecchi: tenerli
 * qui gonfia il file e basta. L'archivio completo e' `/sitemap-articoli.xml`.
 *
 * ⚠️ MAI UN 5xx (stessa regola della Function delle news): API muta -> l'ultima
 * copia buona di questo isolate, altrimenti un urlset VUOTO a 200 con
 * `no-store`. Un urlset vuoto e' una sitemap che dice "ora non ho articoli",
 * che e' vero e innocuo; un 500 e' un errore in Search Console e un incidente
 * in Sentry.
 */

const API = 'https://api.bestfishforever.it';
const SITE = 'https://bestfishforever.it';
const NOME_TESTATA = 'Best Fish Forever';

/** 10 minuti: e' il feed della freschezza, deve accorgersi di una pubblicazione. */
const S_MAXAGE = 600;

/** Finestra dichiarata da Google News. */
const ORE = 48;

interface Articolo {
  identificativo: string;
  titolo: string;
  pubblicatoIl: string;
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

/**
 * Ultima risposta valida prodotta da QUESTO isolate. Non e' una cache: e' la
 * rete che evita di pubblicare un urlset vuoto per un singolo starnuto
 * dell'API. Vive quanto l'isolate, e va benissimo cosi'.
 */
let ultimaBuona: string | null = null;

export async function onRequestGet(ctx: EdgeContext): Promise<Response> {
  const chiave = ctx.request.url;
  const inCache = await caches.default.match(chiave);
  if (inCache) return inCache;

  let xml: string;
  try {
    const articoli = await caricaArticoli();
    xml = toXml(articoli);
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
      'x-bff-news': 'sitemap-news',
    },
  });
}

// ---- Dati ---------------------------------------------------------------

/**
 * Fonte = l'endpoint di proiezione `GET /news/sitemap-data`.
 *
 * ⚠️ RIPIEGO DICHIARATO, DA TOGLIERE. Quell'endpoint arriva con la Fase 0/4 del
 * piano: finche' non c'e', il backend risponde 404 e questa sitemap sarebbe
 * VUOTA — cioe' i tre articoli gia' indicizzati uscirebbero da ogni sitemap del
 * sito nel momento esatto in cui lasciano il manifest del prerender. Quindi si
 * ripiega sull'elenco pubblico paginato, che oggi esiste. Il giorno in cui
 * `sitemap-data` risponde, questo ramo diventa morto: TOGLIERLO, non lasciarlo
 * "per sicurezza" — due fonti per la stessa lista e' il difetto che
 * `gen-sitemap.mjs` documenta su se' stesso.
 */
async function caricaArticoli(): Promise<Articolo[]> {
  const proiezione = await fetch(`${API}/news/sitemap-data?days=${ORE / 24}`, {
    headers: { accept: 'application/json' },
  });
  if (proiezione.ok) return normalizza(await proiezione.json()).filter(entroLaFinestra);

  const articoli = await elencoPubblico();
  return articoli.filter(entroLaFinestra);
}

function entroLaFinestra(a: Articolo): boolean {
  const t = Date.parse(a.pubblicatoIl);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= ORE * 60 * 60 * 1000;
}

/** Forma di `/news/sitemap-data`: `[{slug, title, publishedAt, ...}]`. */
function normalizza(dati: unknown): Articolo[] {
  if (!Array.isArray(dati)) return [];
  const out: Articolo[] = [];
  for (const riga of dati as Record<string, unknown>[]) {
    const identificativo = riga['slug'] ?? riga['_id'];
    const titolo = riga['title'];
    const pubblicatoIl = riga['publishedAt'] ?? riga['createdAt'];
    if (typeof identificativo !== 'string' || typeof titolo !== 'string') continue;
    if (typeof pubblicatoIl !== 'string') continue;
    out.push({ identificativo, titolo, pubblicatoIl });
  }
  return out;
}

/** Ripiego: l'elenco pubblico paginato (envelope `{items, totalPages}`). */
async function elencoPubblico(): Promise<Articolo[]> {
  const out: Articolo[] = [];
  // Il backend rifiuta `limit` ≥ 500: si pagina a 50. Due pagine bastano e
  // avanzano per una finestra di 48 ore, e tengono la Function sotto il tempo
  // di CPU concesso.
  for (let page = 1; page <= 2; page++) {
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
  const corpo = articoli
    .map(
      (a) =>
        '  <url>\n' +
        `    <loc>${SITE}/news/${escapeXml(a.identificativo)}/</loc>\n` +
        '    <news:news>\n' +
        '      <news:publication>\n' +
        `        <news:name>${escapeXml(NOME_TESTATA)}</news:name>\n` +
        '        <news:language>it</news:language>\n' +
        '      </news:publication>\n' +
        `      <news:publication_date>${escapeXml(a.pubblicatoIl)}</news:publication_date>\n` +
        `      <news:title>${escapeXml(a.titolo)}</news:title>\n` +
        '    </news:news>\n' +
        '  </url>',
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
    ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' +
    (corpo ? `${corpo}\n` : '') +
    '</urlset>\n'
  );
}

/**
 * ⚠️ I titoli arrivano da una pipeline redazionale e finiscono dentro XML: una
 * `&` non scappata rende il file MALFORMATO e Search Console scarta l'intera
 * sitemap, non la singola riga.
 */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
