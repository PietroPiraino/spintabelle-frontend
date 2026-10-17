// Le FONTI in fondo all'articolo — `npm run test:scripts` (Node 24, zero
// dipendenze).
//
// PERCHE' ESISTE. La policy editoriale e la pagina `/redazione` promettono che
// un articolo derivato da fonti esterne le elenchi in fondo, col collegamento.
// Fino al 17/10/2026 nessuna delle due rese lo faceva, e la redazione
// automatica ha pubblicato otto settimane senza una fonte citata in pagina.
// Qui si prova tre cose: che le DUE copie della funzione (`fonti.ts` per
// Angular, `fonti.mjs` per l'edge) diano lo stesso risultato; che l'edge stampi
// il blocco dove e come deve; che il template Angular abbia il gemello.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectNoindex } from './csr-noindex.mjs';
import { fontiDiArticolo as fontiEdge } from '../../functions/lib/fonti.mjs';
import { renderArticolo } from '../../functions/lib/render-news.mjs';
import { fontiDiArticolo as fontiApp } from '../../src/app/features/news/fonti.ts';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const scheletro = injectNoindex(readFileSync(join(REPO, 'src/index.html'), 'utf8'));
const TEMPLATE = readFileSync(
  join(REPO, 'src/app/features/news/news-detail/news-detail.component.html'),
  'utf8',
);
const FOGLIO_GLOBALE = readFileSync(join(REPO, 'src/styles.scss'), 'utf8');

const BASE = {
  _id: '65f0000000000000000000bb',
  slug: 'un-pezzo-con-le-fonti',
  title: 'Un pezzo con le fonti',
  body: 'Il corpo del pezzo.',
  autore: 'Pietro Piraino',
  publishedAt: '2026-10-17T09:00:00.000Z',
  createdAt: '2026-10-17T08:00:00.000Z',
};

function dentroMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  assert.ok(m, 'la pagina composta all edge non ha un <main>');
  return m[1];
}

// ---- Le due copie dicono la stessa cosa -----------------------------------

const CASI = [
  ['vuoto', [], []],
  ['assenti', undefined, undefined],
  [
    'due testate',
    ['https://www.assopoker.com/a', 'https://somuchpoker.com/b'],
    ['Assopoker', 'Somuchpoker'],
  ],
  [
    'stessa testata due volte (il doppione noto)',
    ['https://somuchpoker.com/a', 'https://somuchpoker.com/b'],
    ['Somuchpoker', 'Somuchpoker'],
  ],
  [
    'testata assente e testata uguale all URL (il ripiego della pipeline)',
    ['https://www.cardplayer.com/x', 'https://poker.org/y'],
    ['', 'https://poker.org/y'],
  ],
  [
    'URL ripetuto e un valore che non e un indirizzo',
    ['https://a.it/1', 'https://a.it/1', 'javascript:alert(1)', 'ftp://b.it/2'],
    ['A', 'A', 'X', 'B'],
  ],
  ['liste sfasate', ['https://a.it/1', 'https://b.it/2'], ['A']],
];

for (const [nome, urls, testate] of CASI) {
  test(`deriva: le due copie concordano — ${nome}`, () => {
    assert.deepEqual(fontiEdge(urls, testate), fontiApp(urls, testate));
  });
}

test('una testata con piu articoli li numera, invece di due link uguali', () => {
  assert.deepEqual(
    fontiApp(
      ['https://somuchpoker.com/a', 'https://somuchpoker.com/b', 'https://a.it/c'],
      ['Somuchpoker', 'somuchpoker', 'Assopoker'],
    ).map((v) => v.etichetta),
    ['Somuchpoker (1)', 'somuchpoker (2)', 'Assopoker'],
  );
});

test('senza testata, o con la testata uguale all indirizzo, si mostra l host senza www', () => {
  assert.deepEqual(
    fontiApp(['https://www.cardplayer.com/x', 'https://poker.org/y'], ['', 'https://poker.org/y']).map(
      (v) => v.etichetta,
    ),
    ['cardplayer.com', 'poker.org'],
  );
});

test('solo indirizzi http(s), e una volta sola', () => {
  assert.deepEqual(
    fontiApp(['https://a.it/1', 'https://a.it/1', 'javascript:alert(1)'], ['A', 'A', 'X']),
    [{ url: 'https://a.it/1', etichetta: 'A' }],
  );
});

// ---- La resa all'edge ------------------------------------------------------

const CON_FONTI = {
  ...BASE,
  sourceUrls: ['https://www.assopoker.com/notizia', 'https://somuchpoker.com/news'],
  sourceOutlets: ['Assopoker', 'Somuchpoker'],
};

test('l edge stampa il blocco delle fonti, con un collegamento per fonte', () => {
  const main = dentroMain(renderArticolo(scheletro, CON_FONTI, CON_FONTI.slug));
  assert.match(main, /<aside class="news-fonti">/);
  assert.match(main, /<p class="news-fonti__label">Fonti<\/p>/);
  assert.match(
    main,
    /<a href="https:\/\/www\.assopoker\.com\/notizia" target="_blank" rel="nofollow noopener">Assopoker<\/a>/,
  );
  assert.match(main, />Somuchpoker<\/a>/);
});

test('⚠️ ogni link a una fonte e nofollow: si cita, non si spinge (art. 9)', () => {
  const main = dentroMain(renderArticolo(scheletro, CON_FONTI, CON_FONTI.slug));
  const blocco = main.slice(main.indexOf('news-fonti'), main.indexOf('</aside>'));
  const link = blocco.match(/<a [^>]+>/g) ?? [];
  assert.equal(link.length, 2);
  for (const a of link) assert.match(a, /rel="nofollow noopener"/);
});

test('le fonti stanno dopo il corpo e prima di «Per approfondire» e della condivisione', () => {
  const main = dentroMain(renderArticolo(scheletro, CON_FONTI, CON_FONTI.slug));
  const corpo = main.indexOf('class="prose"');
  const fonti = main.indexOf('class="news-fonti"');
  const condivisione = main.indexOf('class="news-share"');
  assert.ok(corpo >= 0 && fonti > corpo && condivisione > fonti);
  const guide = main.indexOf('class="news-guide"');
  if (guide >= 0) assert.ok(guide > fonti);
});

test('senza fonti non si stampa un blocco vuoto (i pezzi scritti a mano)', () => {
  const main = dentroMain(renderArticolo(scheletro, BASE, BASE.slug));
  assert.doesNotMatch(main, /news-fonti/);
});

test('il nome di una testata e scappato come HTML', () => {
  const main = dentroMain(
    renderArticolo(
      scheletro,
      { ...BASE, sourceUrls: ['https://a.it/x'], sourceOutlets: ['<b>Testata & co</b>'] },
      BASE.slug,
    ),
  );
  assert.match(main, /&lt;b&gt;Testata &amp; co&lt;\/b&gt;/);
});

// ---- La copertina licenziata porta il suo credito -------------------------

test('una foto LICENZIATA porta autore e licenza sotto, in una figura', () => {
  const main = dentroMain(
    renderArticolo(
      scheletro,
      {
        ...BASE,
        coverImageUrl: 'https://cdn.bestfishforever.it/news/foto.jpg',
        imageSource: 'LICENZIATA',
        imageCredit: 'Mario Rossi',
        imageLicense: 'CC BY 4.0',
      },
      BASE.slug,
    ),
  );
  assert.match(
    main,
    /<figure class="news-detail__figura">\s*<img class="news-detail__cover"[^>]*>\s*<figcaption class="news-detail__credito">Foto: Mario Rossi · CC BY 4\.0<\/figcaption>\s*<\/figure>/,
  );
});

test('ogni altra copertina resta un <img> nudo, come prima', () => {
  const main = dentroMain(
    renderArticolo(
      scheletro,
      { ...BASE, coverImageUrl: 'https://cdn.bestfishforever.it/news/foto.jpg' },
      BASE.slug,
    ),
  );
  assert.match(main, /<img class="news-detail__cover"/);
  assert.doesNotMatch(main, /<figure/);
});

// ---- Il gemello Angular ----------------------------------------------------

test('deriva: il template Angular ha lo stesso blocco, con lo stesso rel', () => {
  assert.match(TEMPLATE, /<aside class="news-fonti">/);
  assert.match(TEMPLATE, /<p class="news-fonti__label">Fonti<\/p>/);
  assert.match(TEMPLATE, /rel="nofollow noopener"/);
  assert.match(TEMPLATE, /class="news-detail__credito"/);
});

test('⚠️ gli stili delle fonti sono GLOBALI: l edge non ha l incapsulamento', () => {
  assert.match(FOGLIO_GLOBALE, /@use 'styles\/news-fonti';/);
});
