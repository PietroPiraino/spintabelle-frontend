import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DrillAttempt,
  DrillSessionView,
  DrillStats,
} from '../../../core/models/api.models';
import {
  DrillAnswerLog,
  DrillService,
} from '../../../core/services/drill.service';
import {
  depthDisplay,
  formatBb,
  formatFreq,
} from '../../tables/preflop-display';
import {
  SPOT_TYPE_LABELS,
  configSummary,
  drillActionLabel,
  formatLabel,
} from '../drill-display';
import { DrillTrendChartComponent } from '../drill-trend-chart/drill-trend-chart.component';
import { HandCardComponent } from '../hand-card/hand-card.component';

const HISTORY_PAGE = 20;

@Component({
  selector: 'app-drill-results',
  imports: [HandCardComponent, DrillTrendChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drill-results.component.html',
  styleUrl: './drill-results.component.scss',
})
export class DrillResultsComponent {
  protected readonly drill = inject(DrillService);
  private readonly router = inject(Router);

  protected readonly stats = signal<DrillStats | null>(null);
  protected readonly loadingStats = signal(true);
  protected readonly sessions = signal<DrillSessionView[]>([]);
  protected readonly loadingSessions = signal(true);

  // storico mani (paginato + filtri)
  protected readonly attempts = signal<DrillAttempt[]>([]);
  protected readonly attemptsTotal = signal(0);
  protected readonly formatFilter = signal('');
  protected readonly onlyErrors = signal(false);
  protected readonly loadingHistory = signal(true);
  private historyPage = 0;

  protected readonly hasSession = computed(
    () => this.drill.answers().length > 0,
  );

  protected readonly summary = computed(() => {
    const a = this.drill.answers();
    const answered = a.length;
    const correct = a.filter((x) => x.result.correct).length;
    const totalEvLoss = a.reduce((s, x) => s + x.result.evLoss, 0);
    return {
      answered,
      correct,
      totalEvLoss,
      avgEvLoss: answered ? totalEvLoss / answered : 0,
      accuracyPct: answered ? (correct / answered) * 100 : 0,
    };
  });

  protected readonly worstSpots = computed(() =>
    [...this.drill.answers()]
      .filter((x) => x.result.evLoss > 0.005)
      .sort((a, b) => b.result.evLoss - a.result.evLoss)
      .slice(0, 5),
  );

  /** sessioni in ordine cronologico (vecchia → nuova) per il grafico */
  protected readonly trendSessions = computed(() =>
    [...this.sessions()].filter((s) => s.answered > 0).reverse().slice(-24),
  );

  protected readonly formatOptions = computed(() => {
    const st = this.stats();
    if (!st) return [];
    return [...new Set(st.buckets.map((b) => b.format))]
      .sort()
      .map((f) => ({ value: f, label: formatLabel(f) }));
  });

  protected readonly displayedAttempts = computed(() =>
    this.onlyErrors()
      ? this.attempts().filter((a) => !a.correct)
      : this.attempts(),
  );

  protected readonly canLoadMore = computed(
    () => this.attempts().length < this.attemptsTotal(),
  );

  protected readonly spotLabels = SPOT_TYPE_LABELS;

  constructor() {
    this.drill.getStats().subscribe({
      next: (s) => {
        this.stats.set(s);
        this.loadingStats.set(false);
      },
      error: () => this.loadingStats.set(false),
    });
    this.drill.getSessions().subscribe({
      next: (p) => {
        this.sessions.set(p.items);
        this.loadingSessions.set(false);
      },
      error: () => this.loadingSessions.set(false),
    });
    this.loadHistory(true);
  }

  // ── storico mani ───────────────────────────────────────────────────────────

  private loadHistory(reset: boolean): void {
    const page = reset ? 1 : this.historyPage + 1;
    this.loadingHistory.set(true);
    this.drill.getHistory(page, HISTORY_PAGE, this.formatFilter() || undefined).subscribe({
      next: (h) => {
        this.historyPage = page;
        this.attemptsTotal.set(h.total);
        this.attempts.update((cur) => (reset ? h.items : [...cur, ...h.items]));
        this.loadingHistory.set(false);
      },
      error: () => this.loadingHistory.set(false),
    });
  }

  protected onFormatFilter(event: Event): void {
    this.formatFilter.set((event.target as HTMLSelectElement).value);
    this.loadHistory(true);
  }

  protected toggleOnlyErrors(): void {
    this.onlyErrors.update((v) => !v);
  }

  protected loadMore(): void {
    this.loadHistory(false);
  }

  // ── helper di presentazione ──────────────────────────────────────────────

  protected pct(n: number): string {
    return formatFreq(n / 100);
  }
  protected bb(n: number): string {
    return formatBb(n);
  }
  protected formatName(format: string): string {
    return formatLabel(format);
  }
  protected depth(label: string, format: string): string {
    return depthDisplay(label, format);
  }
  protected actionOf(log: DrillAnswerLog, code: string): string {
    const a = log.question.actions.find((x) => x.code === code);
    return a ? drillActionLabel(a) : code;
  }
  protected bucketAcc(answered: number, correct: number): string {
    return answered ? formatFreq(correct / answered) : '—';
  }
  protected sessionLabel(s: DrillSessionView): string {
    return configSummary(s.config);
  }
  protected fmtDate(iso?: string): string {
    if (!iso) return '';
    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }

  // ── azioni ───────────────────────────────────────────────────────────────

  protected repeat(): void {
    const cfg = this.drill.config();
    if (!cfg) return;
    this.drill.begin(cfg);
    void this.router.navigate(['/allenamento/sessione']);
  }

  protected newDrill(): void {
    this.drill.reset();
    void this.router.navigate(['/allenamento']);
  }
}
