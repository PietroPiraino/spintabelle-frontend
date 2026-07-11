import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  VarianzaGraphComponent,
  type GraphUnit,
} from './varianza-graph/varianza-graph.component';
import { VarianzaBustChartComponent } from './varianza-bust-chart/varianza-bust-chart.component';
import {
  SubscribeModelComponent,
  type SubscribeModelSpec,
} from '../subscribe/subscribe-model/subscribe-model.component';
import { VarianzaRunner } from './engine/varianza-runner';
import {
  buildCombined,
  effectiveRake,
  fillFinish,
  weightedAvgStack,
  winRateFromChips,
} from './engine/model';
import {
  DEFAULT_FINISH,
  DEFAULT_FORMAT_ID,
  VARIANCE_FORMATS,
  findFormat,
  pickTier,
  type FormatId,
} from './engine/presets';
import { DEFAULT_BANDS, DEFAULT_BANKROLLS } from './engine/sim-engine';
import type { PercentileRow, SimConfig, SimResult, SimMode } from './engine/types';

const MAX_SIMS = 5000;
const MAX_GAMES = 1_000_000;

@Component({
  selector: 'app-varianza',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [VarianzaGraphComponent, VarianzaBustChartComponent, SubscribeModelComponent],
  providers: [VarianzaRunner],
  templateUrl: './varianza.component.html',
  styleUrl: './varianza.component.scss',
})
export class VarianzaComponent {
  private readonly runner = inject(VarianzaRunner);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly formats = VARIANCE_FORMATS;
  protected readonly maxSims = MAX_SIMS;
  protected readonly maxGames = MAX_GAMES;
  /** Percentili mostrati nella tabella di distribuzione. */
  protected readonly distPercentiles = [0.99, 0.95, 0.9, 0.7, 0.5, 0.3, 0.1, 0.05, 0.01];
  /** Mascotte 3D (polpo) mostrata nell'empty-state. */
  protected readonly octopusSpec: SubscribeModelSpec = {
    url: '/models/octopus.glb',
    alt: 'Polpo, mascotte del simulatore di varianza',
    accent: 0xff6a1f,
    baseRotation: [0, -1.4, 0], // volto verso l'utente
    tint: { match: 'Scene', color: 0xff7a3a }, // virato corallo in stile BFF
    scale: 0.72, // margine nel riquadro: niente taglio su mobile + alone visibile
  };

  // --- stato del form ---
  protected readonly formatId = signal<FormatId>(DEFAULT_FORMAT_ID);
  protected readonly mode = signal<SimMode>('money');
  protected readonly numSims = signal(1000);
  protected readonly numGames = signal(5000);
  /** Edge dell'eroe in chip EV per partita (guida la % di vittoria). */
  protected readonly evChips = signal(40);
  /** Modalità distribuzione piazzamenti: da chip o manuale. */
  protected readonly finishMode = signal<'chips' | 'manual'>('chips');
  protected readonly manualFinish = signal<[number, number, number]>([...DEFAULT_FINISH]);
  protected readonly rakebackPct = signal(0);
  protected readonly buyinEur = signal(10);
  protected readonly showSamples = signal(true);
  // Deviazione standard per la modalità EV Chip (la media è l'edge globale evChips).
  protected readonly chipsStdDev = signal(540);
  /** Bankroll evidenziato nella bust chart (buy-in); dev'essere uno di bankrollOptions. */
  protected readonly bankrollOptions = DEFAULT_BANKROLLS;
  protected readonly selectedBankroll = signal<number>(30);

  // --- stato run ---
  protected readonly running = signal(false);
  protected readonly progress = signal(0);
  protected readonly error = signal<string | null>(null);
  // Ogni modalità ha il suo grafico: risultati separati per soldi ed EV chip, così passando
  // da una modalità all'altra non si vede (o si "storpia") il grafico dell'altra.
  private readonly moneyResult = signal<SimResult | null>(null);
  private readonly chipResult = signal<SimResult | null>(null);
  protected readonly result = computed(() =>
    this.mode() === 'chip' ? this.chipResult() : this.moneyResult(),
  );

  // --- derivati / anteprima live ---
  protected readonly format = computed(() => findFormat(this.formatId()) ?? this.formats[0]);
  protected readonly tier = computed(() => pickTier(this.format(), this.buyinEur()));
  protected readonly structure = computed(() => this.tier().structure);
  /** Stack medio pesato (chips): base per la conversione chip↔buy-in di QUESTA struttura. */
  protected readonly avgStack = computed(() => weightedAvgStack(this.structure()));

  /** [%1°, %2°, %3°] risolti dalla modalità scelta. */
  protected readonly finish = computed<[number, number, number]>(() => {
    if (this.finishMode() === 'manual') {
      const [a, b, c] = this.manualFinish();
      const s = a + b + c;
      return s > 0 ? [(a / s) * 100, (b / s) * 100, (c / s) * 100] : [...DEFAULT_FINISH];
    }
    const [, b0, c0] = DEFAULT_FINISH;
    // Win% dallo stack medio REALE (Spin&Go ~314, non 500). Clamp [1%,95%] anti-degenerazione.
    const wr = Math.min(95, Math.max(1, winRateFromChips(this.evChips(), this.avgStack())));
    return fillFinish(wr, b0, c0);
  });

  protected readonly winRatePct = computed(() => this.finish()[0]);
  protected readonly effectiveRakePct = computed(() => effectiveRake(this.structure()) * 100);

  private readonly combined = computed(() => buildCombined(this.structure(), this.finish()));
  /** ITM = probabilità di andare a premio (somma delle prob degli esiti pagati). */
  protected readonly itmPct = computed(() => {
    const c = this.combined();
    let s = 0;
    for (let i = 0; i < c.places; i++) s += c.probs[i];
    return s * 100;
  });

  /** EV per partita al netto di rakeback (in buy-in), anteprima. */
  protected readonly evPerGamePreview = computed(() => {
    if (this.mode() === 'chip') return this.evChips();
    const rakebackPerGame = effectiveRake(this.structure()) * (this.rakebackPct() / 100);
    return this.combined().evPerGame + rakebackPerGame;
  });
  protected readonly roiPreviewPct = computed(() =>
    this.mode() === 'chip' ? NaN : this.evPerGamePreview() * 100,
  );
  /** Unità dei risultati: buy-in (soldi reali) o chip (EV Chip mode). */
  protected readonly unit = computed(() => (this.mode() === 'chip' ? 'chip' : 'buy-in'));

  /** Curve di rischio di rovina della simulazione corrente (solo modalità soldi). */
  protected readonly bustData = computed(() =>
    this.mode() === 'money' ? (this.result()?.bust ?? null) : null,
  );
  /** % di rischio di rovina del bankroll selezionato, a fine volume. */
  protected readonly bustPct = computed(() => {
    const b = this.bustData();
    if (!b) return NaN;
    const idx = b.bankrolls.indexOf(this.selectedBankroll());
    return (b.final[idx >= 0 ? idx : 0] ?? 0) * 100;
  });
  /** Valore arrotondato mostrato: usato per i colori tier così combaciano col numero a video. */
  protected readonly bustPctRounded = computed(() => {
    const v = this.bustPct();
    return Number.isFinite(v) ? Number(v.toFixed(1)) : v;
  });

  /** Unità del grafico (selezionabile solo in EV Chip mode). */
  protected readonly graphUnit = signal<GraphUnit>('total');
  protected readonly graphUnitOptions = computed<{ v: GraphUnit; l: string }[]>(() =>
    this.mode() === 'chip'
      ? [
          { v: 'perGame', l: 'Chip/partita' },
          { v: 'total', l: 'Chip totali' },
          { v: 'buyin', l: 'Buy-in' },
        ]
      : [],
  );

  /** ROI money pre/post rakeback (%) + guadagno atteso in € sul volume impostato. */
  protected readonly roiPrePct = computed(() => this.combined().evPerGame * 100);
  protected readonly roiPostPct = computed(() => this.evPerGamePreview() * 100);
  protected readonly eurPre = computed(
    () => this.combined().evPerGame * this.numGames() * this.buyinEur(),
  );
  protected readonly eurPost = computed(
    () => this.evPerGamePreview() * this.numGames() * this.buyinEur(),
  );

  /** Seed letto dall'URL: usato una sola volta al primo run per riprodurre un link condiviso. */
  private pendingSeed: number | null = null;

  constructor() {
    this.hydrateFromUrl();
  }

  // --- azioni UI ---
  protected setFormat(id: FormatId): void {
    if (this.formatId() === id) return;
    this.formatId.set(id);
    const f = findFormat(id);
    if (f) this.buyinEur.set(pickTier(f, this.buyinEur()).eur);
  }
  protected setBuyin(eur: string): void {
    const n = Number(eur);
    if (Number.isFinite(n)) this.buyinEur.set(n);
  }
  protected setMode(m: SimMode): void {
    if (m === 'chip') this.finishMode.set('chips'); // le % manuali valgono solo per i soldi
    this.graphUnit.set(m === 'chip' ? 'perGame' : 'total');
    this.error.set(null);
    this.mode.set(m);
  }
  protected setGraphUnit(u: GraphUnit): void {
    this.graphUnit.set(u);
  }
  protected setBankroll(v: string): void {
    const n = Number(v);
    if (Number.isFinite(n)) this.selectedBankroll.set(n);
  }
  protected onNum(sig: WritableSignal<number>, value: string, min: number, max: number): void {
    const n = Number(value);
    if (Number.isFinite(n)) sig.set(Math.min(max, Math.max(min, n)));
  }

  // Slider "Partite" LOGARITMICO: le fasce comuni (1-2k, 10-15k) hanno più corsa,
  // il long-term 200k+ resta compresso in coda.
  private readonly GAMES_MIN = 100;
  /** Partite → posizione slider [0,1000]. */
  protected gamesSliderPos(games: number): number {
    const g = Math.min(MAX_GAMES, Math.max(this.GAMES_MIN, games));
    return Math.round((1000 * Math.log(g / this.GAMES_MIN)) / Math.log(MAX_GAMES / this.GAMES_MIN));
  }
  /** Posizione slider [0,1000] → partite, arrotondate a un valore tondo per la magnitudine. */
  protected onGamesSlider(value: string): void {
    const pos = Math.min(1000, Math.max(0, Number(value)));
    if (!Number.isFinite(pos)) return;
    const raw = this.GAMES_MIN * Math.pow(MAX_GAMES / this.GAMES_MIN, pos / 1000);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.max(1, mag / 10);
    this.numGames.set(Math.min(MAX_GAMES, Math.max(this.GAMES_MIN, Math.round(raw / step) * step)));
  }
  protected setManualFinish(i: number, value: string): void {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const cur = [...this.manualFinish()] as [number, number, number];
    cur[i] = Math.max(0, n);
    this.manualFinish.set(cur);
  }
  protected toggleSamples(): void {
    this.showSamples.update((v) => !v);
  }

  protected async run(): Promise<void> {
    if (this.running()) return;
    this.error.set(null);
    this.running.set(true);
    this.progress.set(0);
    const seed = this.pendingSeed ?? ((Math.floor(Math.random() * 0xffffffff) >>> 0) || 1);
    this.pendingSeed = null;
    const cfg = this.buildConfig(seed);
    this.syncUrl(seed);
    try {
      const res = await this.runner.run(cfg, (f) => this.progress.set(f));
      if (cfg.mode === 'chip') this.chipResult.set(res);
      else this.moneyResult.set(res);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Errore durante la simulazione.');
    } finally {
      this.running.set(false);
    }
  }

  private buildConfig(seed: number): SimConfig {
    const numGames = Math.min(MAX_GAMES, Math.max(1, this.numGames()));
    const numSims = Math.min(MAX_SIMS, Math.max(1, this.numSims()));
    return {
      mode: this.mode(),
      numSims,
      numGames,
      seed,
      graphColumns: Math.min(1280, numGames),
      sampleTrajectories: this.showSamples() ? Math.min(150, numSims) : 0,
      bands: [...DEFAULT_BANDS],
      bankrolls: [...DEFAULT_BANKROLLS],
      structure: this.structure(),
      finish: this.finish(),
      rakebackPct: this.rakebackPct(),
      rakebackInterval: 1,
      bonusPerInterval: 0,
      bonusInterval: 1,
      chipsPerGame: this.evChips(),
      chipsStdDev: this.chipsStdDev(),
    };
  }

  // --- statistiche (formattazione) ---
  private pick(rows: readonly PercentileRow[], p: number): number {
    let best = rows[0];
    for (const r of rows) if (Math.abs(r.p - p) < Math.abs(best.p - p)) best = r;
    return best?.value ?? 0;
  }

  protected buyinsAt(rows: readonly PercentileRow[] | undefined, p: number): number {
    if (!rows) return 0;
    return this.pick(rows, p);
  }

  protected readonly fmtInt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  protected fmtBuyins(v: number): string {
    return this.fmtInt.format(Math.round(v));
  }
  protected fmtPct(v: number, dec = 2): string {
    if (!Number.isFinite(v)) return '—';
    return `${v.toFixed(dec).replace('.', ',')}%`;
  }
  protected fmtSignedPct(v: number, dec = 2): string {
    if (!Number.isFinite(v)) return '—';
    const s = v < 0 ? '−' : '+';
    return `${s}${Math.abs(v).toFixed(dec).replace('.', ',')}%`;
  }
  protected fmtEur(buyins: number): string {
    const be = this.buyinEur();
    if (!be) return '';
    return `${buyins * be < 0 ? '−' : ''}€${this.fmtInt.format(Math.abs(Math.round(buyins * be)))}`;
  }
  protected fmtEurSigned(v: number): string {
    if (!this.buyinEur()) return '';
    return `${v < 0 ? '−' : '+'}€${this.fmtInt.format(Math.abs(Math.round(v)))}`;
  }

  // --- sincronizzazione URL (link condivisibili + riproducibilità via seed) ---
  private hydrateFromUrl(): void {
    const q = this.route.snapshot.queryParamMap;
    const fmt = q.get('formato');
    if (fmt && findFormat(fmt)) this.formatId.set(fmt as FormatId);
    const buyin = Number(q.get('buyin'));
    if (q.get('buyin') !== null && Number.isFinite(buyin) && buyin > 0) this.buyinEur.set(buyin);
    const f0 = findFormat(this.formatId());
    if (f0) this.buyinEur.set(pickTier(f0, this.buyinEur()).eur);
    const m = q.get('modalita');
    if (m === 'chip' || m === 'money') this.mode.set(m);
    this.graphUnit.set(this.mode() === 'chip' ? 'perGame' : 'total');
    const num = (key: string, sig: WritableSignal<number>, min: number, max: number) => {
      const v = Number(q.get(key));
      if (Number.isFinite(v) && v !== 0) sig.set(Math.min(max, Math.max(min, v)));
    };
    num('sim', this.numSims, 1, MAX_SIMS);
    num('games', this.numGames, 1, MAX_GAMES);
    const edge = q.get('edge');
    if (edge !== null && Number.isFinite(Number(edge))) {
      this.evChips.set(Math.min(5000, Math.max(-1000, Number(edge))));
    }
    num('rb', this.rakebackPct, 0, 100);
    const chipsSd = q.get('chipsSd');
    if (chipsSd !== null && Number.isFinite(Number(chipsSd))) {
      this.chipsStdDev.set(Math.min(100_000, Math.max(1, Number(chipsSd))));
    }
    const bk = Number(q.get('bankroll'));
    if (Number.isFinite(bk) && (DEFAULT_BANKROLLS as readonly number[]).includes(bk)) {
      this.selectedBankroll.set(bk);
    }
    const seed = q.get('seed');
    if (seed !== null && Number.isFinite(Number(seed)) && Number(seed) > 0) {
      this.pendingSeed = Number(seed) >>> 0;
    }
  }

  private syncUrl(seed: number): void {
    void this.router.navigate([], {
      queryParams: {
        formato: this.formatId(),
        modalita: this.mode(),
        sim: this.numSims(),
        games: this.numGames(),
        edge: this.evChips(),
        rb: this.rakebackPct() || null,
        buyin: this.buyinEur(),
        chipsSd: this.mode() === 'chip' ? this.chipsStdDev() : null,
        bankroll: this.mode() === 'money' ? this.selectedBankroll() : null,
        seed,
      },
      replaceUrl: true,
    });
  }
}
