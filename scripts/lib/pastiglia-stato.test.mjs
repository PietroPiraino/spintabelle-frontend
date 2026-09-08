// Lo stato di una riga si disegna in UN posto solo.
//
// ⚠️ PERCHÉ ESISTE. Fino all'08/09/2026 il pannello aveva quattro pastiglie di
// stato — `.an-chip` (news), `.aff-chip` (affiliazioni), `.shop-chip` (negozio),
// `.fnt-chip` (fonti) — e le prime tre avevano la dichiarazione base IDENTICA
// parola per parola: undici righe copiate tre volte, con perfino la stessa
// corrispondenza stato→colore. Non era una divergenza di gusto: nessuno aveva
// mai deciso di averne quattro, ognuna era nata copiando la precedente perché
// il commento della prima diceva «il MODELLO da copiare, non da importare».
//
// Il modo in cui questo torna è sempre lo stesso: qualcuno aggiunge una sezione,
// ha bisogno di una pastiglia colorata, e la scrive in casa. Non si rompe
// niente, non c'è un test rosso, e sei mesi dopo ce ne sono cinque. Questa
// guardia costa quattro righe e chiude quella porta.
//
// Gira in `npm run test:scripts`, non nel build.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ADMIN = resolve(process.cwd(), 'src/app/features/admin');

/** Ogni `*.component.scss` sotto `features/admin/`, col suo percorso corto. */
function fogliDiSezione() {
  const out = [];
  for (const voce of readdirSync(ADMIN, { withFileTypes: true })) {
    if (!voce.isDirectory()) continue;
    for (const f of readdirSync(join(ADMIN, voce.name))) {
      if (f.endsWith('.component.scss')) {
        out.push({
          nome: `${voce.name}/${f}`,
          testo: readFileSync(join(ADMIN, voce.name, f), 'utf8'),
        });
      }
    }
  }
  return out;
}

const FOGLI = fogliDiSezione();

test('⚠️ la guardia sta leggendo davvero dei fogli', () => {
  // Il verso anti-guardia-vuota: se la cartella si spostasse, `fogliDiSezione()`
  // tornerebbe [] e ogni test sotto passerebbe senza controllare niente.
  assert.ok(
    FOGLI.length >= 8,
    `trovati solo ${FOGLI.length} fogli di sezione sotto ${ADMIN}: il percorso è cambiato?`,
  );
});

test('le quattro pastiglie locali non sono tornate', () => {
  const morte = ['.an-chip', '.aff-chip', '.shop-chip', '.fnt-chip'];
  for (const { nome, testo } of FOGLI) {
    // Solo le DICHIARAZIONI: i commenti che raccontano perché non ci sono più
    // devono poter nominare le classi, o la lezione si perde.
    const righe = testo
      .split('\n')
      .filter((r) => !r.trimStart().startsWith('//'));
    for (const classe of morte) {
      const dichiarata = righe.some((r) => r.includes(`${classe} {`) || r.includes(`${classe}--`));
      assert.ok(
        !dichiarata,
        `${nome} dichiara di nuovo «${classe}».\n` +
          'La pastiglia di stato è `.admin-stato` (src/app/features/admin/admin-shared.scss) ' +
          'e il colore lo decide un `data-tono`. Se serve un tono nuovo, si aggiunge lì ' +
          'e in `admin-stato.ts` — non si riscrive una pastiglia in casa.',
      );
    }
  }
});

test('nessuna sezione si riscrive una pastiglia propria', () => {
  // La firma di una pastiglia: `border-radius: 999px` insieme a
  // `text-transform: uppercase` dentro lo stesso blocco. È il disegno di
  // `.admin-stato` e di `.badge`, e in un foglio di sezione non ha ragione di
  // esserci — quelle due righe insieme sono il momento in cui qualcuno ne sta
  // costruendo una quinta.
  for (const { nome, testo } of FOGLI) {
    const blocchi = testo.split(/\n(?=\S)/);
    for (const b of blocchi) {
      const codice = b
        .split('\n')
        .filter((r) => !r.trimStart().startsWith('//'))
        .join('\n');
      if (
        codice.includes('border-radius: 999px') &&
        codice.includes('text-transform: uppercase')
      ) {
        const selettore = (codice.match(/^([^\n{]+)\{/) ?? [, '?'])[1].trim();
        assert.fail(
          `${nome} → «${selettore}» ha la forma di una pastiglia di stato ` +
            '(pillola tonda in maiuscoletto).\n' +
            'Se è lo stato di una riga, la classe è `.admin-stato` col `data-tono`; ' +
            'se è un FATTO (il tier, «Gratis», «Tu»), è `.badge`. ' +
            'La regola di confine sta in admin-shared.scss.',
        );
      }
    }
  }
});

test('i due vocabolari di tono non usano le stesse parole', () => {
  // ⚠️ È il vincolo che rende accettabile avere due insiemi di toni: quelli del
  // PERCORSO (news, affiliazioni, negozio) e quelli della SALUTE (fonti). Se le
  // parole si sovrapponessero, `allarme` varrebbe rosso in una sezione e oro in
  // un'altra — e non lo segnalerebbe niente, perché sono due fogli diversi.
  const percorso = readFileSync(resolve(ADMIN, 'admin-stato.ts'), 'utf8');
  const salute = readFileSync(
    resolve(ADMIN, 'admin-fonti/admin-fonti.component.ts'),
    'utf8',
  );

  const toniPercorso = [...percorso.matchAll(/^\s*\| '([a-z]+)'/gm)].map((m) => m[1]);
  const rigaSalute = salute.match(/^type Tono = ([^;]+);/m);
  assert.ok(rigaSalute, 'il type Tono di admin-fonti non si trova più');
  const toniSalute = [...rigaSalute[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

  assert.ok(toniPercorso.length >= 5, `toni del percorso trovati: ${toniPercorso.length}`);
  assert.ok(toniSalute.length >= 4, `toni della salute trovati: ${toniSalute.length}`);

  const collisioni = toniPercorso.filter((t) => toniSalute.includes(t));
  assert.deepEqual(
    collisioni,
    [],
    `le parole ${collisioni.join(', ')} valgono in due vocabolari di tono diversi.\n` +
      'I toni del PERCORSO (admin-stato.ts) rispondono a «a che punto è?», ' +
      'quelli della SALUTE (admin-fonti) a «funziona?»: la stessa parola con ' +
      'due colori a seconda della sezione non la segnala nessuno.',
  );
});
