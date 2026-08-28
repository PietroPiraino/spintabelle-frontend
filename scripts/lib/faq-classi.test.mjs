// Il markup delle FAQ porta sempre le sue due classi interne.
//
// PERCHÉ ESISTE QUESTA GUARDIA. Il 28/08/2026 le FAQ di /allenamento e
// /negozio sono uscite in produzione **rotte e con un font diverso** da quelle
// di ogni altra pagina. Il blocco `.faq__item` era giusto; mancavano le due
// classi INTERNE:
//
//   corretto   <summary class="faq__sum"><h3 class="faq__q">…</h3></summary>
//                                        <p class="faq__a">…</p>
//   rotto      <summary class="faq__sum"><h3>…</h3></summary>
//                                        <p>…</p>
//
// Senza `.faq__q` la domanda eredita l'h3 globale — `clamp(1.2rem, 2.2vw,
// 1.5rem)`, fino a 24px invece di 16 — più un `margin-bottom` che la stacca dal
// chevron con cui dev'essere allineata. Senza `.faq__a` la risposta perde
// `padding: 0 1.1rem 1rem` e va a filo dei bordi della card.
//
// ⚠️ È un difetto MUTO in ogni modo che conta: l'HTML è valido, Angular
// compila, le guardie di build contano parole e `<h1>` e non se ne accorgono,
// i test Karma non guardano il CSS calcolato. Si vede solo aprendo quelle due
// pagine accanto a una delle otto giuste — che è come l'ha trovato l'owner.
//
// Le pagine che generano le FAQ con un `@for` su un array non hanno mai avuto
// il problema: il markup è scritto una volta. Il rischio vive tutto nelle
// pagine che lo scrivono a mano, ed è lì che questa guardia guarda.
//
// ⚠️ NON è una guardia di build: sta in `npm run test:scripts`, come
// `semi-nudi` e la deriva delle news. La catena di `npm run build` misura
// `dist/`; questa misura i sorgenti.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const APP = join(REPO, 'src/app');

/** Ogni `.html` e ogni `.ts` (i template inline) sotto `src/app`. */
function sorgenti(dir = APP, base = '') {
  const fuori = [];
  for (const voce of readdirSync(dir)) {
    const pieno = join(dir, voce);
    const rel = base ? `${base}/${voce}` : voce;
    if (statSync(pieno).isDirectory()) fuori.push(...sorgenti(pieno, rel));
    else if ((voce.endsWith('.html') || voce.endsWith('.ts')) && !voce.endsWith('.spec.ts'))
      fuori.push(rel);
  }
  return fuori;
}

/**
 * Le voci FAQ del file, una per `<details class="faq__item">`.
 *
 * ⚠️ Si taglia sull'APERTURA del `<details>` successivo e non su `</details>`:
 * dentro una risposta può esserci un altro elemento che chiude, e un taglio
 * sulla chiusura sbagliata spezzerebbe la voce a metà facendo sembrare mancante
 * una classe che c'è.
 */
function vociFaq(testo) {
  const parti = testo.split(/<details[^>]*class="[^"]*faq__item/);
  return parti.slice(1); // il primo pezzo è ciò che precede la prima voce
}

test('ogni voce FAQ porta `faq__q` sulla domanda e `faq__a` sulla risposta', () => {
  const colpevoli = [];

  for (const rel of sorgenti()) {
    const testo = readFileSync(join(APP, rel), 'utf8');
    if (!testo.includes('faq__item')) continue;

    vociFaq(testo).forEach((voce, i) => {
      const mancanti = [];
      if (!voce.includes('faq__q')) mancanti.push('faq__q (la domanda)');
      if (!voce.includes('faq__a')) mancanti.push('faq__a (la risposta)');
      if (mancanti.length) colpevoli.push(`${rel} — voce ${i + 1}: manca ${mancanti.join(' e ')}`);
    });
  }

  assert.deepEqual(
    colpevoli,
    [],
    'Voci FAQ senza le classi interne:\n  ' +
      colpevoli.join('\n  ') +
      "\n\nSenza `faq__q` la domanda prende l'h3 GLOBALE (fino a 24px invece di " +
      '16, più un margine che la stacca dal chevron); senza `faq__a` la risposta ' +
      'perde il padding e tocca i bordi della card. La forma giusta è:\n' +
      '  <details class="faq__item">\n' +
      '    <summary class="faq__sum"><h3 class="faq__q">…</h3></summary>\n' +
      '    <p class="faq__a">…</p>\n' +
      '  </details>\n' +
      'Il difetto non rompe nulla — HTML valido, build verde, test verdi — e si ' +
      'vede solo mettendo la pagina accanto a una fatta bene.',
  );
});

test('⚠️ la guardia trova davvero le voci: se ne conta zero, sta leggendo male', () => {
  // Senza questo verso, il giorno in cui il markup cambia forma (o `sorgenti()`
  // smette di trovare i file) questa guardia diventerebbe VERDE su tutto —
  // il modo più silenzioso in cui una guardia muore.
  const totale = sorgenti()
    .map((rel) => readFileSync(join(APP, rel), 'utf8'))
    .filter((t) => t.includes('faq__item'))
    .reduce((n, t) => n + vociFaq(t).length, 0);

  assert.ok(
    totale >= 10,
    `trovate solo ${totale} voci FAQ in tutto il progetto: il markup ha cambiato ` +
      'forma, oppure la scansione non legge più i file giusti. In entrambi i casi ' +
      'questa guardia non sta più controllando niente.',
  );
});
