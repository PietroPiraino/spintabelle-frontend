import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import {
  DrillAnswerResult,
  DrillQuestionAction,
  PreflopNode,
} from '../../../../core/models/api.models';
import {
  actionColorMap,
  formatBb,
  formatEv,
  formatFreq,
} from '../../../tables/preflop-display';
import { RangeGridComponent } from '../../../tables/range-grid/range-grid.component';
import { drillActionLabel, drillColorMap } from '../../drill-display';

interface MixRow {
  code: string;
  label: string;
  colorVar: string;
  freq: string;
  ev: string;
  evSign: -1 | 0 | 1;
  isBest: boolean;
  isChosen: boolean;
}

/**
 * Pannello di correzione: esito, scelta vs ottimo, EV persa, mix GTO completo
 * e — quando il nodo è stato rifetchato — la matrice 13×13 con la mano giocata
 * evidenziata. La verità arriva solo qui, dopo l'invio della risposta.
 */
@Component({
  selector: 'app-drill-feedback',
  imports: [RangeGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drill-feedback.component.html',
  styleUrl: './drill-feedback.component.scss',
})
export class DrillFeedbackComponent {
  readonly result = input.required<DrillAnswerResult>();
  // azioni della domanda, già in ordine aggressivo→passivo dal backend
  readonly actions = input.required<DrillQuestionAction[]>();
  readonly hand = input.required<string>();
  readonly node = input<PreflopNode | null>(null);

  protected readonly chosenLabel = computed(() =>
    this.labelOf(this.result().chosenCode),
  );
  protected readonly bestLabel = computed(() =>
    this.labelOf(this.result().bestCode),
  );

  protected readonly lossLabel = computed(() => {
    const loss = this.result().evLoss;
    return loss > 0.005 ? `−${formatBb(loss)}` : '0';
  });

  protected readonly chosenFreqLabel = computed(() =>
    formatFreq(this.result().chosenFreq),
  );

  protected readonly gridColorMap = computed<Record<string, string>>(() => {
    const n = this.node();
    return n ? actionColorMap(n.actions) : {};
  });

  protected readonly rows = computed<MixRow[]>(() => {
    const r = this.result();
    const colors = drillColorMap(this.actions());
    return this.actions().map((a) => {
      const ev = r.evs[a.code] ?? 0;
      return {
        code: a.code,
        label: drillActionLabel(a),
        colorVar: colors[a.code],
        freq: formatFreq(r.freqs[a.code] ?? 0),
        ev: formatEv(ev),
        evSign: ev > 0.005 ? 1 : ev < -0.005 ? -1 : 0,
        isBest: a.code === r.bestCode,
        isChosen: a.code === r.chosenCode,
      };
    });
  });

  private labelOf(code: string): string {
    const a = this.actions().find((x) => x.code === code);
    return a ? drillActionLabel(a) : code;
  }
}
