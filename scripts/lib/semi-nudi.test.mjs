// I semi delle carte non tornano a essere testo.
//
// PERCHÉ ESISTE QUESTA GUARDIA. Fino al 23/08/2026 i semi del sito erano
// caratteri Unicode nudi (`♠ ♥ ♦ ♣`) sparsi in una ventina di template. Su iOS
// `♥` (U+2665) e `♦` (U+2666) prendono la **presentazione emoji** di default: un
// emoji si porta dentro i propri colori, quindi `color: var(--text-faint)` e
// `var(--copper-600)` venivano **ignorati**. Nessuno lo aveva visto per mesi
// perché su desktop quegli stessi caratteri escono come testo e il colore si
// applica: il difetto era invisibile esattamente sulla piattaforma da cui non si
// sviluppa. Il risultato è che tre intenzioni di design diverse — divisore
// tenue, ornamento tenue, divisore a tema — collassavano sullo stesso glifo
// squillante, e i semi del sito non erano uniformi perché **non erano nostri**.
//
// Ora la forma è nostra e vive in due posti soli, entrambi verificati qui:
// il ramo `spade` di `app-icon` (per i template) e `--mask-picche` in
// `_tokens.scss` (per il CSS). Un seme rimesso come carattere in un template
// riaprirebbe il difetto **senza rompere niente a vista**, ed è per questo che
// serve un elenco chiuso invece della buona volontà.
//
// ⚠️ NON è una guardia di build: sta in `npm run test:scripts`, come le altre di
// `scripts/lib/`. La catena di `npm run build` misura `dist/`; questo misura i
// sorgenti.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const APP = join(REPO, 'src/app');
const ICONE = join(REPO, 'src/app/shared/ui/icon/icon.component.ts');
const TOKEN = join(REPO, 'src/styles/_tokens.scss');

const SEMI = /[♠♥♦♣]/;

/**
 * Gli unici template che possono contenere un seme come CARATTERE, con la
 * ragione accanto. In entrambi il seme è **contenuto**, non ornamento: una
 * carta da gioco e il nome di una mano. Un'icona lì dentro sarebbe sbagliata —
 * si legge in mezzo a una frase, e va scritta come si scrive il testo.
 *
 * ⚠️ Aggiungere una voce qui è una decisione, non una formalità: se il seme è
 * un ORNAMENTO (un divisore, un segnaposto, il fregio di uno stato vuoto) la
 * risposta giusta non è l'elenco, è `<app-icon>` o `var(--mask-picche)`.
 */
const AMMESSI = new Map([
  ['features/landing/landing.component.html', 'la mano 7♣ 4♣ del marchio, dentro una frase'],
  ['features/tables/tables.component.html', 'le tre carte del visualizzatore (A♣ 7♣ 4♣): contenuto'],
]);

/** Tutti gli `.html` sotto `src/app`, percorso relativo con le barre in avanti. */
function templates(dir = APP, base = '') {
  const fuori = [];
  for (const voce of readdirSync(dir)) {
    const pieno = join(dir, voce);
    const rel = base ? `${base}/${voce}` : voce;
    if (statSync(pieno).isDirectory()) fuori.push(...templates(pieno, rel));
    else if (voce.endsWith('.html')) fuori.push(rel);
  }
  return fuori;
}

/**
 * ⚠️ I commenti si tolgono PRIMA di cercare. Le note che spiegano questa regola
 * citano i semi per esteso (il footer lo fa), e una guardia che fallisce sulla
 * spiegazione di se stessa è una guardia che qualcuno cancella.
 */
const senzaCommenti = (html) => html.replace(/<!--[\s\S]*?-->/g, '');

test('nessun seme come CARATTERE nei template, fuori dai due casi ammessi', () => {
  const colpevoli = [];
  for (const rel of templates()) {
    const testo = senzaCommenti(readFileSync(join(APP, rel), 'utf8'));
    if (!SEMI.test(testo)) continue;
    if (AMMESSI.has(rel)) continue;
    const riga = testo.split('\n').findIndex((r) => SEMI.test(r)) + 1;
    colpevoli.push(`${rel}:${riga}`);
  }
  assert.deepEqual(
    colpevoli,
    [],
    'Semi scritti come testo in un template:\n  ' +
      colpevoli.join('\n  ') +
      '\nSu iOS ♥ e ♦ prendono la presentazione EMOJI: si portano dentro i propri ' +
      'colori, quindi il `color` della regola CSS non arriva a schermo e ' +
      "l'ornamento non è più quello progettato. Usa `<app-icon name=\"spade\">` " +
      'nel markup, oppure `mask: var(--mask-picche)` nel foglio di stile. Se il ' +
      "seme è davvero CONTENUTO (una carta, il nome di una mano), aggiungi il file " +
      "ad `AMMESSI` qui sopra con la ragione — ed è una decisione, non una formalità.",
  );
});

test('⚠️ i due file ammessi contengono ancora un seme: l’elenco non invecchia in silenzio', () => {
  // Senza questo verso, il giorno in cui quelle due frasi cambiano l'elenco
  // resta lì a dare il permesso a un file che non ne ha più bisogno — e il
  // prossimo che ci scrive un ornamento passa senza che nessuno lo veda.
  for (const [rel, ragione] of AMMESSI) {
    const testo = senzaCommenti(readFileSync(join(APP, rel), 'utf8'));
    assert.ok(
      SEMI.test(testo),
      `${rel} non contiene più alcun seme (${ragione}): togli la voce da AMMESSI.`,
    );
  }
});

test('deriva: la maschera CSS e l’icona `spade` sono la STESSA sagoma', () => {
  // Le due vivono in due linguaggi che non possono importarsi (SCSS e
  // TypeScript), quindi il tracciato è scritto due volte. Due picche diverse
  // nella stessa pagina — una nel divisore del footer, una in uno stato vuoto —
  // sono esattamente il difetto che questo lotto ha chiuso.
  const ts = readFileSync(ICONE, 'utf8');
  const scss = readFileSync(TOKEN, 'utf8');

  const ramo = ts.slice(ts.indexOf("@case ('spade')"));
  const daIcona = /d="([^"]+)"/.exec(ramo)?.[1];
  assert.ok(daIcona, "il ramo `spade` di app-icon non ha più un `d`: la guardia sta leggendo il file sbagliato.");

  const daMaschera = /--mask-picche:[\s\S]*?path d='([^']+)'/.exec(scss)?.[1];
  assert.ok(daMaschera, '`--mask-picche` non è più in _tokens.scss, o non contiene più un tracciato.');

  assert.equal(
    daMaschera,
    daIcona,
    'La picche del CSS (`--mask-picche`) e quella di `app-icon` sono due sagome diverse: ' +
      'la stessa pagina mostrerebbe due disegni per lo stesso seme.',
  );
});
