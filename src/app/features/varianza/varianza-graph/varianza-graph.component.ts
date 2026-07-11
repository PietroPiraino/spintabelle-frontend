import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import type { SimResult } from '../engine/types';

/** Coppie di percentili disegnate come bande annidate (ventaglio), dall'esterno all'interno. */
const BAND_PAIRS: readonly [number, number][] = [
  [0.01, 0.99],
  [0.05, 0.95],
  [0.1, 0.9],
  [0.2, 0.8],
  [0.3, 0.7],
];

const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
// Notazione compatta per i numeri grandi (chip totali) → niente sbordo sul grafico.
const compactFmt = new Intl.NumberFormat('it-IT', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
/** Formatta un valore d'asse: intero fino a 100k, poi compatto ("1,2 Mln"). */
function fmtVal(v: number): string {
  return Math.abs(v) >= 100_000 ? compactFmt.format(v) : intFmt.format(Math.round(v));
}

/** Unità dell'asse Y: totale cumulato, media per partita, o buy-in (chip/stack medio). */
export type GraphUnit = 'perGame' | 'total' | 'buyin';

/** Riquadro visibile in coordinate-dato (game × valore) + range pieno per il clamp dello zoom. */
interface Viewport {
  gLo: number;
  gHi: number;
  yLo: number;
  yHi: number;
}
interface Geom {
  padL: number;
  padT: number;
  plotW: number;
  plotH: number;
  gLo: number;
  gHi: number;
  yLo: number;
  yHi: number;
  fullGLo: number;
  fullGHi: number;
  fullYLo: number;
  fullYHi: number;
}

@Component({
  selector: 'app-varianza-graph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #cv class="varianza-graph__canvas" role="img"
      aria-label="Grafico della varianza simulata: bande percentili, mediana ed EV atteso dei risultati"></canvas>
    @if (zoomed()) {
      <button type="button" class="varianza-graph__reset" (click)="resetView()">
        Reimposta zoom
      </button>
    }
    <span class="varianza-graph__hint" aria-hidden="true">{{ hint() }}</span>`,
  styleUrl: './varianza-graph.component.scss',
  host: { class: 'varianza-graph' },
})
export class VarianzaGraphComponent {
  readonly result = input<SimResult | null>(null);
  readonly showSamples = input(true);
  readonly unit = input<GraphUnit>('total');
  /** Se true, le etichette delle bande mostrano anche il valore per partita (÷ game). */
  readonly perGameLabels = input(false);
  /** Chips per buy-in (stack medio) per l'unità "buy-in" in EV Chip mode. */
  readonly chipsPerBuyin = input(500);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('cv');
  private readonly themeTick = signal(0);
  private readonly sizeTick = signal(0);
  private readonly destroyRef = inject(DestroyRef);

  /** Stato zoom (per pulsante Reset + suggerimento). */
  protected readonly zoomed = signal(false);
  protected readonly hint = computed(() =>
    this.zoomed()
      ? 'Trascina per spostare · doppio click per reset'
      : 'Rotellina o pizzica per zoomare',
  );

  // Riquadro visibile: null = vista piena. In coordinate-dato → resiliente a resize/tema.
  private view: Viewport | null = null;
  private geom: Geom | null = null;
  // Riconosce il cambio di dati/unità per azzerare lo zoom (il viewport non è più valido).
  private lastRes: SimResult | null = null;
  private lastUnit: GraphUnit | null = null;
  private rafId = 0;

  // Puntatori attivi (mouse/pen/touch) per pan e pinch.
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private panLast: { x: number; y: number } | null = null;
  private pinchLast: { dist: number; cx: number; cy: number } | null = null;

  constructor() {
    // Stabilisce le dipendenze reattive in modo sincrono, poi accoda il disegno (rAF-coalesced).
    effect(() => {
      this.result();
      this.showSamples();
      this.themeTick();
      this.sizeTick();
      this.unit();
      this.chipsPerBuyin();
      this.perGameLabels();
      this.scheduleDraw();
    });

    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      const host = canvas?.parentElement;
      const ro = new ResizeObserver(() => this.sizeTick.update((v) => v + 1));
      if (host) ro.observe(host);
      const mo = new MutationObserver(() => this.themeTick.update((v) => v + 1));
      mo.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      });
      if (canvas) {
        canvas.addEventListener('wheel', this.onWheel, { passive: false });
        canvas.addEventListener('pointerdown', this.onPointerDown);
        canvas.addEventListener('pointermove', this.onPointerMove);
        canvas.addEventListener('pointerup', this.onPointerUp);
        canvas.addEventListener('pointercancel', this.onPointerUp);
        canvas.addEventListener('dblclick', this.onDblClick);
      }
      this.sizeTick.update((v) => v + 1);
      this.destroyRef.onDestroy(() => {
        ro.disconnect();
        mo.disconnect();
        if (this.rafId) cancelAnimationFrame(this.rafId);
        if (canvas) {
          canvas.removeEventListener('wheel', this.onWheel);
          canvas.removeEventListener('pointerdown', this.onPointerDown);
          canvas.removeEventListener('pointermove', this.onPointerMove);
          canvas.removeEventListener('pointerup', this.onPointerUp);
          canvas.removeEventListener('pointercancel', this.onPointerUp);
          canvas.removeEventListener('dblclick', this.onDblClick);
        }
      });
    });
  }

  protected resetView(): void {
    this.setView(null);
  }

  // ---------------------------------------------------------------------------
  // Interazione zoom/pan
  // ---------------------------------------------------------------------------
  private readonly onWheel = (e: WheelEvent): void => {
    if (!this.geom) return;
    e.preventDefault();
    // deltaY < 0 (rotellina su) → factor < 1 → zoom in.
    this.zoomAt(e.offsetX, e.offsetY, Math.exp(e.deltaY * 0.0015));
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    const cv = this.canvasRef()?.nativeElement;
    if (!cv) return;
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    // Il pan a 1 dito è solo per mouse/pen; su touch 1 dito scrolla la pagina, 2 dita = pinch.
    if (e.pointerType !== 'touch') cv.setPointerCapture(e.pointerId);
    if (this.pointers.size >= 2) {
      this.pinchLast = this.pinchState();
      this.panLast = null;
    } else if (e.pointerType !== 'touch') {
      this.panLast = { x: e.offsetX, y: e.offsetY };
    }
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (this.pointers.size >= 2 && this.pinchLast) {
      e.preventDefault();
      const cur = this.pinchState();
      if (!cur) return;
      const factor = cur.dist > 0 ? this.pinchLast.dist / cur.dist : 1;
      this.zoomAt(cur.cx, cur.cy, factor);
      this.panBy(cur.cx - this.pinchLast.cx, cur.cy - this.pinchLast.cy);
      this.pinchLast = cur;
    } else if (this.panLast && e.pointerType !== 'touch') {
      this.panBy(e.offsetX - this.panLast.x, e.offsetY - this.panLast.y);
      this.panLast = { x: e.offsetX, y: e.offsetY };
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    this.canvasRef()?.nativeElement.releasePointerCapture?.(e.pointerId);
    const left = [...this.pointers.values()];
    this.pinchLast = left.length >= 2 ? this.pinchState() : null;
    this.panLast = left.length === 1 ? { x: left[0].x, y: left[0].y } : null;
  };

  private readonly onDblClick = (): void => this.setView(null);

  private pinchState(): { dist: number; cx: number; cy: number } | null {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts;
    return {
      dist: Math.hypot(a.x - b.x, a.y - b.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  }

  /** Zoom di `factor` attorno al pixel (px,py): <1 ingrandisce, >1 rimpicciolisce. */
  private zoomAt(px: number, py: number, factor: number): void {
    const g = this.geom;
    if (!g) return;
    const cur = this.currentView(g);
    const gc = cur.gLo + ((px - g.padL) / g.plotW) * (cur.gHi - cur.gLo);
    const vc = cur.yLo + (1 - (py - g.padT) / g.plotH) * (cur.yHi - cur.yLo);
    this.commitView(
      g,
      gc - (gc - cur.gLo) * factor,
      gc + (cur.gHi - gc) * factor,
      vc - (vc - cur.yLo) * factor,
      vc + (cur.yHi - vc) * factor,
    );
  }

  /** Sposta la vista di (dxPix,dyPix) pixel (solo se già zoomata). */
  private panBy(dxPix: number, dyPix: number): void {
    const g = this.geom;
    if (!g || !this.view) return;
    const cur = this.view;
    const dg = -dxPix * ((cur.gHi - cur.gLo) / g.plotW);
    const dy = dyPix * ((cur.yHi - cur.yLo) / g.plotH);
    this.commitView(g, cur.gLo + dg, cur.gHi + dg, cur.yLo + dy, cur.yHi + dy);
  }

  private currentView(g: Geom): Viewport {
    return (
      this.view ?? { gLo: g.fullGLo, gHi: g.fullGHi, yLo: g.fullYLo, yHi: g.fullYHi }
    );
  }

  /** Applica span minimo + clamp al range pieno; se copre (quasi) tutto → vista piena. */
  private commitView(
    g: Geom,
    gLo: number,
    gHi: number,
    yLo: number,
    yHi: number,
  ): void {
    const fullG = g.fullGHi - g.fullGLo;
    const fullY = g.fullYHi - g.fullYLo;
    const minG = Math.max(2, fullG * 0.004);
    const minY = fullY * 0.008;
    if (gHi - gLo < minG) {
      const c = (gLo + gHi) / 2;
      gLo = c - minG / 2;
      gHi = c + minG / 2;
    }
    if (yHi - yLo < minY) {
      const c = (yLo + yHi) / 2;
      yLo = c - minY / 2;
      yHi = c + minY / 2;
    }
    [gLo, gHi] = clampRange(gLo, gHi, g.fullGLo, g.fullGHi);
    [yLo, yHi] = clampRange(yLo, yHi, g.fullYLo, g.fullYHi);
    const zoomed = gHi - gLo < fullG * 0.999 || yHi - yLo < fullY * 0.999;
    this.setView(zoomed ? { gLo, gHi, yLo, yHi } : null);
  }

  private setView(v: Viewport | null): void {
    this.view = v;
    this.zoomed.set(v !== null);
    this.scheduleDraw();
  }

  private scheduleDraw(): void {
    if (this.rafId) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.draw();
    });
  }

  private token(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // ---------------------------------------------------------------------------
  // Disegno
  // ---------------------------------------------------------------------------
  private draw(): void {
    const ref = this.canvasRef();
    if (!ref) return;
    const canvas = ref.nativeElement;
    const host = canvas.parentElement;
    if (!host) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Larghezza reale dell'host (fallback 320 solo se non ancora impaginato): un floor più alto
    // sborderebbe oltre l'host con overflow:hidden → etichette destre tagliate sotto i 320px.
    const cssW = host.clientWidth || 320;
    const cssH = Math.max(260, host.clientHeight);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const res = this.result();
    if (!res || res.columns.length === 0) {
      this.geom = null;
      return;
    }

    const gu = this.unit();
    // Dati o unità cambiati → il viewport (in coordinate-dato) non è più valido: azzera lo zoom.
    if (res !== this.lastRes || gu !== this.lastUnit) {
      this.lastRes = res;
      this.lastUnit = gu;
      if (this.view) {
        this.view = null;
        this.zoomed.set(false);
      }
    }

    // Palette dai token del tema.
    const cText = this.token('--text-muted') || '#889';
    const cFaint = this.token('--text-faint') || '#aab';
    const cLine = this.token('--line') || 'rgba(120,130,150,.25)';
    const cSeries = this.token('--act-call') || '#00a96e';
    const cMedian = this.token('--gold') || '#e6b800';
    const cEv = this.token('--act-allin') || '#d61f5e';
    const cZero = this.token('--line-strong') || 'rgba(120,130,150,.5)';
    const font = this.token('--font-mono') || 'ui-monospace, monospace';

    const n = res.columns.length;
    const cpb = this.chipsPerBuyin();
    // Trasforma i valori cumulati nell'unità scelta (÷ game, ÷ stack, o totale).
    const sv = (v: number, c: number): number =>
      gu === 'perGame' ? v / Math.max(1, res.columns[c]) : gu === 'buyin' ? v / cpb : v;

    // --- range Y pieno: inviluppo bande (1–99%) + EV, includendo lo zero ---
    let fullYMin = 0;
    let fullYMax = 0;
    // In "per partita" i primissimi game hanno media enorme (poche partite): esclusi dallo
    // scaling (restano disegnati, clippati) così il funnel di convergenza è ben incorniciato.
    const scaleStart = gu === 'perGame' ? Math.min(n - 1, Math.max(1, Math.floor(n * 0.015))) : 0;
    for (const b of res.bands) {
      for (let c = scaleStart; c < n; c++) {
        const v = sv(b.values[c], c);
        if (v < fullYMin) fullYMin = v;
        else if (v > fullYMax) fullYMax = v;
      }
    }
    const evEnd = sv(res.evLine[n - 1], n - 1);
    if (evEnd < fullYMin) fullYMin = evEnd;
    else if (evEnd > fullYMax) fullYMax = evEnd;
    if (fullYMax - fullYMin < 1e-9) {
      fullYMax += 1;
      fullYMin -= 1;
    }
    const padY = (fullYMax - fullYMin) * 0.06;
    fullYMin -= padY;
    fullYMax += padY;
    const fullGLo = 0;
    const fullGHi = res.numGames;

    // Applica il viewport (zoom) se presente.
    const vp = this.view;
    const gLo = vp ? vp.gLo : fullGLo;
    const gHi = vp ? vp.gHi : fullGHi;
    const yMin = vp ? vp.yLo : fullYMin;
    const yMax = vp ? vp.yHi : fullYMax;
    const gSpan = Math.max(1e-9, gHi - gLo);
    const ySpan = Math.max(1e-9, yMax - yMin);

    // --- tacche asse Y (sul viewport) + padding sinistro dinamico ---
    ctx.font = `11px ${font}`;
    const ticks = niceTicks(yMin, yMax, 6);
    let maxTickW = 0;
    for (const t of ticks) maxTickW = Math.max(maxTickW, ctx.measureText(fmtVal(t)).width);
    const padL = Math.ceil(maxTickW) + 12;

    // --- scaletta percentili (asse destro): tutte le bande, valore finale nell'unità scelta ---
    ctx.font = `10px ${font}`;
    const showPg = this.perGameLabels();
    const lastGame = Math.max(1, res.columns[n - 1]);
    const ladder = [...res.bands]
      .sort((a, b) => b.p - a.p) // dal 99% all'1% (alto → basso nel grafico)
      .map((b) => {
        const val = sv(b.values[n - 1], n - 1);
        const pct = `[${Math.round(b.p * 100)}%]`;
        const text = showPg
          ? `${fmtVal(val)} · ${Math.round(val / lastGame)}/p ${pct}`
          : `${fmtVal(val)} ${pct}`;
        return { val, text, isMedian: Math.abs(b.p - 0.5) < 1e-9 };
      });
    let maxLabelW = 0;
    for (const e of ladder) maxLabelW = Math.max(maxLabelW, ctx.measureText(e.text).width);
    const padR = Math.ceil(maxLabelW) + 12;

    const padT = 14;
    const padB = 26;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const x = (game: number): number => padL + ((game - gLo) / gSpan) * plotW;
    const y = (v: number): number => padT + (1 - (v - yMin) / ySpan) * plotH;
    const colX = (c: number): number => x(res.columns[c]);

    // --- griglia orizzontale + etichette asse Y ---
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = cLine;
    ctx.lineWidth = 1;
    ctx.font = `11px ${font}`;
    for (const t of ticks) {
      const yy = Math.round(y(t)) + 0.5;
      if (yy < padT || yy > padT + plotH) continue;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(padL + plotW, yy);
      ctx.stroke();
      ctx.fillStyle = cFaint;
      ctx.textAlign = 'right';
      ctx.fillText(fmtVal(t), padL - 6, yy);
    }

    // --- linea break-even (0) ---
    if (yMin < 0 && yMax > 0) {
      const y0 = Math.round(y(0)) + 0.5;
      ctx.strokeStyle = cZero;
      ctx.lineWidth = 1.25;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y0);
      ctx.lineTo(padL + plotW, y0);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Clip al riquadro di plot: spike jackpot e tratti fuori-viewport non invadono gli assi.
    ctx.save();
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();

    // --- traiettorie campione (tenui) ---
    if (this.showSamples() && res.samples.length) {
      ctx.strokeStyle = cFaint;
      ctx.globalAlpha = 0.1;
      ctx.lineWidth = 1;
      for (const s of res.samples) {
        ctx.beginPath();
        for (let c = 0; c < n; c++) {
          const xx = colX(c);
          const yy = y(sv(s[c], c));
          if (c === 0) ctx.moveTo(xx, yy);
          else ctx.lineTo(xx, yy);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // --- bande percentili annidate (ventaglio) ---
    const rgb = parseColor(cSeries);
    let alpha = 0.1;
    for (const [pl, ph] of BAND_PAIRS) {
      const low = bandByP(res, pl);
      const high = bandByP(res, ph);
      if (!low || !high) {
        alpha += 0.05;
        continue;
      }
      ctx.beginPath();
      for (let c = 0; c < n; c++) ctx.lineTo(colX(c), y(sv(high[c], c)));
      for (let c = n - 1; c >= 0; c--) ctx.lineTo(colX(c), y(sv(low[c], c)));
      ctx.closePath();
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.fill();
      alpha += 0.05;
    }

    // --- mediana (50%) ---
    const median = bandByP(res, 0.5);
    if (median) {
      ctx.strokeStyle = cMedian;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let c = 0; c < n; c++) {
        const xx = colX(c);
        const yy = y(sv(median[c], c));
        if (c === 0) ctx.moveTo(xx, yy);
        else ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }

    // --- linea EV (riferimento) ---
    ctx.strokeStyle = cEv;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let c = 0; c < n; c++) {
      const xx = colX(c);
      const yy = y(sv(res.evLine[c], c));
      if (c === 0) ctx.moveTo(xx, yy);
      else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();

    // --- scaletta percentili sul bordo destro (come SwongSim) ---
    ctx.font = `10px ${font}`;
    ctx.textBaseline = 'middle';
    const labelX = cssW - 4;
    let lastLabelY = Number.NEGATIVE_INFINITY;
    for (const e of ladder) {
      const yy = y(e.val);
      if (yy < padT - 1 || yy > padT + plotH + 1) continue; // fuori riquadro (zoom)
      if (Math.abs(yy - lastLabelY) < 11) continue; // niente sovrapposizioni
      lastLabelY = yy;
      const yt = Math.round(yy) + 0.5;
      ctx.strokeStyle = cLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL + plotW, yt);
      ctx.lineTo(padL + plotW + 4, yt);
      ctx.stroke();
      ctx.fillStyle = e.isMedian ? cMedian : cText;
      ctx.textAlign = 'right';
      ctx.fillText(e.text, labelX, yy);
    }

    // --- asse X (game, sul viewport) ---
    ctx.fillStyle = cFaint;
    ctx.textBaseline = 'top';
    for (let i = 0; i <= 4; i++) {
      const g = Math.round(gLo + (i / 4) * gSpan);
      ctx.textAlign = i === 0 ? 'left' : i === 4 ? 'right' : 'center';
      const lx = i === 0 ? padL : i === 4 ? padL + plotW : x(g);
      ctx.fillText(intFmt.format(g), lx, padT + plotH + 6);
    }

    // --- legenda compatta ---
    this.drawLegend(ctx, padL + 6, padT + 4, font, cText, cMedian, cEv, cSeries);

    this.geom = {
      padL,
      padT,
      plotW,
      plotH,
      gLo,
      gHi,
      yLo: yMin,
      yHi: yMax,
      fullGLo,
      fullGHi,
      fullYLo: fullYMin,
      fullYHi: fullYMax,
    };
  }

  private drawLegend(
    ctx: CanvasRenderingContext2D,
    lx: number,
    ly: number,
    font: string,
    cText: string,
    cMedian: string,
    cEv: string,
    cSeries: string,
  ): void {
    const items: [string, string, boolean][] = [
      ['EV atteso', cEv, true],
      ['Mediana (50%)', cMedian, false],
      ['Bande 1–99%', cSeries, false],
    ];
    ctx.font = `11px ${font}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    let yy = ly + 8;
    for (const [label, color, dashed] of items) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      if (dashed) ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(lx, yy);
      ctx.lineTo(lx + 22, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = cText;
      ctx.fillText(label, lx + 28, yy);
      yy += 16;
    }
  }
}

function bandByP(res: SimResult, p: number): Float64Array | null {
  for (const b of res.bands) if (Math.abs(b.p - p) < 1e-9) return b.values;
  return null;
}

/** Clampa [lo,hi] dentro [min,max] preservando l'ampiezza (o la satura al pieno). */
function clampRange(lo: number, hi: number, min: number, max: number): [number, number] {
  const span = hi - lo;
  const full = max - min;
  if (span >= full) return [min, max];
  if (lo < min) return [min, min + span];
  if (hi > max) return [max - span, max];
  return [lo, hi];
}

/** Estrae "r,g,b" da un colore CSS (hex #rgb/#rrggbb o rgb()). */
function parseColor(css: string): string {
  const c = css.trim();
  if (c.startsWith('#')) {
    let hex = c.slice(1);
    if (hex.length === 3)
      hex = hex
        .split('')
        .map((h) => h + h)
        .join('');
    const num = parseInt(hex, 16);
    return `${(num >> 16) & 255},${(num >> 8) & 255},${num & 255}`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((s) => parseFloat(s));
    return `${parts[0] | 0},${parts[1] | 0},${parts[2] | 0}`;
  }
  return '0,169,110';
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
