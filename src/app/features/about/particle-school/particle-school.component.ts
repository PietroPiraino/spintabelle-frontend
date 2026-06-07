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
import { drawSuitAtlas, sampleEmblemPoints, type EmblemId } from './emblem-shapes';

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

    // ---- attributi statici (seedati: il banco è sempre lo stesso) ----
    const rand = seededRandom(0xbff);
    const positions = new Float32Array(COUNT * 3);
    const angles = new Float32Array(COUNT);
    const seeds = new Float32Array(COUNT);
    const sizes = new Float32Array(COUNT);
    const suits = new Float32Array(COUNT);
    const px = new Float32Array(COUNT);
    const py = new Float32Array(COUNT);
    const vx = new Float32Array(COUNT);
    const vy = new Float32Array(COUNT);
    const streamU = new Float32Array(COUNT);
    const streamBand = new Float32Array(COUNT);

    for (let i = 0; i < COUNT; i++) {
      seeds[i] = rand();
      // tre "profondità": semi piccoli lontani, medi, grandi vicini
      const layer = rand();
      sizes[i] = 1.7 + layer * 2.6;
      // ♠/♥/♦/♣ per particella, sbilanciati sui neri (~68%): il banco resta
      // elegante e i semi rossi sono i lampi caldi che lo attraversano
      const suitRoll = rand();
      suits[i] = suitRoll < 0.34 ? 0 : suitRoll < 0.5 ? 1 : suitRoll < 0.66 ? 2 : 3;
      streamU[i] = rand();
      streamBand[i] = (rand() - 0.5) * 2; // -1..1: larghezza del banco
      px[i] = rand() * innerWidth;
      py[i] = rand() * innerHeight;
      vx[i] = (rand() - 0.5) * 60;
      vy[i] = (rand() - 0.5) * 60;
    }

    const geometry = res.track(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('aSuit', new THREE.BufferAttribute(suits, 1));

    // atlante ♠♥♦♣: ogni particella del banco è un micro-seme
    const atlas = res.track(new THREE.CanvasTexture(drawSuitAtlas()));
    atlas.flipY = false; // v verso il basso, come gl_PointCoord

    const material = res.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0 },
          uAtlas: { value: atlas },
          uColorA: { value: new THREE.Color(0x1b2a4a) },
          uColorB: { value: new THREE.Color(0xff6a1f) },
          uColorC: { value: new THREE.Color(0x00d4d4) },
        },
        vertexShader: /* glsl */ `
          attribute float aAngle;
          attribute float aSeed;
          attribute float aSize;
          attribute float aSuit;
          uniform float uPixelRatio;
          varying float vAngle;
          varying float vSeed;
          varying float vSuit;
          void main() {
            vAngle = aAngle;
            vSeed = aSeed;
            vSuit = aSuit;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * uPixelRatio * 3.3;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform float uOpacity;
          uniform sampler2D uAtlas;
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform vec3 uColorC;
          varying float vAngle;
          varying float vSeed;
          varying float vSuit;
          void main() {
            // micro-seme ♠♥♦♣: cella dell'atlante, leggermente inclinato
            // lungo la direzione di nuoto
            vec2 pc = gl_PointCoord - 0.5;
            float ca = cos(vAngle);
            float sa = sin(vAngle);
            vec2 uv = vec2(pc.x * ca + pc.y * sa, -pc.x * sa + pc.y * ca) + 0.5;
            if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
            float col = mod(vSuit, 2.0);
            float row = floor(vSuit / 2.0 + 0.001);
            float body = texture2D(uAtlas, (uv + vec2(col, row)) * 0.5).a;
            if (body < 0.05) discard;
            // brillio individuale lento
            float tw = 0.72 + 0.28 * sin(uTime * (1.2 + vSeed * 2.2) + vSeed * 40.0);
            // bicromia da carte: ♥♦ (celle 1 e 2) nel colore caldo, ♠♣ nel base
            float red = step(0.5, vSuit) * step(vSuit, 2.5);
            vec3 color = mix(uColorA, uColorB, red);
            // qualche seme "raro" nel colore accento
            color = mix(color, uColorC, step(0.95, vSeed));
            gl_FragColor = vec4(color, body * tw * uOpacity);
          }
        `,
      }),
    );

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.name = 'fish-school';
    scene.add(points);

    // ---- emblemi: nuvole di punti campionate, una per stazione ----
    const anchors = Array.from(
      document.querySelectorAll<HTMLElement>('[data-emblem]'),
    );
    const stations = anchors.map((el) => ({
      el,
      points: sampleEmblemPoints(el.dataset['emblem'] as EmblemId, COUNT),
    }));

    // ---- palette per-tema: il banco segue Ghiaccio/Tramonto/Notte ----
    const applyTheme = () => {
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(name).trim();
      const dark = document.documentElement.dataset['theme'] === 'dark';
      const u = material.uniforms;
      (u['uColorA'].value as InstanceType<typeof THREE.Color>).set(
        token(dark ? '--neon-cyan' : '--navy-700'),
      );
      (u['uColorB'].value as InstanceType<typeof THREE.Color>).set(token('--copper-500'));
      (u['uColorC'].value as InstanceType<typeof THREE.Color>).set(
        token(dark ? '--gold' : '--neon-cyan'),
      );
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    this.cleanupFns.push(() => themeObserver.disconnect());

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
    const positionAttr = geometry.getAttribute('position') as InstanceType<
      typeof THREE.BufferAttribute
    >;
    const angleAttr = geometry.getAttribute('aAngle') as InstanceType<
      typeof THREE.BufferAttribute
    >;

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

      positionAttr.needsUpdate = true;
      angleAttr.needsUpdate = true;

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
