import { runSimulation, DEFAULT_BANDS } from './sim-engine';
import { buildCombined } from './model';
import type { PayoutStructure, SimConfig } from './types';

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

function cfg(over: Partial<SimConfig> = {}): SimConfig {
  return {
    mode: 'money',
    numSims: 500,
    numGames: 500,
    seed: 12345,
    graphColumns: 200,
    sampleTrajectories: 20,
    bands: [...DEFAULT_BANDS],
    structure: REF_60_100,
    finish: [36, 33, 31],
    rakebackPct: 0,
    rakebackInterval: 1,
    bonusPerInterval: 0,
    bonusInterval: 1,
    chipsPerGame: 10,
    chipsStdDev: 50,
    ...over,
  };
}

describe('runSimulation — struttura output', () => {
  it('riempie tutte le colonne, bande e campioni', () => {
    const r = runSimulation(cfg());
    expect(r.columns.length).toBe(200);
    expect(r.columns[r.columns.length - 1]).toBe(500);
    expect(r.bands.length).toBe(DEFAULT_BANDS.length);
    for (const b of r.bands) {
      expect(b.values.length).toBe(200);
      expect(Number.isFinite(b.values[199])).toBeTrue();
    }
    expect(r.samples.length).toBe(20);
    expect(r.samples[0].length).toBe(200);
    expect(r.evLine[199]).toBeCloseTo(r.evPerGame * 500, 6);
  });

  it('gestisce i casi limite (1 sim, 1 game)', () => {
    const r = runSimulation(cfg({ numSims: 1, numGames: 1 }));
    expect(r.columns.length).toBe(1);
    expect(r.roi.length).toBeGreaterThan(0);
    expect(Number.isFinite(r.finalMean)).toBeTrue();
  });
});

describe('runSimulation — determinismo', () => {
  it('stesso seed → risultato identico', () => {
    const a = runSimulation(cfg({ seed: 777 }));
    const b = runSimulation(cfg({ seed: 777 }));
    expect(a.finalMean).toBe(b.finalMean);
    expect(a.finalStdDev).toBe(b.finalStdDev);
    expect(a.roi[8].value).toBe(b.roi[8].value);
    expect(a.bands[4].values[100]).toBe(b.bands[4].values[100]);
  });

  it('seed diversi → risultati diversi', () => {
    const a = runSimulation(cfg({ seed: 1 }));
    const b = runSimulation(cfg({ seed: 2 }));
    expect(a.finalMean).not.toBe(b.finalMean);
  });
});

describe('runSimulation — correttezza statistica', () => {
  it('EV/game analitico coincide con buildCombined (money)', () => {
    const r = runSimulation(cfg());
    expect(r.evPerGame).toBeCloseTo(buildCombined(REF_60_100, [36, 33, 31]).evPerGame, 9);
    expect(r.effectiveRake).toBeCloseTo(0.05, 9);
  });

  it('modalità chip: la media finale converge a chipsPerGame × numGames', () => {
    const r = runSimulation(
      cfg({ mode: 'chip', numSims: 3000, numGames: 1000, chipsPerGame: 10, chipsStdDev: 50 }),
    );
    // atteso 10000; SE ≈ 29 → tolleranza ampia ma stringente
    expect(r.finalMean).toBeGreaterThan(10000 - 150);
    expect(r.finalMean).toBeLessThan(10000 + 150);
    expect(r.evPerGame).toBe(10);
  });

  it('i percentili ROI sono monotoni crescenti', () => {
    const r = runSimulation(cfg({ numSims: 2000 }));
    for (let i = 1; i < r.roi.length; i++) {
      expect(r.roi[i].value).toBeGreaterThanOrEqual(r.roi[i - 1].value);
    }
  });

  it('drawdown ≥ 0 e punto minimo ≤ 0', () => {
    const r = runSimulation(cfg());
    for (const d of r.drawdown) expect(d.value).toBeGreaterThanOrEqual(0);
    for (const l of r.lowPoint) expect(l.value).toBeLessThanOrEqual(0);
  });

  it('il rakeback aumenta l\'EV per game', () => {
    const noRb = runSimulation(cfg({ rakebackPct: 0 })).evPerGame;
    const withRb = runSimulation(cfg({ rakebackPct: 50 })).evPerGame;
    expect(withRb).toBeGreaterThan(noRb);
  });
});

describe('runSimulation — rischio di rovina (bust chart)', () => {
  it('assente senza bankroll richiesti', () => {
    expect(runSimulation(cfg()).bust).toBeUndefined();
  });

  it('assente in modalità chip anche con bankroll richiesti', () => {
    expect(runSimulation(cfg({ mode: 'chip', bankrolls: [10, 50] })).bust).toBeUndefined();
  });

  it('curve cumulate non decrescenti, in [0,1], e bankroll più grande ≤ più piccolo', () => {
    const r = runSimulation(cfg({ bankrolls: [5, 20, 100], numGames: 2000, numSims: 800 }));
    const bust = r.bust!;
    expect(bust.bankrolls).toEqual([5, 20, 100]);
    expect(bust.curves.length).toBe(3);
    for (const c of bust.curves) {
      for (let i = 1; i < c.length; i++) {
        expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]); // cumulata
        expect(c[i]).toBeGreaterThanOrEqual(0);
        expect(c[i]).toBeLessThanOrEqual(1);
      }
    }
    // A ogni colonna: chi busta un bankroll grande ha già bustato quello piccolo → curva ≤.
    for (let i = 0; i < bust.curves[0].length; i++) {
      expect(bust.curves[1][i]).toBeLessThanOrEqual(bust.curves[0][i]);
      expect(bust.curves[2][i]).toBeLessThanOrEqual(bust.curves[1][i]);
    }
    for (let j = 0; j < 3; j++) {
      expect(bust.final[j]).toBe(bust.curves[j][bust.curves[j].length - 1]);
    }
  });

  it('bankroll minuscolo + edge negativo → bust quasi certo', () => {
    // finish sotto il break-even (33,33%): giocatore perdente.
    const r = runSimulation(
      cfg({ finish: [20, 40, 40], bankrolls: [3], numGames: 3000, numSims: 500 }),
    );
    expect(r.bust!.final[0]).toBeGreaterThan(0.8);
  });
});

describe('runSimulation — rakeback/bonus per intervallo (regressione)', () => {
  // Struttura a varianza NULLA: un solo esito, l'eroe arriva sempre 1° (prize 2, −1 = +1/game).
  // Così ogni traiettoria è identica e la media finale deve coincidere ESATTAMENTE con l'EV totale,
  // isolando la matematica di rakeback/bonus per intervallo.
  const DET: PayoutStructure = {
    players: 3,
    freqBase: 100,
    levels: [{ freq: 100, mult: 2, split: [100, 0, 0] }],
  };

  it('rakeback con intervallo non divisore: media finale = EV totale (no deflazione)', () => {
    const r = runSimulation(
      cfg({
        structure: DET,
        finish: [100, 0, 0],
        rakebackPct: 100,
        rakebackInterval: 7, // 100 non è multiplo di 7
        numGames: 100,
        numSims: 40,
      }),
    );
    expect(r.finalStdDev).toBeCloseTo(0, 6);
    expect(r.finalMean).toBeCloseTo(r.evTotal, 4);
  });

  it('bonus con intervallo non divisore: media finale = EV totale (no deflazione)', () => {
    const r = runSimulation(
      cfg({
        structure: DET,
        finish: [100, 0, 0],
        rakebackPct: 0,
        bonusPerInterval: 5,
        bonusInterval: 7,
        numGames: 100,
        numSims: 40,
      }),
    );
    expect(r.finalStdDev).toBeCloseTo(0, 6);
    expect(r.finalMean).toBeCloseTo(r.evTotal, 4);
  });
});
