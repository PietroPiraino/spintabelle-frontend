import type { PreflopHandData, PreflopNode } from '../../../core/models/api.models';
import { MATRIX_HANDS } from '../preflop-display';
import type { NodoCompatto } from './situazioni.types';

/**
 * Dal nodo compatto (`nodi/<slug>.ts`) al `PreflopNode` che `app-range-grid`
 * e i calcoli del viewer si aspettano: le 169 righe tornano un oggetto per
 * mano, le colonne un oggetto per codice azione.
 */
export function espandiNodo(c: NodoCompatto): PreflopNode {
  const hands: Record<string, PreflopHandData> = {};
  MATRIX_HANDS.forEach((mano, i) => {
    const freq: Record<string, number> = {};
    const ev: Record<string, number> = {};
    c.codici.forEach((code, j) => {
      freq[code] = c.f[i][j];
      ev[code] = c.e[i][j];
    });
    hands[mano] = { freq, ev, hand_ev: c.h[i] };
  });
  return {
    format: c.format,
    depth: c.depth,
    depth_label: c.depth_label,
    stacks: c.stacks,
    preflop_actions: c.preflop_actions,
    history: c.history,
    active_position: c.active_position,
    pot: c.pot,
    players: c.players,
    actions: c.actions,
    hands,
  };
}
