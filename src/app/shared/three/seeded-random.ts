/**
 * PRNG deterministico (mulberry32): gli elementi "sparsi" dei diorami
 * (ciocche, granelli, fasi di pesci/bolle/scintille) devono essere identici
 * ad ogni mount — mai Math.random() a runtime (vincolo C-G8 della direzione
 * artistica: il diorama è "disegnato a mano, sempre uguale").
 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** N valori deterministici in [min, max) — comodo per array di fasi. */
export function seededRange(seed: number, count: number, min: number, max: number): number[] {
  const rand = seededRandom(seed);
  return Array.from({ length: count }, () => min + rand() * (max - min));
}
