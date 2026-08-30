// Prepara la shell CSR — e SOLO quella. TRE chirurgie, non una:
//   1. inietta il `<meta name="robots" content="noindex, follow">`
//   2. TOGLIE il `<link rel="canonical">` ereditato da src/index.html
//   3. inlina il foglio di stile GLOBALE nella <head>
//
// ⚠️ IL NOME DEL FILE DICE SOLO LA PRIMA, ed e' impreciso da prima che ci fosse
// la terza. La rinomina costa 18 riferimenti in 12 file (package.json, i
// messaggi d'errore di check-prerender-content.mjs, check-news-live.mjs,
// public/_headers, public/robots.txt, README.md, i due renderer di bordo, tre
// test): va fatta come commit separato e meccanico, con
// `grep -rn "inject-csr-noindex"` a zero prima del merge, mai insieme a una
// modifica funzionale. Nel frattempo a tenere onesto il nome c'e'
// scripts/lib/catena-build.test.mjs, che verifica gli anelli della catena.
//
// PERCHE' UN SOLO SCRIPT e non tre. Due programmi che aprono, leggono,
// modificano e riscrivono lo STESSO file hanno una lost update se qualcuno li
// mette in parallelo, li riordina, o ne infila un terzo in mezzo: file valido,
// deploy verde, e una chirurgia su tre. Un lettore, uno scrittore, una
// post-condizione verificata sulla stessa stringa in memoria.
//
// PERCHE' ESISTE. Le rotte non prerenderizzate (RenderMode.Client: /login,
// /registrazione, /negozio, /allenamento, /account, /admin, /live/:id/stanza,
// le quattro rotte email) ricevono tutte lo STESSO file, `index.csr.html`, che
// nasce senza alcun `<meta name="robots">` e per giunta dichiara come canonical
// la HOME. Nessuna di quelle rotte deve comparire in ricerca, quindi la shell
// puo' dichiararlo una volta per tutte.
//
// PERCHE' QUI E NON IN src/index.html. Mettere il meta nel sorgente e contare
// sul ramo `else` di `SeoService.setRobots` (che lo rimuove) per ripulire le
// 26 pagine prerenderizzate e' un meccanismo mai misurato, il cui modo di
// fallire e' catastrofico e silenzioso: si deploya `noindex` su TUTTO il sito
// pubblico. Qui invece si scrive dopo che il prerender ha gia' emesso i suoi
// file: le pagine pubbliche non sono raggiungibili da questo script nemmeno
// per sbaglio, apre un file solo e quello e'.
//
// PERCHE' ANCHE QUESTO, visto che c'e' `public/_headers` con `X-Robots-Tag`.
// Non e' ridondanza: i due coprono buchi diversi. L'header sopravvive
// all'idratazione (il JS non puo' toglierlo) ma poggia su un dettaglio di
// Cloudflare Pages — che `_headers` sia valutato sull'URL RICHIESTO e non sul
// bersaglio della riscrittura 200 di `_redirects` — documentato e verificato,
// ma mai misurato su un `_headers` nostro. Il meta invece e' dentro il corpo
// della risposta: arriva a destinazione qualunque cosa faccia il matcher degli
// header. Se uno dei due salta, l'altro regge.
//
// Filosofia identica alle altre guardie del progetto:
//   - ARTEFATTI ASSENTI  -> exit 0 + avviso (niente dist = niente deploy in gioco)
//   - ARTEFATTO STRANO   -> exit 1 (un'iniezione che non inietta e non lo dice
//     e' il modo in cui una rete di sicurezza si stacca in silenzio)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  META_ROBOTS,
  hasCanonical,
  hasNoindex,
  injectNoindex,
  stripCanonical,
} from './lib/csr-noindex.mjs';
import {
  fogliDichiarati,
  inserisciCssInline,
  percorsoDelFoglio,
  verificaCssInline,
} from './lib/csr-css.mjs';

// ⚠️ Default `process.cwd()` e non un percorso Windows assoluto: su POSIX
// `C:/…` non e' assoluto e verrebbe attaccato alla cwd, con il risultato che
// lo script non farebbe nulla proprio sul runner di Cloudflare.
const ROOT = resolve(process.argv[2] ?? process.cwd());
const BROWSER = join(ROOT, 'dist/frontend/browser');
const SHELL = join(BROWSER, 'index.csr.html');

if (!existsSync(join(ROOT, 'dist/frontend/browser'))) {
  console.warn(
    `\n⚠️  Iniezione noindex SALTATA: manca ${join(ROOT, 'dist/frontend/browser')} — hai lanciato ng build?\n`,
  );
  process.exit(0);
}

// Da qui in poi la dist c'e': se la shell non c'e', la forma dell'artefatto e'
// cambiata e le rotte client partirebbero indicizzabili. Rumore, non silenzio.
if (!existsSync(SHELL)) {
  console.error(
    '\n❌ dist/frontend/browser esiste ma manca index.csr.html.' +
      '\n   E\' la shell servita a ogni rotta client (vedi public/_redirects):' +
      '\n   senza, non c\'e\' niente in cui iniettare il noindex.' +
      '\n   Emergenza: SKIP_PRERENDER_CHECK=1 non copre questo script, va indagato.\n',
  );
  process.exit(1);
}

let html;
try {
  html = readFileSync(SHELL, 'utf8');
} catch (e) {
  console.error(`\n❌ index.csr.html illeggibile: ${e.message}\n`);
  process.exit(1);
}

// Due interventi, indipendenti e ognuno idempotente: si aggiunge il `noindex` e
// si TOGLIE il canonical ereditato da `src/index.html` (che punta alla home —
// vedi `stripCanonical`, e' li' che c'e' scritto perche' la coppia
// noindex+canonical e' il problema). Si scrive solo se qualcosa e' cambiato.
const fatto = [];
let out = html;

if (hasNoindex(out)) {
  fatto.push("noindex gia' presente");
} else {
  try {
    out = injectNoindex(out);
  } catch (e) {
    console.error(`\n❌ Non riesco a iniettare il noindex nella shell CSR: ${e.message}\n`);
    process.exit(1);
  }
  fatto.push(`iniettato ${META_ROBOTS}`);
}

if (hasCanonical(out)) {
  out = stripCanonical(out);
  // ⚠️ Se dopo la rimozione ne resta uno, la forma del tag e' cambiata e la
  // shell continuerebbe a dichiarare una canonica altrui: rumore, non silenzio.
  if (hasCanonical(out)) {
    console.error(
      '\n❌ Il <link rel="canonical"> della shell CSR non e\' stato rimosso.' +
        '\n   La forma del tag e\' cambiata: aggiorna stripCanonical() in' +
        '\n   scripts/lib/csr-noindex.mjs (coperta da npm run test:scripts).\n',
    );
    process.exit(1);
  }
  fatto.push('rimosso il <link rel="canonical"> verso la home');
} else {
  fatto.push('nessun canonical da rimuovere');
}

// ---- 3. Il foglio globale INLINE ----------------------------------------
//
// PERCHE'. Beasties (dipendenza transitiva di @angular/build, si riconosce da
// `data-beasties-container` su <html>) calcola la critical CSS dall'HTML RESO.
// In index.csr.html <app-root> contiene 447 byte di boot-loader: ha inlinato,
// correttamente e inutilmente, la critical CSS dell'ANIMAZIONE DI CARICAMENTO.
// Misurato il 30/08/2026: due <style> per 9.279 B, e `h1{`, `.container{`,
// `.section{`, `.page-hero` ASSENTI — contro i 37-44 kB delle prerenderizzate.
// Ma quella shell e' il corpo di 12 rotte client (public/_redirects) E delle
// pagine composte all'edge (/replayer/*, /news, /news/*), dove le Function
// sostituiscono il boot-loader con un articolo INTERO: dipinto senza CSS e
// riflowato quando il <link media="print"> (priorita' Lowest, dietro dieci
// modulepreload) atterra. E' il 12% di CLS «insufficiente» del report
// Cloudflare del 29-30/08/2026.
//
// ⚠️ PREMESSA CHE NESSUNA GUARDIA PUO' VERIFICARE: questo serve a qualcosa
// finche' la shell resta il corpo di quelle pagine. Se un giorno /replayer/*
// diventasse prerenderizzata, o `_redirects` cambiasse, l'iniezione resterebbe
// verde e smetterebbe di servire. Chi tocca quei file guardi anche qui.
//
// I DUE <link> RESTANO. Se l'iniezione fallisse o fosse incompleta il sito
// resta stilato, e il foglio esterno — che nel documento sta DOPO il blocco
// iniettato — vince a parita' di specificita': la copia inline e' un
// acceleratore, non l'autorita'. Toglierli e' un secondo giro, dopo che il CLS
// e' misurato buono. Costo di questa scelta: ~6 kB gzip di doppione alla PRIMA
// visita (il foglio ha l'hash nel nome, quindi poi e' in cache lunga).
const hrefs = fogliDichiarati(out);
if (!hrefs.length) {
  console.error(
    '\n❌ Nessun <link rel="stylesheet"> nella shell CSR.' +
      "\n   E' l'unico modo che ho di sapere QUALE foglio inlinare: il nome porta" +
      "\n   l'hash del build e non e' cablabile. O Beasties ha cambiato forma, o" +
      "\n   il foglio globale e' sparito: aggiorna fogliDichiarati() in" +
      '\n   scripts/lib/csr-css.mjs (coperta da npm run test:scripts).\n',
  );
  process.exit(1);
}

let byteInline = 0;
try {
  const fogli = hrefs.map((href) => {
    const css = readFileSync(join(BROWSER, percorsoDelFoglio(href)), 'utf8');
    byteInline += css.length;
    return { href, css };
  });
  out = inserisciCssInline(out, fogli);
} catch (e) {
  console.error(`\n❌ Non riesco a inlinare il CSS globale nella shell CSR: ${e.message}\n`);
  process.exit(1);
}

// ⚠️ LA POST-CONDIZIONE, sullo STESSO predicato che usera' poi
// check-prerender-content.mjs: due copie della stessa verifica in due file sono
// una divergenza che aspetta solo di succedere. Un'iniezione che non inietta e
// non lo dice e' il modo in cui una rete di sicurezza si stacca in silenzio.
const guaiCss = verificaCssInline(out, (percorso) => {
  try {
    return readFileSync(join(BROWSER, percorso), 'utf8');
  } catch {
    return null;
  }
});
if (guaiCss.length) {
  console.error(
    "\n❌ Il CSS globale NON e' finito nella shell CSR come dovrebbe:\n   • " +
      guaiCss.join('\n   • ') +
      '\n   Aggiorna inserisciCssInline()/verificaCssInline() in' +
      '\n   scripts/lib/csr-css.mjs (coperte da npm run test:scripts).\n',
  );
  process.exit(1);
}
fatto.push(`inlinati ${hrefs.length} foglio/i globale/i (${byteInline} B)`);

if (out === html) {
  console.log(`\n✓ Shell CSR: ${fatto.join(' · ')}.\n`);
  process.exit(0);
}

writeFileSync(SHELL, out, 'utf8');
console.log(`\n✓ Shell CSR: ${fatto.join(' · ')}.\n`);
