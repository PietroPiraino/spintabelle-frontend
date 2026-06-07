import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { DIORAMA_CAPABILITIES } from '../three/three-capabilities';
import { THREE_LOADER } from '../three/three-loader';
import { SceneResources } from '../three/disposable-scene';
import { seededRandom } from '../three/seeded-random';
import { bindSuitPalette, createSuitPoints } from '../three/suit-points';

/**
 * Il divisore '♠ ♥ ♦ ♣' del design system, ma VIVO — variante "semi nitidi +
 * alone".
 *
 * I quattro semi sono GLIFI tipografici veri (contenuto HTML reale, sempre
 * leggibili a colpo d'occhio, theme-aware via token CSS). Dietro, un canvas
 * disegna per ciascun seme un piccolo ALONE di micro-semi che orbitano lenti
 * e respirano: il divisore "vibra" senza mai chiedere di indovinare una forma.
 *
 * Senza WebGL / con reduced-motion il canvas non parte: restano i glifi nitidi
 * (il divisore statico del design system) — la leggibilità è garantita comunque.
 *
 * Camera ortografica mappata 1:1 sui pixel CSS del canvas host; i centri dei
 * semi sono misurati dal DOM dei glifi (robusti al responsive).
 */
@Component({
  selector: 'app-suit-divider-live',
  imports: [],
  template: `
    <canvas #canvas class="sdl__canvas" aria-hidden="true"></canvas>
    <div class="sdl__row" aria-hidden="true">
      <span class="sdl__glyph" data-suit="0">♠</span>
      <span class="sdl__glyph sdl__glyph--warm" data-suit="1">♥</span>
      <span class="sdl__glyph sdl__glyph--warm" data-suit="2">♦</span>
      <span class="sdl__glyph" data-suit="3">♣</span>
    </div>
  `,
  styleUrl: './suit-divider-live.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuitDividerLiveComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly loadThree = inject(THREE_LOADER);
  private readonly caps = inject(DIORAMA_CAPABILITIES);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private cleanupFns: (() => void)[] = [];
  private rafId = 0;
  private disposed = false;

  constructor() {
    afterNextRender(() => {
      // reduced-motion o niente WebGL → restano i glifi nitidi, senza alone
      if (this.caps.prefersReducedMotion() || !this.caps.hasWebGL()) return;
      void this.initAura().catch((error) => {
        this.teardown();
        console.warn('[suit-divider-live] init fallita, divisore statico', error);
      });
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.teardown();
  }

  private teardown(): void {
    cancelAnimationFrame(this.rafId);
    this.host.nativeElement.classList.remove('is-on');
    const fns = this.cleanupFns;
    this.cleanupFns = [];
    fns.forEach((fn) => fn());
  }

  private async initAura(): Promise<void> {
    const THREE = await this.loadThree();
    if (this.disposed) return;

    const canvas = this.canvasRef().nativeElement;
    const hostEl = this.host.nativeElement as HTMLElement;
    const res = new SceneResources();
    this.cleanupFns.push(() => res.disposeAll());

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    });
    this.cleanupFns.push(() => {
      renderer.dispose();
      renderer.forceContextLoss();
    });

    const scene = new THREE.Scene();
    // Ortografica in pixel del canvas: origine in alto a sinistra, y verso il basso
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);

    // ---- l'alone: micro-semi ♠♥♦♣ dalla factory condivisa, taglia minuta ----
    // Pochi punti per seme, piccoli e morbidi: un pulviscolo che orbita, non
    // una seconda sagoma. Il protagonista resta il glifo.
    const PER_GLYPH = 64;
    const COUNT = PER_GLYPH * 4;
    const sp = createSuitPoints(THREE, res, {
      count: COUNT,
      seed: 0x5d1,
      sizeFactor: 2.3, // ~2-4px CSS: scintille, non forme
      sizeMin: 0.8,
      sizeSpan: 0.9,
    });
    const { positions, angles, alphas, seeds, suits } = sp;
    const material = sp.material;
    sp.points.name = 'suit-divider-aura';
    scene.add(sp.points);

    // ---- stato per-particella: orbita ellittica + respiro radiale ----
    const rand = seededRandom(0x5d1 ^ 0xa10e);
    const glyphOf = new Int8Array(COUNT); // a quale seme (0..3) appartiene l'alone
    const a0 = new Float32Array(COUNT); // angolo iniziale
    const av = new Float32Array(COUNT); // velocità angolare (lenta, segno misto)
    const rx = new Float32Array(COUNT); // raggio orizzontale (px)
    const ry = new Float32Array(COUNT); // raggio verticale (alone un po' schiacciato)
    const breathAmp = new Float32Array(COUNT);
    const breathSpd = new Float32Array(COUNT);
    const breathPh = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      const g = i % 4;
      glyphOf[i] = g;
      // l'alone di OGNI seme è fatto di quel seme: ♥ aureola di cuori, ♠ di picche…
      suits[i] = g;
      a0[i] = rand() * Math.PI * 2;
      av[i] = (0.12 + rand() * 0.22) * (rand() < 0.5 ? -1 : 1);
      const r = 9 + rand() * 19; // 9..28 px dal centro del glifo
      rx[i] = r;
      ry[i] = r * (0.6 + rand() * 0.2); // alone leggermente ovale
      breathAmp[i] = 2 + rand() * 3.5;
      breathSpd[i] = 0.35 + rand() * 0.5;
      breathPh[i] = rand() * Math.PI * 2;
      // più vicino al glifo = più presente; verso l'esterno sfuma
      alphas[i] = 0.3 + (1 - (r - 9) / 19) * 0.5; // ~0.3..0.8
    }
    // suits è statico: caricalo UNA volta sulla GPU (markDirty non lo tocca)
    sp.points.geometry.getAttribute('aSuit').needsUpdate = true;

    // ---- palette per-tema: l'alone segue Ghiaccio/Tramonto/Notte ----
    this.cleanupFns.push(bindSuitPalette(material));

    // ---- centri dei quattro glifi, misurati dal DOM (px del canvas) ----
    const centers = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    const measureCenters = () => {
      const hostRect = hostEl.getBoundingClientRect();
      const glyphs = hostEl.querySelectorAll<HTMLElement>('.sdl__glyph');
      glyphs.forEach((el) => {
        const g = Number(el.dataset['suit']);
        const r = el.getBoundingClientRect();
        centers[g].x = r.left + r.width / 2 - hostRect.left;
        centers[g].y = r.top + r.height / 2 - hostRect.top;
      });
    };

    // ---- pausa: fuori dal viewport e a scheda nascosta ----
    let visible = true;
    let intersecting = true;
    const running = () => visible && intersecting;

    const onVisibility = () => (visible = !document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisibility));

    const io = new IntersectionObserver((entries) => {
      intersecting = entries[entries.length - 1].isIntersecting;
    });
    io.observe(hostEl);
    this.cleanupFns.push(() => io.disconnect());

    // ---- resize: misure dal CANVAS host, non dal viewport ----
    const resize = () => {
      const r = hostEl.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (w === 0 || h === 0) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.right = w;
      camera.bottom = h;
      camera.updateProjectionMatrix();
      material.uniforms['uPixelRatio'].value = renderer.getPixelRatio();
      measureCenters();
    };
    const ro = new ResizeObserver(() => resize());
    ro.observe(hostEl);
    this.cleanupFns.push(() => ro.disconnect());
    resize();

    // posizioni iniziali: ogni particella già nella sua orbita (niente "volo")
    for (let i = 0; i < COUNT; i++) {
      const c = centers[glyphOf[i]];
      positions[i * 3] = c.x + rx[i] * Math.cos(a0[i]);
      positions[i * 3 + 1] = c.y + ry[i] * Math.sin(a0[i]);
    }
    sp.markDirty();

    // ---- simulazione ----
    const start = performance.now();
    let lastT = 0;

    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      if (!running()) {
        lastT = (performance.now() - start) / 1000;
        return;
      }

      const t = (performance.now() - start) / 1000;
      const dt = Math.min(Math.max(t - lastT, 0), 0.066);
      lastT = t;

      for (let i = 0; i < COUNT; i++) {
        const c = centers[glyphOf[i]];
        const breath = breathAmp[i] * Math.sin(t * breathSpd[i] + breathPh[i]);
        const ang = a0[i] + av[i] * t;
        positions[i * 3] = c.x + (rx[i] + breath) * Math.cos(ang);
        positions[i * 3 + 1] = c.y + (ry[i] + breath) * Math.sin(ang);
        // leggera oscillazione dell'inclinazione del micro-seme
        angles[i] = Math.sin(t * 0.5 + breathPh[i]) * 0.4;
      }

      sp.markDirty();
      material.uniforms['uTime'].value = t;
      // fade-in morbido dell'alone in ~1.2s (i glifi sono già pieni e leggibili)
      const op = material.uniforms['uOpacity'];
      if (op.value < 1) op.value = Math.min(1, op.value + dt / 1.2);

      renderer.render(scene, camera);
    };

    hostEl.classList.add('is-on');
    loop();
  }
}
