import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { DrillSessionView } from '../../../core/models/api.models';
import { formatBb, formatFreq } from '../../tables/preflop-display';

interface Dot {
  cx: number;
  cy: number;
}

interface ChartData {
  key: 'acc' | 'loss';
  title: string;
  color: string;
  line: string;
  area: string;
  dots: Dot[];
  latest: string;
  caption: string;
}

const r2 = (n: number) => Number(n.toFixed(2));

/**
 * Andamento nel tempo: due mini-grafici SVG (precisione ed EV persa media) sulle
 * sessioni passate, in ordine cronologico. In entrambi "più in alto = meglio".
 * Le sessioni passate devono arrivare già cronologiche (vecchia → nuova).
 */
@Component({
  selector: 'app-drill-trend-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tc">
      @for (c of charts(); track c.key) {
        <div class="tc__card">
          <div class="tc__head">
            <span class="tc__title">{{ c.title }}</span>
            <span class="tc__latest" [style.color]="c.color">{{ c.latest }}</span>
          </div>
          <svg class="tc__svg" viewBox="0 0 100 40">
            <line class="tc__axis" x1="3" y1="36" x2="97" y2="36" />
            <path class="tc__area" [attr.d]="c.area" [attr.fill]="c.color" />
            <polyline
              class="tc__line"
              [attr.points]="c.line"
              [attr.stroke]="c.color"
            />
            @for (d of c.dots; track $index) {
              <circle [attr.cx]="d.cx" [attr.cy]="d.cy" r="1.2" [attr.fill]="c.color" />
            }
          </svg>
          <span class="tc__cap">{{ c.caption }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .tc {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
      gap: 1rem;
    }
    .tc__card {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--surface-1);
      box-shadow: var(--shadow-card);
      padding: 0.9rem 1rem 0.7rem;
    }
    .tc__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 0.4rem;
    }
    .tc__title {
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-faint);
    }
    .tc__latest {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 1.05rem;
    }
    .tc__svg {
      width: 100%;
      height: auto;
      display: block;
      overflow: visible;
    }
    .tc__axis {
      stroke: var(--line);
      stroke-width: 1px;
      vector-effect: non-scaling-stroke;
    }
    .tc__line {
      fill: none;
      stroke-width: 2px;
      stroke-linejoin: round;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .tc__area {
      opacity: 0.12;
    }
    .tc__cap {
      display: block;
      margin-top: 0.3rem;
      font-size: 0.74rem;
      color: var(--text-faint);
    }
  `,
})
export class DrillTrendChartComponent {
  readonly sessions = input.required<DrillSessionView[]>();

  protected readonly charts = computed<ChartData[]>(() => {
    const s = this.sessions();
    if (!s.length) return [];
    const n = s.length;
    const accVals = s.map((x) => x.accuracyPct);
    const lossVals = s.map((x) => x.avgEvLoss);
    const maxLoss = Math.max(0.2, ...lossVals) * 1.12;

    const X = (i: number) => (n > 1 ? 3 + (i / (n - 1)) * 94 : 50);
    const build = (vals: number[], yf: (v: number) => number) => {
      const dots = vals.map((v, i) => ({ cx: r2(X(i)), cy: r2(yf(v)) }));
      const line = dots.map((p) => `${p.cx},${p.cy}`).join(' ');
      const area =
        `M ${dots[0].cx},36 ` +
        dots.map((p) => `L ${p.cx},${p.cy}`).join(' ') +
        ` L ${dots[n - 1].cx},36 Z`;
      return { dots, line, area };
    };

    const acc = build(accVals, (v) => 6 + (1 - v / 100) * 30);
    const loss = build(lossVals, (v) => 6 + (v / maxLoss) * 30);
    const cap = `ultime ${n} session${n === 1 ? 'e' : 'i'}`;

    return [
      {
        key: 'acc',
        title: 'Precisione',
        color: 'var(--felt)',
        ...acc,
        latest: formatFreq(accVals[n - 1] / 100),
        caption: cap,
      },
      {
        key: 'loss',
        title: 'EV persa media',
        color: 'var(--copper-500)',
        ...loss,
        latest: `−${formatBb(lossVals[n - 1])} bb`,
        caption: cap,
      },
    ];
  });
}
