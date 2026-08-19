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
// ⚠️ QUI DENTRO NON C'E' PIU' NESSUNA NEWS, ed e' voluto (19/08/2026). Prima
// c'era un fetch all'API che DECORAVA con <lastmod> gli articoli presenti nel
// manifest; da quando `/news` e `news/:id` sono `RenderMode.Server`, il
// manifest non li contiene piu' — non c'e' niente da decorare e non c'e' piu'
// alcuna ragione per cui questo script parli col backend. Gli articoli li
// pubblicano le due sitemap generate all'edge (`functions/news-sitemap.xml.ts`
// e `functions/sitemap-articoli.xml.ts`, dichiarate in public/robots.txt),
// perche' una news pubblicata dall'admin non fa partire alcun build.
// ⚠️ E l'indice `/news` non e' piu' qui dentro: lo pubblica la PRIMA <loc> di
// `/sitemap-articoli.xml`. Se sparisce quella riga, sparisce da ogni sitemap.
//
// Fail-safe (invariato): qualsiasi errore NON fa fallire il build — esce 0 e in
// dist resta la sitemap statica copiata da public/.
// Eseguito da `npm run build` DOPO `ng build` e PRIMA di check-routes.mjs.

import { readFileSync, writeFileSync } from 'node:fs';

const SITE = 'https://bestfishforever.it';
const OUT = 'dist/frontend/browser/sitemap.xml';
const MANIFEST = 'dist/frontend/prerendered-routes.json';

// Prerenderizzate ma volutamente FUORI dalla sitemap. Questa non e' una lista
// derivabile: e' una decisione editoriale, quindi ogni voce porta il suo perche'.
const ESCLUSE = new Map([
  // Non è più un placeholder: la pagina è viva. Resta esclusa perché il
  // programma è riservato agli iscritti — l'HTML indicizzabile non porta
  // marchi di operatore, percentuali né incentivi, quindi in sitemap
  // finirebbe un guscio senza il contenuto per cui varrebbe indicizzarlo.
  ['/affiliazioni', 'programma riservato agli iscritti: il contenuto reale è dietro login'],
]);

// changefreq/priority sono GIUDIZI editoriali (quanto conta questa pagina,
// quanto spesso cambia): dal build non si derivano. Mappa per-path + default,
// cosi' una pagina nuova entra in sitemap da sola col default e la si rifinisce
// qui solo se merita. L'ordine di questa mappa e' anche l'ordine in sitemap.
const META = new Map([
  ['/', { changefreq: 'weekly', priority: '1.0' }],
  ['/abbonati', { changefreq: 'monthly', priority: '0.9' }],
  ['/lezioni', { changefreq: 'weekly', priority: '0.8' }],
  // Le guide: l'indice qui, le singole prendono il default (monthly/0.5) e
  // entrano da sole appena compaiono nel manifest.
  ['/guide', { changefreq: 'weekly', priority: '0.8' }],
  ['/live', { changefreq: 'weekly', priority: '0.7' }],
  ['/docs', { changefreq: 'monthly', priority: '0.6' }],
  ['/chi-siamo', { changefreq: 'monthly', priority: '0.7' }],
  ['/tabelle', { changefreq: 'monthly', priority: '0.7' }],
  ['/simulatore-varianza', { changefreq: 'monthly', priority: '0.7' }],
  // ⚠️ Qui c'era `/news`: tolto il 19/08/2026 perche' l'indice non e' piu'
  // prerenderizzato e questa mappa vale solo per cio' che esce dal manifest.
  // Rimetterlo non lo farebbe ricomparire in sitemap (la lista e' il manifest,
  // non questa mappa): lo pubblica /sitemap-articoli.xml.
  ['/privacy', { changefreq: 'yearly', priority: '0.2' }],
  ['/cookie-policy', { changefreq: 'yearly', priority: '0.2' }],
]);

// Default per una pagina pubblica non ancora rifinita qui sopra (oggi: le
// singole /guide/<slug>, che entrano in sitemap da sole appena compaiono nel
// manifest).
const META_DEFAULT = { changefreq: 'monthly', priority: '0.5' };

function urlPrerenderizzate() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const urls = Object.keys(manifest?.routes ?? {});
  if (urls.length === 0)
    throw new Error(`${MANIFEST} non elenca nessuna rotta (build cambiato forma?)`);
  return urls;
}

const ordineMeta = [...META.keys()];
function perOrdineEditoriale(a, b) {
  const ra = ordineMeta.indexOf(a.loc);
  const rb = ordineMeta.indexOf(b.loc);
  const ka = ra === -1 ? Number.MAX_SAFE_INTEGER : ra;
  const kb = rb === -1 ? Number.MAX_SAFE_INTEGER : rb;
  if (ka !== kb) return ka - kb;
  // Fuori da META (oggi le singole /guide/<slug>): per path, deterministico.
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

// ⚠️ Niente <lastmod>: l'unico posto da cui si ricavava era la data degli
// articoli, presa dall'API, e le news non passano piu' da qui. Per le pagine
// prerenderizzate non esiste una data attendibile (la data del build non e' la
// data del contenuto), e un <lastmod> inventato e' un segnale che i motori
// imparano a ignorare. Il <lastmod> degli articoli lo scrive
// functions/sitemap-articoli.xml.ts, dove la data c'e' davvero.
function toXml(urls) {
  const body = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${SITE}${conSlash(u.loc)}</loc>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

try {
  const prerender = urlPrerenderizzate();

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
    .map((loc) => ({ loc, ...(META.get(loc) ?? META_DEFAULT) }))
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
// ⚠️ `process.exitCode = 0` e NON `process.exit(0)`, e la regola resta anche
// ora che qui dentro non c'e' piu' nessun fetch. Storia: su Windows + Node 24
// uscire a forza mentre undici stava ancora chiudendo i socket del fetch faceva
// abortire libuv ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)") con
// **exit 127**, che spegneva in silenzio le guardie concatenate dopo con `&&` —
// cioe' proprio il difetto che quelle guardie esistono per impedire. Il fetch e'
// sparito col <lastmod> delle news, ma `process.exit()` qui non serve a niente
// in nessun caso: non rimetterlo.
process.exitCode = 0;
