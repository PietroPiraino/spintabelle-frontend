// Sonda DAL VIVO sugli articoli: guarda la PRODUZIONE, non `dist/`.
//
// ⚠️ NON FA PARTE DI `npm run build`, ed e' una scelta. Le altre guardie
// (check-routes, check-prerender-content) misurano gli artefatti del build e
// bloccano il deploy; questa interroga il sito gia' deployato, quindi in catena
// bloccherebbe un build per uno starnuto della produzione. Si lancia A MANO
// dopo ogni deploy della consegna, ed e' lo stesso script del criterio (b) del
// pilota (PLAN-news-redazione.md §5.2).
//
// ⚠️ ED E' COMMITTATA, a differenza della famiglia `e2e-*.mjs` alla radice
// (gitignorata di proposito, strumenti locali): qui la prossima persona deve
// poterla lanciare senza ricostruirla, perche' verifica cose che nessun'altra
// guardia PUO' vedere.
//
// COSA VERIFICA, E PERCHE' PROPRIO QUESTE COSE.
//   1. L'articolo piu' recente risponde 200, con un solo <h1>, contenuto vero e
//      canonical nella forma con slash finale (lezione Search Console 18/07).
//   2. ⚠️ NIENTE `noindex`, ne' come <meta> ne' come header. E' il controllo per
//      cui questo file esiste: lo scheletro dell'edge e' `index.csr.html`, che
//      `inject-csr-noindex.mjs` deindicizza di proposito. Se la Function
//      smettesse di togliere quel meta, OGNI articolo reso all'edge nascerebbe
//      fuori da Google — e `check-prerender-content.mjs` non se ne accorgerebbe
//      MAI, perche' guarda `dist/` e questa risposta in `dist/` non esiste.
//   3. Un id inventato -> 404 VERO. Il soft-404 (200 con l'HTML della home) e'
//      il difetto che `public/404.html` ha chiuso il 16/08/2026.
//   4. `/negozio` porta ancora `X-Robots-Tag`. Sembra fuori tema e non lo e':
//      quell'header viene da `public/_headers`, che in advanced mode
//      (`_worker.js`) smetterebbe di applicarsi. E' la prova, da fuori, che
//      siamo ancora in directory mode.
//
// Uso:
//   node scripts/check-news-live.mjs
//   node scripts/check-news-live.mjs --base https://ramo.spintabelle-frontend.pages.dev
//   BFF_BASE=... BFF_API=... node scripts/check-news-live.mjs
//
// Esiti: 0 tutto verde · 1 deriva trovata · 0 + avviso se il controllo non e'
// eseguibile (API muta, nessun articolo): stessa filosofia delle altre guardie.

import { hasNoindex } from './lib/csr-noindex.mjs';

const argv = process.argv.slice(2);
const arg = (nome) => {
  const i = argv.indexOf(`--${nome}`);
  return i !== -1 ? argv[i + 1] : undefined;
};

const BASE = (arg('base') ?? process.env.BFF_BASE ?? 'https://bestfishforever.it').replace(/\/$/, '');
const API = (arg('api') ?? process.env.BFF_API ?? 'https://api.bestfishforever.it').replace(/\/$/, '');

// Stessa soglia di check-prerender-content.mjs: un pavimento anti-pagina-vuota.
const MIN_PAROLE = 120;
const ID_INESISTENTE = 'slug-inventato-xyz';
const TIMEOUT_MS = 20000;

const errori = [];
const nota = (m) => errori.push(m);
const info = [];

function nonEseguibile(motivo) {
  console.warn(`\n⚠️  Sonda news SALTATA: ${motivo}\n`);
  process.exit(0);
}

// ---- Aiutanti -----------------------------------------------------------
//
// ⚠️ `paroleVisibili` e `contaTag` sono gemelli di quelli in
// check-prerender-content.mjs, e la copia e' voluta: quello misura file in
// `dist/`, questo misura risposte HTTP. Estrarli in una lib comune legherebbe
// una guardia di build a una sonda di produzione, che si lanciano in momenti
// diversi e possono divergere di proposito. `hasNoindex` invece si IMPORTA: la
// stringa del meta deve restare una sola in tutto il repo.

function dentroMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1] : html;
}

function paroleVisibili(html) {
  return dentroMain(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function contaTag(html, tag) {
  return (dentroMain(html).match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
}

async function prendi(url, opzioni = {}) {
  const stop = AbortSignal.timeout(TIMEOUT_MS);
  return fetch(url, { redirect: 'follow', signal: stop, ...opzioni });
}

// ---- 1. L'articolo piu' recente -----------------------------------------

let elenco;
try {
  const res = await prendi(`${API}/news?page=1&limit=1`, { headers: { accept: 'application/json' } });
  if (!res.ok) nonEseguibile(`l'API risponde ${res.status} su /news — non ho da dove partire.`);
  elenco = await res.json();
} catch (e) {
  nonEseguibile(`l'API non risponde (${e.message}).`);
}

const items = Array.isArray(elenco) ? elenco : (elenco?.items ?? []);
if (!items.length) nonEseguibile("nessun articolo pubblicato: non c'e' niente da sondare.");

// Chiave pubblica dell'articolo. In produzione il campo `slug` c'e' gia'
// (verificato sull'API il 19/08/2026: `GET /news?page=1&limit=1` lo restituisce
// accanto a `_id`), quindi si prova prima quello — che e' anche la forma su cui
// Fase 4 costruira' i 301. Se un giorno non ci fosse, si ripiega sull'ObjectId.
const chiave = String(items[0].slug ?? items[0]._id ?? '');
const tipoChiave = items[0].slug ? 'slug' : '_id';
if (!chiave) nonEseguibile("il primo articolo non ha ne' slug ne' _id: forma della risposta cambiata?");

// Due forme, e non e' pedanteria. Quella con lo SLASH FINALE e' la forma
// servita a 200 dall'SSG ed e' quella che canonical e sitemap dichiarano
// (lezione Search Console 18/07/2026): e' quella che DEVE funzionare. Quella
// nuda si prova SOLO se la prima non risponde 200, perche' se funzionasse solo
// lei vorrebbe dire che Cloudflare non porta alla Function la forma canonica —
// un difetto preciso, che merita di essere detto con precisione invece di
// sparire dentro cinque rilievi tutti figli della stessa causa.
const urlSlash = `${BASE}/news/${chiave}/`;
const urlNudo = `${BASE}/news/${chiave}`;

async function scarica(url) {
  try {
    const r = await prendi(url);
    return { url, res: r, html: await r.text() };
  } catch (e) {
    nota(`${url} — la richiesta non e' andata a buon fine (${e.message}).`);
    return null;
  }
}

const marcatoreDi = (r) => {
  const m = r.headers.get('x-bff-news');
  return m ? `reso dall'edge (x-bff-news: ${m})` : 'servito come asset prerenderizzato';
};

let scelta = await scarica(urlSlash);
if (scelta) info.push(`${urlSlash} (${tipoChiave}) -> ${scelta.res.status}, ${marcatoreDi(scelta.res)}`);

if (scelta && scelta.res.status !== 200) {
  const statoSlash = scelta.res.status;
  const nudo = await scarica(urlNudo);
  if (nudo) info.push(`${urlNudo} -> ${nudo.res.status}, ${marcatoreDi(nudo.res)}`);
  if (nudo && nudo.res.status === 200) {
    nota(
      `${urlSlash} — risponde ${statoSlash}, mentre la forma SENZA slash risponde 200. ` +
        "Cloudflare non porta alla Function la forma canonica: e' quella con lo slash " +
        "finale a essere dichiarata in canonical e in sitemap, quindi e' quella che un " +
        'motore chiede. Da guardare: come functions/news/[[path]].ts viene agganciata ' +
        'su un percorso che finisce con "/".',
    );
    scelta = nudo; // i controlli di contenuto qui sotto hanno comunque senso
  } else {
    nota(
      `${urlSlash} — risponde ${statoSlash} invece di 200 (e nemmeno la forma senza ` +
        "slash risponde 200). Se e' 404 su un articolo nato dopo l'ultimo build, la " +
        "Function non e' stata invocata: controlla che `public/_routes.json` sia finito " +
        'in dist e che il suo `include` copra questa URL.',
    );
    // ⚠️ Niente controlli di contenuto su una pagina che non c'e': parlerebbero
    // del 404 e non dell'articolo, quattro rilievi per una causa sola.
    scelta = null;
  }
}

if (scelta) {
  const { res, html } = scelta;
  const urlArticolo = scelta.url.endsWith('/') ? scelta.url : `${scelta.url}/`;

  const parole = paroleVisibili(html);
  if (parole < MIN_PAROLE)
    nota(`${urlArticolo} — solo ${parole} parole nel <main> (minimo ${MIN_PAROLE}).`);

  const h1 = contaTag(html, 'h1');
  if (h1 !== 1) nota(`${urlArticolo} — ${h1} <h1> nel <main> (deve essere esattamente 1).`);

  const canonical = (html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) || [])[1] ?? null;
  if (!canonical) nota(`${urlArticolo} — manca <link rel="canonical">.`);
  else if (canonical !== urlArticolo)
    nota(`${urlArticolo} — canonical "${canonical}", atteso "${urlArticolo}" (forma con slash finale).`);

  if (!/<meta[^>]+property=["']og:title["']/i.test(html))
    nota(`${urlArticolo} — manca og:title: senza, l'anteprima social e' quella della home.`);

  // ⚠️ Il controllo per cui esiste questo file.
  if (hasNoindex(html))
    nota(
      `${urlArticolo} — esce con <meta name="robots" ... noindex>. La Function deve ` +
        'TOGLIERE il meta che inject-csr-noindex.mjs ha messo nello scheletro ' +
        "(index.csr.html): senza, ogni articolo reso all'edge nasce fuori da Google.",
    );

  const xRobots = res.headers.get('x-robots-tag');
  if (xRobots && /noindex/i.test(xRobots))
    nota(
      `${urlArticolo} — header X-Robots-Tag: ${xRobots}. Una regola di public/_headers ` +
        "sta coprendo anche gli articoli: in quell'elenco non deve mai comparire /news.",
    );
}

// ---- 2. Un id inventato deve dare un 404 vero ---------------------------

const urlFinto = `${BASE}/news/${ID_INESISTENTE}/`;
try {
  const finto = await prendi(urlFinto);
  const corpo = await finto.text();
  if (finto.status !== 404)
    nota(
      `${urlFinto} — risponde ${finto.status} invece di 404. Un articolo inesistente ` +
        "servito a 200 e' un soft-404: Google lo indicizza come pagina vera.",
    );
  if (/<app-landing/i.test(corpo))
    nota(`${urlFinto} — nel corpo c'e' <app-landing>: e' l'HTML della HOME, il difetto chiuso il 16/08/2026.`);
  info.push(`${urlFinto} -> ${finto.status}`);
} catch (e) {
  nota(`${urlFinto} — la richiesta non e' andata a buon fine (${e.message}).`);
}

// ---- 3. `_headers` e' ancora in vigore (= siamo in directory mode) ------

const urlGated = `${BASE}/negozio`;
try {
  const gated = await prendi(urlGated, { method: 'HEAD' });
  const xr = gated.headers.get('x-robots-tag');
  if (!xr || !/noindex/i.test(xr))
    nota(
      `${urlGated} — manca X-Robots-Tag: noindex (trovato: ${xr ?? 'niente'}). ` +
        "Quell'header viene da public/_headers: se e' sparito, o e' saltata quella " +
        "lista o siamo finiti in advanced mode (_worker.js), dove _headers non si " +
        "applica piu' — e le 14 rotte client tornano indicizzabili in silenzio.",
    );
  else info.push(`${urlGated} -> X-Robots-Tag: ${xr}`);
} catch (e) {
  nota(`${urlGated} — la richiesta non e' andata a buon fine (${e.message}).`);
}

// ---- Esito --------------------------------------------------------------

console.log(`\nSonda news dal vivo — base ${BASE}, API ${API}`);
for (const r of info) console.log(`  · ${r}`);

if (errori.length) {
  console.error(`\n❌ ${errori.length} problema/i:\n`);
  for (const e of errori) console.error(`   • ${e}\n`);
  process.exit(1);
}

console.log('\n✅ articolo servito con contenuto, h1, canonical e OG; niente noindex; 404 vero; _headers in vigore.\n');
