// Il markdown dell'edge deve rendere come quello dell'app — `npm run
// test:scripts` (Node 24, zero dipendenze).
//
// PERCHE' ESISTE. `functions/lib/markdown.mjs` e' una COPIA delle otto righe di
// configurazione di `src/app/shared/ui/markdown/marked-loader.ts` (il perche'
// della copia sta in testa a quel file: due build diverse, e importare il
// loader Angular dentro un Worker vorrebbe dire trascinarci `@angular/core`).
// Una copia non sorvegliata diverge: qualcuno cambia `breaks` nel loader, gli
// articoli prerenderizzati e quelli resi all'edge si impaginano diversamente, e
// non se ne accorge nessuno perche' nessuna guardia guarda dentro la risposta
// dell'edge (check-prerender-content.mjs misura `dist/`, e quella risposta in
// `dist/` non c'e').
//
// Due controlli, che coprono buchi diversi:
//   (1) FIXTURE — la copia rende una fixture ricca ESATTAMENTE come l'ha resa
//       il loader. E' un confronto sull'OUTPUT: se cambia il comportamento di
//       marked (aggiornamento di versione) lo dice qui, non in produzione.
//   (2) DERIVA DEL SORGENTE — rilegge i valori dal sorgente del loader e li
//       confronta con quelli esportati dalla copia. E' un confronto sui
//       PARAMETRI: se qualcuno cambia il loader ma non la copia, il test
//       fallisce nominando il file da aggiornare, anche se la fixture per caso
//       non se ne accorgesse.
//
// ⚠️ UNA DIVERGENZA E' VOLUTA e ha il suo test a parte: la copia dell'edge
// SCARTA l'HTML grezzo, perche' fuori da Angular non c'e' il sanitizer di
// `[innerHTML]`. La fixture qui sotto non contiene HTML grezzo, proprio perche'
// l'identita' valga su tutto il resto.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renderMarkdown,
  MARKED_OPTIONS,
  HEADING_OFFSET,
  MAX_DEPTH,
} from '../../functions/lib/markdown.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const LOADER = join(REPO, 'src/app/shared/ui/markdown/marked-loader.ts');

// ---- (1) La fixture -----------------------------------------------------
//
// COME SI RIGENERA, se un giorno marked cambia output di proposito: rendere
// FIXTURE_MD con la configurazione del loader (gfm+breaks, offset dei titoli
// con cap) e incollare il risultato qui sotto. Non "aggiustare" FIXTURE_HTML a
// mano guardando il diff: il punto del test e' che il valore atteso venga dal
// loader, non dalla copia che sta verificando.

const FIXTURE_MD = [
  '# Titolo dell articolo',
  '',
  'Primo paragrafo con **grassetto**, _corsivo_ e un [link](https://bestfishforever.it/news/).',
  'Seconda riga dello stesso paragrafo: con breaks attivo resta a capo.',
  '',
  '## Sottotitolo',
  '',
  '- primo punto',
  '- secondo punto',
  '',
  '##### Titolo gia profondo',
  '',
  '###### Oltre il tetto',
  '',
  '> Citazione su una riga.',
  '',
  '| Colonna | Valore |',
  '| --- | --- |',
  '| uno | 1 |',
  '',
  '~~barrato~~ e infine codice:',
  '',
  '```',
  'codice fedele',
  '```',
  '',
].join('\n');

const FIXTURE_HTML =
  '<h2>Titolo dell articolo</h2>\n' +
  '<p>Primo paragrafo con <strong>grassetto</strong>, <em>corsivo</em> e un ' +
  '<a href="https://bestfishforever.it/news/">link</a>.<br>Seconda riga dello stesso ' +
  'paragrafo: con breaks attivo resta a capo.</p>\n' +
  '<h3>Sottotitolo</h3>\n' +
  '<ul>\n<li>primo punto</li>\n<li>secondo punto</li>\n</ul>\n' +
  '<h5>Titolo gia profondo</h5>\n' +
  '<h5>Oltre il tetto</h5>\n' +
  '<blockquote>\n<p>Citazione su una riga.</p>\n</blockquote>\n' +
  '<table>\n<thead>\n<tr>\n<th>Colonna</th>\n<th>Valore</th>\n</tr>\n</thead>\n' +
  '<tbody><tr>\n<td>uno</td>\n<td>1</td>\n</tr>\n</tbody></table>\n' +
  '<p><del>barrato</del> e infine codice:</p>\n' +
  '<pre><code>codice fedele\n</code></pre>\n';

test('la copia dell edge rende la fixture ESATTAMENTE come il loader Angular', () => {
  assert.equal(renderMarkdown(FIXTURE_MD), FIXTURE_HTML);
});

test('gfm e breaks sono attivi: tabella, barrato e a-capo singolo', () => {
  // Le tre cose che si perderebbero silenziosamente spegnendo un'opzione: una
  // tabella tornerebbe un paragrafo, il barrato del testo letterale, e i
  // paragrafi delle news esistenti si incollerebbero su una riga sola.
  const out = renderMarkdown('uno\ndue\n\n~~via~~\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n');
  assert.match(out, /uno<br>due/);
  assert.match(out, /<del>via<\/del>/);
  assert.match(out, /<table>/);
});

test('offset dei titoli: `#` diventa <h2> e il cap si ferma a <h5>', () => {
  // La pagina dell'articolo ha gia' un <h1> (il titolo): un `#` nel corpo che
  // restasse <h1> darebbe due <h1> nella stessa pagina — esattamente cio' che
  // check-prerender-content.mjs conta come deriva sulle prerenderizzate.
  assert.match(renderMarkdown('# uno\n'), /<h2>uno<\/h2>/);
  assert.match(renderMarkdown('#### quattro\n'), /<h5>quattro<\/h5>/);
  assert.match(renderMarkdown('###### sei\n'), /<h5>sei<\/h5>/);
  assert.doesNotMatch(renderMarkdown('# uno\n'), /<h1>/);
});

// ---- La divergenza VOLUTA ----------------------------------------------

test('l HTML grezzo viene SCARTATO: e\' la differenza voluta rispetto al loader', () => {
  // Nell'app il risultato passa da `[innerHTML]`, che Angular sanifica. Qui no:
  // l'unica difesa e' non emettere affatto l'HTML dell'articolo.
  const out = renderMarkdown('testo <b>grassetto</b> e <img src=x onerror=alert(1)>\n\n<div>blocco</div>\n');
  assert.doesNotMatch(out, /<b>/);
  assert.doesNotMatch(out, /<img/);
  assert.doesNotMatch(out, /<div>/);
  assert.doesNotMatch(out, /onerror/);
  assert.match(out, /grassetto/); // il TESTO resta, sono i tag a sparire
});

test('uno <script> nel corpo non arriva mai nell HTML servito', () => {
  const out = renderMarkdown('prima\n\n<script>alert(1)</script>\n\ndopo\n');
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /<\/script>/i);
});

test('renderMarkdown regge corpo vuoto/assente senza lanciare', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
  assert.equal(renderMarkdown(undefined), '');
});

// ---- (2) Deriva del sorgente -------------------------------------------
//
// Rilegge i numeri dal TESTO del loader. Non e' importabile da qui (e' un .ts
// con dentro `InjectionToken` di Angular), quindi si legge il sorgente e si
// estraggono i valori. ⚠️ Se una di queste estrazioni non trova piu' niente il
// test FALLISCE invece di saltare: un controllo di deriva che si autodisattiva
// quando cambia la forma del file e' peggio di nessun controllo — e' la stessa
// filosofia di `nonCapisco` in check-routes.mjs.

function valoreNumerico(sorgente, nome) {
  const m = sorgente.match(new RegExp(`const ${nome}\\s*=\\s*(\\d+)`));
  assert.ok(
    m,
    `marked-loader.ts: non trovo piu' \`const ${nome} = <numero>\`. Se e' stato ` +
      'rinominato, aggiorna QUESTO test e functions/lib/markdown.mjs insieme.',
  );
  return Number(m[1]);
}

test('deriva: HEADING_OFFSET e MAX_DEPTH combaciano con il loader Angular', () => {
  const sorgente = readFileSync(LOADER, 'utf8');
  assert.equal(
    valoreNumerico(sorgente, 'HEADING_OFFSET'),
    HEADING_OFFSET,
    'HEADING_OFFSET diverso fra marked-loader.ts e functions/lib/markdown.mjs',
  );
  assert.equal(
    valoreNumerico(sorgente, 'MAX_DEPTH'),
    MAX_DEPTH,
    'MAX_DEPTH diverso fra marked-loader.ts e functions/lib/markdown.mjs',
  );
});

test('deriva: le opzioni di `new Marked({...})` combaciano con il loader Angular', () => {
  const sorgente = readFileSync(LOADER, 'utf8');
  const m = sorgente.match(/new Marked\(\{([^}]*)\}\)/);
  assert.ok(
    m,
    "marked-loader.ts: non trovo piu' `new Marked({...})`. Se la forma e' cambiata, " +
      'aggiorna QUESTO test e functions/lib/markdown.mjs insieme.',
  );
  const opzioni = {};
  for (const [, chiave, valore] of m[1].matchAll(/(\w+)\s*:\s*(true|false)/g))
    opzioni[chiave] = valore === 'true';
  assert.deepEqual(
    opzioni,
    MARKED_OPTIONS,
    'le opzioni di marked divergono fra marked-loader.ts e functions/lib/markdown.mjs',
  );
});
