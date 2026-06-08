import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DrillConfigPayload,
  DrillDifficulty,
  DrillSpotType,
  PreflopMeta,
} from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { DrillService } from '../../../core/services/drill.service';
import { PreflopService } from '../../../core/services/preflop.service';
import { anteOffset, depthDisplay } from '../../tables/preflop-display';
import {
  DIFFICULTY_HINTS,
  DIFFICULTY_LABELS,
  SPOT_TYPE_LABELS,
  formatLabel,
} from '../drill-display';

interface DepthOption {
  /** valore mostrato (offset ante tolto), es. "10" — chiave del chip */
  display: string;
  /** valore base numerico, per l'ordinamento */
  base: number;
  /** TUTTE le depth_label grezze che collassano su questo display (es. "10","10.17") */
  rawLabels: string[];
}

@Component({
  selector: 'app-drill-config',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drill-config.component.html',
  styleUrl: './drill-config.component.scss',
})
export class DrillConfigComponent {
  protected readonly auth = inject(AuthService);
  private readonly preflop = inject(PreflopService);
  private readonly drill = inject(DrillService);
  private readonly router = inject(Router);

  protected readonly meta = signal<PreflopMeta | null>(null);
  protected readonly metaError = signal(false);

  protected readonly selectedFormats = signal<Set<string>>(new Set());
  protected readonly selectedDepths = signal<Set<string>>(new Set());
  protected readonly selectedPositions = signal<Set<string>>(new Set());
  protected readonly selectedSpotTypes = signal<Set<DrillSpotType>>(new Set());
  protected readonly difficulty = signal<DrillDifficulty>('STANDARD');
  protected readonly questions = signal(20);

  protected readonly positions = ['BTN', 'SB', 'BB'];
  protected readonly spotTypes: DrillSpotType[] = [
    'OPEN',
    'VS_OPEN',
    'VS_3BET',
    'VS_4BET_PLUS',
  ];
  protected readonly difficulties: DrillDifficulty[] = [
    'STANDARD',
    'MIXED_ONLY',
    'MARGINAL',
    'ALL',
  ];
  protected readonly questionCounts = [10, 20, 50];

  protected readonly spotLabels = SPOT_TYPE_LABELS;
  protected readonly difficultyLabels = DIFFICULTY_LABELS;
  protected readonly difficultyHints = DIFFICULTY_HINTS;

  protected readonly formatOptions = computed(() =>
    (this.meta()?.formats ?? []).map((f) => ({
      format: f.format,
      label: formatLabel(f.format),
    })),
  );

  /**
   * Profondità disponibili (unione dei formati scelti, o di tutti),
   * DEDUPLICATE per valore mostrato: "10" (spin) e "10.17" (spin_ante)
   * collassano su un solo chip "10 bb" che, se scelto, filtra entrambe.
   */
  protected readonly availableDepths = computed<DepthOption[]>(() => {
    const m = this.meta();
    if (!m) return [];
    const sel = this.selectedFormats();
    const formats = m.formats.filter((f) =>
      sel.size ? sel.has(f.format) : true,
    );
    const byDisplay = new Map<string, { base: number; raws: Set<string> }>();
    for (const f of formats) {
      for (const d of f.depths) {
        const display = depthDisplay(d, f.format);
        const base = parseFloat(d) - anteOffset(f.format);
        const entry = byDisplay.get(display) ?? { base, raws: new Set<string>() };
        entry.raws.add(d);
        byDisplay.set(display, entry);
      }
    }
    return [...byDisplay.entries()]
      .map(([display, v]) => ({ display, base: v.base, rawLabels: [...v.raws] }))
      .sort((a, b) => a.base - b.base);
  });

  protected readonly canStart = computed(() => this.selectedFormats().size > 0);

  constructor() {
    // la meta popola i selettori: parte appena l'utente è loggato
    effect(() => {
      if (!this.auth.user() || this.meta() || this.metaError()) return;
      untracked(() =>
        this.preflop.getMeta().subscribe({
          next: (m) => this.meta.set(m),
          error: () => this.metaError.set(true),
        }),
      );
    });

    // default: il primo gioco base (preferendo spin) appena la meta è pronta
    effect(() => {
      const m = this.meta();
      if (!m) return;
      untracked(() => {
        if (this.selectedFormats().size) return;
        const fmts = m.formats.map((f) => f.format);
        const def =
          fmts.find((f) => f === 'spin') ??
          fmts.find((f) => !f.includes('_')) ??
          fmts[0];
        if (def) this.selectedFormats.set(new Set([def]));
      });
    });

    // tieni coerenti le profondità scelte coi formati attivi (per display)
    effect(() => {
      const avail = new Set(this.availableDepths().map((d) => d.display));
      untracked(() => {
        const cur = this.selectedDepths();
        if (![...cur].every((d) => avail.has(d))) {
          this.selectedDepths.set(new Set([...cur].filter((d) => avail.has(d))));
        }
      });
    });
  }

  protected toggleFormat(format: string): void {
    this.toggle(this.selectedFormats, format);
  }
  protected toggleDepth(label: string): void {
    this.toggle(this.selectedDepths, label);
  }
  protected togglePosition(pos: string): void {
    this.toggle(this.selectedPositions, pos);
  }
  protected toggleSpot(spot: DrillSpotType): void {
    this.toggle(this.selectedSpotTypes, spot);
  }
  protected setDifficulty(d: DrillDifficulty): void {
    this.difficulty.set(d);
  }
  protected setQuestions(n: number): void {
    this.questions.set(n);
  }

  protected retry(): void {
    this.metaError.set(false);
  }

  protected viewResults(): void {
    void this.router.navigate(['/allenamento/risultati']);
  }

  protected start(): void {
    if (!this.canStart()) return;
    const payload: DrillConfigPayload = {
      formats: [...this.selectedFormats()],
      // ogni display scelto si espande in TUTTE le sue depth_label grezze
      depths: this.availableDepths()
        .filter((d) => this.selectedDepths().has(d.display))
        .flatMap((d) => d.rawLabels),
      positions: [...this.selectedPositions()],
      spotTypes: [...this.selectedSpotTypes()],
      difficulty: this.difficulty(),
      questionsPerSession: this.questions(),
    };
    this.drill.begin(payload);
    void this.router.navigate(['/allenamento/sessione']);
  }

  private toggle<T>(sig: WritableSignal<Set<T>>, value: T): void {
    sig.update((s) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }
}
