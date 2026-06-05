// Helper puri di presentazione per il viewer delle tabelle preflop.
import { PreflopAction, PreflopFormat } from '../../core/models/api.models';

export const FORMAT_LABELS: Record<PreflopFormat, string> = {
  spin: 'Spin & Go',
  husng: 'Heads-Up',
  spin_2x_nolimp: 'Spin & Go BvB 2x raise only',
};

const RANKS = [
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
] as const;

/**
 * Le 169 mani nell'ordine della matrice 13×13: coppie in diagonale,
 * suited sopra (riga+colonna+s), offsuit sotto.
 */
export const MATRIX_HANDS: readonly string[] = RANKS.flatMap((row, r) =>
  RANKS.map((col, c) => {
    if (r === c) return row + col;
    return r < c ? `${row}${col}s` : `${col}${row}o`;
  }),
);

/**
 * Ordine di visualizzazione delle azioni: dall'aggressiva alla passiva
 * (all-in → raise dal più grande → call/check → fold), come nei solver.
 * Usato ovunque: segmenti delle celle, legenda, pulsanti, dettaglio mano.
 */
export function displayActions(actions: PreflopAction[]): PreflopAction[] {
  const rank = (a: PreflopAction): number => {
    if (a.display === 'ALLIN') return 0;
    if (a.type === 'RAISE') return 1;
    if (a.type === 'CALL' || a.type === 'CHECK') return 2;
    return 3; // FOLD
  };
  return [...actions].sort((a, b) => rank(a) - rank(b) || b.betsize - a.betsize);
}

/**
 * Colore (nome della custom property) per ogni codice azione del nodo.
 * I raise non all-in prendono una scala oro→arancio in base alla size.
 */
export function actionColorMap(
  actions: PreflopAction[],
): Record<string, string> {
  const raises = actions
    .filter((a) => a.type === 'RAISE' && a.display !== 'ALLIN')
    .sort((a, b) => a.betsize - b.betsize);
  const ramp =
    raises.length === 1
      ? ['--act-raise-2']
      : raises.length === 2
        ? ['--act-raise-1', '--act-raise-3']
        : ['--act-raise-1', '--act-raise-2', '--act-raise-3'];

  const map: Record<string, string> = {};
  for (const a of actions) {
    if (a.display === 'ALLIN') map[a.code] = '--act-allin';
    else if (a.type === 'RAISE')
      map[a.code] = ramp[Math.min(raises.indexOf(a), ramp.length - 1)];
    else if (a.type === 'CALL') map[a.code] = '--act-call';
    else if (a.type === 'CHECK') map[a.code] = '--act-check';
    else map[a.code] = '--act-fold';
  }
  return map;
}

/** "25" → "25", 7.5 → "7,5": numeri compatti con la virgola italiana. */
export function formatBb(value: number | string): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return String(parseFloat(n.toFixed(2))).replace('.', ',');
}

/** Etichetta leggibile dell'azione (gergo da tavolo, condiviso coi coach). */
export function actionLabel(action: PreflopAction): string {
  switch (action.type) {
    case 'FOLD':
      return 'Fold';
    case 'CHECK':
      return 'Check';
    case 'CALL':
      return 'Call';
    default:
      return action.display === 'ALLIN'
        ? `All-in ${formatBb(action.betsize)}bb`
        : `Raise ${formatBb(action.betsize)}bb`;
  }
}

/** Frequenza 0..1 → percentuale compatta ("58,4%", "100%"). */
export function formatFreq(freq: number): string {
  const pct = freq * 100;
  const rounded = pct >= 99.95 ? '100' : pct.toFixed(1).replace(/\.0$/, '');
  return `${rounded.replace('.', ',')}%`;
}

/** EV in bb con segno esplicito ("+0,35", "−1,20"). */
export function formatEv(ev: number): string {
  // il segno si decide sul valore già arrotondato, mai in disaccordo con le cifre
  const rounded = Number(ev.toFixed(2));
  const v = Math.abs(rounded).toFixed(2).replace('.', ',');
  return `${rounded < 0 ? '−' : '+'}${v}`;
}
