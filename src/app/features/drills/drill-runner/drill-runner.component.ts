import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DrillQuestionAction,
  PreflopNode,
} from '../../../core/models/api.models';
import { DrillService } from '../../../core/services/drill.service';
import { PreflopService } from '../../../core/services/preflop.service';
import { depthDisplay } from '../../tables/preflop-display';
import {
  SPOT_TYPE_LABELS,
  drillActionLabel,
  drillColorMap,
  formatLabel,
} from '../drill-display';
import { DrillFeedbackComponent } from './drill-feedback/drill-feedback.component';
import { PokerTableComponent } from '../poker-table/poker-table.component';

@Component({
  selector: 'app-drill-runner',
  imports: [PokerTableComponent, DrillFeedbackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drill-runner.component.html',
  styleUrl: './drill-runner.component.scss',
})
export class DrillRunnerComponent {
  protected readonly drill = inject(DrillService);
  private readonly preflop = inject(PreflopService);
  private readonly router = inject(Router);

  /** nodo completo rifetchato per il reveal (con la strategia di tutte le mani) */
  protected readonly feedbackNode = signal<PreflopNode | null>(null);
  private feedbackFor = '';

  protected readonly colorMap = computed<Record<string, string>>(() => {
    const q = this.drill.question();
    return q ? drillColorMap(q.actions) : {};
  });

  protected readonly heroStack = computed<number | null>(() => {
    const q = this.drill.question();
    if (!q) return null;
    return q.players.find((p) => p.position === q.activePosition)?.stack ?? null;
  });

  protected readonly spotLabel = computed(() => {
    const q = this.drill.question();
    return q ? SPOT_TYPE_LABELS[q.spotType] : '';
  });

  protected readonly tableLabel = computed(() => {
    const q = this.drill.question();
    return q ? formatLabel(q.format) : '';
  });

  protected readonly depthLabel = computed(() => {
    const q = this.drill.question();
    return q ? depthDisplay(q.depthLabel, q.format) : '';
  });

  /** in feedback: l'azione scelta dall'eroe, mostrata sul suo posto al tavolo */
  protected readonly heroChoice = computed<string | null>(() => {
    if (this.drill.phase() !== 'feedback') return null;
    const r = this.drill.lastResult();
    const q = this.drill.question();
    if (!r || !q) return null;
    const a = q.actions.find((x) => x.code === r.chosenCode);
    return a ? drillActionLabel(a) : r.chosenCode;
  });

  constructor() {
    // ingresso diretto senza sessione → torna alla configurazione
    effect(() => {
      const phase = this.drill.phase();
      if (phase === 'idle' && !this.drill.config() && !this.drill.errorMsg()) {
        untracked(() =>
          this.router.navigate(['/allenamento'], { replaceUrl: true }),
        );
      }
    });

    // sessione conclusa → schermata risultati
    effect(() => {
      if (this.drill.phase() === 'finished') {
        untracked(() => this.router.navigate(['/allenamento/risultati']));
      }
    });

    // reveal: rifetch del nodo completo quando si entra nel feedback
    effect(() => {
      const phase = this.drill.phase();
      const q = this.drill.question();
      if (phase !== 'feedback' || !q) return;
      if (this.feedbackFor === q.questionId) return;
      this.feedbackFor = q.questionId;
      const stacks = q.format.includes('_asymmetric') ? q.stacks : undefined;
      untracked(() => {
        this.feedbackNode.set(null);
        this.preflop
          .getNode(q.format, q.depthLabel, q.preflopActions, stacks)
          .subscribe({
            next: (n) => this.feedbackNode.set(n),
            error: () => this.feedbackNode.set(null),
          });
      });
    });
  }

  protected actionLabel(a: DrillQuestionAction): string {
    return drillActionLabel(a);
  }

  protected onAnswer(code: string): void {
    this.drill.answer(code);
  }

  protected onNext(): void {
    this.feedbackNode.set(null);
    this.drill.advance();
  }

  protected onQuit(): void {
    const id = this.drill.sessionId();
    if (id) this.drill.endSession(id).subscribe({ error: () => undefined });
    void this.router.navigate(['/allenamento/risultati']);
  }

  protected backToConfig(): void {
    this.drill.reset();
    void this.router.navigate(['/allenamento']);
  }
}
