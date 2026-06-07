import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { DIORAMA_CAPABILITIES } from '../../../shared/three/three-capabilities';
import { THREE_LOADER } from '../../../shared/three/three-loader';
import { SceneResources } from '../../../shared/three/disposable-scene';
import { seededRandom } from '../../../shared/three/seeded-random';
import { bindSuitPalette, createSuitPoints } from '../../../shared/three/suit-points';
import { sampleEmblemPoints, type EmblemId } from './emblem-shapes';

/**
 * Il banco di Best Fish Forever: un unico organismo di particelle-pesce che
 * vive DIETRO tutta la pagina /chi-siamo. Nuota in corrente tra le sezioni,
 * scappa dal cursore e — quando il pannello di un coach è al centro dello
 * schermo — si riforma nel suo emblema (ancore DOM `[data-emblem]`).
 *
 * Tecnica: THREE.Points + ShaderMaterial (1 draw call), camera ortografica
 * mappata 1:1 sui pixel CSS (le ancore si misurano con getBoundingClientRect
 * e sono già nello spazio del canvas, che è fixed full-viewport).
 */
@Component({
  selector: 'app-particle-school',
  imports: [],
  template: `<canvas #canvas class="ps__canvas" aria-hidden="true"></canvas>`,
  styleUrl: './particle-school.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticleSchoolComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly loadThree = inject(THREE_LOADER);
  private readonly caps = inject(DIORAMA_CAPABILITIES);
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private cleanupFns: (() => void)[] = [];
  private rafId = 0;
  private disposed = false;

  constructor() {
    afterNextRender(() => {
      // reduced-motion o niente WebGL → la pagina vive benissimo senza banco
      if (this.caps.prefersReducedMotion() || !this.caps.hasWebGL()) return;
      void this.initSchool().catch((error) => {
        this.teardown();
        console.warn('[particle-school] init fallita, pagina senza banco', error);
      });
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.teardown();
  }

  private teardown(): void {
    cancelAnimationFrame(this.rafId);
    const fns = this.cleanupFns;
    this.cleanupFns = [];
    fns.forEach((fn) => fn());
  }

  private async initSchool(): Promise<void> {
    const THREE = await this.loadThree();
    if (this.disposed) return;

    const canvas = this.canvasRef().nativeElement;
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
    // Ortografica in pixel CSS: origine in alto a sinistra, y verso il basso
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, -10, 10);

    const isMobile = () => innerWidth < 600;
    const COUNT = isMobile() ? 3500 : 9000;

    const rand = seededRandom(0xbff ^ 0x51ed);
    // ---- il banco: micro-semi ♠♥♦♣ dalla factory condivisa ----
    const sp = createSuitPoints(THREE, res, { count: COUNT, seed: 0xbff });
    const { positions, angles, seeds } = sp;
    const material = sp.material;
    sp.points.name = 'fish-school';
    scene.add(sp.points);

    // stato dinamico per-particella (seed separato da quello della factory)
    const px = new Float32Array(COUNT);
    const py = new Float32Array(COUNT);
    const vx = new Float32Array(COUNT);
    const vy = new Float32Array(COUNT);
    const streamU = new Float32Array(COUNT);
    const streamBand = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      streamU[i] = rand();
      streamBand[i] = (rand() - 0.5) * 2; // -1..1: larghezza del banco
      px[i] = rand() * innerWidth;
      py[i] = rand() * innerHeight;
      vx[i] = (rand() - 0.5) * 60;
      vy[i] = (rand() - 0.5) * 60;
    }

    // ---- emblemi: nuvole di punti campionate, una per stazione ----
    const anchors = Array.from(
      document.querySelectorAll<HTMLElement>('[data-emblem]'),
    );
    const stations = anchors.map((el) => ({
      el,
      points: sampleEmblemPoints(el.dataset['emblem'] as EmblemId, COUNT),
    }));

    // ---- palette per-tema: il banco segue Ghiaccio/Tramonto/Notte ----
    this.cleanupFns.push(bindSuitPalette(material));

    // ---- input: cursore (fuga) e visibilità della scheda ----
    const mouse = { x: -9999, y: -9999 };
    const onPointerMove = (event: PointerEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };
    const onPointerOut = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    if (this.caps.hasFinePointer()) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      document.documentElement.addEventListener('pointerleave', onPointerOut);
      this.cleanupFns.push(() => {
        window.removeEventListener('pointermove', onPointerMove);
        document.documentElement.removeEventListener('pointerleave', onPointerOut);
      });
    }

    let running = true;
    const onVisibility = () => (running = !document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanupFns.push(() => document.removeEventListener('visibilitychange', onVisibility));

    // ---- resize ----
    const resize = () => {
      const w = innerWidth;
      const h = innerHeight;
      if (w === 0 || h === 0) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile() ? 1.5 : 2));
      renderer.setSize(w, h, false);
      camera.right = w;
      camera.bottom = h;
      camera.updateProjectionMatrix();
      material.uniforms['uPixelRatio'].value = renderer.getPixelRatio();
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });
    this.cleanupFns.push(() => window.removeEventListener('resize', resize));

    // ---- simulazione ----
    const start = performance.now();
    let lastT = 0;

    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      if (!running) return;

      const t = (performance.now() - start) / 1000;
      const dt = Math.min(Math.max(t - lastT, 0), 0.066);
      lastT = t;

      const w = innerWidth;
      const h = innerHeight;

      // stazione più "centrata" nello schermo in questo frame
      let bestAct = 0;
      let bestCx = 0;
      let bestCy = 0;
      let bestScale = 0;
      let bestPoints: Float32Array | null = null;
      for (const station of stations) {
        const r = station.el.getBoundingClientRect();
        if (r.width === 0) continue;
        const cy = r.top + r.height / 2;
        const offset = Math.abs(cy - h / 2) / (h * 0.62);
        // plateau: attivazione PIENA quando la stazione è vicina al centro,
        // poi decadimento morbido (l'emblema deve tenersi mentre leggi)
        const k = Math.min(Math.max((offset - 0.32) / 0.55, 0), 1);
        const act = 1 - k * k * (3 - 2 * k);
        if (act > bestAct) {
          bestAct = act;
          bestCx = r.left + r.width / 2;
          bestCy = cy;
          bestScale = Math.min(r.width, r.height);
          bestPoints = station.points;
        }
      }

      const tw = t * 0.012;
      for (let i = 0; i < COUNT; i++) {
        const seed = seeds[i];

        // corrente: NASTRO stretto e sinuoso (un banco coeso, non una nebbia)
        const u = (streamU[i] + tw * (0.7 + seed * 0.8)) % 1;
        const streamX = u * (w + 360) - 180;
        const streamY =
          h * 0.5 +
          Math.sin(u * Math.PI * 2 * 1.35 + t * 0.16) * h * 0.19 +
          streamBand[i] * h * 0.042;

        // formazione: l'attivazione è sfalsata per pesce (arrivo a ondate)
        let tx = streamX;
        let ty = streamY;
        const act = bestPoints ? Math.pow(bestAct, 0.8 + seed * 0.9) : 0;
        if (bestPoints && act > 0.02) {
          // micro-orbita attorno al proprio punto: l'emblema respira
          const ox = Math.sin(t * 0.9 + seed * 31) * 2.6;
          const oy = Math.cos(t * 0.8 + seed * 17) * 2.6;
          const ex = bestCx + bestPoints[i * 2] * bestScale + ox;
          const ey = bestCy + bestPoints[i * 2 + 1] * bestScale + oy;
          tx = streamX + (ex - streamX) * act;
          ty = streamY + (ey - streamY) * act;
        }

        // arrive: in FORMAZIONE si scatta verso il punto (è l'arrive a
        // frenare vicino alla meta) — l'emblema si compone in ~1s, non in 6
        const dx = tx - px[i];
        const dy = ty - py[i];
        const dist = Math.hypot(dx, dy) || 1;
        const maxSpeed = 240 + seed * 160 + act * 280;
        const arrive = Math.min(1, dist / (90 + (1 - act) * 60));
        const desiredX = (dx / dist) * maxSpeed * arrive;
        const desiredY = (dy / dist) * maxSpeed * arrive;
        const accel = 5.5 + act * 4;
        let ax = (desiredX - vx[i]) * accel;
        let ay = (desiredY - vy[i]) * accel;

        // vaganza da banco (si spegne in formazione)
        const wander = 30 * (1 - act);
        ax += Math.sin(t * 1.25 + seed * 39) * wander;
        ay += Math.cos(t * 1.05 + seed * 23) * wander;

        // fuga dal cursore
        const fx = px[i] - mouse.x;
        const fy = py[i] - mouse.y;
        const fd = Math.hypot(fx, fy);
        if (fd < 150 && fd > 0.001) {
          const force = (1 - fd / 150) * 1500;
          ax += (fx / fd) * force;
          ay += (fy / fd) * force;
        }

        vx[i] += ax * dt;
        vy[i] += ay * dt;
        const damp = 1 - 1.8 * dt;
        vx[i] *= damp;
        vy[i] *= damp;

        px[i] += vx[i] * dt;
        py[i] += vy[i] * dt;

        positions[i * 3] = px[i];
        positions[i * 3 + 1] = py[i];
        // inclinazione: i semi si PIEGANO nella direzione di nuoto (mai
        // capovolti) e si raddrizzano quando l'emblema è formato
        const targetAngle =
          act > 0.6 ? 0 : Math.atan2(vy[i], vx[i]) * 0.3;
        angles[i] += (targetAngle - angles[i]) * Math.min(1, 5 * dt);
      }

      sp.markDirty();

      material.uniforms['uTime'].value = t;
      // fade-in del banco al primo arrivo
      const op = material.uniforms['uOpacity'];
      if (op.value < 1) op.value = Math.min(1, op.value + dt / 1.2);

      renderer.render(scene, camera);
    };

    canvas.classList.add('is-on');
    loop();
  }
}
