// Le 24 pagine chart pubbliche (/tabelle/<slug>): cio' che si rompe in
// silenzio fra il catalogo, i moduli generati e il dataset.
//
//  1. **Un export stantio.** Il catalogo (`situazioni.catalogo.ts`) e i moduli
//     `nodi/<slug>.ts` li scrive `backend/scripts/export-situazioni.mjs`, ma
//     nessuno obbliga a rilanciarlo dopo aver toccato il catalogo: una riga
//     aggiunta senza export e' una pagina prerenderizzata senza griglia, una
//     riga tolta lascia un modulo orfano. Qui si pretende la BIIEZIONE, e che
//     l'identita' dentro ogni modulo sia quella del catalogo.
//  2. **L'ordine delle mani.** Le 169 righe di `f`/`e` seguono `MATRIX_HANDS`:
//     se l'ordine di `preflop-display.ts` cambiasse, ogni cella mostrerebbe la
//     mano di un'altra, senza errori. Si confronta con i valori importati.
//  3. **Art. 9 sui testi del catalogo** (titoli, h1, descrizioni, premesse):
//     sono testo pubblico indicizzabile come le guide.
//
// Node 24 importa i `.ts` di sole costanti: catalogo, tipi, nodi e
// preflop-display hanno solo `import type` (o nessun import).

import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const url = (p) => pathToFileURL(resolve(REPO, p)).href;
const CARTELLA = 'src/app/features/tables/situazioni';

const { SITUAZIONI, slugSituazioni, testiDiSituazione } = await import(
  url(`${CARTELLA}/situazioni.catalogo.ts`)
);
const { MATRIX_HANDS } = await import(url('src/app/features/tables/preflop-display.ts'));
const art9 = await import(url('src/app/core/art9.constants.ts'));
const fileNodi = readdirSync(resolve(REPO, CARTELLA, 'nodi')).filter((f) => f.endsWith('.ts'));
const nodi = new Map();
for (const f of fileNodi) {
  const m = await import(url(`${CARTELLA}/nodi/${f}`));
  nodi.set(f.replace(/\.ts$/, ''), m.NODO);
}
const { CARICATORI } = await import(url(`${CARTELLA}/situazioni.caricatori.ts`));

test('catalogo, moduli nodi e mappa dei caricatori sono in biiezione (nessun export stantio)', () => {
  const slugs = slugSituazioni().sort();
  assert.deepEqual([...nodi.keys()].sort(), slugs, 'nodi/<slug>.ts ≠ catalogo: rilancia export-situazioni.mjs');
  assert.deepEqual(Object.keys(CARICATORI).sort(), slugs, 'situazioni.caricatori.ts ≠ catalogo');
  assert.ok(slugs.length >= 20, `solo ${slugs.length} situazioni`);
  assert.equal(new Set(slugs).size, slugs.length, 'slug duplicati');
});

test('ogni modulo porta l\'identita\' del catalogo e 169 righe nell\'ordine di MATRIX_HANDS', () => {
  assert.equal(MATRIX_HANDS.length, 169);
  assert.equal(MATRIX_HANDS[0], 'AA');
  assert.equal(MATRIX_HANDS[1], 'AKs');
  assert.equal(MATRIX_HANDS[13], 'AKo');
  assert.equal(MATRIX_HANDS[168], '22');
  for (const s of SITUAZIONI) {
    const n = nodi.get(s.slug);
    assert.equal(n.format, s.format, s.slug);
    assert.equal(n.depth_label, s.depth_label, s.slug);
    assert.equal(n.preflop_actions, s.preflop_actions, s.slug);
    assert.equal(n.active_position, s.posizione, `${s.slug}: la posizione del catalogo non e' quella del nodo`);
    assert.equal(n.f.length, 169, s.slug);
    assert.equal(n.e.length, 169, s.slug);
    assert.equal(n.h.length, 169, s.slug);
    assert.deepEqual(n.codici, n.actions.map((a) => a.code), s.slug);
    for (const riga of n.f) assert.equal(riga.length, n.codici.length, s.slug);
    assert.match(n.esportato, /^\d{4}-\d{2}-\d{2}$/, s.slug);
    // le frequenze di una mano raggiunta sommano ~1
    const sommeOk = n.f.every((riga) => {
      const t = riga.reduce((a, b) => a + b, 0);
      return t < 0.01 || Math.abs(t - 1) < 0.02;
    });
    assert.ok(sommeOk, `${s.slug}: frequenze che non sommano a 1`);
  }
});

test('slug in kebab-case, titoli ≤ 60, descrizioni ≤ 160, ogni titolo dice la profondita\'', () => {
  for (const s of SITUAZIONI) {
    assert.match(s.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, s.slug);
    assert.ok(s.titolo.length <= 60, `${s.slug}: titolo di ${s.titolo.length}`);
    assert.ok(s.descrizione.length <= 160, `${s.slug}: descrizione di ${s.descrizione.length}`);
    assert.ok(s.titolo.includes(`${s.depth_label} bb`), `${s.slug}: il titolo non dice «${s.depth_label} bb»`);
    assert.ok(s.h1.includes(`${s.depth_label} big blind`), `${s.slug}: l'h1 non dice la profondita'`);
  }
});

test('art. 9: nessun testo del catalogo nomina una sala, una parola non pubblicabile o una promessa', () => {
  const liste = [art9.SALE_AFFILIATE, art9.PAROLE_NON_PUBBLICABILI, art9.PROMESSE_VIETATE];
  for (const s of SITUAZIONI) {
    for (const testo of testiDiSituazione(s)) {
      for (const lista of liste) {
        assert.deepEqual(art9.terminiPresenti(testo, lista), [], `${s.slug}: «${testo}»`);
      }
    }
  }
});
