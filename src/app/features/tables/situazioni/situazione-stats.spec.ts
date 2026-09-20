import type { PreflopNode } from '../../../core/models/api.models';
import { MATRIX_HANDS } from '../preflop-display';
import {
  COMBINAZIONI_TOTALI,
  combinazioni,
  notazioneRange,
  statistiche,
} from './situazione-stats';

/** Un nodo sintetico: fold/all-in a due sole mani «vere», le altre passano. */
function nodoSintetico(): PreflopNode {
  const hands: PreflopNode['hands'] = {};
  for (const m of MATRIX_HANDS) {
    hands[m] = { freq: { F: 1, RAI: 0 }, ev: { F: 0, RAI: -0.5 }, hand_ev: 0 };
  }
  hands['AA'] = { freq: { F: 0, RAI: 1 }, ev: { F: 0, RAI: 2 }, hand_ev: 2 };
  hands['KK'] = { freq: { F: 0, RAI: 1 }, ev: { F: 0, RAI: 1.5 }, hand_ev: 1.5 };
  hands['AKs'] = { freq: { F: 0.4, RAI: 0.6 }, ev: { F: 0, RAI: 0 }, hand_ev: 0 };
  hands['72o'] = { freq: { F: 0, RAI: 0 }, ev: { F: 0, RAI: 0 }, hand_ev: 0 }; // non raggiunta
  hands['Q7s'] = { freq: { F: 0, RAI: 1 }, ev: { F: 0, RAI: 0.02 }, hand_ev: 0.02 }; // al confine, giocata
  hands['Q6s'] = { freq: { F: 1, RAI: 0 }, ev: { F: 0, RAI: -0.03 }, hand_ev: 0 }; // al confine, passata
  return {
    format: 'spin',
    depth: 10,
    depth_label: '10',
    stacks: '10-10-10',
    preflop_actions: '',
    history: [],
    active_position: 'BTN',
    pot: 1.5,
    players: [],
    actions: [
      { code: 'F', type: 'FOLD', betsize: 0, betsize_by_pot: null, display: 'FOLD', simple_group: '', advanced_group: '', next_position: null, is_hand_end: true, next_street: false, is_terminal: true, total_freq: 0 },
      { code: 'RAI', type: 'RAISE', betsize: 10, betsize_by_pot: null, display: 'ALLIN', simple_group: '', advanced_group: '', next_position: 'SB', is_hand_end: false, next_street: false, is_terminal: false, total_freq: 0 },
    ],
    hands,
  };
}

describe('situazione-stats', () => {
  it('pesa le combinazioni (6/4/12) e le somma a 1.326', () => {
    expect(combinazioni('AA')).toBe(6);
    expect(combinazioni('AKs')).toBe(4);
    expect(combinazioni('AKo')).toBe(12);
    expect(COMBINAZIONI_TOTALI).toBe(1326);
  });

  it('calcola quote, mani pure, miste, non raggiunte e il confine col fold', () => {
    const st = statistiche(nodoSintetico());
    const allin = st.azioni.find((a) => a.tipo === 'ALLIN')!;
    const fold = st.azioni.find((a) => a.tipo === 'FOLD')!;
    // all-in: AA (6) + KK (6) + Q7s (4) + 0,6 × AKs (4) = 18,4 combinazioni
    expect(allin.quotaCombo * COMBINAZIONI_TOTALI).toBeCloseTo(18.4, 5);
    expect(allin.maniPure).toEqual(['AA', 'KK', 'Q7s']); // per EV decrescente
    expect(allin.notazione).toBe('KK+, Q7s');
    expect(allin.maniDominanti).toBe(4); // AA, KK, Q7s, AKs (0,6 > 0,4)
    expect(fold.maniDominanti).toBe(169 - 1 - 4); // meno la non raggiunta
    expect(st.maniMiste.map((m) => m.mano)).toEqual(['AKs']);
    expect(st.nonRaggiunte).toBe(1);
    // AKs e' mista con EV 0: sta sul confine per definizione, prima di Q7s
    expect(st.confine!.giocate[0]).toEqual({ mano: 'AKs', azione: 'RAI', ev: 0 });
    expect(st.confine!.giocate[1]).toEqual({ mano: 'Q7s', azione: 'RAI', ev: 0.02 });
    expect(st.confine!.passate[0]).toEqual({ mano: 'Q6s', azione: 'RAI', ev: -0.03 });
    expect(st.confine!.quante).toBe(3);
    expect(st.evMedio).toBeGreaterThan(0);
  });

  it('notazioneRange compatta le sequenze: «X+» dalla cima, «X-Y» nel mezzo, singole com\'e\'', () => {
    expect(notazioneRange(['AA', 'KK', 'QQ', '55', '44', '33'])).toBe('QQ+, 55-33');
    expect(notazioneRange(['AKs', 'AQs', 'A5s', 'A4s', 'A2s'])).toBe('AQs+, A5s-A4s, A2s');
    expect(notazioneRange(['K9o', 'KTo', 'KJo', 'KQo'])).toBe('K9o+');
    expect(notazioneRange(['T9s', '98s', '87s'])).toBe('T9s, 98s, 87s');
    expect(notazioneRange([])).toBe('');
  });
});
