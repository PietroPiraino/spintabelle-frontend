// Generatore pseudo-casuale seedabile (mulberry32) + gaussiana (metodo polare di Marsaglia).
// Riproduce il comportamento di RandomGaussian di SwongSim, ma deterministico dato un seed.

/** PRNG veloce e seedabile: ritorna una funzione che dà numeri in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Ritorna un campionatore gaussiano che consuma dallo stream `rand`.
 * Metodo polare di Marsaglia (identico a SwongSim.RandomGaussian).
 */
export function makeGaussian(rand: () => number): (mean: number, stdDev: number) => number {
  return function (mean: number, stdDev: number) {
    let u: number;
    let v: number;
    let s: number;
    do {
      u = 2 * rand() - 1;
      v = 2 * rand() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    s = Math.sqrt((-2 * Math.log(s)) / s);
    return mean + u * s * stdDev;
  };
}
