import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectNoindex, stripCanonical } from './csr-noindex.mjs';
import {
  ATTR_MARCATORE,
  fogliDichiarati,
  inserisciCssInline,
  percorsoDelFoglio,
  puntoDiInserimento,
  togliCssInline,
  verificaCssInline,
} from './csr-css.mjs';

const CSS = ':root{--x:1}h1{font-size:2rem}.container{max-width:1180px}';
const LINK = `<link rel="stylesheet" href="/styles-ABC123.css" media="print" onload="this.media='all'">`;
const NOSC = `<noscript><link rel="stylesheet" href="/styles-ABC123.css"></noscript>`;

// ⚠️ La fixture riproduce la forma REALE della shell (misurata il 30/08/2026):
// boot-loader dentro <app-root>, un <style> di Beasties, il <link media=print>,
// la sua copia in <noscript>, e il meta robots iniettato dopo. E' proprio sulle
// FORME dei tag di quel file che una regex puo' mancare il bersaglio.
const shell = (testa = `  ${LINK}\n  ${NOSC}\n`) =>
  `<!doctype html><html lang="it" data-beasties-container=""><head>\n` +
  `  <title>x</title>\n` +
  `  <link rel="icon" type="image/x-icon" href="/favicon.ico">\n` +
  `  <link rel="apple-touch-icon" href="/logo-256.png">\n` +
  `  <link rel="preload" as="font" type="font/woff2" href="/fonts/a.woff2" crossorigin>\n` +
  `  <link rel="modulepreload" href="/chunk-x.js">\n` +
  `  <style>.boot-loader{position:fixed}</style>\n` +
  testa +
  `  <meta name="robots" content="noindex, follow">\n` +
  `</head><body ngcm=""><app-root><div class="boot-loader"></div></app-root></body></html>`;

const leggi = (p) => (p === 'styles-ABC123.css' ? CSS : null);
const iniettata = () => inserisciCssInline(shell(), [{ href: '/styles-ABC123.css', css: CSS }]);

// ---------------------------------------------------------------- fogliDichiarati

test('fogliDichiarati: un solo href anche se il <link> compare due volte', () => {
  // media="print" + la copia in <noscript>: Beasties li emette entrambi.
  assert.deepEqual(fogliDichiarati(shell()), ['/styles-ABC123.css']);
});

test('fogliDichiarati: due href diversi, in ordine di dichiarazione', () => {
  const due =
    `  <link rel="stylesheet" href="/styles-AAA.css">\n` +
    `  <link rel="stylesheet" href="/styles-BBB.css">\n`;
  assert.deepEqual(fogliDichiarati(shell(due)), ['/styles-AAA.css', '/styles-BBB.css']);
});

test('fogliDichiarati: NON tocca gli altri <link> (icon, apple-touch, preload, modulepreload, canonical)', () => {
  // ⚠️ Stesso verso del caso gemello in csr-noindex.test.mjs: un rel troppo
  // largo qui significherebbe inlinare una favicon come se fosse un foglio.
  const con = shell(`  ${LINK}\n  <link rel="canonical" href="https://x/">\n`);
  assert.deepEqual(fogliDichiarati(con), ['/styles-ABC123.css']);
});

test('fogliDichiarati: regge apici singoli, href prima di rel, e la barra finale', () => {
  const varianti =
    `  <link rel='stylesheet' href='/a.css'>\n` +
    `  <link href="/b.css" rel="stylesheet"/>\n`;
  assert.deepEqual(fogliDichiarati(shell(varianti)), ['/a.css', '/b.css']);
});

test('fogliDichiarati: [] se non c e nessun foglio', () => {
  assert.deepEqual(fogliDichiarati(shell('')), []);
});

// -------------------------------------------------------------- percorsoDelFoglio

test('percorsoDelFoglio: toglie la barra iniziale, e regge un href senza deployUrl', () => {
  assert.equal(percorsoDelFoglio('/styles-ABC.css'), 'styles-ABC.css');
  assert.equal(percorsoDelFoglio('styles-ABC.css'), 'styles-ABC.css');
});

test('percorsoDelFoglio: toglie query e frammento', () => {
  assert.equal(percorsoDelFoglio('/s.css?v=2#x'), 's.css');
});

test('percorsoDelFoglio: LANCIA su tutto cio che non e un file locale', () => {
  // ⚠️ Un href non locale letto «al meglio» darebbe un blocco vuoto iniettato
  // in silenzio: cioe' niente, senza dirlo.
  for (const href of ['https://cdn.x/s.css', '//cdn.x/s.css', 'data:text/css,a{}', '../fuori.css', '']) {
    assert.throws(() => percorsoDelFoglio(href), undefined, `doveva lanciare su ${href}`);
  }
});

// ------------------------------------------------------------- puntoDiInserimento

test('puntoDiInserimento: LANCIA se non c e nessun <link rel=stylesheet>', () => {
  assert.throws(() => puntoDiInserimento(shell('')), /nessun <link rel="stylesheet">/);
});

// ------------------------------------------------------------ inserisciCssInline

test('inserisciCssInline: il CSS finisce nel documento VERBATIM', () => {
  assert.ok(iniettata().includes(CSS));
});

test('⚠️ il blocco sta PRIMA del <link> e DOPO il <style> del boot-loader', () => {
  // ⚠️ E' la decisione portante: un <link> partecipa alla cascata nella sua
  // POSIZIONE nel documento, non quando carica. Messo dopo, una copia inline
  // stantia sopprimerebbe il foglio vero in silenzio, per sempre.
  const out = iniettata();
  const marcatore = out.indexOf(ATTR_MARCATORE);
  const link = out.indexOf('rel="stylesheet"');
  const boot = out.indexOf('.boot-loader{position:fixed}');
  assert.ok(marcatore > 0 && link > 0 && boot > 0);
  assert.ok(marcatore < link, 'il blocco deve stare PRIMA del <link>');
  assert.ok(marcatore > boot, 'il blocco deve stare DOPO il <style> del boot-loader');
});

test('inserisciCssInline: idempotente — due passate, stesso output e un solo marcatore', () => {
  const uno = iniettata();
  const due = inserisciCssInline(uno, [{ href: '/styles-ABC123.css', css: CSS }]);
  assert.equal(due, uno);
  assert.equal((due.match(new RegExp(ATTR_MARCATORE, 'g')) || []).length, 1);
});

test('⚠️ idempotente ANCHE sulla forma REALE dell artefatto, senza spazi attorno al <link>', () => {
  // ⚠️ QUESTO CASO E' LA RAGIONE PER CUI IL PRIMO GIRO E' FALLITO IN dist/.
  // La fixture qui sopra ha `\n  ` prima del <link>; l'artefatto vero, che esce
  // da Beasties, ha `</style><link rel="stylesheet"…>` ATTACCATI. Con
  // inserimento e rimozione non simmetrici i due spazi migravano a ogni
  // passata: i test passavano, `dist/` cambiava a ogni build, e il difetto
  // sarebbe uscito come un commit fantasma a ogni deploy.
  const nuda =
    `<!doctype html><html lang="it"><head><title>x</title>` +
    `<style>.boot-loader{position:fixed}</style>${LINK}${NOSC}` +
    `<meta name="robots" content="noindex, follow"></head>` +
    `<body><app-root></app-root></body></html>`;
  const fogli = [{ href: '/styles-ABC123.css', css: CSS }];
  const uno = inserisciCssInline(nuda, fogli);
  const due = inserisciCssInline(uno, fogli);
  const tre = inserisciCssInline(due, fogli);
  assert.equal(due, uno, 'seconda passata diversa dalla prima');
  assert.equal(tre, uno, 'terza passata diversa dalla prima');
  assert.equal((tre.match(new RegExp(ATTR_MARCATORE, 'g')) || []).length, 1);
  assert.ok(tre.indexOf(ATTR_MARCATORE) < tre.indexOf('rel="stylesheet"'));
});

test('inserisciCssInline: RIMPIAZZA un blocco vecchio invece di affiancarlo', () => {
  // ⚠️ Il blocco si riconosce per MARCATORE, non per href: cosi' una dist non
  // pulita viene corretta invece che lasciata col CSS della build precedente.
  const vecchia = inserisciCssInline(shell(), [{ href: '/styles-VECCHIO.css', css: 'a{b:1}' }]);
  const nuova = inserisciCssInline(vecchia, [{ href: '/styles-ABC123.css', css: CSS }]);
  assert.equal((nuova.match(new RegExp(ATTR_MARCATORE, 'g')) || []).length, 1);
  assert.ok(nuova.includes(CSS));
  assert.ok(!nuova.includes('a{b:1}'));
});

test('⚠️ LANCIA se il CSS contiene "</style" (qualunque cassa, anche senza >)', () => {
  // Chiuderebbe il blocco: il resto del foglio finirebbe come TESTO in pagina,
  // e da li' in poi il parser leggerebbe CSS come HTML. Catastrofico a video e
  // invisibile a uno script che ha appena scritto «con successo».
  for (const cattivo of ['a{}</style>', 'a{}</STYLE\t', "a{content:'</style '}"]) {
    assert.throws(
      () => inserisciCssInline(shell(), [{ href: '/s.css', css: cattivo }]),
      /<\/style/,
    );
  }
});

test('⚠️ un blocco PER FOGLIO neutralizza la giunzione: "</styl" + "e>" non chiude nulla', () => {
  // ⚠️ E' il verso OPPOSTO del test qui sopra, ed e' il motivo per cui i
  // blocchi non si concatenano. Concatenati, `a{}</styl` + `e>b{}` avrebbero
  // formato un `</style` a cavallo della giunzione — un difetto che nessuno dei
  // due fogli contiene e che nessun controllo per-foglio potrebbe vedere.
  // Avvolti separatamente, ciascuno e' gia' chiuso e la sequenza non si forma.
  const due = `  <link rel="stylesheet" href="/a.css">\n  <link rel="stylesheet" href="/b.css">\n`;
  const out = inserisciCssInline(shell(due), [
    { href: '/a.css', css: 'a{}</styl' },
    { href: '/b.css', css: 'e>b{}' },
  ]);
  assert.ok(out.includes('a{}</styl</style>'), 'il primo blocco si chiude da solo');
  assert.equal((out.match(/<\/style>/gi) || []).length, 3, 'boot-loader + due blocchi');
});

test('⚠️ LANCIA se una url() e relativa (ma non sulle data: ne sulle assolute)', () => {
  // In un foglio esterno url() si risolve contro l URL DEL FOGLIO, inline
  // contro la BASE DEL DOCUMENTO: una relativa romperebbe solo la copia inline.
  assert.throws(
    () => inserisciCssInline(shell(), [{ href: '/s.css', css: '@font-face{src:url(fonts/a.woff2)}' }]),
    /url\(\) relativa/,
  );
  // ⚠️ `url(%23n)` dentro una SVG percent-encodata sembra relativa e NON lo e'.
  const buono =
    '@font-face{src:url(/fonts/a.woff2)}' +
    ".x{background:url('data:image/svg+xml,%3Csvg%3E%3C/svg%3E')}" +
    '.y{fill:url(%23grad)}.z{mask:url(#m)}.w{src:url(https://cdn/x.woff2)}';
  assert.ok(inserisciCssInline(shell(), [{ href: '/s.css', css: buono }]).includes(buono));
});

test('inserisciCssInline: LANCIA se non c e nessun <link rel=stylesheet>', () => {
  assert.throws(
    () => inserisciCssInline(shell(''), [{ href: '/s.css', css: CSS }]),
    /nessun <link rel="stylesheet">/,
  );
});

test('inserisciCssInline: un blocco PER FOGLIO quando gli href sono due', () => {
  // ⚠️ Non concatenati: un @import in testa al secondo, concatenato, finirebbe
  // a meta' blocco e verrebbe scartato in silenzio.
  const due = `  <link rel="stylesheet" href="/a.css">\n  <link rel="stylesheet" href="/b.css">\n`;
  const out = inserisciCssInline(shell(due), [
    { href: '/a.css', css: 'a{x:1}' },
    { href: '/b.css', css: 'b{y:2}' },
  ]);
  assert.equal((out.match(new RegExp(ATTR_MARCATORE, 'g')) || []).length, 2);
  assert.ok(out.indexOf('a{x:1}') < out.indexOf('b{y:2}'), 'ordine di dichiarazione');
});

test('inserisciCssInline: lascia intatti gli altri <link>, il meta robots e <app-root>', () => {
  const out = iniettata();
  for (const atteso of [
    'rel="icon"',
    'rel="apple-touch-icon"',
    'rel="preload"',
    'rel="modulepreload"',
    '<meta name="robots" content="noindex, follow">',
    '<app-root><div class="boot-loader"></div></app-root>',
    '.boot-loader{position:fixed}',
  ]) {
    assert.ok(out.includes(atteso), `ha perso ${atteso}`);
  }
});

test('convive con injectNoindex/stripCanonical NEI DUE ORDINI', () => {
  const nuda = shell(`  ${LINK}\n  <link rel="canonical" href="https://bestfishforever.it/">\n`)
    .replace('  <meta name="robots" content="noindex, follow">\n', '');
  const fogli = [{ href: '/styles-ABC123.css', css: CSS }];
  const a = inserisciCssInline(stripCanonical(injectNoindex(nuda)), fogli);
  const b = injectNoindex(stripCanonical(inserisciCssInline(nuda, fogli)));
  for (const out of [a, b]) {
    assert.ok(out.includes(CSS));
    assert.ok(/<meta name="robots"[^>]*noindex/i.test(out));
    assert.ok(!/rel=["']canonical["']/i.test(out));
    assert.ok(out.indexOf(ATTR_MARCATORE) < out.indexOf('rel="stylesheet"'));
  }
});

// ------------------------------------------------------------------ togliCssInline

test('togliCssInline: toglie solo i blocchi marcati, non gli altri <style>', () => {
  const out = togliCssInline(iniettata());
  assert.ok(!out.includes(ATTR_MARCATORE));
  assert.ok(!out.includes(CSS));
  assert.ok(out.includes('.boot-loader{position:fixed}'));
});

// -------------------------------------------------------------- verificaCssInline

test('verificaCssInline: [] su una shell appena iniettata', () => {
  assert.deepEqual(verificaCssInline(iniettata(), leggi), []);
});

test('verificaCssInline: segnala se il blocco manca del tutto', () => {
  const guai = verificaCssInline(shell(), leggi);
  assert.equal(guai.length, 1);
  assert.match(guai[0], /non e' inline/);
});

test('⚠️ verificaCssInline: segnala una copia STANTIA (blocco presente, CSS diverso)', () => {
  // Il verso che intercetta un blocco che c'e' e non serve piu'.
  const stantia = inserisciCssInline(shell(), [{ href: '/styles-ABC123.css', css: 'vecchio{a:1}' }]);
  assert.match(verificaCssInline(stantia, leggi)[0], /stantia|non e' inline/);
});

test('verificaCssInline: segnala un SECONDO foglio dichiarato e non inline', () => {
  const due = `  <link rel="stylesheet" href="/styles-ABC123.css">\n  <link rel="stylesheet" href="/b.css">\n`;
  const out = inserisciCssInline(shell(due), [{ href: '/styles-ABC123.css', css: CSS }]);
  const guai = verificaCssInline(out, (p) => (p === 'styles-ABC123.css' ? CSS : p === 'b.css' ? 'b{y:2}' : null));
  assert.equal(guai.length, 1);
  assert.match(guai[0], /b\.css/);
});

test('verificaCssInline: segnala un foglio dichiarato e assente su disco', () => {
  assert.match(verificaCssInline(iniettata(), () => null)[0], /non lo trovo su disco/);
});

test('⚠️ verificaCssInline: anti-guardia-vuota — senza <link> NON risponde «tutto a posto»', () => {
  // Zero fogli dichiarati significa che la forma dell artefatto e' cambiata,
  // non che va tutto bene. Una guardia che passa verde sul nulla e' peggio che
  // non averla.
  const guai = verificaCssInline(shell(''), leggi);
  assert.equal(guai.length, 1);
  assert.match(guai[0], /nessun <link rel="stylesheet">/);
});
