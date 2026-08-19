// Controllo del CONTENUTO delle pagine prerenderizzate.
//
// PERCHE' ESISTE. check-routes.mjs verifica che le liste (rotte, _redirects,
// manifest) siano coerenti fra loro. Non guarda dentro l'HTML — e il difetto
// piu' costoso di questo sito viveva esattamente li': /tabelle risultava
// prerenderizzata, aveva il canonical giusto, era in sitemap, e conteneva
// TRE PAROLE ("Controllo della sessione…"). Il template si apriva con
// `@if (!auth.ready())`, e in prerender `auth.ready()` non diventa mai true
// (`ready$` emette solo da AuthService.bootstrap(), che gira solo nel browser):
// il ramo dello spinner vinceva sempre. Nessuna lista era in deriva. Era
// l'HTML a essere vuoto, e non lo guardava nessuno.
//
// Stessa filosofia degli altri controlli del progetto:
//   - DERIVA TROVATA           -> exit 1 (bloccare e' il punto)
//   - CONTROLLO NON ESEGUIBILE -> exit 0 + avviso (niente dist = niente deploy
//     in gioco: non blocco per un mio bug)
//   - SORGENTE INCOMPRENSIBILE -> exit 1 (un controllo che si autodisattiva in
//     silenzio e' peggio di nessun controllo)

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative, dirname, sep } from 'node:path';
import { hasCanonical, hasNoindex } from './lib/csr-noindex.mjs';

// ⚠️ Il default e' `process.cwd()` e NON un percorso Windows assoluto. Con
// `'C:/Projects/poker-ranges/frontend'` questa guardia era MUTA su Cloudflare:
// su POSIX `C:/…` non e' un percorso assoluto, quindi `resolve` lo attaccava
// alla cwd (`/build/frontend/C:/Projects/…`), la cartella non esisteva e lo
// script usciva 0 dal ramo "controllo non eseguibile". Girava solo sul portatile
// dell'autore. `npm run build` parte sempre da frontend/, qui e sul runner.
const ROOT = resolve(process.argv[2] ?? process.cwd());
const BROWSER = join(ROOT, 'dist/frontend/browser');
const SITE = 'https://bestfishforever.it';

// Soglia anti-"controllo vuoto": se il conteggio crolla, il walker si e' rotto.
const MIN_PAGINE = 8;

// Soglie di parole nel <main>, per rotta. Sono un pavimento, non un obiettivo:
// servono a intercettare una pagina che si SVUOTA, non a giudicare il copy.
// Il default vale per ogni rotta nuova, comprese le news e le guide: una
// pagina prerenderizzata che non arriva a 120 parole non ha niente da dire a
// nessuno, ne' a un lettore ne' a un motore.
const MIN_PAROLE_DEFAULT = 120;
const MIN_PAROLE = {
  // ⚠️ 900 e non 2.000: il conteggio della home include le card delle ultime
  // news, che arrivano dall'API AL BUILD. Se l'API non risponde la sezione
  // sparisce e il totale crolla, senza che nulla si sia rotto. La soglia sta
  // sotto al PAVIMENTO STATICO misurato (1.177 parole senza news): cosi'
  // intercetta un blocco editoriale che sparisce, e non fallisce il deploy per
  // un raffreddore del backend.
  '/': 900,
  '/tabelle': 400, // il visualizzatore e' dietro login: qui vive solo l'evergreen
  '/lezioni': 350, // idem: il catalogo e' dietro il JWT, qui c'e' solo il teaser
  '/docs': 300, // idem
  '/live': 300, // idem: il calendario e' dietro il JWT
  '/abbonati': 100, // TODO fase 3: sale a 400 quando arriva il blocco editoriale
  '/chi-siamo': 300,
  '/simulatore-varianza': 400,
  '/affiliazioni': 200, // volutamente neutra (art. 9 DL 87/2018), non gonfiarla
  '/news': 60, // indice: solo estratti troncati, cresce col numero di articoli
  '/guide': 60, // indice: occhiello + titolo + descrizione per guida
  // ⚠️ Le singole /guide/<slug> NON hanno una soglia propria: prendono il
  // default (120). E' voluto — una guida nuova non deve richiedere una modifica
  // qui — ma il default e' un pavimento anti-pagina-vuota, non l'obiettivo: una
  // guida sta fra le 900 e le 1400 parole.
  '/privacy': 500,
  '/cookie-policy': 400,
};

// Pagine che possono legittimamente NON avere un canonical proprio o un h1:
// oggi nessuna. La lista esiste perche' un'eccezione va dichiarata con la sua
// motivazione, non ottenuta abbassando la soglia di tutti.
const ESENTI = new Map();

// Le UNICHE pagine prerenderizzate che devono uscire con `noindex`. Tutte le
// altre devono uscirne senza: e' la meta' che conta di piu' del controllo (d),
// perche' un `noindex` finito per errore sull'HTML pubblico e' il difetto piu'
// costoso che questo sito possa deployare — cancella le pagine dall'indice e
// non se ne accorge nessuno finche' non sparisce il traffico.
const NOINDEX_ATTESO = new Set([
  // art. 9 DL 87/2018: il programma di affiliazione non va promosso in ricerca.
  '/affiliazioni',
]);

const errori = [];
const nota = (m) => errori.push(m);

function nonEseguibile(motivo) {
  console.warn(`\n⚠️  Controllo contenuto prerenderizzato SALTATO: ${motivo}\n`);
  process.exit(0);
}

function nonCapisco(motivo) {
  console.error(`\n❌ Il controllo contenuto non capisce piu' gli artefatti: ${motivo}`);
  console.error('   NON ti lascio passare in silenzio. Emergenza: SKIP_PRERENDER_CHECK=1.\n');
  process.exit(1);
}

if (process.env.SKIP_PRERENDER_CHECK === '1')
  nonEseguibile('SKIP_PRERENDER_CHECK=1 — stai deployando senza rete di sicurezza.');

if (!existsSync(BROWSER)) nonEseguibile(`manca ${BROWSER} — hai lanciato ng build?`);

// ---- 1. Raccolta degli artefatti ----------------------------------------

/** Ogni index.html sotto dist/browser e' una pagina prerenderizzata. */
function raccogliPagine(dir, acc = []) {
  for (const voce of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, voce.name);
    if (voce.isDirectory()) raccogliPagine(p, acc);
    else if (voce.name === 'index.html') acc.push(p);
  }
  return acc;
}

let pagine;
try {
  pagine = raccogliPagine(BROWSER);
} catch (e) {
  nonCapisco(`non riesco a percorrere dist/browser (${e.message})`);
}

// index.csr.html e' la shell CSR delle rotte client: e' VUOTA di proposito,
// non e' una pagina prerenderizzata e non va misurata.
pagine = pagine.filter((f) => !f.endsWith(`${sep}index.csr.html`));

// ---- 1-bis. La shell CSR deve uscire con il noindex ---------------------
//
// Ce lo scrive `scripts/inject-csr-noindex.mjs` subito dopo `ng build`. Qui si
// verifica che ci sia ARRIVATO: la shell e' l'unico corpo che Google riceve su
// /login, /registrazione, /negozio, /allenamento, /account, /admin e
// /live/:id/stanza, e da quando `public/robots.txt` non le blocca piu' e'
// l'unica cosa che le tiene fuori dall'indice insieme all'header X-Robots-Tag.
// Se l'iniezione smettesse di funzionare (rinomina del file, cambio di forma
// dell'artefatto, script tolto dalla catena di build) il sito tornerebbe a
// offrire 13 URL con lo stesso corpo, tutti indicizzabili, in silenzio.
const SHELL = join(BROWSER, 'index.csr.html');
if (!existsSync(SHELL))
  nonCapisco(
    'manca dist/frontend/browser/index.csr.html — e\' la shell servita a ogni ' +
      'rotta client (public/_redirects): senza, quelle rotte ricevono altro.',
  );
const shellHtml = readFileSync(SHELL, 'utf8');
if (!hasNoindex(shellHtml))
  nota(
    'index.csr.html — manca il <meta name="robots" content="noindex">. ' +
      'Lo inietta scripts/inject-csr-noindex.mjs: e\' ancora nella catena di ' +
      '`npm run build`? Senza, ogni rotta client torna indicizzabile.',
  );

// ⚠️ E la shell NON deve dichiarare un canonical (dal 19/08/2026). Lo ereditava
// da `src/index.html`, che punta alla HOME: giusto per la home, sbagliato per
// le altre 13 rotte che ricevono lo stesso file. Servivano insieme due segnali
// che si contraddicono — «non indicizzarmi» e «la pagina buona e' la home» — e
// il modo in cui quella coppia puo' finire male non e' che /login resti in
// indice: e' che il noindex venga consolidato SUL BERSAGLIO del canonical,
// cioe' sulla home. Lo toglie lo stesso iniettore; qui si verifica che sia
// arrivato.
if (hasCanonical(shellHtml))
  nota(
    'index.csr.html — dichiara ancora un <link rel="canonical"> (verso la ' +
      'home). Lo rimuove scripts/inject-csr-noindex.mjs: noindex + canonical ' +
      'altrui e\' la coppia che puo\' far consolidare il noindex sulla home.',
  );

if (pagine.length < MIN_PAGINE)
  nonCapisco(
    `trovate solo ${pagine.length} pagine prerenderizzate (soglia ${MIN_PAGINE}): ` +
      'il walker si e\' rotto, oppure il prerender ha smesso di emetterle.',
  );

// ---- 2. Estrazione ------------------------------------------------------

/** Parole realmente leggibili: via script, style, tag ed entita'. */
function paroleVisibili(html) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const corpo = main ? main[1] : html;
  return corpo
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function contaTag(html, tag) {
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const corpo = main ? main[1] : html;
  return (corpo.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
}

/** /tabelle/index.html -> "/tabelle"; browser/index.html -> "/" */
function rottaDi(file) {
  const rel = relative(BROWSER, dirname(file)).split(sep).join('/');
  return rel === '' ? '/' : `/${rel}`;
}

const righe = [];

for (const file of pagine.sort()) {
  const rotta = rottaDi(file);
  let html;
  try {
    html = readFileSync(file, 'utf8');
  } catch (e) {
    nonCapisco(`${rotta} illeggibile (${e.message})`);
  }

  const parole = paroleVisibili(html);
  const h1 = contaTag(html, 'h1');
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] ?? null;
  const noindex = hasNoindex(html);
  const soglia = MIN_PAROLE[rotta] ?? MIN_PAROLE_DEFAULT;
  const esente = ESENTI.get(rotta);

  righe.push({ rotta, parole, h1, canonical, soglia, noindex });
  if (esente) continue;

  // (a) contenuto. E' il controllo per cui questo file esiste.
  if (parole < soglia)
    nota(
      `${rotta} — solo ${parole} parole nel <main> (minimo ${soglia}). ` +
        "Se il contenuto e' dietro un @if su `auth.ready()`, il ramo che esce in " +
        'prerender e\' sempre quello sbagliato: gatta su `isAuthenticated()`.',
    );

  // (b) un h1 e uno solo. Zero = la pagina non dice di cosa parla; due = due
  // rami di template resi insieme, che a schermo non si vede e nell'HTML si'.
  if (h1 !== 1) nota(`${rotta} — ${h1} <h1> nel <main> (deve essere esattamente 1).`);

  // (c) canonical proprio e coerente. Senza, la pagina eredita quello statico
  // della home in index.html e Google la tratta come un duplicato.
  const atteso = rotta === '/' ? `${SITE}/` : `${SITE}${rotta}/`;
  if (!canonical) nota(`${rotta} — manca <link rel="canonical">.`);
  else if (canonical !== atteso)
    nota(`${rotta} — canonical "${canonical}", atteso "${atteso}" (forma con slash finale).`);

  // (d) `noindex` esattamente dove e' dichiarato, e da nessun'altra parte.
  // Il verso che conta e' il primo: una pagina pubblica che esce con noindex
  // sparisce da Google senza rompere niente di visibile, e finora nessun
  // controllo la guardava. Il verso opposto serve a non perdere in silenzio un
  // vincolo legale (/affiliazioni, art. 9 DL 87/2018).
  const deveEssereNoindex = NOINDEX_ATTESO.has(rotta);
  if (noindex && !deveEssereNoindex)
    nota(
      `${rotta} — esce con <meta name="robots" ... noindex>, e non e' fra le rotte ` +
        'che devono averlo (NOINDEX_ATTESO). Cosi\' sparisce da Google: se e\' voluto, ' +
        'dichiaralo li\' con la sua motivazione.',
    );
  else if (!noindex && deveEssereNoindex)
    nota(
      `${rotta} — deve uscire con noindex (NOINDEX_ATTESO) e non ce l'ha. ` +
        'Il meccanismo e\' `data: { noindex: true }` in app.routes.ts → SeoService.setRobots.',
    );
}

// ---- 3. Esito -----------------------------------------------------------

const larghezza = Math.max(...righe.map((r) => r.rotta.length), 12);
console.log('\nContenuto prerenderizzato:');
for (const r of righe) {
  const ok =
    r.parole >= r.soglia &&
    r.h1 === 1 &&
    r.canonical &&
    r.noindex === NOINDEX_ATTESO.has(r.rotta);
  console.log(
    `  ${ok ? '✓' : '✗'} ${r.rotta.padEnd(larghezza)} ` +
      `${String(r.parole).padStart(5)} parole (min ${r.soglia})  h1:${r.h1}` +
      (r.noindex ? '  [noindex]' : ''),
  );
}

if (errori.length) {
  console.error(`\n❌ Contenuto prerenderizzato in deriva (${errori.length}):\n`);
  for (const e of errori) console.error(`   • ${e}`);
  console.error('');
  process.exit(1);
}

console.log(
  `\n✓ ${righe.length} pagine prerenderizzate, tutte con contenuto, h1 e canonical` +
    ` (noindex solo su ${[...NOINDEX_ATTESO].join(', ')}); shell CSR con noindex.\n`,
);
