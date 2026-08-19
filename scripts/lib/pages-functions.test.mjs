// Test di scripts/lib/pages-functions.mjs — `npm run test:scripts` (Node 24,
// zero dipendenze). Qui si testa il pezzo che DECIDE quali URL passano dalla
// Cloudflare Pages Function: se il matcher sbaglia, `check-routes.mjs` passa
// per il motivo sbagliato e non protegge piu' niente.
//
// ⚠️ Erede di `server-routes.test.mjs`: i test che leggevano i `renderMode` di
// `app.routes.server.ts` sono spariti insieme al codice che li leggeva — la
// terza categoria di rotte non e' piu' "RenderMode.Server" ma "servita da una
// Pages Function", ed e' un fatto di `_routes.json`, non di Angular.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseRoutesJson,
  includeMatches,
  findInclude,
  lintInclude,
  lintIncludes,
  urlDiEsempio,
} from './pages-functions.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');

const includeVeri = () =>
  parseRoutesJson(readFileSync(join(REPO, 'public/_routes.json'), 'utf8')).include;

// ---- parseRoutesJson ----------------------------------------------------

test('parseRoutesJson: forma buona', () => {
  const r = parseRoutesJson('{"version":1,"include":["/news/*"],"exclude":[]}');
  assert.deepEqual(r, { version: 1, include: ['/news/*'], exclude: [] });
});

test("parseRoutesJson: il file vero del repo e' valido e non e' una catch-all", () => {
  const include = includeVeri();
  assert.ok(include.length > 0);
  assert.deepEqual(lintIncludes(include), []);
});

test('parseRoutesJson: chiave sconosciuta -> lancia (Cloudflare la ignorerebbe in silenzio)', () => {
  assert.throws(
    () => parseRoutesJson('{"version":1,"include":[],"exclude":[],"nota":"ciao"}'),
    /chiave sconosciuta/,
  );
});

test('parseRoutesJson: version diversa da 1 -> lancia', () => {
  assert.throws(() => parseRoutesJson('{"version":2,"include":[],"exclude":[]}'), /version/);
});

test('parseRoutesJson: pattern senza "/" iniziale -> lancia', () => {
  assert.throws(() => parseRoutesJson('{"version":1,"include":["news/*"],"exclude":[]}'), /non inizia con/);
});

test('parseRoutesJson: `*` non in fondo (o doppio) -> lancia invece di indovinare', () => {
  assert.throws(() => parseRoutesJson('{"version":1,"include":["/news/*/foto"],"exclude":[]}'), /solo in fondo/);
  assert.throws(() => parseRoutesJson('{"version":1,"include":["/a*/b*"],"exclude":[]}'), /solo in fondo/);
});

test('parseRoutesJson: JSON rotto -> lancia', () => {
  assert.throws(() => parseRoutesJson('{'), /JSON valido/);
});

// ---- includeMatches: la semantica che conta ----------------------------

test('includeMatches: `/news/*` NON copre il prefisso nudo `/news`', () => {
  // ⚠️ L'INVARIANTE PIU' IMPORTANTE DI QUESTO FILE. L'indice /news lo compone
  // la Function come gli articoli: se lo si desse per coperto da `/news/*`,
  // Cloudflare non la chiamerebbe e cercherebbe un asset che non esiste.
  // Al contrario di `_redirects`, dove `/live/*` catturava ANCHE `/live` — due
  // file, due semantiche opposte.
  assert.equal(includeMatches('/news/*', '/news'), false);
  assert.equal(includeMatches('/news/*', '/news/'), true);
  assert.equal(includeMatches('/news/*', '/news/abc'), true);
  assert.equal(includeMatches('/news/*', '/news/abc/'), true);
  assert.equal(includeMatches('/news/*', '/newsletter'), false);
});

test("includeMatches: senza `*` e' match esatto", () => {
  assert.equal(includeMatches('/news', '/news'), true);
  assert.equal(includeMatches('/news', '/news/'), false);
  assert.equal(includeMatches('/news', '/news/abc'), false);
});

test('includeMatches: il catch-all `/*` cattura davvero tutto', () => {
  for (const url of ['/', '/news', '/chunk-ABC.js', '/favicon.ico'])
    assert.equal(includeMatches('/*', url), true, url);
});

test('findInclude: restituisce il pattern che cattura, o null', () => {
  assert.equal(findInclude(['/news', '/news/*'], '/news/abc'), '/news/*');
  assert.equal(findInclude(['/news/*'], '/news'), null);
});

// ---- Il file vero, misurato sulle URL vere ------------------------------

test("public/_routes.json copre TUTTE E QUATTRO le forme delle news (indice e articolo, nuda e con lo slash)", () => {
  const include = includeVeri();
  const attese = [
    ...urlDiEsempio('news'), //      /news   e /news/
    ...urlDiEsempio('news/:id'), //  /news/x e /news/x/
  ];
  for (const url of attese)
    assert.ok(findInclude(include, url), `${url} non e' coperta da nessun include: ${include.join(' ')}`);
});

test("public/_routes.json elenca `/news` A PARTE: togliendolo, il prefisso nudo resta scoperto", () => {
  // La prova che l'invariante qui sopra non e' teorica ma e' quella che tiene
  // in piedi la configurazione VERA: basta cancellare una riga dall'include e
  // l'indice smette di arrivare alla Function, mentre gli articoli continuano
  // a funzionare benissimo — il difetto piu' facile da non vedere provando a
  // mano, perche' si prova quasi sempre un articolo.
  const senzaIndice = includeVeri().filter((p) => p !== '/news');
  assert.ok(senzaIndice.includes('/news/*'), 'atteso `/news/*` nel file vero');
  assert.equal(findInclude(senzaIndice, '/news'), null);
  assert.ok(findInclude(senzaIndice, '/news/abc'));
});

// ---- lintInclude --------------------------------------------------------

test("lintInclude: la catch-all e' vietata anche qui (terza incarnazione della regola)", () => {
  assert.match(lintInclude('/*'), /catch-all/);
  assert.match(lintInclude('/**'), /catch-all/);
  assert.equal(lintInclude('/news/*'), null);
  assert.equal(lintInclude('/news'), null);
});

// ---- urlDiEsempio -------------------------------------------------------

test('urlDiEsempio: forma nuda e forma con slash finale, parametri sostituiti', () => {
  assert.deepEqual(urlDiEsempio('news'), ['/news', '/news/']);
  assert.deepEqual(urlDiEsempio('news/:id'), ['/news/__esempio__', '/news/__esempio__/']);
  assert.deepEqual(urlDiEsempio(''), ['/']);
});
