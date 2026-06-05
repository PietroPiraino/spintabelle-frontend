import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { PreflopNode } from '../../../core/models/api.models';
import {
  MATRIX_HANDS,
  actionLabel,
  displayActions,
  formatFreq,
} from '../preflop-display';

interface GridCell {
  hand: string;
  /** linear-gradient con i segmenti colorati per frequenza (null = mai giocata qui) */
  background: string | null;
  reached: boolean;
  aria: string;
}

/**
 * Matrice 13×13 delle mani: ogni cella è divisa in segmenti colorati
 * proporzionali alle frequenze delle azioni (all-in → … → fold).
 */
@Component({
  selector: 'app-range-grid',
  templateUrl: './range-grid.component.html',
  styleUrl: './range-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RangeGridComponent {
  readonly node = input.required<PreflopNode>();
  readonly colorMap = input.required<Record<string, string>>();
  readonly selected = input<string | null>(null);

  readonly handHover = output<string | null>();
  readonly handPick = output<string>();

  protected readonly cells = computed<GridCell[]>(() => {
    const node = this.node();
    const colors = this.colorMap();
    const actions = displayActions(node.actions);

    return MATRIX_HANDS.map((hand) => {
      const data = node.hands[hand];
      const segments: { color: string; freq: number; label: string }[] = [];
      let total = 0;
      if (data) {
        for (const action of actions) {
          const freq = data.freq[action.code] ?? 0;
          if (freq < 0.0005) continue;
          total += freq;
          segments.push({
            color: colors[action.code],
            freq,
            label: `${actionLabel(action)} ${formatFreq(freq)}`,
          });
        }
      }

      const reached = total > 0.001;
      if (!reached) {
        return {
          hand,
          background: null,
          reached: false,
          aria: `${hand}: mano che non arriva mai a questo punto`,
        };
      }

      // normalizza a 100% per assorbire i residui di arrotondamento
      let acc = 0;
      const stops = segments.map((s, i) => {
        const from = (acc / total) * 100;
        acc += s.freq;
        const to = i === segments.length - 1 ? 100 : (acc / total) * 100;
        return `var(${s.color}) ${from.toFixed(2)}% ${to.toFixed(2)}%`;
      });
      const background =
        stops.length === 1
          ? `linear-gradient(var(${segments[0].color}), var(${segments[0].color}))`
          : `linear-gradient(to right, ${stops.join(', ')})`;

      return {
        hand,
        background,
        reached: true,
        aria: `${hand}: ${segments.map((s) => s.label).join(', ')}`,
      };
    });
  });

  protected onLeave(): void {
    this.handHover.emit(null);
  }
}
