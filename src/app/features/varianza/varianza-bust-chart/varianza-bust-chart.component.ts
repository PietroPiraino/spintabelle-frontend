import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { BustData } from '../engine/types';

const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

/** Curve di rischio di rovina: % cumulata di giocatori andati in bust, per bankroll. */
@Component({
  selector: 'app-varianza-bust-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv class="varianza-bust__canvas" role="img"
    aria-label="Curve di rischio di rovina: percentuale di giocatori andati in bust nel tempo per diversi bankroll"></canvas>`,
  styleUrl: './varianza-bust-chart.component.scss',
  host: { class: 'varianza-bust' },
})
export class VarianzaBustChartComponent {
  readonly bust = input<BustData | null>(null);
  readonly numGames = input(0);
  /** Bankroll evidenziato (in buy-in); gli altri restano tenui. */
  readonly selected = input(-1);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('cv');
  private readonly themeTick = signal(0);
  private readonly sizeTick = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    effect(() => {
      this.bust();
      this.numGames();
      this.selected();
      this.themeTick();
      this.sizeTick();
      this.draw();
    });

    afterNextRender(() => {
      const host = this.canvasRef()?.nativeElement.parentElement;
      const ro = new ResizeObserver(() => this.sizeTick.update((v) => v + 1));
      if (host) ro.observe(host);
      const mo = new MutationObserver(() => this.themeTick.update((v) => v + 1));
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      this.sizeTick.update((v) => v + 1);
      this.destroyRef.onDestroy(() => {
        ro.disconnect();
        mo.disconnect();
      });
    });
  }

  private token(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /** Colore per bankroll: piccolo = rischioso (rosso) → grande = sicuro (verde). */
  private curveColor(i: number, m: number, dark: boolean): string {
    const t = m > 1 ? i / (m - 1) : 1;
    const hue = 8 + t * 137; // 8 (rosso) → 145 (verde)
    const s = dark ? 58 : 64;
    const l = dark ? 60 : 44;
    return `hsl(${hue.toFixed(0)} ${s}% ${l}%)`;
  }

  private draw(): void {
    const ref = this.canvasRef();
    if (!ref) return;
    const canvas = ref.nativeElement;
    const host = canvas.parentElement;
    if (!host) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Larghezza reale dell'host (fallback 320 solo se non ancora impaginato): un floor più alto
    // farebbe sbordare il canvas oltre l'host con overflow:hidden → etichette destre tagliate.
    const cssW = host.clientWidth || 320;
    const cssH = Math.max(220, host.clientHeight);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const b = this.bust();
    const nG = this.numGames();
    if (!b || !b.curves.length || nG <= 0) return;

    const cFaint = this.token('--text-faint') || '#aab';
    const cLine = this.token('--line') || 'rgba(120,130,150,.25)';
    const cText = this.token('--text-muted') || '#889';
    const font = this.token('--font-mono') || 'ui-monospace, monospace';
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';

    const m = b.curves.length;
    const cols = b.curves[0].length;

    // Y max: sul picco delle curve, con margine; pavimento al 5% per non sovra-zoomare a rischio ~0.
    let peak = 0;
    for (const c of b.curves) for (let i = 0; i < cols; i++) if (c[i] > peak) peak = c[i];
    const yMax = Math.min(1, Math.max(0.05, peak * 1.15));

    // Etichette endpoint: "{B} bi · {pct}%" — sempre 1 decimale, coerente con la headline.
    ctx.font = `10px ${font}`;
    const labels = b.bankrolls.map(
      (bk, j) => `${bk} bi · ${(b.final[j] * 100).toFixed(1).replace('.', ',')}%`,
    );
    let maxLabelW = 0;
    for (const s of labels) maxLabelW = Math.max(maxLabelW, ctx.measureText(s).width);

    // Tacche Y (percentuali) → padding sinistro.
    ctx.font = `11px ${font}`;
    const ticks = niceTicks(0, yMax, 5);
    let maxTickW = 0;
    for (const t of ticks) maxTickW = Math.max(maxTickW, ctx.measureText(fmtPct(t)).width);

    const padL = Math.ceil(maxTickW) + 12;
    const padR = Math.ceil(maxLabelW) + 12;
    const padT = 12;
    const padB = 26;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const x = (game: number): number => padL + (game / nG) * plotW;
    const y = (v: number): number => padT + (1 - v / yMax) * plotH;
    // Le colonne coprono i game [1..nG] uniformemente (columns[c] = round((c+1)/cols * nG)).
    const colGame = (c: number): number => Math.round(((c + 1) / cols) * nG);

    // --- griglia + etichette Y ---
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 1;
    ctx.font = `11px ${font}`;
    for (const t of ticks) {
      const yy = Math.round(y(t)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.fillStyle = cFaint;
      ctx.textAlign = 'right';
      ctx.fillText(fmtPct(t), padL - 6, yy);
    }

    const selectedIdx = b.bankrolls.indexOf(this.selected());

    // --- curve (la selezionata disegnata per ultima, sopra le altre) ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();
    const order = [...Array(m).keys()].sort((a, c) =>
      a === selectedIdx ? 1 : c === selectedIdx ? -1 : 0,
    );
    for (const j of order) {
      const isSel = j === selectedIdx;
      ctx.strokeStyle = this.curveColor(j, m, dark);
      ctx.globalAlpha = selectedIdx < 0 ? 0.9 : isSel ? 1 : 0.4;
      ctx.lineWidth = isSel ? 2.75 : 1.75;
      ctx.beginPath();
      const curve = b.curves[j];
      for (let c = 0; c < cols; c++) {
        const xx = x(colGame(c));
        const yy = y(curve[c]);
        if (c === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // --- etichette endpoint (valore finale a destra), anti-sovrapposizione con tetto ---
    // Le curve a rischio ~0% (vincente ben capitalizzato) si accalcano in basso: senza tetto
    // le etichette verrebbero spinte sotto il canvas e sparirebbero → comprimo verso l'alto.
    ctx.font = `10px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const order2 = [...Array(m).keys()].sort((a, c) => b.final[c] - b.final[a]); // dall'alto al basso
    const gap = 12;
    const maxLabelY = cssH - 6; // non oltre il fondo del canvas
    let lastY = Number.NEGATIVE_INFINITY;
    for (let r = 0; r < order2.length; r++) {
      const j = order2[r];
      const isSel = j === selectedIdx;
      let yy = y(b.final[j]);
      if (yy - lastY < gap) yy = lastY + gap; // scosta se troppo vicine
      yy = Math.min(yy, maxLabelY - (order2.length - 1 - r) * gap); // lascia spazio a quelle sotto
      lastY = yy;
      ctx.fillStyle = this.curveColor(j, m, dark);
      ctx.globalAlpha = selectedIdx < 0 || isSel ? 1 : 0.6;
      ctx.beginPath();
      ctx.arc(padL + plotW, y(b.final[j]), isSel ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      const prevFont = ctx.font;
      if (isSel) ctx.font = `700 10px ${font}`;
      ctx.fillStyle = isSel ? this.curveColor(j, m, dark) : cText;
      ctx.fillText(labels[j], padL + plotW + 8, yy);
      ctx.font = prevFont;
    }
    ctx.globalAlpha = 1;

    // --- asse X (game) ---
    ctx.fillStyle = cFaint;
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const g = Math.round((i / 4) * nG);
      ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
      const lx = i === 0 ? padL : i === 4 ? padL + plotW : x(g);
      ctx.fillText(intFmt.format(g), lx, padT + plotH + 6);
    }
  }
}

function fmtPct(frac: number): string {
  const p = frac * 100;
  return p < 10 && p > 0 ? `${p.toFixed(1).replace('.', ',')}%` : `${Math.round(p)}%`;
}

/** Tacche "belle" (1/2/5 × 10^k) tra min e max. */
function niceTicks(min: number, max: number, count: number): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) out.push(Math.abs(t) < step / 1e6 ? 0 : t);
  return out;
}
