// Controllo di coerenza rotte <-> public/_redirects <-> public/_routes.json.
// Confronta gli ARTEFATTI DEL BUILD (verita') con i file scritti a mano.
//
// La sitemap NON e' piu' fra le liste controllate: gen-sitemap.mjs la DERIVA dal
// manifest del build, quindi non puo' piu' divergere e non c'e' niente da
// confrontare (vedi il punto 5).
//
// Distingue due esiti diversi, ed e' il cuore del progetto:
//   - DERIVA TROVATA        -> exit 1 (bloccare e' il punto)
//   - CONTROLLO NON ESEGUIBILE -> exit 0 + avviso (non blocco un deploy per un
//     mio bug: stessa filosofia fail-safe di gen-sitemap.mjs)

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readRoutes } from './lib/route-inventory.mjs';
import { parseRedirects, findMatch, lintRules, sampleUrl, routeCoversUrl } from './lib/redirects.mjs';
import {
  readServerRoutes,
  serverPaths,
  parseRoutesJson,
  findInclude,
  lintIncludes,
  urlDiEsempio,
} from './lib/server-routes.mjs';

// ⚠️ Il default e' `process.cwd()` e NON un percorso Windows assoluto. Con
// `'C:/Projects/poker-ranges/frontend'` questa guardia era MUTA su Cloudflare:
// su POSIX `C:/…` non e' assoluto, quindi `resolve` lo attaccava alla cwd
// (`/build/frontend/C:/Projects/…`), la cartella non esisteva e lo script
// usciva 0 dal ramo fail-safe qui sotto. Girava solo sul portatile dell'autore,
// mentre CLAUDE.md dichiarava che bloccava il deploy. `npm run build` parte
// sempre da frontend/, qui e sul runner di Cloudflare.
const ROOT = resolve(process.argv[2] ?? process.cwd());
const DIST = join(ROOT, 'dist/frontend');
const BROWSER = join(DIST, 'browser');

// Soglie anti-"controllo vuoto": se una collezione crolla, il parser si e' rotto.
const MIN_ROTTE = 20;
const MIN_PRERENDER = 8;
const MIN_REGOLE = 10;

const errori = [];
const nota = (m) => errori.push(m);

// SALTA (exit 0) SOLO quando mancano gli artefatti: non c'e' un deploy in gioco
// e non c'e' niente da controllare. Vale anche l'uscita di sicurezza esplicita.
function nonEseguibile(motivo) {
  console.warn(`\n⚠️  Controllo rotte SALTATO: ${motivo}\n`);
  process.exit(0);
}

// SI ROMPE (exit 1) quando il controllo non capisce piu' i SORGENTI. Sembra
// prudente lasciar passare, ma e' la peggiore delle uscite: un controllo che si
// auto-disattiva in silenzio e' tornare esattamente al problema di partenza,
// con in piu' l'illusione di essere protetti. Chi ha cambiato la forma del file
// e' qui adesso: o rimette un letterale, o aggiorna il parser.
function nonCapisco(motivo) {
  console.error(`\n❌ Il controllo rotte non capisce piu' il sorgente: ${motivo}`);
  console.error('   NON ti lascio passare in silenzio: un controllo spento e\' peggio di');
  console.error('   nessun controllo. Rimetti una forma che il parser capisce (un `path`');
  console.error('   letterale, un `_routes.json` di forma nota), oppure aggiorna il parser');
  console.error('   in scripts/lib/. Emergenza: SKIP_ROUTE_CHECK=1.\n');
  process.exit(1);
}

if (process.env.SKIP_ROUTE_CHECK === '1')
  nonEseguibile('SKIP_ROUTE_CHECK=1 — stai deployando senza rete di sicurezza.');

// ---- 1. Raccolta (ogni fonte con la sua soglia) -------------------------
if (!existsSync(BROWSER)) nonEseguibile(`manca ${BROWSER} — hai lanciato ng build?`);

const manifest = join(DIST, 'prerendered-routes.json');
if (!existsSync(manifest)) nonCapisco('manca prerendered-routes.json (build cambiato forma?)');

let rotte, prerender, regole;
try {
  rotte = readRoutes(join(ROOT, 'src/app/app.routes.ts')).filter((p) => p !== '**');
} catch (e) {
  nonCapisco(`app.routes.ts — ${e.message}`);
}

// LA TERZA CATEGORIA. Fino al 19/08/2026 una rotta era Prerender (un file in
// dist) oppure Client (una regola in _redirects), e questo controllo conosceva
// solo quelle due. Da oggi ce n'e' una terza — `RenderMode.Server`, resa a ogni
// richiesta dalla Pages Function — e va letta QUI, prima della sezione 4:
// altrimenti `/news`, che non e' piu' un file e non ha (giustamente) alcuna
// regola in _redirects, verrebbe segnalata come "rotta client senza regola" e
// il primo build dopo la migrazione fallirebbe con la diagnosi sbagliata.
let rotteServer = [];
try {
  rotteServer = serverPaths(readServerRoutes(join(ROOT, 'src/app/app.routes.server.ts')));
} catch (e) {
  nonCapisco(`app.routes.server.ts — ${e.message}`);
}
const eServer = (rotta) => rotteServer.includes(rotta);
try {
  prerender = Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).routes);
} catch (e) {
  nonCapisco(`prerendered-routes.json illeggibile (${e.message})`);
}

const fileRedirects = join(BROWSER, '_redirects');
if (!existsSync(fileRedirects))
  nota('DERIVA: `_redirects` non e\' finito in dist — ogni rotta client servira\' la HOME.');
else {
  try {
    regole = parseRedirects(readFileSync(fileRedirects, 'utf8'));
  } catch (e) {
    nonCapisco(`_redirects non parsabile (${e.message})`);
  }
}

if (rotte.length < MIN_ROTTE)
  nonCapisco(`trovate solo ${rotte.length} rotte (min ${MIN_ROTTE}): parser rotto?`);
if (prerender.length < MIN_PRERENDER)
  nonCapisco(`solo ${prerender.length} pagine prerenderizzate (min ${MIN_PRERENDER})`);
if (regole && regole.length < MIN_REGOLE)
  nota(`DERIVA: solo ${regole.length} regole in _redirects (min atteso ${MIN_REGOLE}).`);

// ---- 2. Invarianti su _redirects (l'incidente del 12/07) ---------------
// Le regole stanno in lib/redirects.mjs (pure, coperte da `npm run test:scripts`).
for (const { rule, problema } of lintRules(regole ?? []))
  nota(`public/_redirects riga ${rule.line}: ${problema}`);
if (regole?.length && !existsSync(join(BROWSER, 'index.csr.html')))
  nota('DERIVA: le regole puntano a /index.csr ma dist non contiene index.csr.html.');

// ---- 3. Nessuna prerender deve essere catturata (addio SEO) ------------
for (const url of prerender) {
  const m = findMatch(regole ?? [], url);
  if (m)
    nota(
      `DERIVA GRAVE: \`${url}\` e' prerenderizzata MA la regola di riga ${m.line} ` +
        `(\`${m.from}\`) la sovrascrive con la shell vuota -> niente meta/OG/SEO.`,
    );
}

// ---- 4. Ogni rotta client deve avere la sua regola (il difetto di ieri) -
//
// ⚠️ BUCO NOTO, dichiarato invece che taciuto. Una rotta PARAMETRICA (`news/:id`)
// risulta "prerenderizzata" se anche UN SOLO id lo e', e viene saltata. Ma le
// news si pubblicano dall'admin SENZA deploy: un articolo nuovo non e' nel
// manifest, non ha regola, e Cloudflare gli serve la HOME finche' non si
// rideploya (verificato in prod 16/07/2026: /news/<id nuovo> → 71.583 B con
// <app-landing> dentro). E' lo stesso difetto che questo check esiste per
// trovare, e qui non lo trova: la copertura si ferma dove finisce il manifest.
// NON si ripara con `/news/*`: le regole precedono gli asset, quindi
// catturerebbe anche le news prerenderizzate e ne perderebbe i meta — cioe'
// il motivo per cui esistono.
//
// AGGIORNAMENTO (Fase 1 tappa 2, 19/08/2026): quel buco NON esiste piu', ed e'
// morto per costruzione, non per una toppa. `/news` e `news/:id` sono
// `RenderMode.Server`: non c'e' piu' un manifest che copre "solo gli id
// esistenti al build", perche' non c'e' piu' nessun build di mezzo — la pagina
// la rende la Pages Function `functions/news/[[path]].ts` a ogni richiesta.
// Le rotte Server vengono saltate qui e controllate nella sezione 4-bis contro
// `public/_routes.json`. Quello che questa guardia continua a NON poter vedere
// e' il CORPO della risposta dell'edge (non e' un file in dist): lo verifica dal
// vivo `scripts/check-news-live.mjs`, dopo il deploy.
const parametricheCoperteAMeta = [];

for (const rotta of rotte) {
  const url = sampleUrl(rotta);
  // Terza categoria: non e' ne' un file ne' una riscrittura. Il suo controllo
  // e' altrove (4-bis), qui sarebbe solo un falso positivo.
  if (eServer(rotta)) continue;
  const prerenderizzata = prerender.some((p) => routeCoversUrl(rotta, p));
  if (prerenderizzata) {
    // Se e' parametrica, il manifest copre solo gli id esistenti al build.
    if (rotta.includes(':')) parametricheCoperteAMeta.push(rotta);
    continue;
  }
  if (!findMatch(regole ?? [], url))
    nota(
      `DERIVA: la rotta client \`/${rotta}\` non ha una regola in public/_redirects.\n` +
        `    Cosa vede l'utente (il difetto e' invisibile da qui): Cloudflare le\n` +
        `    serve l'HTML della HOME (~71 KB) invece della shell, quindi su ${url}\n` +
        `    compare la landing per ~10s prima che Angular monti la pagina vera.\n` +
        `    Riga da incollare in public/_redirects:\n` +
        `        ${url.padEnd(23)} /index.csr  200`,
    );
}

// ---- 4-bis. Cloudflare Pages Functions e public/_routes.json -----------
//
// La terza lista scritta a mano di questo sito, dopo `_redirects` e `_headers`:
// `public/_routes.json` decide QUALI URL vengono servite dalla Pages Function
// (`functions/`) invece che dagli asset. E' l'SSR all'edge per gli articoli
// (PLAN-news-redazione.md, Fase 1). La semantica dei pattern vive in
// scripts/lib/server-routes.mjs, coperta da `npm run test:scripts`.
//
// ⚠️ `/news/*` NON copre `/news`: il prefisso letterale include la barra. E' il
// contrario di `_redirects`, dove `/live/*` catturava ANCHE `/live`. Due file,
// due semantiche opposte, e qui la conseguenza e' concreta: `/news` (l'indice,
// anch'esso RenderMode.Server dal 19/08/2026) va elencato A PARTE nell'include,
// altrimenti Cloudflare non chiama la Function e cerca un asset che non esiste.
// Lo stesso vale al contrario per il nome del file della Function, che infatti
// e' `[[path]].ts` (catch-all OPZIONALE: prende il prefisso nudo e i figli).

// Pattern di `include` che possono legittimamente sovrapporsi alle pagine
// prerenderizzate. ⚠️ OGGI E' VUOTO, ed e' la fotografia giusta della tappa 2:
// le news non sono piu' prerenderizzate, quindi nessun include si sovrappone a
// niente e la Function non ha piu' motivo di essere asset-first (non c'e'
// nessun asset di news da preferire). Nella tappa 1 qui c'era `/news/*`, con
// una premessa precisa: quella Function chiamava `ctx.next()` per prima, quindi
// su un articolo gia' prerenderizzato vinceva il suo HTML statico coi suoi
// meta. Senza quella premessa, un include che copre una pagina prerenderizzata
// le fa perdere meta/OG/canonical esattamente come una regola sbagliata in
// `_redirects` — per questo l'eccezione va dichiarata qui, una per una, col suo
// motivo, e non ottenuta allargando il controllo.
const ASSET_FIRST = new Set();

const DIR_FUNCTIONS = join(ROOT, 'functions');
const SRC_ROUTES_JSON = join(ROOT, 'public/_routes.json');
const DIST_ROUTES_JSON = join(BROWSER, '_routes.json');

// (e) `functions/` <-> `_routes.json`: o ci sono entrambi, o nessuno dei due.
const haFunctions = existsSync(DIR_FUNCTIONS);
const haRoutesJson = existsSync(SRC_ROUTES_JSON);
if (haFunctions && !haRoutesJson)
  nota(
    'DERIVA: c\'e\' `functions/` ma manca `public/_routes.json`. Senza, Cloudflare ' +
      'se ne genera uno da solo dall\'albero di functions/: nessuno ha piu\' deciso ' +
      'cosa passa dalla Function, e questa guardia non ha piu\' niente da leggere.',
  );
if (!haFunctions && haRoutesJson)
  nota(
    'DERIVA: c\'e\' `public/_routes.json` ma non c\'e\' `functions/`. Sta instradando ' +
      'URL verso una Function che non esiste.',
  );

// ⚠️ MAI `_worker.js` (advanced mode). Li' il worker riceve OGNI richiesta e
// `_headers`/`_redirects` smettono di applicarsi alle sue risposte: la
// deindicizzazione delle rotte client del 17/08/2026 decadrebbe IN SILENZIO.
for (const w of [join(ROOT, 'public/_worker.js'), join(BROWSER, '_worker.js')])
  if (existsSync(w))
    nota(
      `DERIVA GRAVE: trovato \`${w}\` — e' la advanced mode di Cloudflare Pages. ` +
        'Li\' il worker intercetta ogni richiesta e `_headers`/`_redirects` non si ' +
        'applicano piu\': le 14 rotte client tornerebbero indicizzabili senza che ' +
        'nulla si rompa a vista. Questo progetto usa la directory mode: functions/ ' +
        '+ public/_routes.json.',
  );

let routesJson = null;
if (haRoutesJson) {
  try {
    routesJson = parseRoutesJson(readFileSync(SRC_ROUTES_JSON, 'utf8'));
  } catch (e) {
    nonCapisco(`public/_routes.json — ${e.message}`);
  }
  if (!existsSync(DIST_ROUTES_JSON))
    nota(
      'DERIVA: `public/_routes.json` non e\' finito in dist. Cloudflare lo legge ' +
        'dalla cartella di output: senza, se lo genera da solo e la lista qui non ' +
        'conta niente.',
    );

  // (b) niente catch-all: la regola d'oro della casa, terza incarnazione.
  for (const { pattern, problema } of lintIncludes(routesJson.include))
    nota(`public/_routes.json \`${pattern}\`: ${problema}`);

  // (c) sovrapposizioni col prerender solo se dichiarate ASSET_FIRST.
  const gia = new Set();
  for (const url of prerender) {
    const p = findInclude(routesJson.include, url);
    if (!p || ASSET_FIRST.has(p) || gia.has(p)) continue;
    gia.add(p);
    nota(
      `DERIVA GRAVE: l'include \`${p}\` di _routes.json cattura pagine ` +
        `prerenderizzate (es. \`${url}\`) e NON e' dichiarato asset-first. La ` +
        'Function le servirebbe al posto del loro HTML statico -> via meta, OG e ' +
        'canonical. Se la Function fa `ctx.next()` per prima, aggiungilo a ' +
        'ASSET_FIRST in questo file, con il motivo.',
    );
  }
}

// (a) ogni rotta `RenderMode.Server` dev'essere raggiunta dalla Function.
// (`rotteServer` e' letta nella sezione 1: serve gia' alla sezione 4.)
for (const rotta of rotteServer) {
  for (const url of urlDiEsempio(rotta)) {
    if (routesJson && findInclude(routesJson.include, url)) continue;
    nota(
      `DERIVA: la rotta \`${rotta}\` e' RenderMode.Server ma \`${url}\` non e' in ` +
        'nessun `include` di public/_routes.json -> Cloudflare non chiama la ' +
        'Function e serve un asset che non esiste (404). ⚠️ `/news/*` NON copre ' +
        '`/news`: se manca il prefisso nudo, elencalo a parte.',
    );
  }
}

// (d) e una rotta Server NON deve avere una regola in `_redirects`.
//
// Non e' pignoleria: le regole di `_redirects` sono valutate PRIMA di tutto,
// Function comprese. Una riga `/news  /index.csr  200` rimasta li' non
// "convive" con l'SSR — lo SPEGNE, e la pagina torna a essere la shell vuota
// col canonical della home, mentre la Function esiste, e' configurata, e non
// viene mai chiamata. E' il modo piu' silenzioso che questa migrazione ha di
// fallire: nessun errore, nessun 404, solo una pagina vuota che sembra un
// problema di Angular.
for (const rotta of rotteServer) {
  for (const url of urlDiEsempio(rotta)) {
    const m = findMatch(regole ?? [], url);
    if (!m) continue;
    nota(
      `DERIVA GRAVE: la rotta \`${rotta}\` e' RenderMode.Server, ma la regola di ` +
        `riga ${m.line} di public/_redirects (\`${m.from}\`) cattura \`${url}\`. ` +
        'Le regole precedono le Function: quella riga serve la shell vuota al ' +
        "posto dell'HTML reso all'edge -> niente contenuto, niente meta, " +
        'canonical della home. Togli la regola: le rotte Server non ne vogliono.',
    );
  }
}

// ---- 5. (non c'e' piu': era il check "ogni prerender e' in sitemap.xml") -
// RIMOSSO il 16/07/2026, quando gen-sitemap.mjs ha smesso di avere la lista
// scritta a mano e ha iniziato a DERIVARE la sitemap da prerendered-routes.json.
// Da quel momento il check confrontava il manifest con una sitemap generata dal
// manifest stesso: dist contro se' stesso, verde per costruzione. Non e' stato
// tenuto "per prudenza" perche' un controllo che non puo' fallire e' peggio di
// nessun controllo — occupa il posto di uno vero e ti fa sentire coperto.
// L'invariante che garantiva ora e' garantita dalla derivazione, non da un
// confronto. Se un giorno la sitemap tornasse ad avere una fonte propria, questo
// check va rimesso: e' l'unica condizione che lo rende di nuovo capace di fallire.

// ---- 6. Esito -----------------------------------------------------------
console.log(
  `Controllo rotte: ${rotte.length} rotte, ${prerender.length} prerenderizzate, ` +
    `${regole?.length ?? 0} regole _redirects, ` +
    `${routesJson ? routesJson.include.length : 0} include in _routes.json ` +
    `(${rotteServer.length} rotte RenderMode.Server).`,
);
if (errori.length) {
  console.error(`\n❌ ${errori.length} problema/i:\n`);
  errori.forEach((e) => console.error('  • ' + e + '\n'));
  process.exit(1);
}
// Dice solo cio' che ha davvero verificato: la sitemap non e' nell'elenco
// perche' non la controlla piu' nessuno — la deriva gen-sitemap.mjs.
console.log(
  '✅ ogni rotta client ha la sua regola, nessuna prerender e\' catturata' +
    (routesJson
      ? ', _routes.json senza catch-all e senza sovrapposizioni non dichiarate,' +
        ' ogni rotta Server e\' raggiunta dalla Function e nessuna e\' scavalcata' +
        ' da _redirects.'
      : '.'),
);

// ⚠️ E il limite piu' importante di questa guardia, dopo la migrazione all'SSR:
// delle rotte Server verifica l'INSTRADAMENTO, non il CORPO. Che `/news/<id>`
// arrivi alla Function lo sa; che quella risposta abbia un <h1>, il canonical
// giusto e nessun `noindex` non puo' saperlo — non e' un file in dist. Lo
// verifica dal vivo, dopo il deploy, `node scripts/check-news-live.mjs`.
if (rotteServer.length)
  console.log(
    `\n⚠️  Non verificato: il contenuto di ${rotteServer.map((r) => '`/' + r + '`').join(', ')}` +
      ' (rese all\'edge, non sono file in dist).\n' +
      "    Dopo il deploy: 'node scripts/check-news-live.mjs'.",
  );

// E dichiara dove NON arriva. Un verde che tace i propri limiti e' la stessa
// falsa sicurezza del check tautologico che questo file ha appena rimosso.
if (parametricheCoperteAMeta.length)
  console.log(
    `\n⚠️  Copertura parziale: ${parametricheCoperteAMeta.map((r) => '`/' + r + '`').join(', ')}.\n` +
      `    Sono PRERENDERIZZATE, quindi il manifest le copre solo per i valori\n` +
      `    esistenti al momento del build: un valore nuovo non ha un file, e senza\n` +
      `    una regola in _redirects riceve public/404.html finche' non si rideploya.\n` +
      `    Oggi va bene cosi': gli slug delle guide stanno in un file del repo\n` +
      `    (features/guides/guides.data.ts), quindi un valore nuovo E' un deploy.\n` +
      `    ⚠️ Se un domani una rotta parametrica prendesse i valori dall'API — com'era\n` +
      `    news/:id fino al 19/08/2026 — questa riga smette di essere innocua: quella\n` +
      `    rotta va resa all'edge (RenderMode.Server + include in _routes.json).`,
  );
