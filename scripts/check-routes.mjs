// Controllo di coerenza rotte <-> public/_redirects.
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

const ROOT = resolve(process.argv[2] ?? 'C:/Projects/poker-ranges/frontend');
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
  console.error('   nessun controllo. Rimetti un `path` letterale, oppure aggiorna');
  console.error('   scripts/lib/route-inventory.mjs. Emergenza: SKIP_ROUTE_CHECK=1.\n');
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
// il motivo per cui esistono. Serve un deploy hook: decisione da owner.
const parametricheCoperteAMeta = [];

for (const rotta of rotte) {
  const url = sampleUrl(rotta);
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
    `${regole?.length ?? 0} regole _redirects.`,
);
if (errori.length) {
  console.error(`\n❌ ${errori.length} problema/i:\n`);
  errori.forEach((e) => console.error('  • ' + e + '\n'));
  process.exit(1);
}
// Dice solo cio' che ha davvero verificato: la sitemap non e' nell'elenco
// perche' non la controlla piu' nessuno — la deriva gen-sitemap.mjs.
console.log('✅ ogni rotta client ha la sua regola, nessuna prerender e\' catturata.');

// E dichiara dove NON arriva. Un verde che tace i propri limiti e' la stessa
// falsa sicurezza del check tautologico che questo file ha appena rimosso.
if (parametricheCoperteAMeta.length)
  console.log(
    `\n⚠️  Non verificato: ${parametricheCoperteAMeta.map((r) => '`/' + r + '`').join(', ')}.\n` +
      `    Il manifest copre solo i valori esistenti al momento del build. Una news\n` +
      `    pubblicata dall'admin DOPO questo deploy non e' prerenderizzata, non ha\n` +
      `    regola, e Cloudflare le servira' la HOME finche' non si rideploya.\n` +
      `    Buco noto e non risolvibile qui (una regola /news/* romperebbe le news\n` +
      `    prerenderizzate: le regole precedono gli asset). Serve un deploy hook.`,
  );
