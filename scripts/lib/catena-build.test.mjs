import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// La catena di `npm run build`, sorvegliata.
//
// PERCHE' ESISTE. `ng build` produce artefatti che poi TRE script correggono e
// verificano in fila. Ognuno di quei passaggi e' la riparazione di un difetto
// che era arrivato in produzione, e ognuno fallisce in un modo che nessuno
// vede: se un anello sparisce dalla catena, il build resta VERDE e il sito
// torna a servire quello che serviva prima della riparazione — 13 URL
// indicizzabili (noindex), un canonical altrui sulla shell, il foglio globale
// che atterra dopo il contenuto (CLS). Nessun test dell'app se ne accorgerebbe:
// sono correzioni post-build, fuori dal perimetro di Karma e dei componenti.
//
// ⚠️ E' l'UNICA difesa contro «qualcuno toglie un anello». Le asserzioni dentro
// check-prerender-content.mjs non bastano da sole: se si toglie ANCHE quello,
// non resta niente. Questo test invece gira in `npm run test:scripts`, non ha
// bisogno di `dist/`, e legge la catena dichiarata invece degli artefatti.
//
// Precedenti in casa: faq-classi.test.mjs e semi-nudi.test.mjs sono anche loro
// guardie che leggono i SORGENTI e non gli artefatti, e vivono qui perche' e'
// la cartella che la glob di `test:scripts` raccoglie.
//
// ⚠️ Verifica i NOMI DEI FILE, non i comandi: `inject-csr-noindex.mjs` fa da
// tempo piu' di quello che il suo nome dice (noindex + canonical + CSS inline),
// e il giorno in cui verra' rinominato questo test fallira' — che e' il
// comportamento voluto: la rinomina e' un commit meccanico che deve toccare
// tutti i 18 riferimenti, e questo e' uno di quelli.

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));

/** Gli anelli, NELL'ORDINE in cui devono girare. */
const ANELLI = [
  'ng build',
  'scripts/inject-csr-noindex.mjs',
  'scripts/gen-sitemap.mjs',
  'scripts/check-routes.mjs',
  'scripts/check-prerender-content.mjs',
];

test('la catena di build contiene tutti i suoi anelli', () => {
  const build = pkg.scripts?.build;
  assert.ok(typeof build === 'string' && build.length, 'package.json non dichiara scripts.build');
  for (const anello of ANELLI) {
    assert.ok(
      build.includes(anello),
      `manca "${anello}" da scripts.build. Se e' stato tolto di proposito, ` +
        'questo test va aggiornato NELLO STESSO commit, spiegando perche\' — ' +
        'altrimenti la riparazione che quell\'anello porta e\' sparita in silenzio.',
    );
  }
});

test('gli anelli sono NELL ORDINE giusto', () => {
  // ⚠️ L'ordine e' portante: l'iniettore scrive index.csr.html, la guardia lo
  // rilegge. Invertiti, la guardia verificherebbe l'artefatto PRIMA della
  // correzione e fallirebbe sempre; peggio, con la sitemap in mezzo si
  // deriverebbe da un manifest non ancora scritto.
  const build = pkg.scripts.build;
  const posizioni = ANELLI.map((a) => build.indexOf(a));
  for (let i = 1; i < posizioni.length; i++) {
    assert.ok(
      posizioni[i] > posizioni[i - 1],
      `"${ANELLI[i]}" deve venire DOPO "${ANELLI[i - 1]}" in scripts.build`,
    );
  }
});

test('gli anelli sono concatenati con && (non con ; che ignora i fallimenti)', () => {
  // ⚠️ Con `;` un exit 1 di una guardia non fermerebbe il build: Cloudflare
  // deployerebbe lo stesso, e la guardia diventerebbe decorativa.
  const build = pkg.scripts.build;
  const dopoNgBuild = build.slice(build.indexOf('ng build'));
  assert.ok(!/;/.test(dopoNgBuild), 'la catena usa `;` da qualche parte: un fallimento non fermerebbe il deploy');
  assert.equal(
    (dopoNgBuild.match(/&&/g) || []).length,
    ANELLI.length - 1,
    'il numero di `&&` non corrisponde al numero di anelli',
  );
});

test('⚠️ anti-guardia-vuota: la lista degli anelli non e vuota', () => {
  // Se qualcuno svuotasse ANELLI, i tre test sopra passerebbero su qualunque
  // cosa. Una guardia che non guarda niente e' peggio di nessuna guardia.
  assert.ok(ANELLI.length >= 5, 'la lista degli anelli si e\' svuotata');
});

test('npm run test:scripts usa la GLOB e non la directory', () => {
  // ⚠️ `node --test scripts/lib/` su una DIRECTORY non funziona su Node 24 /
  // Windows: prova a caricarla come modulo. Se qualcuno «semplificasse» quella
  // riga, l'intera suite smetterebbe di girare — in silenzio, perche' il
  // comando fallisce prima di eseguire un solo test.
  assert.match(pkg.scripts?.['test:scripts'] ?? '', /scripts\/lib\/\*\.test\.mjs/);
});
