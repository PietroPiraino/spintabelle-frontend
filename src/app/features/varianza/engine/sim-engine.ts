// Motore Monte Carlo (port di SwongSim.simulate + calcROI). Loop "game-major": tiene solo
// i totali correnti per simulazione, quindi è O(numSims) in memoria invece dell'intera
// matrice numSims×numGames dell'originale. Deterministico dato il seed.

import { makeGaussian, mulberry32 } from './rng';
import { buildCombined, effectiveRake } from './model';
import type {
  BandLine,
  BustData,
  PercentileRow,
  SimConfig,
  SimResult,
} from './types';

/** Percentili riportati nelle statistiche testuali (come SwongSim). */
export const STAT_PERCENTILES = [
  0.001, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95,
  0.975, 0.99, 0.999,
] as const;

/** Bande percentili di default per l'inviluppo del grafico.
 * Scaletta "per-10%" (99/95/90/80/70/50/30/20/10/5/1) → asse destro come SwongSim. */
export const DEFAULT_BANDS = [
  0.01, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 0.99,
] as const;

/** Bankroll di default (in buy-in) per le curve di rischio di rovina. */
export const DEFAULT_BANKROLLS = [10, 20, 30, 50, 100, 200] as const;

function pIndex(p: number, n: number): number {
  return Math.min(n - 1, Math.max(0, Math.round(p * (n - 1))));
}

function percentiles(sorted: Float64Array, ps: readonly number[]): PercentileRow[] {
  const n = sorted.length;
  return ps.map((p) => ({ p, value: n > 0 ? sorted[pIndex(p, n)] : 0 }));
}

/**
 * Esegue la simulazione. `onProgress` (opzionale) riceve una frazione 0..1.
 */
export function runSimulation(
  cfg: SimConfig,
  onProgress?: (frac: number) => void,
): SimResult {
  const numSims = Math.max(1, cfg.numSims | 0);
  const numGames = Math.max(1, cfg.numGames | 0);
  const isMoney = cfg.mode === 'money';

  const rand = mulberry32(cfg.seed >>> 0);
  const gauss = makeGaussian(rand);

  // --- preparazione distribuzione / economia (solo money) ---
  let cdf: Float64Array = new Float64Array(0);
  let prize: Float64Array = new Float64Array(0);
  let places = 0;
  let evPre = 0;
  let effRake = 0;
  let rakebackPerInterval = 0;
  let bonusPerInterval = 0;
  let rakebackPerGame = 0;
  let bonusPerGame = 0;
  let rbInterval = 1;
  let bInterval = 1;

  if (isMoney) {
    const cd = buildCombined(cfg.structure, cfg.finish);
    cdf = cd.cdf;
    prize = cd.prize;
    places = cd.places;
    evPre = cd.evPerGame;
    effRake = effectiveRake(cfg.structure);

    rbInterval = Math.max(1, cfg.rakebackInterval | 0);
    const rbPct = cfg.rakebackPct / 100;
    const totalRakeback = effRake * rbPct * (Math.floor(numGames / rbInterval) * rbInterval);
    rakebackPerGame = totalRakeback / numGames; // media, per la linea EV
    // Importo pagato a ogni intervallo = rake maturata su un intervallo pieno. Così i Q
    // pagamenti sommano a totalRakeback e le traiettorie restano allineate alla linea EV
    // anche quando numGames non è multiplo dell'intervallo.
    rakebackPerInterval = effRake * rbPct * rbInterval;

    bInterval = Math.max(1, cfg.bonusInterval | 0);
    const totalBonus = cfg.bonusPerInterval * Math.floor(numGames / bInterval);
    bonusPerGame = totalBonus / numGames; // media, per la linea EV
    bonusPerInterval = cfg.bonusPerInterval; // importo configurato a ogni intervallo
  }

  const chipsMean = cfg.chipsPerGame;
  const chipsSd = cfg.chipsStdDev;
  const evPerGame = isMoney ? evPre + rakebackPerGame + bonusPerGame : chipsMean;
  const evTotal = evPerGame * numGames;

  // --- stato per simulazione ---
  const totals = new Float64Array(numSims);
  const peak = new Float64Array(numSims);
  const peakGame = new Int32Array(numSims);
  const maxDrop = new Float64Array(numSims);
  const lowest = new Float64Array(numSims);
  const beBest = new Float64Array(numSims);

  // --- rischio di rovina: prima partita in cui il totale scende sotto -B, per ogni bankroll ---
  // Bankroll ordinati crescenti: appena il totale rompe -B[k] rompe anche tutti i B[j<k].
  const bankrolls =
    isMoney && cfg.bankrolls?.length
      ? [...cfg.bankrolls].filter((b) => b > 0).sort((a, b) => a - b)
      : [];
  const mB = bankrolls.length;
  // bustGame[s*mB + j] = game del primo bust del bankroll j (0 = mai bustato).
  const bustGame = mB ? new Int32Array(numSims * mB) : new Int32Array(0);
  // bustPtr[s] = indice del più piccolo bankroll non ancora rotto (avanza in modo monotòno).
  const bustPtr = mB ? new Int32Array(numSims) : new Int32Array(0);

  // --- colonne x (mappate ai game) ---
  const cols = Math.min(Math.max(1, cfg.graphColumns | 0), numGames);
  const columns = new Int32Array(cols);
  for (let c = 0; c < cols; c++) {
    columns[c] = Math.max(1, Math.round(((c + 1) / cols) * numGames));
  }
  columns[cols - 1] = numGames;

  // --- traiettorie campione ---
  const nSamples = Math.min(Math.max(0, cfg.sampleTrajectories | 0), numSims);
  const sampleIdx = new Int32Array(nSamples);
  for (let i = 0; i < nSamples; i++) {
    sampleIdx[i] = Math.floor((i * numSims) / Math.max(1, nSamples));
  }
  const samples: Float32Array[] = [];
  for (let i = 0; i < nSamples; i++) samples.push(new Float32Array(cols));

  // --- bande percentili ---
  const bandPs = cfg.bands.length ? cfg.bands : DEFAULT_BANDS;
  const bands: BandLine[] = bandPs.map((p) => ({ p, values: new Float64Array(cols) }));
  const sortBuf = new Float64Array(numSims);

  let yMin = 0;
  let yMax = 0;
  let colPtr = 0;
  const progressEvery = Math.max(1, Math.floor(numGames / 100));

  // --- loop principale (game-major) ---
  for (let g = 1; g <= numGames; g++) {
    let det = 0;
    if (isMoney) {
      if (g % rbInterval === 0) det += rakebackPerInterval;
      if (g % bInterval === 0) det += bonusPerInterval;
    }

    for (let s = 0; s < numSims; s++) {
      let w = totals[s];
      if (isMoney) {
        w += det;
        const u = rand();
        // primo esito con cdf >= u (scan lineare: places è piccolo, ≤ ~14)
        for (let i = 0; i < places; i++) {
          if (cdf[i] >= u) {
            w += prize[i];
            break;
          }
        }
        w -= 1;
      } else {
        w += gauss(chipsMean, chipsSd);
      }
      totals[s] = w;

      // tracker: picco, downswing massimo, break-even, punto minimo
      if (w > peak[s]) {
        peak[s] = w;
        peakGame[s] = g;
      } else {
        const d = peak[s] - w;
        if (d > maxDrop[s]) maxDrop[s] = d;
        const be = g - peakGame[s];
        if (be > beBest[s]) beBest[s] = be;
      }
      if (w < lowest[s]) {
        lowest[s] = w;
        // Nuovo minimo → potrebbe rompere uno o più bankroll (in ordine crescente).
        if (mB) {
          let bp = bustPtr[s];
          const base = s * mB;
          while (bp < mB && w < -bankrolls[bp]) {
            bustGame[base + bp] = g;
            bp++;
          }
          bustPtr[s] = bp;
        }
      }
      if (w < yMin) yMin = w;
      else if (w > yMax) yMax = w;
    }

    // snapshot colonne x (una sola ordinata per game che ne attiva almeno una)
    if (colPtr < cols && columns[colPtr] <= g) {
      sortBuf.set(totals);
      sortBuf.sort();
      while (colPtr < cols && columns[colPtr] <= g) {
        const c = colPtr;
        for (const b of bands) b.values[c] = sortBuf[pIndex(b.p, numSims)];
        for (let si = 0; si < nSamples; si++) samples[si][c] = totals[sampleIdx[si]];
        colPtr++;
      }
    }

    if (onProgress && g % progressEvery === 0) onProgress(g / numGames);
  }

  // --- linea EV di riferimento ---
  const evLine = new Float64Array(cols);
  for (let c = 0; c < cols; c++) evLine[c] = evPerGame * columns[c];
  if (evTotal > yMax) yMax = evTotal;
  if (evTotal < yMin) yMin = evTotal;

  // --- statistiche finali ---
  let sum = 0;
  for (let s = 0; s < numSims; s++) sum += totals[s];
  const mean = sum / numSims;
  let ss = 0;
  for (let s = 0; s < numSims; s++) {
    const d = totals[s] - mean;
    ss += d * d;
  }
  const variance = numSims > 1 ? ss / (numSims - 1) : 0;
  const stdDev = Math.sqrt(variance);

  const finalSorted = Float64Array.from(totals).sort();
  const dropSorted = Float64Array.from(maxDrop).sort();
  const lowSorted = Float64Array.from(lowest).sort();
  const beSorted = Float64Array.from(beBest).sort();

  // --- curve di rischio di rovina: istogramma dei bust per colonna → cumulata / numSims ---
  let bust: BustData | undefined;
  if (mB) {
    const curves: Float64Array[] = [];
    const final: number[] = [];
    for (let j = 0; j < mB; j++) {
      const counts = new Float64Array(cols);
      for (let s = 0; s < numSims; s++) {
        const gB = bustGame[s * mB + j];
        if (gB > 0) {
          const c = firstColumnAtOrAfter(columns, gB); // prima colonna che copre il bust
          if (c < cols) counts[c] += 1;
        }
      }
      const curve = new Float64Array(cols);
      let acc = 0;
      for (let c = 0; c < cols; c++) {
        acc += counts[c];
        curve[c] = acc / numSims;
      }
      curves.push(curve);
      final.push(curve[cols - 1]);
    }
    bust = { bankrolls, curves, final };
  }

  if (onProgress) onProgress(1);

  return {
    mode: cfg.mode,
    numSims,
    numGames,
    evPerGame,
    evTotal,
    effectiveRake: effRake,
    places,
    columns,
    bands,
    evLine,
    samples,
    yMin,
    yMax,
    finalMean: mean,
    finalStdDev: stdDev,
    roi: percentiles(finalSorted, STAT_PERCENTILES),
    drawdown: percentiles(dropSorted, STAT_PERCENTILES),
    lowPoint: percentiles(lowSorted, STAT_PERCENTILES),
    breakeven: percentiles(beSorted, STAT_PERCENTILES),
    bust,
  };
}

/** Indice della prima colonna il cui game è ≥ target (ricerca binaria su columns crescente). */
function firstColumnAtOrAfter(columns: Int32Array, target: number): number {
  let lo = 0;
  let hi = columns.length - 1;
  let res = columns.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (columns[mid] >= target) {
      res = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return res;
}
