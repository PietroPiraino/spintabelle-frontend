// La regola della barra finale (src/app/core/barra-finale.ts) e il controllo
// sui link dell'HTML (barra-finale-link.mjs). Lanciato da `npm run test:scripts`.
//
// Il verso che conta di piu' e' il secondo blocco: una rotta CLIENT con la
// barra finale non corrisponde a nessuna regola di public/_redirects, quindi
// chi ricarica la pagina riceve la 404.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { linkSenzaBarraGiusta } from './barra-finale-link.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const {
  PERCORSI_CON_BARRA_FINALE,
  vuoleBarraFinale,
  percorsoVuoleBarraFinale,
  aggiungiBarraFinale,
  togliBarraFinale,
} = await import(pathToFileURL(resolve(REPO, 'src/app/core/barra-finale.ts')).href);

test('le pagine pubbliche vogliono la barra, parametri compresi', () => {
  for (const p of [
    '/tabelle',
    '/tabelle/spin-and-go-btn-10bb',
    '/glossario',
    '/glossario/limp/',
    '/guide/strategia-spin-and-go',
    '/news',
    '/news/un-articolo',
    '/replayer',
    '/replayer/Ab12Cd',
    '/allenamento',
    '/live',
    '/affiliazioni',
  ])
    assert.equal(percorsoVuoleBarraFinale(p), true, p);
});

test('le rotte client NON la vogliono (con la barra risponderebbero 404)', () => {
  for (const p of [
    '/login',
    '/registrazione',
    '/account',
    '/mie-mani',
    '/admin',
    '/admin/news',
    '/admin/replayer',
    '/allenamento/sessione',
    '/allenamento/risultati',
    '/live/abc/stanza',
    '/verifica-email',
    '/reimposta-password',
  ])
    assert.equal(percorsoVuoleBarraFinale(p), false, p);
});

test('la radice e i percorsi sconosciuti restano come sono', () => {
  assert.equal(vuoleBarraFinale([]), false);
  assert.equal(percorsoVuoleBarraFinale('/'), false);
  assert.equal(percorsoVuoleBarraFinale('/pagina-che-non-esiste'), false);
  // un parametro non combacia con un segmento vuoto
  assert.equal(vuoleBarraFinale(['glossario', '']), false);
  // il conteggio dei segmenti conta: `live` non trascina `live/:id/stanza`
  assert.equal(vuoleBarraFinale(['live', 'x']), false);
});

test("l'elenco non ha doppioni e ogni voce e' uno schema pulito", () => {
  assert.equal(new Set(PERCORSI_CON_BARRA_FINALE).size, PERCORSI_CON_BARRA_FINALE.length);
  for (const s of PERCORSI_CON_BARRA_FINALE)
    assert.match(s, /^[a-z0-9-]+(\/(:[a-zA-Z]+|[a-z0-9-]+))*$/, s);
});

test('aggiungiBarraFinale: prima di query e frammento, idempotente', () => {
  assert.equal(aggiungiBarraFinale('/glossario/limp'), '/glossario/limp/');
  assert.equal(aggiungiBarraFinale('/tabelle?formato=spin'), '/tabelle/?formato=spin');
  assert.equal(aggiungiBarraFinale('/guide/x#faq'), '/guide/x/#faq');
  assert.equal(aggiungiBarraFinale('/glossario/limp/'), '/glossario/limp/');
  assert.equal(aggiungiBarraFinale('/'), '/');
});

test('togliBarraFinale: la radice resta, query e frammento pure', () => {
  assert.equal(togliBarraFinale('/glossario/limp/'), '/glossario/limp');
  assert.equal(togliBarraFinale('/tabelle/?formato=spin'), '/tabelle?formato=spin');
  assert.equal(togliBarraFinale('/guide/x/#faq'), '/guide/x#faq');
  assert.equal(togliBarraFinale('/'), '/');
  assert.equal(togliBarraFinale('/?a=1'), '/?a=1');
  assert.equal(togliBarraFinale('/login'), '/login');
});

test('linkSenzaBarraGiusta: trova i due versi, ignora file e radice', () => {
  const html = `
    <a href="/">home</a>
    <a href="/glossario/limp">nuda</a>
    <a href="/glossario/check/">giusta</a>
    <a href="/tabelle?formato=spin">nuda con query</a>
    <a href="/login/">client con barra</a>
    <a href="/login?redirect=/abbonati">client giusta</a>
    <link href="/chunk-AB12.js"><link href="/fonts/x.woff2">
    <a href="//esterno.example/x">protocollo relativo</a>`;
  const storti = linkSenzaBarraGiusta(html, percorsoVuoleBarraFinale);
  assert.deepEqual(storti, [
    { href: '/glossario/limp', atteso: '/glossario/limp/' },
    { href: '/tabelle?formato=spin', atteso: '/tabelle/?formato=spin' },
    { href: '/login/', atteso: '/login' },
  ]);
});
