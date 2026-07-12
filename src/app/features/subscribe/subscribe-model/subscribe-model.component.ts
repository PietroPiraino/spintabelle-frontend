import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { DIORAMA_CAPABILITIES } from '../../../shared/three/three-capabilities';
import { THREE_LOADER } from '../../../shared/three/three-loader';
import { SceneResources } from '../../../shared/three/disposable-scene';
import { fitModel, loadGltfModel, tintMaterial } from '../../../shared/three/gltf-model';
import type { ThreeModule } from '../../../shared/three/diorama.types';

/** Configurazione di un mascotte 3D mostrato su una card abbonamento. */
export interface SubscribeModelSpec {
  /** URL del .glb (servito da public/, es. "/models/fish.glb"). */
  readonly url: string;
  /** Etichetta accessibile della card (es. "Pesce — piano Pesce Rosso"). */
  readonly alt: string;
  /** Colore (hex) della luce d'accento, in tono col tier. */
  readonly accent: number;
  /** Rotazione base [x,y,z] in radianti che orienta il modello (profilo). */
  readonly baseRotation?: readonly [number, number, number];
  /** Vira di tono un materiale del modello (es. il corpo del pesce → arancio). */
  readonly tint?: { readonly match: string; readonly color: number };
  /** Fattore di scala aggiuntivo (default 1): <1 lascia margine nel riquadro. */
  readonly scale?: number;
}

const TARGET_SIZE = 2.3; // lato più lungo del modello in unità scena

/**
 * Mascotte 3D di una card abbonamento (pesce / squalo). Stessa filosofia
 * dell'hero della landing: three importato lazy, scena ripulita a dovere,
 * messa in pausa fuori dal viewport. I modelli sono statici (0 clip) → l'idle
 * "galleggiamento" è procedurale. Sotto il canvas resta sempre un fallback CSS:
 * se WebGL manca, il dispositivo è in reduced-motion estremo, o il .glb non è
 * ancora presente, la card resta integra (nessun crash).
 */
@Component({
  selector: 'app-subscribe-model',
  imports: [],
  template: `
    <div class="sub3d" [attr.aria-label]="spec().alt" [style.--sub3d-accent]="accentCss()">
      <div class="sub3d__fallback" aria-hidden="true"></div>
      <canvas #canvas class="sub3d__canvas" aria-hidden="true"></canvas>
    </div>
  `,
  styleUrl: './subscribe-model.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscribeModelComponent implements OnDestroy {
  readonly spec = input.required<SubscribeModelSpec>();
  /** Card selezionata: il modello "risponde" (luce accent + piccolo zoom). */
  readonly selected = input(false);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly caps = inject(DIORAMA_CAPABILITIES);
  private readonly loadThree = inject(THREE_LOADER);
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private cleanupFns: (() => void)[] = [];
  private rafId = 0;
  private disposed = false;

  constructor() {
    afterNextRender(() => {
      if (!this.caps.hasWebGL()) return; // resta il fallback CSS
      void this.initScene();
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    // guardia SSR/prerender: su server rafId=0 e il global non esiste.
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  /** Accent come stringa CSS per il glow del fallback (#rrggbb). */
  protected accentCss(): string {
    return '#' + this.spec().accent.toString(16).padStart(6, '0');
  }

  private async initScene(): Promise<void> {
    const THREE: ThreeModule = await this.loadThree();
    if (this.disposed) return;

    const spec = this.spec();
    const canvas = this.canvasRef().nativeElement;
    const hostEl = this.host.nativeElement;
    const reducedMotion = this.caps.prefersReducedMotion();

    const res = new SceneResources();
    this.cleanupFns.push(() => res.disposeAll());

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.12, 3.5);
    camera.lookAt(0, 0, 0);

    // Luci: ambiente morbido + key bianca + accento nel tono del tier
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.5, 3.5, 4);
    scene.add(key);
    const accent = new THREE.PointLight(spec.accent, 9, 14, 2);
    accent.position.set(-2.4, -1, 2.5);
    scene.add(accent);

    // ---- caricamento modello (.glb): se fallisce, niente crash, resta il fallback ----
    let wrapper: import('three').Group;
    try {
      const { root } = await loadGltfModel(THREE, res, spec.url);
      if (this.disposed) {
        res.disposeAll();
        return;
      }
      if (spec.tint) tintMaterial(root, spec.tint.match, spec.tint.color);
      wrapper = fitModel(THREE, root, TARGET_SIZE);
      if (spec.scale) wrapper.scale.multiplyScalar(spec.scale);
    } catch {
      // .glb assente o illeggibile: ripulisci e lascia il fallback CSS
      res.disposeAll();
      renderer.dispose();
      renderer.forceContextLoss();
      this.cleanupFns = this.cleanupFns.filter(Boolean);
      return;
    }
    const [baseX, baseY, baseZ] = spec.baseRotation ?? [0, 0, 0];
    wrapper.rotation.set(baseX, baseY, baseZ);
    scene.add(wrapper);

    this.cleanupFns.push(() => {
      renderer.dispose();
      renderer.forceContextLoss();
    });

    const resize = () => {
      const { clientWidth, clientHeight } = hostEl;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      // ridisegna subito: setSize pulisce il canvas e in modalità statica
      // (reduced-motion) non c'è il loop a ripristinare il frame
      renderer.render(scene, camera);
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hostEl);
    this.cleanupFns.push(() => resizeObserver.disconnect());

    canvas.classList.add('is-on');

    // reduced-motion: render statico singolo, niente loop
    if (reducedMotion) {
      renderer.render(scene, camera);
      return;
    }

    // ---- parallasse dal cursore (solo puntatore fine: desktop) ----
    const baseScale = wrapper.scale.x; // fitModel ha già scalato sul lato lungo
    const fine = this.caps.hasFinePointer();
    let pnx = 0; // target normalizzato [-1,1] del cursore nel riquadro
    let pny = 0;
    let pcx = 0; // valore corrente smussato
    let pcy = 0;
    let hovering = false;
    let boost = 0; // 0→1 quando la card è selezionata
    if (fine) {
      const onMove = (e: PointerEvent) => {
        const r = hostEl.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        pnx = ((e.clientX - r.left) / r.width) * 2 - 1;
        pny = ((e.clientY - r.top) / r.height) * 2 - 1;
        hovering = true;
      };
      const onLeave = () => (hovering = false);
      hostEl.addEventListener('pointermove', onMove, { passive: true });
      hostEl.addEventListener('pointerleave', onLeave, { passive: true });
      this.cleanupFns.push(() => {
        hostEl.removeEventListener('pointermove', onMove);
        hostEl.removeEventListener('pointerleave', onLeave);
      });
    }

    // ---- idle procedurale: bob + ondeggio + rollio, parallasse e reazione alla selezione ----
    let running = true;
    let visible = true;
    const start = performance.now();
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      if (!running || !visible) return;

      const t = (performance.now() - start) / 1000;
      // easing verso il target del cursore (0 quando non si è sopra → rientro)
      pcx += ((hovering ? pnx : 0) - pcx) * 0.08;
      pcy += ((hovering ? pny : 0) - pcy) * 0.08;
      boost += ((this.selected() ? 1 : 0) - boost) * 0.12;

      wrapper.position.y = Math.sin(t * 0.9) * 0.06;
      wrapper.rotation.x = baseX + pcy * 0.18; // si inclina verso il cursore
      wrapper.rotation.y = baseY + Math.sin(t * 0.5) * 0.25 + pcx * 0.25; // si gira verso il cursore
      wrapper.rotation.z = baseZ + Math.sin(t * 0.4 + 1) * 0.05;
      wrapper.scale.setScalar(baseScale * (1 + boost * 0.07)); // piccolo zoom se selezionata
      accent.intensity = 9 + boost * 12; // accento più vivo se selezionata
      renderer.render(scene, camera);
    };

    const intersection = new IntersectionObserver(
      ([entry]) => (visible = entry.isIntersecting),
    );
    intersection.observe(hostEl);
    this.cleanupFns.push(() => intersection.disconnect());

    const onVisibility = () => (running = !document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanupFns.push(() =>
      document.removeEventListener('visibilitychange', onVisibility),
    );

    loop();
  }
}
