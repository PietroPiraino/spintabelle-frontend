// Inietta il `noindex` nella shell CSR — e SOLO in quella.
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
import { META_ROBOTS, hasNoindex, injectNoindex } from './lib/csr-noindex.mjs';

// ⚠️ Default `process.cwd()` e non un percorso Windows assoluto: su POSIX
// `C:/…` non e' assoluto e verrebbe attaccato alla cwd, con il risultato che
// lo script non farebbe nulla proprio sul runner di Cloudflare.
const ROOT = resolve(process.argv[2] ?? process.cwd());
const SHELL = join(ROOT, 'dist/frontend/browser/index.csr.html');

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

if (hasNoindex(html)) {
  console.log('\n✓ Shell CSR: noindex gia\' presente, niente da fare.\n');
  process.exit(0);
}

let out;
try {
  out = injectNoindex(html);
} catch (e) {
  console.error(`\n❌ Non riesco a iniettare il noindex nella shell CSR: ${e.message}\n`);
  process.exit(1);
}

writeFileSync(SHELL, out, 'utf8');
console.log(`\n✓ Shell CSR: iniettato ${META_ROBOTS}\n`);
