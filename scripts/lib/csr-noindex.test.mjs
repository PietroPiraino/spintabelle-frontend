import { test } from 'node:test';
import assert from 'node:assert/strict';
import { META_ROBOTS, hasNoindex, injectNoindex } from './csr-noindex.mjs';

const shell = (extra = '') =>
  `<!doctype html><html lang="it"><head>\n  <title>x</title>\n${extra}</head><body><app-root></app-root></body></html>`;

test('hasNoindex: falso su una shell senza meta robots', () => {
  assert.equal(hasNoindex(shell()), false);
});

test('hasNoindex: vero solo se il meta robots contiene noindex', () => {
  assert.equal(hasNoindex(shell('  <meta name="robots" content="noindex, follow">\n')), true);
  assert.equal(hasNoindex(shell("  <meta name='robots' content='noindex'>\n")), true);
  // ⚠️ un robots che dice "index" NON conta come noindex: se contasse, una
  // shell dichiarata indicizzabile passerebbe la guardia come se fosse a posto.
  assert.equal(hasNoindex(shell('  <meta name="robots" content="index, follow">\n')), false);
});

test('hasNoindex: non si fa ingannare da un noindex fuori dal meta robots', () => {
  assert.equal(hasNoindex(shell('  <meta name="description" content="noindex">\n')), false);
});

test('injectNoindex: inserisce il meta dentro <head>', () => {
  const out = injectNoindex(shell());
  assert.ok(out.includes(META_ROBOTS));
  assert.ok(out.indexOf(META_ROBOTS) < out.indexOf('</head>'), 'il meta deve stare nel <head>');
});

test('injectNoindex: idempotente — due passate non accumulano tag', () => {
  const uno = injectNoindex(shell());
  const due = injectNoindex(uno);
  assert.equal(due, uno);
  assert.equal((due.match(/name="robots"/g) || []).length, 1);
});

test('injectNoindex: lascia intatto il resto del documento', () => {
  const out = injectNoindex(shell());
  assert.ok(out.includes('<app-root></app-root>'));
  assert.ok(out.includes('<title>x</title>'));
});

test('injectNoindex: lancia se manca </head> invece di restituire un HTML invariato', () => {
  assert.throws(() => injectNoindex('<html><body>niente head</body></html>'), /head/);
});

test('injectNoindex: regge un </head > con spazio (HTML valido)', () => {
  const out = injectNoindex('<html><head><title>x</title></head ><body></body></html>');
  assert.ok(out.includes(META_ROBOTS));
  assert.ok(out.indexOf(META_ROBOTS) < out.indexOf('</head >'));
});
