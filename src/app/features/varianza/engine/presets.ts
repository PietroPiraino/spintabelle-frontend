// Strutture payout dei formati lottery a 3 giocatori.
// SPIN & GO: dati UFFICIALI pokerstars.it — moltiplicatori, split, frequenze (su 10.000.000)
//   e STACK INIZIALE variabile per moltiplicatore (300/400/500) per ogni buy-in.
// TWISTER: dati ufficiali .it (Lottomatica): €1–€100 rake 7%, €200 rake 6%; split 75/15/10
//   quando il montepremi (mult × buy-in) supera la soglia €, altrimenti winner-take-all.

import type { PayoutLevel, PayoutStructure } from './types';

// Divisioni montepremi ricorrenti (in %).
const WTA: readonly [number, number, number] = [100, 0, 0];
// Twister: divisione ufficiale .it quando il montepremi supera la soglia (vedi twisterStructure).
const TWISTER_3WAY: readonly [number, number, number] = [75, 15, 10];

/** Un buy-in selezionabile e la struttura payout associata. */
export interface BuyinTier {
  readonly eur: number;
  readonly label: string;
  readonly structure: PayoutStructure;
}

/** Un formato di gioco con i suoi buy-in. */
export interface VarianceFormat {
  readonly id: 'spin' | 'twister';
  readonly label: string;
  readonly buyins: readonly BuyinTier[];
  readonly defaultEur: number;
  /** Nota mostrata in UI (es. avviso "dati provvisori"). */
  readonly note?: string;
}

function eurLabel(eur: number): string {
  return eur % 1 === 0 ? '€' + eur : '€' + eur.toFixed(2).replace('.', ',');
}

// ---------------------------------------------------------------------------
// SPIN & GO (dati ufficiali pokerstars.it)
// ---------------------------------------------------------------------------
// 9 livelli. Il montepremi più alto è 12000× (6000× solo sul buy-in €200).
const SPIN_MULTS = [12000, 100, 50, 25, 10, 5, 4, 3, 2] as const;
// Split 1°/2°/3° per livello (in %).
const SPIN_SPLITS: readonly (readonly [number, number, number])[] = [
  [83.333, 10, 6.667], // 12000× (o 6000× sul €200): jackpot 3-way
  [80, 12, 8], // 100×
  [80, 12, 8], // 50×
  [80, 12, 8], // 25×
  [80, 20, 0], // 10×: paga 1° e 2°
  WTA, // 5×
  WTA, // 4×
  WTA, // 3×
  WTA, // 2×
];
// Stack iniziale (chips) per moltiplicatore: più alto è il montepremi, più chips e blinds lente.
const SPIN_STACKS = [500, 500, 500, 500, 500, 400, 400, 300, 300] as const;
// Frequenze fisse (su 10.000.000) per 12000/100/50/25/10/5/4; le 3× e 2× variano per buy-in.
const SPIN_FIXED_FREQ = [1, 500, 1000, 7500, 100000, 250000, 900000] as const;

function spinStructure(freq3: number, freq2: number, topMult = 12000): PayoutStructure {
  const freqs = [...SPIN_FIXED_FREQ, freq3, freq2];
  const levels: PayoutLevel[] = SPIN_MULTS.map((mult, i) => ({
    freq: freqs[i] ?? 0,
    mult: i === 0 ? topMult : mult,
    split: SPIN_SPLITS[i] ?? WTA,
    stack: SPIN_STACKS[i] ?? 500,
  }));
  return { players: 3, freqBase: 10_000_000, levels };
}

// Per fascia di rake le 3×/2× cambiano leggermente (→ rake 10/9/8/7%). Stack medio ~313,7 ovunque.
const SPIN_050 = spinStructure(3368502, 5372497); // rake 10%
const SPIN_1_5 = spinStructure(3668502, 5072497); // rake 9%
const SPIN_10 = spinStructure(3968502, 4772497); // rake 8%
const SPIN_25_100 = spinStructure(4268502, 4472497); // rake 7%
const SPIN_200 = spinStructure(4274502, 4466497, 6000); // rake 7%, top 6000×

function tier(eur: number, structure: PayoutStructure): BuyinTier {
  return { eur, label: eurLabel(eur), structure };
}

// ---------------------------------------------------------------------------
// TWISTER (dati ufficiali Lottomatica/iPoker .it) — stack fisso (default 500).
// ---------------------------------------------------------------------------
const TWISTER_MULT = [1000, 100, 50, 25, 10, 5, 4, 3, 2] as const;
const TWISTER_STD_FREQ = [1, 5, 10, 50, 500, 1400, 7000, 14182, 26852] as const; // €1–€100, rake 7%
const TWISTER_200_FREQ = [2, 5, 15, 75, 750, 3650, 14615, 30889, 49999] as const; // €200, rake 6%

// Il premio si divide 75/15/10 quando il MONTEPREMI (mult × buy-in) supera una soglia €
// (ufficiali .it: €1>50 · €2>100 · €5>250 · €10>500 · €20/50/100/200>1000). Tradotto in
// moltiplicatore, un livello paga 3 posti se mult > splitAbove:
//   €1–€20 → mult>50 · €50 → mult>20 · €100 → mult>10 · €200 → mult>5.
function twisterStructure(
  freqBase: number,
  freqs: readonly number[],
  splitAbove: number,
): PayoutStructure {
  const levels: PayoutLevel[] = TWISTER_MULT.map((mult, i) => ({
    freq: freqs[i] ?? 0,
    mult,
    split: mult > splitAbove ? TWISTER_3WAY : WTA,
  }));
  return { players: 3, freqBase, levels };
}
const TWISTER_1_20 = twisterStructure(50_000, TWISTER_STD_FREQ, 50); // €1–€20
const TWISTER_50 = twisterStructure(50_000, TWISTER_STD_FREQ, 20); // €50
const TWISTER_100 = twisterStructure(50_000, TWISTER_STD_FREQ, 10); // €100
const TWISTER_200 = twisterStructure(100_000, TWISTER_200_FREQ, 5); // €200

function twisterTier(eur: number): BuyinTier {
  const structure =
    eur >= 200 ? TWISTER_200 : eur >= 100 ? TWISTER_100 : eur >= 50 ? TWISTER_50 : TWISTER_1_20;
  return { eur, label: eurLabel(eur), structure };
}

// ---------------------------------------------------------------------------
export const VARIANCE_FORMATS: readonly VarianceFormat[] = [
  {
    id: 'spin',
    label: 'Spin & Go',
    defaultEur: 10,
    buyins: [
      tier(0.5, SPIN_050),
      tier(1, SPIN_1_5),
      tier(2, SPIN_1_5),
      tier(5, SPIN_1_5),
      tier(10, SPIN_10),
      tier(25, SPIN_25_100),
      tier(50, SPIN_25_100),
      tier(100, SPIN_25_100),
      tier(200, SPIN_200),
    ],
  },
  {
    id: 'twister',
    label: 'Twister',
    defaultEur: 5,
    buyins: [
      twisterTier(1),
      twisterTier(2),
      twisterTier(5),
      twisterTier(10),
      twisterTier(20),
      twisterTier(50),
      twisterTier(100),
      twisterTier(200),
    ],
  },
];

export type FormatId = VarianceFormat['id'];
export const DEFAULT_FORMAT_ID: FormatId = 'spin';

/** Distribuzione piazzamenti di default: un reg vincente da ~+40 chip/game. */
export const DEFAULT_FINISH: readonly [number, number, number] = [36, 33, 31];

export function findFormat(id: string): VarianceFormat | undefined {
  return VARIANCE_FORMATS.find((f) => f.id === id);
}

/** Trova il buy-in del formato più vicino al valore €, per preservarlo al cambio formato. */
export function pickTier(format: VarianceFormat, eur: number): BuyinTier {
  let best = format.buyins[0];
  for (const t of format.buyins) {
    if (Math.abs(t.eur - eur) < Math.abs(best.eur - eur)) best = t;
  }
  return best;
}
