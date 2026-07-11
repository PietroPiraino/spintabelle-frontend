import {
  buildCombined,
  chipsFromWinRate,
  effectiveRake,
  fillFinish,
  weightedAvgStack,
  winRateFromChips,
} from './model';
import { VARIANCE_FORMATS, findFormat, pickTier } from './presets';
import type { PayoutStructure } from './types';

// Struttura di riferimento "$60/$100" dell'app originale (per validare i numeri esatti).
const REF_60_100: PayoutStructure = {
  players: 3,
  freqBase: 1_000_000,
  levels: [
    { freq: 1, mult: 12000, split: [83.333, 8.333, 8.333] },
    { freq: 30, mult: 240, split: [83.333, 8.333, 8.333] },
    { freq: 75, mult: 120, split: [83.333, 8.333, 8.333] },
    { freq: 1000, mult: 25, split: [100, 0, 0] },
    { freq: 5000, mult: 10, split: [100, 0, 0] },
    { freq: 75000, mult: 6, split: [100, 0, 0] },
    { freq: 229506, mult: 4, split: [100, 0, 0] },
    { freq: 689388, mult: 2, split: [100, 0, 0] },
  ],
};

describe('modello chip-share', () => {
  it('0 EV chip → 33,33% (baseline a 3 giocatori)', () => {
    expect(winRateFromChips(0)).toBeCloseTo(33.3333, 3);
  });

  it('+40 EV chip/game → 36% (default dell\'app)', () => {
    expect(winRateFromChips(40)).toBeCloseTo(36, 6);
  });

  it('chipsFromWinRate è l\'inverso di winRateFromChips', () => {
    expect(chipsFromWinRate(36)).toBeCloseTo(40, 6);
    expect(chipsFromWinRate(winRateFromChips(123))).toBeCloseTo(123, 6);
  });

  it('fillFinish distribuisce il resto tra 2° e 3° in proporzione', () => {
    const [a, b, c] = fillFinish(36, 33, 31);
    expect(a).toBe(36);
    expect(a + b + c).toBeCloseTo(100, 6);
    expect(b).toBeCloseTo(33, 6);
    expect(c).toBeCloseTo(31, 6);
  });
});

describe('effectiveRake', () => {
  it('la struttura $60/$100 dà esattamente il 5% (match con l\'app)', () => {
    expect(effectiveRake(REF_60_100)).toBeCloseTo(0.05, 9);
  });

  it('Twister: €1–€100 = 7%, €200 = 6% (dati ufficiali .it)', () => {
    const tw = findFormat('twister')!;
    for (const t of tw.buyins) {
      const expected = t.eur >= 200 ? 0.06 : 0.07;
      expect(effectiveRake(t.structure)).toBeCloseTo(expected, 6);
    }
  });

  it('Spin & Go: rake ufficiali pokerstars.it (10/9/8/7% per fascia)', () => {
    const rakeByEur: Record<number, number> = {
      0.5: 0.1, 1: 0.09, 2: 0.09, 5: 0.09, 10: 0.08, 25: 0.07, 50: 0.07, 100: 0.07, 200: 0.07,
    };
    for (const t of findFormat('spin')!.buyins) {
      expect(effectiveRake(t.structure)).toBeCloseTo(rakeByEur[t.eur], 6);
    }
  });
});

describe('weightedAvgStack', () => {
  it('Spin & Go: stack medio pesato ≈ 313,7 chips (stack variabili 300/400/500)', () => {
    for (const t of findFormat('spin')!.buyins) {
      expect(weightedAvgStack(t.structure)).toBeCloseTo(313.68, 1);
    }
  });

  it('Twister: stack medio = 500 (default, nessuno stack per livello)', () => {
    for (const t of findFormat('twister')!.buyins) {
      expect(weightedAvgStack(t.structure)).toBe(500);
    }
  });
});

describe('buildCombined', () => {
  it('EV/game per $60/$100 con finish 36/33/31 = +2,58% (match con l\'app: 258 buyin/10000)', () => {
    const cd = buildCombined(REF_60_100, [36, 33, 31]);
    expect(cd.evPerGame).toBeCloseTo(0.0258, 3);
  });

  it('la CDF copre solo gli esiti a premio: Σprob = ITM (match app: 36,006784%)', () => {
    // Gli esiti non a premio (2°/3° nei livelli winner-take-all) sono scartati:
    // la CDF arriva alla probabilità di andare a premio, non a 1.
    const cd = buildCombined(REF_60_100, [36, 33, 31]);
    let sum = 0;
    for (let i = 0; i < cd.places; i++) sum += cd.probs[i];
    expect(sum).toBeCloseTo(0.36006784, 7);
    expect(cd.cdf[cd.places - 1]).toBeCloseTo(sum, 9);
  });

  it('$60/$100 produce 14 esiti (3 spin jackpot ×3 posti + 5 WTA)', () => {
    expect(buildCombined(REF_60_100, [36, 33, 31]).places).toBe(14);
  });

  it('un edge maggiore (più chip) aumenta l\'EV', () => {
    const base = buildCombined(REF_60_100, [33.333, 33.333, 33.333]).evPerGame;
    const edge = buildCombined(REF_60_100, [40, 30, 30]).evPerGame;
    expect(edge).toBeGreaterThan(base);
  });
});

describe('Twister — split montepremi 75/15/10 (soglia per buy-in)', () => {
  const tw = findFormat('twister')!;
  const threeWayMults = (eur: number): number[] =>
    pickTier(tw, eur)
      .structure.levels.filter((l) => l.split[1] > 0)
      .map((l) => l.mult)
      .sort((a, b) => a - b);

  it('i livelli a 3 posti dipendono dal buy-in (montepremi > soglia €)', () => {
    expect(threeWayMults(1)).toEqual([100, 1000]);
    expect(threeWayMults(20)).toEqual([100, 1000]);
    expect(threeWayMults(50)).toEqual([25, 50, 100, 1000]);
    expect(threeWayMults(100)).toEqual([25, 50, 100, 1000]);
    expect(threeWayMults(200)).toEqual([10, 25, 50, 100, 1000]);
  });

  it('lo split a 3 posti è 75/15/10, il resto winner-take-all', () => {
    const lv = pickTier(tw, 5).structure.levels;
    expect([...lv.find((l) => l.mult === 1000)!.split]).toEqual([75, 15, 10]);
    expect([...lv.find((l) => l.mult === 2)!.split]).toEqual([100, 0, 0]);
  });
});

describe('formati', () => {
  it('ogni struttura ha freqBase = Σfreq (nessun bug di normalizzazione)', () => {
    for (const f of VARIANCE_FORMATS) {
      for (const t of f.buyins) {
        const sum = t.structure.levels.reduce((a, l) => a + l.freq, 0);
        expect(sum).toBe(t.structure.freqBase);
      }
    }
  });

  it('findFormat + pickTier (buy-in più vicino)', () => {
    const tw = findFormat('twister')!;
    expect(tw.label).toBe('Twister');
    expect(pickTier(tw, 200).eur).toBe(200);
    expect(pickTier(tw, 7).eur).toBe(5);
    expect(findFormat('inesistente')).toBeUndefined();
  });
});
