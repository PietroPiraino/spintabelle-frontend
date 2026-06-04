import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

type ThreeModule = typeof import('three');

// Dimensioni carta (unità scena) e raggio degli angoli
const CARD_W = 2.3;
const CARD_H = 3.22;
const CARD_R = 0.16;

/**
 * Hero 3D: la mano del "fish" (7♣ 4♣, come nel logo) fluttua sul tavolo.
 * Three.js è importato dinamicamente (chunk lazy) solo se il contesto lo
 * consente; sotto il canvas c'è sempre un fallback CSS.
 */
@Component({
  selector: 'app-hero-3d',
  imports: [],
  template: `
    <div class="hero3d__fallback" aria-hidden="true"></div>
    <canvas #canvas class="hero3d__canvas" aria-hidden="true"></canvas>
  `,
  styleUrl: './hero-3d.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hero3dComponent implements OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  private cleanupFns: (() => void)[] = [];
  private rafId = 0;
  private disposed = false;

  constructor() {
    afterNextRender(() => {
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion || !this.hasWebGL()) return; // resta il fallback CSS
      void this.initScene();
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  private hasWebGL(): boolean {
    try {
      const probe = document.createElement('canvas');
      return !!(probe.getContext('webgl2') ?? probe.getContext('webgl'));
    } catch {
      return false;
    }
  }

  /**
   * Faccia di una carta su canvas (texture nitida senza asset).
   * L'intero canvas viene riempito: gli angoli arrotondati sono dati dalla
   * geometria, non dalla texture (niente più spigoli neri).
   */
  private drawCardFace(rank: string, suit: string, color: string): HTMLCanvasElement {
    const w = 256;
    const h = 358;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(22, 34, 63, 0.3)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(5, 5, w - 10, h - 10, 18);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.textAlign = 'center';

    // angoli (alto-sx e basso-dx ruotato)
    ctx.font = '700 56px "Bricolage Grotesque", sans-serif';
    ctx.fillText(rank, 40, 64);
    ctx.font = '44px serif';
    ctx.fillText(suit, 40, 110);
    ctx.save();
    ctx.translate(w - 40, h - 64 + 14);
    ctx.rotate(Math.PI);
    ctx.font = '700 56px "Bricolage Grotesque", sans-serif';
    ctx.fillText(rank, 0, 0);
    ctx.font = '44px serif';
    ctx.fillText(suit, 0, 46);
    ctx.restore();

    // seme centrale
    ctx.font = '150px serif';
    ctx.fillText(suit, w / 2, h / 2 + 52);

    return canvas;
  }

  /**
   * Dorso carta chiaro: sul tema ghiaccio il testo navy resta leggibile
   * anche quando una carta passa dietro ai titoli della hero.
   */
  private drawCardBack(): HTMLCanvasElement {
    const w = 256;
    const h = 358;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f4f1e9';
    ctx.fillRect(0, 0, w, h);

    // trama a losanghe soft (ciano/arancio alternati)
    ctx.lineWidth = 2;
    let stripe = 0;
    for (let x = -h; x < w + h; x += 26) {
      ctx.strokeStyle =
        stripe++ % 2 === 0
          ? 'rgba(0, 212, 212, 0.22)'
          : 'rgba(255, 106, 31, 0.2)';
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + h, h - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + h, 20);
      ctx.lineTo(x, h - 20);
      ctx.stroke();
    }

    // fiore centrale in filigrana
    ctx.fillStyle = 'rgba(22, 34, 63, 0.14)';
    ctx.font = '120px serif';
    ctx.textAlign = 'center';
    ctx.fillText('♣', w / 2, h / 2 + 42);

    // cornice neon arancio
    ctx.strokeStyle = '#ff6a1f';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(14, 14, w - 28, h - 28, 14);
    ctx.stroke();

    return canvas;
  }

  private async initScene(): Promise<void> {
    const THREE: ThreeModule = await import('three');
    if (this.disposed) return;

    const canvas = this.canvasRef().nativeElement;
    const hostEl = this.host.nativeElement as HTMLElement;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    // Luci per fondo chiaro: ambiente alto, tocco neon arancio
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 7);
    scene.add(key);
    const neon = new THREE.PointLight(0xff6a1f, 22, 40);
    neon.position.set(-6, -4, 6);
    scene.add(neon);

    // ---- geometria carta: rounded rect estruso (angoli arrotondati veri) ----
    const roundedRect = (w: number, h: number, r: number) => {
      const shape = new THREE.Shape();
      const x = -w / 2;
      const y = -h / 2;
      shape.moveTo(x + r, y);
      shape.lineTo(x + w - r, y);
      shape.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
      shape.lineTo(x + w, y + h - r);
      shape.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
      shape.lineTo(x + r, y + h);
      shape.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
      shape.lineTo(x, y + r);
      shape.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
      return shape;
    };

    const cardShape = roundedRect(CARD_W, CARD_H, CARD_R);

    const geometries: import('three').BufferGeometry[] = [];
    const materials: import('three').Material[] = [];
    const textures: import('three').Texture[] = [];

    /** Mappa la texture sulle coordinate della shape (UV = posizione xy). */
    const fitTexture = (tex: import('three').CanvasTexture) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.repeat.set(1 / CARD_W, 1 / CARD_H);
      tex.offset.set(0.5, 0.5);
      textures.push(tex);
      return tex;
    };

    const backTexture = fitTexture(new THREE.CanvasTexture(this.drawCardBack()));

    const makeCard = (face?: { rank: string; suit: string; color: string }) => {
      // ExtrudeGeometry: gruppo 0 = facce (fronte/retro), gruppo 1 = bordo
      const geometry = new THREE.ExtrudeGeometry(cardShape, {
        depth: 0.04,
        bevelEnabled: false,
      });
      geometry.translate(0, 0, -0.02);
      geometries.push(geometry);

      const capTexture = face
        ? fitTexture(new THREE.CanvasTexture(this.drawCardFace(face.rank, face.suit, face.color)))
        : backTexture;
      const caps = new THREE.MeshStandardMaterial({ map: capTexture, roughness: 0.5 });
      const edge = new THREE.MeshStandardMaterial({ color: 0xf2efe6 });
      materials.push(caps, edge);

      return new THREE.Mesh(geometry, [caps, edge]);
    };

    // La mano del fish: 7♣ 4♣ in primo piano (come nel logo), contorno di dorsi
    const navy = '#1b2a4a';
    const cards = [
      { mesh: makeCard({ rank: '7', suit: '♣', color: navy }), x: 3.5, y: -0.2, z: 1.5, rotZ: 0.18, speed: 0.55, phase: 0 },
      { mesh: makeCard({ rank: '4', suit: '♣', color: navy }), x: 5.5, y: 0.6, z: 0.4, rotZ: -0.22, speed: 0.7, phase: 1.4 },
      { mesh: makeCard(), x: 7.2, y: -1.6, z: -1.6, rotZ: 0.4, speed: 0.45, phase: 2.6 },
      { mesh: makeCard(), x: 4.4, y: 3.3, z: -2.4, rotZ: -0.35, speed: 0.6, phase: 3.4 },
      // tutte sul lato destro: la colonna di testo resta sempre libera
      { mesh: makeCard(), x: 6.2, y: -3.4, z: -3.2, rotZ: 0.5, speed: 0.5, phase: 4.6 },
    ];
    for (const card of cards) {
      card.mesh.position.set(card.x, card.y, card.z);
      card.mesh.rotation.z = card.rotZ;
      scene.add(card.mesh);
    }

    // ---- interazione e ciclo di render ----
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / innerWidth) * 2 - 1;
      pointer.y = (event.clientY / innerHeight) * 2 - 1;
    };
    addEventListener('pointermove', onPointerMove, { passive: true });
    this.cleanupFns.push(() => removeEventListener('pointermove', onPointerMove));

    let running = true;
    let visible = true;

    // niente THREE.Clock (deprecato): basta il tempo trascorso
    const start = performance.now();
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      if (!running || !visible) return;

      const t = (performance.now() - start) / 1000;
      for (const card of cards) {
        card.mesh.position.y = card.y + Math.sin(t * card.speed + card.phase) * 0.45;
        card.mesh.rotation.y = Math.sin(t * card.speed * 0.6 + card.phase) * 0.38;
        card.mesh.rotation.z = card.rotZ + Math.sin(t * 0.3 + card.phase) * 0.06;
      }
      // parallasse leggera del puntatore
      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 0.55 - camera.position.y) * 0.04;
      camera.lookAt(3.2, 0, 0);

      renderer.render(scene, camera);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = hostEl;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(hostEl);
    this.cleanupFns.push(() => resizeObserver.disconnect());

    // pausa quando fuori viewport o scheda nascosta
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

    // dispose completo di renderer/geometrie/materiali/texture
    this.cleanupFns.push(() => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    });

    canvas.classList.add('is-on');
    loop();
  }
}
