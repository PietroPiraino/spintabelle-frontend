import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  META_ROBOTS,
  hasCanonical,
  hasNoindex,
  injectNoindex,
  stripCanonical,
} from './csr-noindex.mjs';

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

// ---- canonical: la shell non deve dichiararne uno ------------------------
//
// ⚠️ Il caso che questi test difendono non e' «/login resta in indice» (a
// quello pensa il noindex), ma il suo contrario pericoloso: noindex + canonical
// verso la home e' la coppia che Google puo' consolidare, applicando il noindex
// AL BERSAGLIO. Il bersaglio e' la home.

const CANON = '  <link rel="canonical" href="https://bestfishforever.it/">\n';

test('hasCanonical: vero con il tag, falso senza', () => {
  assert.equal(hasCanonical(shell(CANON)), true);
  assert.equal(hasCanonical(shell()), false);
});

test('stripCanonical: toglie il tag e non lascia una riga vuota al suo posto', () => {
  const out = stripCanonical(shell(CANON));
  assert.equal(hasCanonical(out), false);
  assert.ok(!out.includes('canonical'));
  assert.ok(out.includes('<title>x</title>'));
  assert.ok(out.includes('<app-root></app-root>'));
});

test('stripCanonical: idempotente (una shell gia pulita resta identica)', () => {
  const pulita = shell();
  assert.equal(stripCanonical(pulita), pulita);
});

test('stripCanonical: regge apici singoli e attributi in ordine diverso', () => {
  const varianti = [
    `  <link href="https://bestfishforever.it/" rel="canonical">\n`,
    `  <link rel='canonical' href='https://bestfishforever.it/'>\n`,
    `  <link rel="canonical" href="https://bestfishforever.it/" />\n`,
  ];
  for (const v of varianti) {
    assert.equal(hasCanonical(stripCanonical(shell(v))), false, v);
  }
});

test('stripCanonical: NON tocca gli altri <link> (preload, icone, manifest)', () => {
  const altri =
    '  <link rel="icon" href="/favicon.ico">\n' +
    '  <link rel="apple-touch-icon" href="/logo-96.png">\n' +
    '  <link rel="modulepreload" href="/chunk-x.js">\n';
  const out = stripCanonical(shell(CANON + altri));
  assert.equal(hasCanonical(out), false);
  assert.ok(out.includes('rel="icon"'));
  assert.ok(out.includes('rel="apple-touch-icon"'));
  assert.ok(out.includes('rel="modulepreload"'));
});

test('noindex e strip convivono: la shell finisce con il meta e senza canonical', () => {
  const out = stripCanonical(injectNoindex(shell(CANON)));
  assert.equal(hasNoindex(out), true);
  assert.equal(hasCanonical(out), false);
  assert.ok(out.includes(META_ROBOTS));
});
