// Modello matematico: distribuzione combinata (montepremi × piazzamento), rake effettiva,
// e conversione EV-chip → win rate. Port fedele di SwongSim (swongForm.calcROI / buttonWinRate).

import type { PayoutStructure } from './types';

/** Stack di partenza di default nel modello chip-share di SwongSim. */
export const DEFAULT_START_STACK = 500;
/** Giocatori di default. */
export const DEFAULT_PLAYERS = 3;

/**
 * Modello "chip-share": la probabilità di arrivare 1° è la tua quota di chip attese.
 *   P(1°) = (stack + evChipsPerGame) / (giocatori × stack) × 100
 * A 0 chip di EV → 33,33% (baseline); a +40 chip/game → 36% (default dell'app).
 */
export function winRateFromChips(
  evChipsPerGame: number,
  startStack = DEFAULT_START_STACK,
  players = DEFAULT_PLAYERS,
): number {
  return ((startStack + evChipsPerGame) / (players * startStack)) * 100;
}

/** Inverso: dato il %1° ricava gli EV chip/game impliciti (usato per pre-riempire il dialog). */
export function chipsFromWinRate(
  pct1: number,
  startStack = DEFAULT_START_STACK,
  players = DEFAULT_PLAYERS,
): number {
  return (pct1 / 100) * (players * startStack) - startStack;
}

/**
 * Dato il %1° e i valori correnti di 2°/3°, distribuisce il rimanente (100 − %1°)
 * tra 2° e 3° in proporzione (come SwongSim). Ritorna [%1°, %2°, %3°] con somma 100.
 */
export function fillFinish(
  pct1: number,
  rel2: number,
  rel3: number,
): [number, number, number] {
  const rem = 100 - pct1;
  const denom = rel2 + rel3;
  if (denom <= 0) return [pct1, rem / 2, rem / 2];
  return [pct1, (rem * rel2) / denom, (rem * rel3) / denom];
}

/** Somma delle frequenze dei livelli (usata come base di normalizzazione). */
export function sumFreq(s: PayoutStructure): number {
  let f = 0;
  for (const l of s.levels) f += l.freq;
  return f;
}

/**
 * Stack iniziale medio (chips) pesato sulle frequenze dei moltiplicatori. Negli Spin & Go
 * lo stack varia (300/400/500) → la media reale è ~314, non 500. Usato per la conversione
 * chip↔buy-in (win% e modalità EV Chip). Default 500 per livello senza stack (es. Twister).
 */
export function weightedAvgStack(s: PayoutStructure): number {
  let num = 0;
  let den = 0;
  for (const l of s.levels) {
    num += l.freq * (l.stack ?? 500);
    den += l.freq;
  }
  return den > 0 ? num / den : 500;
}

/**
 * Rake effettiva:  (giocatori × freqBase − Σ freq·mult) / (giocatori × freqBase).
 * = 1 − (montepremi medio in buy-in) / giocatori. Es. Spin & Go $60/$100 → 5%.
 */
export function effectiveRake(s: PayoutStructure): number {
  let sumFM = 0;
  for (const l of s.levels) sumFM += l.freq * l.mult;
  const base = s.freqBase > 0 ? s.freqBase : sumFreq(s);
  if (base <= 0 || s.players <= 0) return 0;
  return (s.players * base - sumFM) / (s.players * base);
}

/** Distribuzione combinata pronta per il campionamento Monte Carlo. */
export interface CombinedDist {
  /** CDF cumulativa crescente (ultima ≈ 1), lunghezza = places. */
  readonly cdf: Float64Array;
  /** Premio (buy-in) di ciascun esito. */
  readonly prize: Float64Array;
  /** Probabilità di ciascun esito. */
  readonly probs: Float64Array;
  readonly places: number;
  /** EV per game al lordo di rakeback/bonus: Σ prob·prize − 1. */
  readonly evPerGame: number;
}

/**
 * Fonde i due eventi casuali (livello montepremi × piazzamento eroe) in un'unica
 * distribuzione discreta. Ogni esito (j,k): prob = finish[k]·freq_j/base, premio =
 * mult_j·split[j,k]. Compatta via gli esiti a probabilità o premio nullo (come SwongSim).
 */
export function buildCombined(
  s: PayoutStructure,
  finishPct: readonly [number, number, number],
): CombinedDist {
  const base = s.freqBase > 0 ? s.freqBase : sumFreq(s);
  const f = [finishPct[0] / 100, finishPct[1] / 100, finishPct[2] / 100];
  const probList: number[] = [];
  const prizeList: number[] = [];
  for (const lvl of s.levels) {
    for (let k = 0; k < 3; k++) {
      const prob = base > 0 ? f[k] * (lvl.freq / base) : 0;
      const payout = lvl.mult * (lvl.split[k] / 100);
      if (prob > 0 && payout > 0) {
        probList.push(prob);
        prizeList.push(payout);
      }
    }
  }
  const places = probList.length;
  const cdf = new Float64Array(places);
  const prize = Float64Array.from(prizeList);
  const probs = Float64Array.from(probList);
  let acc = 0;
  let ev = -1;
  for (let i = 0; i < places; i++) {
    acc += probs[i];
    cdf[i] = acc;
    ev += probs[i] * prize[i];
  }
  return { cdf, prize, probs, places, evPerGame: ev };
}
