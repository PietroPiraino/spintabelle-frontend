import {
  HandActionView,
  HandStreetName,
  HandStreetView,
} from '../../../core/models/api.models';
import {
  carteNuove,
  gettoneAzione,
  misuraInBui,
  notazioneStrada,
} from './hand-notation';

/**
 * ⚠️ **I quattro casi che aprono questo file sono gli ESEMPI DEL TITOLARE**
 * (`R2 C1`, `X X`, `B2 F`, `X B1 R4 C3`), ricostruiti come il backend li manda
 * davvero: importi interi in unità minime, `importo` = incremento,
 * `totaleStrada` = totale del giocatore su quella strada. Sono il contratto —
 * se cambiano, la colonna smette di dire quello che il titolare ha chiesto.
 */

const BB = 30;

function az(
  seat: number,
  tipo: string,
  importo: number,
  totaleStrada: number,
  tipoOriginale?: string,
): HandActionView {
  // `potDopo` è deliberatamente finto: ⚠️ questa notazione non lo guarda mai, e
  // non deve — comprende la puntata non chiamata.
  return { seat, tipo, importo, totaleStrada, potDopo: 0, tipoOriginale };
}

function strada(
  nome: HandStreetName,
  azioni: HandActionView[],
  board: string[] = [],
): HandStreetView {
  return { strada: nome, board, azioni, pot: 0, raccolto: 0, restituzione: null };
}

function codici(s: HandStreetView, heroSeat: number | null = null): string {
  return notazioneStrada(s, heroSeat, BB)
    .map((g) => g.codice)
    .join(' ');
}

describe('hand-notation — i quattro esempi del titolare', () => {
  it('preflop: rilancio a 2 bb e chiamata da 1 bb del grande buio → «R2 C1»', () => {
    const s = strada('PREFLOP', [
      az(1, 'SB', 15, 15),
      az(2, 'BB', 30, 30),
      az(3, 'RAISE', 60, 60),
      az(2, 'CALL', 30, 60),
    ]);
    expect(codici(s)).toBe('R2 C1');
  });

  it('flop: due bussate → «X X»', () => {
    const s = strada('FLOP', [az(1, 'CHECK', 0, 0), az(2, 'CHECK', 0, 0)], [
      'Kh',
      '3h',
      '7d',
    ]);
    expect(codici(s)).toBe('X X');
  });

  it('flop: puntata da 2 bb e passo → «B2 F»', () => {
    const s = strada('FLOP', [az(1, 'BET', 60, 60), az(2, 'FOLD', 0, 0)]);
    expect(codici(s)).toBe('B2 F');
  });

  it('flop: bussa, punta, check-raise, chiamata → «X B1 R4 C3»', () => {
    const s = strada('FLOP', [
      az(1, 'CHECK', 0, 0),
      az(2, 'BET', 30, 30),
      az(1, 'RAISE', 120, 120),
      // ⚠️ Il caso che pinna la regola: chi aveva già 30 sulla strada ne mette
      // altri 90 per arrivare a 120. Col totale uscirebbe `C4`, cioè un numero
      // vero per un'altra domanda.
      az(2, 'CALL', 90, 120),
    ]);
    expect(codici(s)).toBe('X B1 R4 C3');
  });
});

describe('hand-notation — che cosa NON entra nella notazione', () => {
  it('ante, bui e straddle non producono gettoni', () => {
    const s = strada('PREFLOP', [
      az(1, 'ANTE', 5, 5),
      az(2, 'ANTE', 5, 5),
      az(1, 'SB', 15, 15),
      az(2, 'BB', 30, 30),
      az(3, 'STRADDLE', 60, 60),
      az(3, 'FOLD', 0, 0),
    ]);
    expect(codici(s)).toBe('F');
  });

  it('una strada senza azioni (all-in preflop, run-out) torna un elenco vuoto', () => {
    const s = strada('TURN', [], ['Kh', '3h', '7d', 'Jc']);
    expect(notazioneStrada(s, 3, BB)).toEqual([]);
  });
});

describe('hand-notation — all-in', () => {
  it('un all-in di rilancio porta il totale della strada', () => {
    const g = gettoneAzione(az(3, 'ALLIN', 550, 550, 'RAISE'), null, BB);
    expect(g?.codice).toBe('A18');
  });

  it('un all-in di CHIAMATA porta l’incremento, non il totale', () => {
    // Aveva già 60 sulla strada e ne aggiunge 240 per coprire un rilancio a 300.
    const g = gettoneAzione(az(6, 'ALLIN', 240, 300, 'CALL'), null, BB);
    expect(g?.codice).toBe('A8');
  });
});

describe('hand-notation — l’eroe', () => {
  it('marca solo le azioni del posto dell’eroe', () => {
    const s = strada('FLOP', [az(1, 'CHECK', 0, 0), az(3, 'BET', 60, 60)]);
    const g = notazioneStrada(s, 3, BB);
    expect(g.map((x) => x.eroe)).toEqual([false, true]);
  });

  it('senza posto dell’eroe nessun gettone è marcato', () => {
    const s = strada('FLOP', [az(1, 'CHECK', 0, 0), az(3, 'BET', 60, 60)]);
    expect(notazioneStrada(s, null, BB).some((x) => x.eroe)).toBe(false);
  });

  it('l’etichetta per lo screen reader nomina il verbo e la misura', () => {
    const g = gettoneAzione(az(3, 'RAISE', 75, 75), 3, BB);
    expect(g?.etichetta).toBe('rilancia a 2.5 grandi bui');
    expect(gettoneAzione(az(3, 'FOLD', 0, 0), 3, BB)?.etichetta).toBe('passa');
  });
});

describe('misuraInBui', () => {
  it('scrive il punto decimale, come i codici del preflop', () => {
    expect(misuraInBui(75, BB)).toBe('2.5');
  });

  it('sotto i 10 bb tiene un decimale, sopra arrotonda all’intero', () => {
    expect(misuraInBui(15, BB)).toBe('0.5');
    expect(misuraInBui(364, BB)).toBe('12');
  });

  it('lascia cadere lo zero decimale', () => {
    expect(misuraInBui(60, BB)).toBe('2');
  });

  it('⚠️ senza grande buio noto NON stampa nulla, mai «Infinity»', () => {
    expect(misuraInBui(60, 0)).toBe('');
    expect(gettoneAzione(az(3, 'RAISE', 60, 60), 3, 0)?.codice).toBe('R');
  });
});

describe('carteNuove', () => {
  const board = ['Kh', '3h', '7d', 'Jc', 'Kd'];

  it('⚠️ il board è cumulativo: ogni strada mostra solo la sua carta nuova', () => {
    expect(carteNuove(strada('FLOP', [], board.slice(0, 3)))).toEqual([
      'Kh',
      '3h',
      '7d',
    ]);
    expect(carteNuove(strada('TURN', [], board.slice(0, 4)))).toEqual(['Jc']);
    expect(carteNuove(strada('RIVER', [], board))).toEqual(['Kd']);
  });

  it('il preflop non ha carte comuni', () => {
    expect(carteNuove(strada('PREFLOP', [], []))).toEqual([]);
  });
});
