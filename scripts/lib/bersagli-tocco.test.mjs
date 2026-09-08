// I bersagli di tocco del pannello admin: 44px, DICHIARATI.
//
// ⚠️ PERCHÉ UNA GUARDIA E NON UN TOKEN `--tap: 44px`. Il 44 non abita sempre la
// stessa proprietà, e QUALE sia è la decisione: `height` su un `<td>` (dove si
// comporta da minimo e viene ereditata da tutto ciò che sta nella cella),
// `min-height` su `.btn` e su `button.badge--tag`, `width`+`height` su un
// bottone quadrato. Un token li fa sembrare intercambiabili, e
// `min-height: var(--tap)` su un `.badge` con `padding: .22rem .7rem` produce
// ancora una scatola da 26px SEMBRANDO risolto: trasformerebbe un errore
// rumoroso (nessuno ha dichiarato niente) in uno muto (qualcuno ha dichiarato
// la cosa sbagliata).
//
// ⚠️ E i ~60 letterali del progetto hanno accanto il commento che spiega il
// difetto già pagato, con la misura: 38,1 contro 54,5; 26 contro 44; 42 a
// 390px. Il commento È la lezione; `var(--tap)` la sostituirebbe con un
// rimando. Questa guardia protegge la stessa cosa senza nascondere la
// dichiarazione.
//
// ⚠️ Dall'08/09/2026 un punto sorveglia il verso OPPOSTO: da quando la cella
// d'identità sta su due righe, i 44px della riga di tabella non sono più solo
// dichiarati, sono anche LIMITATI dall'interlinea compressa. Un punto che dice
// «non superare» in mezzo a sette che dicono «raggiungi» va letto per quello
// che è, non uniformato agli altri.
//
// Non gira nel build (`npm run build`): gira in `npm run test:scripts`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RADICE = process.cwd();
const leggi = (p) => readFileSync(resolve(RADICE, p), 'utf8');

/**
 * I cinque punti in cui il bersaglio di tocco del pannello è dichiarato una
 * volta sola — e da cui ogni sezione lo eredita invece di riscriverselo.
 *
 * `dentro` è il selettore che deve esistere; `regola` è la dichiarazione che
 * deve stargli dentro. Si cerca il blocco a partire dal selettore, non con un
 * grep globale: un `44px` che sta da un'altra parte del file non deve poter
 * far passare la guardia.
 */
const PUNTI = [
  {
    file: 'src/app/features/admin/admin-shared.scss',
    selettore: '.admin-ico {',
    attese: ['width: 44px', 'height: 44px'],
    perche:
      'il comando solo-icona del pannello (+, matita, tre puntini): un <button> con dentro un\'icona da 18 sta sui 20px',
  },
  {
    file: 'src/app/features/admin/admin-table.scss',
    selettore: '  th,\n  td {',
    attese: ['height: 44px'],
    perche:
      'la riga di tabella: senza, sta sui ~30px e nessun comando dentro la cella arriva al minimo',
  },
  {
    file: 'src/app/features/admin/admin-modale.scss',
    selettore: '.admin-modale__sum {',
    attese: ['min-height: 44px'],
    perche: 'l\'intestazione di sezione dentro la modale',
  },
  {
    file: 'src/app/features/admin/admin-modale.scss',
    selettore: '  .btn {',
    attese: ['min-height: 44px'],
    perche:
      'i pulsanti dentro la modale: un .btn--sm nudo sta sui 38,1px e accanto a un campo da 44 fa due altezze sulla stessa riga',
  },
  {
    file: 'src/app/shared/ui/modal/modal.component.scss',
    selettore: '.mo__chiudi {',
    attese: ['width: 44px', 'height: 44px'],
    perche: 'la ✕ della modale',
  },
  {
    file: 'src/app/shared/ui/modal/modal.component.scss',
    selettore: '.mo__piede {',
    attese: ['min-height: 44px'],
    perche:
      'i pulsanti del piede: lì admin-modale.scss non arriva, perché quel blocco vive dentro .admin-modale, che sta nel CORPO',
  },
  {
    file: 'src/styles/_cards.scss',
    selettore: 'button.badge--tag {',
    attese: ['min-height: 44px'],
    perche:
      'le pillole di filtro, che app-filtro e app-schede riusano: un .badge nudo sta sui 26px. ⚠️ Il selettore è button.badge--tag e non .badge--tag — un\'etichetta <span> alta 44px sarebbe solo un buco',
  },
  {
    // ⚠️ Questo punto è l'unico che sorveglia un LIMITE e non una
    // dichiarazione, ed è il rovescio di tutti gli altri: qui il 44 non va
    // raggiunto, va NON SUPERATO. La cella d'identità sta su due righe, e ci
    // sta solo perché l'interlinea è compressa a 1.25: col `line-height: 1.6`
    // che il body eredita (`src/styles/_reset.scss`) la riga passerebbe da 45 a
    // ~53px in TUTTE e undici le tabelle del pannello, senza che nulla si
    // rompa, senza un test rosso e senza che nessuno se ne accorga finché non
    // mette due sezioni una accanto all'altra.
    //
    // ⚠️ La newline iniziale nel selettore non è pedanteria: `blocco()` usa
    // `indexOf`, e `.admin-table__ident {` compare DUE volte nel file (la
    // regola di base e quella dentro la @media a 720px, indentata). Senza la
    // newline la guardia leggerebbe il primo dei due — che oggi è quello
    // giusto solo per caso, cioè perché sta più su nel file.
    file: 'src/app/features/admin/admin-table.scss',
    selettore: '\n.admin-table__ident {',
    attese: ['line-height: 1.25', 'min-height: 2lh'],
    perche:
      'il TETTO della riga di tabella: due righe di testo entrano nei 44px solo con l\'interlinea compressa, e il min-height tiene i titoli allineati anche dove il sotto-testo non c\'è',
  },
];

/** Il corpo del blocco che comincia a `selettore`, bilanciando le graffe. */
function blocco(sorgente, selettore) {
  const i = sorgente.indexOf(selettore);
  if (i < 0) return null;
  let livello = 0;
  for (let j = i + selettore.length - 1; j < sorgente.length; j += 1) {
    if (sorgente[j] === '{') livello += 1;
    else if (sorgente[j] === '}') {
      livello -= 1;
      if (livello === 0) return sorgente.slice(i, j + 1);
    }
  }
  return null;
}

for (const p of PUNTI) {
  test(`44px dichiarati: ${p.selettore.trim()} in ${p.file.split('/').pop()}`, () => {
    const corpo = blocco(leggi(p.file), p.selettore);
    assert.ok(
      corpo,
      `selettore «${p.selettore.trim()}» non trovato in ${p.file}. ` +
        'Se è stato rinominato, aggiorna questa guardia: non toglierla.',
    );
    for (const attesa of p.attese) {
      assert.ok(
        corpo.includes(attesa),
        `${p.file} → «${p.selettore.trim()}» non dichiara più «${attesa}».\n` +
          `A cosa serve: ${p.perche}.\n` +
          '⚠️ I 44px non arrivano mai da soli: se li hai tolti, il bersaglio di ' +
          'tocco è tornato sotto il minimo e non lo segnala nient\'altro.',
      );
    }
  });
}

test('⚠️ la guardia sta leggendo davvero qualcosa', () => {
  // Il verso anti-guardia-vuota: se i file si spostassero, ogni `blocco()`
  // tornerebbe null e i test sopra fallirebbero uno per uno — ma se qualcuno
  // svuotasse PUNTI la suite resterebbe verde senza controllare niente.
  assert.ok(PUNTI.length >= 8, 'l\'elenco dei punti si è accorciato');
});
