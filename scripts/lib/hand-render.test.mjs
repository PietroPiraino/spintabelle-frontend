/**
 * Prove del renderer di bordo delle MANI (`functions/lib/render-hand.mjs`).
 *
 * ⚠️ **Sono l'unica rete su `functions/`.** Quella cartella sta **fuori da
 * `dist/`**: `check-routes.mjs` confronta le liste, `check-prerender-content.mjs`
 * apre gli artefatti del build — e l'HTML che questo file produce non è un
 * artefatto, è una risposta. Un push che spedisce la metà Angular e dimentica
 * quella di bordo compila verde, si deploya verde e serve la pagina vecchia: è
 * successo davvero il 19/08/2026 sulle news (19 file committati, 2 lasciati
 * fuori, un'ora di articoli senza firma).
 *
 * ⚠️ **L'asserzione che conta di più è il `noindex`, e va provata NEI DUE
 * VERSI.** È la misura da cui dipende la difendibilità del trattamento dei
 * nickname di terzi (decisione D2): senza, un nome diventa *cercabile* invece
 * che raggiungibile da chi ha il collegamento. E il modo in cui può cadere è
 * muto — basta che qualcuno «uniformi» questo renderer a quello delle news, che
 * il `noindex` lo **toglie**.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  corpoMano,
  descrizioneMano,
  immagineMano,
  percorsoCanonico,
  redirezione,
  renderMano,
  titoloMano,
} from '../../functions/lib/render-hand.mjs';

/** Uno scheletro minimo con la forma di `index.csr.html` dopo l'iniezione. */
const SCHELETRO = `<!doctype html><html lang="it"><head>
<meta charset="utf-8">
<title>Best Fish Forever</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://bestfishforever.it/">
</head><body><app-root><div class="boot">caricamento…</div></app-root></body></html>`;

const MANO = {
  publicId: 'ACDEFGHJKM',
  gameTypeLabel: 'Twister',
  roomLabel: 'Altra sala',
  tableSize: 3,
  ogImageUrl: '',
  board: ['7h', '2c', 'Ts'],
  players: [
    { seat: 1, nome: 'BabyLoca', posizione: 'BTN', isHero: true, carte: ['6c', 'Tc'] },
    { seat: 2, nome: 'lauripietro79', posizione: 'SB', isHero: false },
    { seat: 3, nome: 'VIJusticeII', posizione: 'BB', isHero: false },
  ],
  streets: [
    { strada: 'PREFLOP', board: [], azioni: [{ seat: 1 }, { seat: 2 }, { seat: 3 }] },
    { strada: 'FLOP', board: ['7h', '2c', 'Ts'], azioni: [{ seat: 1 }] },
  ],
  risultati: [{ seat: 3, vinto: 100 }],
};

// ───────────────────────────────────────────────────────────────────────────

test('⚠️ il noindex dello scheletro RESTA (è l’inverso delle news)', () => {
  const html = renderMano(SCHELETRO, MANO);
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
});

test('⚠️ il noindex viene IMPOSTO anche se lo scheletro non ce l’ha', () => {
  // Se un domani `inject-csr-noindex.mjs` smettesse di girare, o cambiasse la
  // forma del meta, la pagina di una mano deve restare fuori dall'indice lo
  // stesso: la misura non può dipendere da un altro script.
  const senza = SCHELETRO.replace(/<meta name="robots"[^>]*>\n?/, '');
  assert.doesNotMatch(senza, /robots/);
  assert.match(renderMano(senza, MANO), /name="robots" content="noindex, follow"/);
});

test('titolo e descrizione mettono in evidenza il FORMATO', () => {
  assert.equal(titoloMano(MANO), 'Mano di Twister');
  assert.match(descrizioneMano(MANO), /Twister/);
  assert.match(descrizioneMano(MANO), /3 giocatori/);
});

test('⚠️ NESSUN nickname e NESSUNA sala nell’anteprima social', () => {
  // `og:description` finisce nelle chat di gruppo e nelle cache delle
  // piattaforme: è la superficie meno controllabile della funzione. E il nome
  // della sala non deve comparire in un'anteprima (art. 9 DL 87/2018).
  const d = descrizioneMano(MANO);
  for (const nick of ['BabyLoca', 'lauripietro79', 'VIJusticeII']) {
    assert.ok(!d.includes(nick), `il nickname ${nick} è finito nella descrizione`);
  }
  assert.ok(!d.includes('Altra sala'), 'la sala è finita nella descrizione');

  const html = renderMano(SCHELETRO, MANO);
  const testa = html.slice(0, html.indexOf('</head>'));
  for (const nick of ['BabyLoca', 'lauripietro79', 'VIJusticeII']) {
    assert.ok(!testa.includes(nick), `il nickname ${nick} è finito nella <head>`);
  }
});

test('⚠️ i nickname CI SONO invece nel corpo: è la riga di A16', () => {
  // «Nel corpo sì, in titolo e indirizzo mai» — ed è anche l'unica ragione per
  // cui la pagina è noindex.
  const corpo = corpoMano(MANO);
  assert.match(corpo, /BabyLoca/);
  assert.match(corpo, /lauripietro79/);
});

test('il corpo ha un solo h1 e contenuto vero', () => {
  const html = renderMano(SCHELETRO, MANO);
  assert.equal((html.match(/<h1[^>]*>/g) ?? []).length, 1);
  assert.match(html, /Mano di Twister/);
  assert.match(html, /7h 2c Ts/);
});

test('⚠️ il canonical ha la barra finale, come l’indirizzo servito', () => {
  const html = renderMano(SCHELETRO, MANO);
  assert.match(html, /rel="canonical" href="https:\/\/bestfishforever\.it\/replayer\/ACDEFGHJKM\/"/);
  assert.equal(percorsoCanonico('ACDEFGHJKM'), '/replayer/ACDEFGHJKM/');
});

test('⚠️ la forma senza barra finale reindirizza; quella giusta no', () => {
  assert.equal(redirezione('/replayer/ACDEFGHJKM', 'ACDEFGHJKM'), '/replayer/ACDEFGHJKM/');
  assert.equal(redirezione('/replayer/ACDEFGHJKM/', 'ACDEFGHJKM'), null);
});

test('⚠️ il bersaglio del salto è un PERCORSO, non una URL assoluta', () => {
  // Un `Location` verso la produzione butterebbe fuori dall'anteprima di ramo
  // chiunque stia verificando lì — e la prova su preview è obbligatoria.
  const t = redirezione('/replayer/ACDEFGHJKM', 'ACDEFGHJKM');
  assert.ok(t.startsWith('/'), 'il bersaglio non è un percorso');
  assert.ok(!t.includes('://'), 'il bersaglio è assoluto');
});

test('⚠️ l’immagine usa `||`, quindi la stringa VUOTA non vince', () => {
  // Lo schema ha `trim: true`: i campi possono arrivare stringa vuota, e con
  // `??` la stringa vuota vincerebbe sul ripiego.
  assert.equal(immagineMano({ ogImageUrl: '' }), 'https://bestfishforever.it/og.png');
  assert.equal(immagineMano({ ogImageUrl: 'https://cdn/x.png' }), 'https://cdn/x.png');
});

test('⚠️ un nickname con `$&` non riscrive la pagina', () => {
  // In `String.replace` una stringa di rimpiazzo interpreta `$&`, `$1`, `` $` ``
  // — e qui i rimpiazzi contengono nomi scritti da estranei.
  const ostile = {
    ...MANO,
    players: [{ seat: 1, nome: '$&$`$1', posizione: 'BTN', isHero: true }],
  };
  const html = renderMano(SCHELETRO, ostile);
  assert.match(html, /\$&\$`\$1|\$&amp;/);
  assert.equal((html.match(/<app-root/g) ?? []).length, 1);
});

test('⚠️ un nickname con HTML dentro viene ESCAPATO', () => {
  const ostile = {
    ...MANO,
    players: [{ seat: 1, nome: '<script>alert(1)</script>', posizione: 'BTN', isHero: true }],
  };
  const html = renderMano(SCHELETRO, ostile);
  assert.ok(!html.includes('<script>alert(1)</script>'), 'HTML non escapato nel corpo');
  assert.match(html, /&lt;script&gt;/);
});

test('⚠️ lancia se lo scheletro non ha <app-root>', () => {
  // Senza, la pagina uscirebbe con la testa giusta e il corpo vuoto: 200,
  // canonical perfetto, zero contenuto — la trappola già pagata su `/tabelle`.
  assert.throws(() => renderMano('<html><head></head><body></body></html>', MANO), /app-root/);
});

test('una mano senza carte note e senza esito non fa lanciare', () => {
  const scarna = {
    publicId: 'AAAAAAAAAA',
    gameTypeLabel: 'Cash game',
    players: [{ seat: 1, nome: 'X', posizione: 'BTN', isHero: false }],
    streets: [],
    board: [],
    risultati: [],
  };
  assert.doesNotThrow(() => renderMano(SCHELETRO, scarna));
});

test('⚠️ la targa arriva davvero nell’HTML, non solo dentro l’aiutante', () => {
  // ⚠️ `immagineMano` era già provata da sola, e passava: il difetto stava un
  // gradino più in là — il backend non esponeva `ogImageUrl` nella vista, così
  // la catena ripiegava su `og.png` per sempre. Un aiutante corretto non prova
  // che qualcuno lo chiami con il dato giusto.
  const conTarga = renderMano(SCHELETRO, {
    ...MANO,
    ogImageUrl: 'https://cdn.bestfishforever.it/replayer/abc/cover-x.png',
  });
  assert.match(
    conTarga,
    /property="og:image" content="https:\/\/cdn\.bestfishforever\.it\/replayer\/abc\/cover-x\.png"/,
  );

  const senza = renderMano(SCHELETRO, { ...MANO, ogImageUrl: '' });
  assert.match(senza, /property="og:image" content="https:\/\/bestfishforever\.it\/og\.png"/);
});
