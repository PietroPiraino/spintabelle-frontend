// Tipi del motore di simulazione della varianza (port di SwongSim).
// Tutto in "buy-in" come unità: 1 game costa 1 buy-in, i premi sono multipli del buy-in.

export type SimMode = 'money' | 'chip';

/** Un livello del montepremi lottery: quanto è frequente, quanto paga, come si divide. */
export interface PayoutLevel {
  /** Peso di frequenza (relativo a freqBase). */
  readonly freq: number;
  /** Montepremi del livello, espresso in buy-in (es. 2, 4, 6 … 12000). */
  readonly mult: number;
  /** Divisione del montepremi tra 1°/2°/3° in percentuale (somma 100). */
  readonly split: readonly [number, number, number];
  /** Stack iniziale in chips per questo moltiplicatore (default 500 se assente). */
  readonly stack?: number;
}

/** Struttura payout completa di un formato lottery SNG. */
export interface PayoutStructure {
  /** Giocatori al tavolo (di norma 3 negli Spin & Go / Twister). */
  readonly players: number;
  /**
   * Base di frequenza: le probabilità di livello sono freq/freqBase.
   * Se 0 o incoerente, il motore normalizza su Σfreq (comportamento corretto).
   */
  readonly freqBase: number;
  readonly levels: readonly PayoutLevel[];
}

/** Preset pronto per il selettore (nomi generici, dati reali). */
export interface VariancePreset {
  readonly id: string;
  readonly label: string;
  readonly kind: 'spin' | 'twister';
  /** Nota buy-in mostrata in UI (es. "€10"). */
  readonly buyinNote: string;
  readonly structure: PayoutStructure;
}

/** Configurazione di una simulazione. */
export interface SimConfig {
  readonly mode: SimMode;
  readonly numSims: number;
  readonly numGames: number;
  readonly seed: number;

  /** Risoluzione orizzontale (colonne x) per bande percentili e linee campione. */
  readonly graphColumns: number;
  /** Quante traiettorie grezze conservare per il disegno delle linee tenui. */
  readonly sampleTrajectories: number;
  /** Percentili (0..1) da calcolare per l'inviluppo del grafico. */
  readonly bands: readonly number[];
  /** Bankroll (in buy-in) per le curve di rischio di rovina. Vuoto/assente = niente bust chart. */
  readonly bankrolls?: readonly number[];

  // --- modalità money ---
  readonly structure: PayoutStructure;
  /** Distribuzione dei piazzamenti dell'eroe: [%1°, %2°, %3°] (somma 100). */
  readonly finish: readonly [number, number, number];
  /** Rakeback in % della rake pagata. */
  readonly rakebackPct: number;
  readonly rakebackInterval: number;
  /** Bonus/award in buy-in erogato ogni bonusInterval game. */
  readonly bonusPerInterval: number;
  readonly bonusInterval: number;

  // --- modalità chip (EV Chip) ---
  readonly chipsPerGame: number;
  readonly chipsStdDev: number;
}

/** Una riga percentile (valore in buy-in). */
export interface PercentileRow {
  readonly p: number;
  readonly value: number;
}

/** Curve di rischio di rovina: per ogni bankroll, % cumulata di sim andate in bust. */
export interface BustData {
  /** Bankroll considerati, in buy-in (ordinati crescenti). */
  readonly bankrolls: readonly number[];
  /** Una curva per bankroll: frazione (0..1) di sim bustate entro columns[c]. */
  readonly curves: readonly Float64Array[];
  /** Frazione bustata a fine volume, per bankroll (= curva all'ultima colonna). */
  readonly final: readonly number[];
}

/** Una linea di inviluppo (un percentile lungo le colonne x). */
export interface BandLine {
  readonly p: number;
  readonly values: Float64Array;
}

/** Risultato completo di una simulazione. */
export interface SimResult {
  readonly mode: SimMode;
  readonly numSims: number;
  readonly numGames: number;

  /** EV per game (money: include rakeback+bonus; chip: = chipsPerGame). */
  readonly evPerGame: number;
  readonly evTotal: number;
  /** Rake effettiva (frazione 0..1), solo money. */
  readonly effectiveRake: number;
  /** Numero di esiti combinati (livello × piazzamento) effettivamente possibili. */
  readonly places: number;

  /** Indice di game per ogni colonna x. */
  readonly columns: Int32Array;
  readonly bands: readonly BandLine[];
  /** Linea EV di riferimento per colonna. */
  readonly evLine: Float64Array;
  /** Traiettorie campione (una Float32Array per linea, lunghezza = colonne). */
  readonly samples: readonly Float32Array[];

  readonly yMin: number;
  readonly yMax: number;

  readonly finalMean: number;
  readonly finalStdDev: number;
  /** Percentili del risultato finale (buy-in). */
  readonly roi: readonly PercentileRow[];
  /** Percentili del massimo downswing (buy-in). */
  readonly drawdown: readonly PercentileRow[];
  /** Percentili del punto più basso raggiunto (buy-in). */
  readonly lowPoint: readonly PercentileRow[];
  /** Percentili della più lunga fase di break-even (in game). */
  readonly breakeven: readonly PercentileRow[];

  /** Curve di rischio di rovina (solo money + bankrolls richiesti). */
  readonly bust?: BustData;
}
