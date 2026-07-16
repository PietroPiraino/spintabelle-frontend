// Test di scripts/lib/redirects.mjs — `node --test scripts/lib/` (Node 24, zero
// dipendenze). Qui si testa il pezzo che DECIDE: se il matcher sbaglia, il
// controllo rotte passa per il motivo sbagliato e non protegge piu' niente.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRedirects,
  ruleMatches,
  findMatch,
  lintRule,
  lintRules,
  sampleUrl,
  routeCoversUrl,
} from './redirects.mjs';

const regola = (from, to = '/index.csr', status = '200', line = 1) => ({ from, to, status, line });

// ---- parseRedirects -----------------------------------------------------
test('parseRedirects: legge le regole e ignora commenti e righe vuote', () => {
  const rules = parseRedirects(
    ['# commento', '', '/login    /index.csr  200', '/live/*   /index.csr  200'].join('\n'),
  );
  assert.deepEqual(rules, [
    { from: '/login', to: '/index.csr', status: '200', line: 3 },
    { from: '/live/*', to: '/index.csr', status: '200', line: 4 },
  ]);
});

test('parseRedirects: il numero di riga e\' quello del file vero (per incollarlo nell\'errore)', () => {
  const [r] = parseRedirects('#a\n#b\n\n/docs  /index.csr  200\n');
  assert.equal(r.line, 4);
});

test('parseRedirects: riga malformata -> lancia (non tira a indovinare)', () => {
  assert.throws(() => parseRedirects('/soltanto-questo\n'), /riga 1/);
});

// ---- ruleMatches: la semantica Cloudflare -------------------------------
test('ruleMatches: match esatto, e NON per prefisso', () => {
  assert.equal(ruleMatches('/login', '/login'), true);
  assert.equal(ruleMatches('/login', '/login/extra'), false);
  assert.equal(ruleMatches('/login', '/logineria'), false);
  assert.equal(ruleMatches('/login', '/altro'), false);
});

test('ruleMatches: lo splat /* cattura anche le code con piu\' segmenti', () => {
  // Il caso vero: /live/* deve coprire /live/<id>/stanza, non solo /live/<id>.
  assert.equal(ruleMatches('/live/*', '/live/abc'), true);
  assert.equal(ruleMatches('/live/*', '/live/abc/stanza'), true);
  assert.equal(ruleMatches('/live/*', '/live/a/b/c/d'), true);
  assert.equal(ruleMatches('/live/*', '/live'), true); // il prefisso nudo
});

test('ruleMatches: lo splat NON sconfina su un fratello con lo stesso prefisso', () => {
  // Se sconfinasse, /live/* "coprirebbe" /livello e il controllo direbbe
  // "coperta" per una rotta che in prod prende l'HTML della home.
  assert.equal(ruleMatches('/live/*', '/livello'), false);
  assert.equal(ruleMatches('/live/*', '/live-chat'), false);
});

test('findMatch: restituisce la prima regola che matcha, null se nessuna', () => {
  const rules = [regola('/docs', '/index.csr', '200', 1), regola('/live/*', '/index.csr', '200', 2)];
  assert.equal(findMatch(rules, '/live/x/stanza').line, 2);
  assert.equal(findMatch(rules, '/tabelle'), null);
});

// ---- lintRule: i tre casi che hanno gia' fatto danno ---------------------
test('lintRule: regola sana -> nessun problema', () => {
  assert.equal(lintRule(regola('/login')), null);
});

test('lintRule: target con .html -> LOOP (incidente del 12/07: sito giu\')', () => {
  const p = lintRule(regola('/login', '/index.csr.html'));
  assert.match(p, /LOOP/);
  assert.match(p, /index\.csr/); // dice anche cosa scrivere al posto suo
});

test('lintRule: catch-all /* -> vietata (cattura il proprio target)', () => {
  assert.match(lintRule(regola('/*')), /catch-all/);
  assert.match(lintRule(regola('/**')), /catch-all/);
});

test('lintRule: status diverso da 200 -> non e\' un rewrite', () => {
  assert.match(lintRule(regola('/login', '/index.csr', '301')), /200/);
  assert.match(lintRule(regola('/login', '/index.csr', '')), /assente/);
});

test('lintRule: la catch-all vince sul .html (il problema piu\' grave per primo)', () => {
  assert.match(lintRule(regola('/*', '/index.csr.html', '301')), /catch-all/);
});

test('lintRules: filtra le sane e tiene la regola incriminata (per il numero di riga)', () => {
  const rules = [regola('/login', '/index.csr', '200', 5), regola('/docs', '/index.csr.html', '200', 6)];
  const out = lintRules(rules);
  assert.equal(out.length, 1);
  assert.equal(out[0].rule.line, 6);
  assert.match(out[0].problema, /LOOP/);
});

test('lintRules: _redirects reale di oggi -> zero problemi', () => {
  const rules = parseRedirects(
    ['/account  /index.csr  200', '/live/*   /index.csr  200', '# nota', ''].join('\n'),
  );
  assert.deepEqual(lintRules(rules), []);
});

// ---- sampleUrl / routeCoversUrl -----------------------------------------
test('sampleUrl: una rotta con parametri diventa un URL concreto di esempio', () => {
  assert.equal(sampleUrl('login'), '/login');
  assert.equal(sampleUrl('live/:id/stanza'), '/live/__esempio__/stanza');
  assert.equal(sampleUrl(''), '/');
});

test('routeCoversUrl: la rotta parametrica copre l\'URL prerenderizzata concreta', () => {
  assert.equal(routeCoversUrl('news/:id', '/news/6a29cc8a9ed40761656ec14d'), true);
  assert.equal(routeCoversUrl('news/:id', '/news'), false);
  assert.equal(routeCoversUrl('news/:id', '/news/a/b'), false); // :id e' UN segmento
  assert.equal(routeCoversUrl('news', '/news'), true);
  assert.equal(routeCoversUrl('', '/'), true);
});
