// Test di scripts/lib/server-routes.mjs — `npm run test:scripts` (Node 24,
// zero dipendenze). Qui si testa il pezzo che DECIDE quali URL passano dalla
// Cloudflare Pages Function: se il matcher sbaglia, `check-routes.mjs` passa
// per il motivo sbagliato e non protegge piu' niente.

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readServerRoutes,
  serverPaths,
  parseRoutesJson,
  includeMatches,
  findInclude,
  lintInclude,
  lintIncludes,
  urlDiEsempio,
} from './server-routes.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');

/** Scrive un finto app.routes.server.ts e restituisce il percorso. */
function fixtureTs(contenuto) {
  const dir = mkdtempSync(join(tmpdir(), 'bff-server-routes-'));
  const f = join(dir, 'app.routes.server.ts');
  writeFileSync(f, contenuto, 'utf8');
  return f;
}

const sorgente = (corpo) =>
  `import { RenderMode, ServerRoute } from '@angular/ssr';\nexport const serverRoutes: ServerRoute[] = [\n${corpo}\n];\n`;

// ---- readServerRoutes ---------------------------------------------------

test('readServerRoutes: legge path e renderMode, ignorando il resto della rotta', () => {
  const f = fixtureTs(
    sorgente(
      [
        "  { path: '', renderMode: RenderMode.Prerender },",
        "  { path: 'news', renderMode: RenderMode.Server },",
        "  { path: 'news/:id', renderMode: RenderMode.Server, fallback: PrerenderFallback.None,",
        '    async getPrerenderParams() { return []; } },',
        "  { path: '**', renderMode: RenderMode.Client },",
      ].join('\n'),
    ),
  );
  const rotte = readServerRoutes(f);
  assert.deepEqual(
    rotte.map((r) => [r.path, r.renderMode]),
    [
      ['', 'Prerender'],
      ['news', 'Server'],
      ['news/:id', 'Server'],
      ['**', 'Client'],
    ],
  );
  assert.deepEqual(serverPaths(rotte), ['news', 'news/:id']);
});

test('readServerRoutes: `path` non letterale -> lancia (non tira a indovinare)', () => {
  const f = fixtureTs(sorgente('  { path: ROTTA_NEWS, renderMode: RenderMode.Server },'));
  assert.throws(() => readServerRoutes(f), /letterale stringa/);
});

test('readServerRoutes: `renderMode` calcolato -> lancia', () => {
  const f = fixtureTs(sorgente("  { path: 'news', renderMode: modalita() },"));
  assert.throws(() => readServerRoutes(f), /RenderMode\./);
});

test('readServerRoutes: rotta senza renderMode -> lancia', () => {
  const f = fixtureTs(sorgente("  { path: 'news' },"));
  assert.throws(() => readServerRoutes(f), /renderMode/);
});

test('readServerRoutes: spread nell array -> lancia invece di saltarlo', () => {
  const f = fixtureTs(sorgente('  ...altreRotte,'));
  assert.throws(() => readServerRoutes(f), /si rifiuta di indovinare/);
});

test('readServerRoutes: array assente -> lancia', () => {
  const f = fixtureTs('export const altro = [];\n');
  assert.throws(() => readServerRoutes(f), /serverRoutes/);
});

test('readServerRoutes: legge il file VERO del repo (il parser regge la forma reale)', () => {
  const rotte = readServerRoutes(join(REPO, 'src/app/app.routes.server.ts'));
  assert.ok(rotte.length >= 15, `trovate solo ${rotte.length} rotte server`);
  assert.ok(rotte.some((r) => r.path === '' && r.renderMode === 'Prerender'));
  assert.ok(rotte.some((r) => r.path === '**' && r.renderMode === 'Client'));
});

// ---- parseRoutesJson ----------------------------------------------------

test('parseRoutesJson: forma buona', () => {
  const r = parseRoutesJson('{"version":1,"include":["/news/*"],"exclude":[]}');
  assert.deepEqual(r, { version: 1, include: ['/news/*'], exclude: [] });
});

test('parseRoutesJson: il file vero del repo e\' valido e non e\' una catch-all', () => {
  const { include } = parseRoutesJson(readFileSync(join(REPO, 'public/_routes.json'), 'utf8'));
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
  // ⚠️ E' l'invariante di tutta la tappa 1: l'indice /news resta una pagina
  // prerenderizzata e non deve passare dalla Function. Al contrario di
  // `_redirects`, dove `/live/*` catturava ANCHE `/live` — due file, due
  // semantiche opposte.
  assert.equal(includeMatches('/news/*', '/news'), false);
  assert.equal(includeMatches('/news/*', '/news/'), true);
  assert.equal(includeMatches('/news/*', '/news/abc'), true);
  assert.equal(includeMatches('/news/*', '/news/abc/'), true);
  assert.equal(includeMatches('/news/*', '/newsletter'), false);
});

test('includeMatches: senza `*` e\' match esatto', () => {
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

// ---- lintInclude --------------------------------------------------------

test('lintInclude: la catch-all e\' vietata anche qui (terza incarnazione della regola)', () => {
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
