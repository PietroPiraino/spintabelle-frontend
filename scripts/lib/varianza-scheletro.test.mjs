// Lo scheletro dei risultati di /simulatore-varianza non deve divergere dal
// blocco pieno che riserva.
//
// PERCHE' ESISTE QUESTA GUARDIA. Il report Cloudflare del 29-30/08/2026 dava
// `/simulatore-varianza` come la pagina peggiore del sito per CLS: 13 visite su
// 25 in fascia «insufficiente», cioe' una su due. La causa non e' il
// caricamento — quella pagina e' prerenderizzata e ha gia' 44 kB di critical
// CSS, e infatti l'LCP e' 25 su 25 verde — ma la FINE della simulazione: il
// worker risponde secondi dopo il clic, fuori dai 500ms in cui uno spostamento
// e' scusato, e in un solo frame compaiono ~1.400px mai riservati.
//
// Lo scheletro li riserva. Ma funziona solo finche' riproduce il blocco pieno:
// le stesse classi, le stesse stringhe, lo stesso numero di card. Un rinomino
// di un'etichetta, una settima card, un `<details>` tolto — e lo scheletro
// riserva un'altezza diversa da quella che arrivera'.
//
// ⚠️ E' un difetto MUTO in tutti i modi che contano: Angular compila, Karma
// passa, le guardie di build contano parole e `<h1>`, e a occhio non si vede
// perche' lo scheletro dura pochi secondi. Torna solo come un numero peggiore
// in un pannello, settimane dopo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const VZ = join(REPO, 'src/app/features/varianza');
const HTML = readFileSync(join(VZ, 'varianza.component.html'), 'utf8');
const TS = readFileSync(join(VZ, 'varianza.component.ts'), 'utf8');
const SCSS = readFileSync(join(VZ, 'varianza.component.scss'), 'utf8');
const BUST = readFileSync(join(VZ, 'varianza-bust-chart/varianza-bust-chart.component.scss'), 'utf8');
const GRAPH = readFileSync(join(VZ, 'varianza-graph/varianza-graph.component.scss'), 'utf8');

/** Il blocco pieno: da `@if (result(); as r) {` fino al suo `@else if`. */
const bloccoPieno = () => {
  const da = HTML.indexOf('@if (result(); as r) {');
  const a = HTML.indexOf('@else if (mostraScheletro())', da);
  assert.ok(da > 0 && a > da, 'non trovo piu\' il blocco dei risultati: la forma del template e\' cambiata');
  return HTML.slice(da, a);
};

/** Le etichette dichiarate in `skelLabel` / `skelSubLabel`. */
const etichette = (nome) => {
  const m = TS.match(new RegExp(`readonly ${nome} = \\[([\\s\\S]*?)\\] as const;`));
  assert.ok(m, `non trovo ${nome} in varianza.component.ts`);
  return [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
};

test('lo scheletro ha esattamente tante voci quante sono le card del blocco pieno', () => {
  const card = (bloccoPieno().match(/class="vz__card"/g) || []).length;
  // ⚠️ Anti-guardia-vuota: se il conteggio e' zero sto leggendo male il file, e
  // i test qui sotto passerebbero su qualunque cosa.
  assert.ok(card >= 6, `ho contato ${card} card nel blocco pieno: sto leggendo male il template`);
  assert.equal(etichette('skelLabel').length, card, 'skelLabel non copre tutte le card');
  assert.equal(etichette('skelSubLabel').length, card, 'skelSubLabel non copre tutte le card');

  // `skelSub` dice quali card hanno il sottotitolo: due array, uno per modalita'.
  const m = TS.match(/readonly skelSub = computed[\s\S]*?\);/);
  assert.ok(m, 'non trovo skelSub');
  for (const arr of m[0].matchAll(/\[([^\]]*true[^\]]*)\]/g)) {
    assert.equal(
      arr[1].split(',').length,
      card,
      'un ramo di skelSub non ha una voce per ogni card',
    );
  }
});

test('⚠️ le etichette dello scheletro compaiono VERBATIM nel blocco pieno', () => {
  // Sono copiate apposta: e' cio' che fa andare a capo `.vz__card-k` negli
  // stessi punti, e quindi riservare l'altezza giusta invece di indovinarla.
  const pieno = bloccoPieno();
  for (const label of etichette('skelLabel')) {
    assert.ok(
      pieno.includes(label),
      `«${label}» non esiste piu' nel blocco pieno: se l'etichetta e' stata ` +
        'rinominata, va aggiornata anche skelLabel in varianza.component.ts — ' +
        'altrimenti lo scheletro riserva un\'altezza diversa, in silenzio.',
    );
  }
});

test('⚠️ .vz__progress NON e piu dentro un @if (sparirebbe a fine simulazione)', () => {
  // E' il difetto originale: figlio diretto del <form> (flex column, gap
  // 1.1rem), spariva a run finito e il pannello si accorciava di 21,6px. Sotto
  // i 900px `.vz__main` sta sotto il form e ci veniva trascinato.
  assert.match(
    HTML,
    /<div class="vz__progress" \[class\.is-on\]="running\(\)"/,
    'la barra deve restare SEMPRE nel flusso, con la visibilita\' pilotata dalla classe',
  );
  assert.doesNotMatch(
    HTML,
    /@if \(running\(\)\) \{\s*<div class="vz__progress"/,
    'la barra e\' tornata dentro un @if: e\' il difetto che questa correzione ha chiuso',
  );
  assert.match(SCSS, /\.vz__progress\.is-on \{\s*visibility: visible/, 'manca la regola .is-on');
});

test('⚠️ le altezze dei grafici hanno UNA fonte sola, e i due componenti la consumano', () => {
  // Due copie dello stesso numero in due file divergono in silenzio, e qui la
  // divergenza si paga in CLS: lo scheletro riserverebbe un'altezza diversa da
  // quella che il grafico prendera'.
  assert.match(SCSS, /--vz-graph-h:\s*clamp\(/, 'manca --vz-graph-h in :host');
  assert.match(SCSS, /--vz-bust-h:\s*clamp\(/, 'manca --vz-bust-h in :host');
  assert.match(GRAPH, /height:\s*var\(--vz-graph-h/, 'il grafico non consuma --vz-graph-h');
  assert.match(BUST, /height:\s*var\(--vz-bust-h/, 'la bust chart non consuma --vz-bust-h');
  assert.match(SCSS, /\.vz__skel-chart[\s\S]*?height:\s*var\(--vz-bust-h\)/, 'lo scheletro del grafico non consuma --vz-bust-h');
  // `.vz__empty` deve valere quanto il grafico che sostituisce.
  assert.match(SCSS, /\.vz__empty \{[\s\S]*?height:\s*var\(--vz-graph-h\)/, '.vz__empty non consuma --vz-graph-h');
});

test('⚠️ .vz__card-v riserva due righe (l unica altezza che dipende dal VALORE)', () => {
  assert.match(
    SCSS,
    /\.vz__card-v \{[\s\S]*?min-height:\s*calc\(/,
    'senza il min-height lo scheletro non puo\' riservare la misura giusta ne\' a ' +
      'una ne\' a quattro colonne: «da −1.234 a 5.678 buy-in» va a capo e ' +
      '«±1.234 buy-in» no.',
  );
});

test('⚠️ lo scheletro NON e legato a running() da solo', () => {
  // `setMode()` non annulla il run in volo: con `running()` da solo, cambiando
  // modalita' durante la simulazione lo scheletro crollerebbe di ~1.400px a
  // quattro secondi dall'ultimo clic — un difetto peggiore dell'originale.
  assert.match(
    TS,
    /mostraScheletro = computed\(\s*\(\) =>\s*!this\.result\(\) && this\.runningMode\(\) === this\.mode\(\)/,
    'mostraScheletro deve congiungere !result() e runningMode() === mode()',
  );
  assert.match(TS, /this\.runningMode\.set\(cfg\.mode\)/, 'runningMode va scritto da cfg.mode, non da mode()');
  assert.match(TS, /this\.runningMode\.set\(null\)/, 'runningMode va azzerato nel finally');
});
