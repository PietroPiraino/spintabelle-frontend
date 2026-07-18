// Genera dist/frontend/browser/sitemap.xml DERIVANDOLA dagli artefatti del build.
//
// FONTE = `dist/frontend/prerendered-routes.json`, il manifest che Angular emette
// da solo elencando ogni pagina prerenderizzata (SSG). Prima qui c'era una lista
// `staticUrls` scritta a mano: una QUARTA lista da tenere allineata a mano con
// app.routes.ts / app.routes.server.ts / public/_redirects, e che sbagliava in
// silenzio (pagina nuova prerenderizzata ma fuori sitemap -> Google non la trova
// mai, e nessuno se ne accorge). Derivando, quella classe di difetti sparisce:
// una pagina pubblica nuova entra in sitemap da sola.
//
// ⚠️ Il fetch alle news NON e' piu' la fonte della lista degli articoli: lo era,
// e significava DUE fetch indipendenti sulla stessa API (uno qui, uno in
// getPrerenderParams) che potevano dissentire — sitemap con news mai
// prerenderizzate, o viceversa. Ora la lista viene solo dal manifest; il fetch
// sopravvive con un ruolo minore: DECORARE con <lastmod> le news gia' presenti
// nel manifest. <lastmod> e' un dato (la data dell'articolo), non un elenco, e da
// dist/ non e' ricavabile. API giu' -> niente lastmod, URL invariati.
//
// Fail-safe (invariato): qualsiasi errore NON fa fallire il build — esce 0 e in
// dist resta la sitemap statica copiata da public/.
// Eseguito da `npm run build` DOPO `ng build` e PRIMA di check-routes.mjs.

import { readFileSync, writeFileSync } from 'node:fs';

const SITE = 'https://bestfishforever.it';
const API = 'https://api.bestfishforever.it';
const OUT = 'dist/frontend/browser/sitemap.xml';
const MANIFEST = 'dist/frontend/prerendered-routes.json';

// Prerenderizzate ma volutamente FUORI dalla sitemap. Questa non e' una lista
// derivabile: e' una decisione editoriale, quindi ogni voce porta il suo perche'.
const ESCLUSE = new Map([
  ['/affiliazioni', 'placeholder: nessun contenuto reale da indicizzare'],
]);

// changefreq/priority sono GIUDIZI editoriali (quanto conta questa pagina,
// quanto spesso cambia): dal build non si derivano. Mappa per-path + default,
// cosi' una pagina nuova entra in sitemap da sola col default e la si rifinisce
// qui solo se merita. L'ordine di questa mappa e' anche l'ordine in sitemap.
const META = new Map([
  ['/', { changefreq: 'weekly', priority: '1.0' }],
  ['/abbonati', { changefreq: 'monthly', priority: '0.9' }],
  ['/chi-siamo', { changefreq: 'monthly', priority: '0.7' }],
  ['/tabelle', { changefreq: 'monthly', priority: '0.7' }],
  ['/simulatore-varianza', { changefreq: 'monthly', priority: '0.7' }],
  ['/news', { changefreq: 'weekly', priority: '0.6' }],
  ['/privacy', { changefreq: 'yearly', priority: '0.2' }],
  ['/cookie-policy', { changefreq: 'yearly', priority: '0.2' }],
]);

// Default per una pagina pubblica non ancora rifinita qui sopra (e per le news,
// che sono dinamiche e non possono stare in META).
const META_DEFAULT = { changefreq: 'monthly', priority: '0.5' };

function urlPrerenderizzate() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const urls = Object.keys(manifest?.routes ?? {});
  if (urls.length === 0)
    throw new Error(`${MANIFEST} non elenca nessuna rotta (build cambiato forma?)`);
  return urls;
}

// Solo <lastmod>, per le news gia' nel manifest. Non aggiunge e non toglie URL.
async function lastmodNews() {
  const out = new Map();
  try {
    // Il backend limita `limit` (≥500 → 400): pagino a 50 (cap 20 pagine).
    for (let page = 1; page <= 20; page++) {
      const res = await fetch(`${API}/news?page=${page}&limit=50`);
      if (!res.ok) break;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      for (const n of items) {
        if (typeof n?._id !== 'string') continue;
        const d = String(n.updatedAt || n.createdAt || '').slice(0, 10);
        if (d) out.set(`/news/${n._id}`, d);
      }
      const totalPages = Number(data?.totalPages) || 1;
      if (items.length === 0 || page >= totalPages) break;
    }
  } catch {
    // API giu': gli URL restano quelli del manifest, senza lastmod.
  }
  return out;
}

const ordineMeta = [...META.keys()];
function perOrdineEditoriale(a, b) {
  const ra = ordineMeta.indexOf(a.loc);
  const rb = ordineMeta.indexOf(b.loc);
  const ka = ra === -1 ? Number.MAX_SAFE_INTEGER : ra;
  const kb = rb === -1 ? Number.MAX_SAFE_INTEGER : rb;
  if (ka !== kb) return ka - kb;
  // Fuori da META (le news): piu' recenti prima, poi per path (deterministico).
  if ((a.lastmod ?? '') !== (b.lastmod ?? ''))
    return (b.lastmod ?? '').localeCompare(a.lastmod ?? '');
  return a.loc.localeCompare(b.loc);
}

// L'SSG serve le pagine con lo SLASH FINALE: Cloudflare fa `/abbonati` → 308 →
// `/abbonati/` (la 200 e' la forma con slash). La sitemap deve elencare la forma
// servita a 200 — non quella che redirige — e coincidere col canonical (vedi
// SeoService.absUrl), altrimenti Search Console bucketizza gli URL come
// "reindirizzamento"/"canonical alternato". La root resta `/`. Nota: lo slash si
// aggiunge SOLO qui in output; le chiavi restano senza slash sopra, per i lookup
// in META/ESCLUSE.
function conSlash(loc) {
  return loc === '/' || loc.endsWith('/') ? loc : `${loc}/`;
}

function toXml(urls) {
  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${SITE}${conSlash(u.loc)}</loc>${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

try {
  const prerender = urlPrerenderizzate();
  const lastmods = await lastmodNews();

  // Un'esclusione che non corrisponde piu' a niente e' una nota che marcisce:
  // dillo (senza rompere il build, e' solo rumore editoriale).
  for (const [url, perche] of ESCLUSE)
    if (!prerender.includes(url))
      console.warn(
        `⚠️ sitemap: \`${url}\` e' marcata esclusa ("${perche}") ma non e' piu' ` +
          `prerenderizzata — togli la voce da ESCLUSE in scripts/gen-sitemap.mjs.`,
      );

  const urls = prerender
    .filter((loc) => !ESCLUSE.has(loc))
    .map((loc) => ({ loc, lastmod: lastmods.get(loc) ?? null, ...(META.get(loc) ?? META_DEFAULT) }))
    .sort(perOrdineEditoriale);

  writeFileSync(OUT, toXml(urls));
  const escluse = prerender.length - urls.length;
  console.log(
    `✅ sitemap.xml: ${urls.length} URL derivate da prerendered-routes.json ` +
      `(${escluse} escluse) → ${OUT}`,
  );
} catch (e) {
  console.warn('⚠️ sitemap non aggiornata (resta quella statica):', e?.message || e);
}

// Fail-safe: qualunque cosa sia successa qui sopra, il build prosegue.
//
// ⚠️ `process.exitCode = 0` e NON `process.exit(0)`: su Windows + Node 24
// uscire a forza mentre undici sta ancora chiudendo i socket del fetch fa
// abortire libuv ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)")
// con **exit 127**. Restava invisibile finche' questo era l'ultimo anello di
// `npm run build`: la sitemap era gia' scritta e nessuno guardava l'exit code.
// Ora che la catena prosegue con check-routes.mjs, quel 127 spegnerebbe la
// guardia su ogni build locale Windows — cioe' esattamente il difetto
// silenzioso che la guardia esiste per impedire. L'uscita naturale e'
// immediata (i socket di undici sono unref'd), non introduce attese.
process.exitCode = 0;
