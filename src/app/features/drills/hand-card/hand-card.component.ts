import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

interface Card {
  rank: string;
  suit: string;
  red: boolean;
}

/**
 * Mostra UNA mano (es. "AKs", "AKo", "AA") come due carte. Convenzione:
 * suited = stesso seme; offsuit = due semi; coppia = due semi diversi.
 */
@Component({
  selector: 'app-hand-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="dc-hand" [class.dc-hand--lg]="large()">
      @for (c of cards(); track $index) {
        <span class="dc-card" [class.dc-card--red]="c.red">
          <span class="dc-card__rank">{{ c.rank }}</span>
          <span class="dc-card__suit">{{ c.suit }}</span>
        </span>
      }
    </span>
  `,
  styles: `
    .dc-hand {
      display: inline-flex;
      gap: 0.3rem;
    }
    .dc-card {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 46px;
      border-radius: 7px;
      background: #ffffff;
      color: #16223f;
      border: 1px solid rgba(27, 42, 74, 0.25);
      box-shadow: var(--shadow-card);
      font-family: var(--font-display);
      font-weight: 800;
      line-height: 1;
    }
    .dc-card--red {
      color: #d61f5e;
    }
    .dc-card__rank {
      font-size: 1.05rem;
    }
    .dc-card__suit {
      font-size: 0.85rem;
    }
    .dc-hand--lg .dc-card {
      width: 52px;
      height: 72px;
      border-radius: 10px;
    }
    .dc-hand--lg .dc-card__rank {
      font-size: 1.7rem;
    }
    .dc-hand--lg .dc-card__suit {
      font-size: 1.25rem;
    }
  `,
})
export class HandCardComponent {
  readonly hand = input.required<string>();
  readonly large = input(false);

  protected readonly cards = computed<Card[]>(() => {
    const h = this.hand();
    const r1 = h[0];
    const r2 = h[1];
    const spade: Card = { rank: r1, suit: '♠', red: false };
    if (r1 === r2) {
      // coppia: due semi diversi (uno nero, uno rosso)
      return [spade, { rank: r2, suit: '♥', red: true }];
    }
    if (h.endsWith('s')) {
      // suited: stesso seme
      return [spade, { rank: r2, suit: '♠', red: false }];
    }
    // offsuit: due semi diversi
    return [spade, { rank: r2, suit: '♥', red: true }];
  });
}
