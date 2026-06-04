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

/**
 * Hero 3D: le carte del "fish" (7-4 offsuit, come nel logo) fluttuano sul
 * tavolo. Three.js è importato dinamicamente (chunk lazy) solo se il contesto
 * lo consente; sotto il canvas c'è sempre un fallback CSS.
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

  /** Disegna la faccia di una carta su canvas (texture nitida senza asset). */
  private drawCardFace(rank: string, suit: string, color: string): HTMLCanvasElement {
    const w = 256;
    const h = 358;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#f3ead6';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 22);
    ctx.fill();
    ctx.strokeStyle = 'rgba(27,42,74,0.25)';
    ctx.lineWidth = 4;
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

  /** Dorso carta: navy con cornice rame e trama a losanghe. */
  private drawCardBack(): HTMLCanvasElement {
    const w = 256;
    const h = 358;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#16223f';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 22);
    ctx.fill();

    ctx.strokeStyle = '#c8632a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(14, 14, w - 28, h - 28, 14);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200, 99, 42, 0.35)';
    ctx.lineWidth = 2;
    for (let x = -h; x < w + h; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x + h, h - 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + h, 20);
      ctx.lineTo(x, h - 20);
      ctx.stroke();
    }

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

    scene.add(new THREE.AmbientLight(0xede4cd, 0.85));
    const key = new THREE.DirectionalLight(0xff8a3d, 1.6);
    key.position.set(6, 8, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0xffb547, 30, 40);
    rim.position.set(-6, -4, 5);
    scene.add(rim);

    // ---- carte ----
    const geometries: import('three').BufferGeometry[] = [];
    const materials: import('three').Material[] = [];
    const textures: import('three').Texture[] = [];

    const backTexture = new THREE.CanvasTexture(this.drawCardBack());
    backTexture.colorSpace = THREE.SRGBColorSpace;
    textures.push(backTexture);

    const makeCard = (face?: { rank: string; suit: string; color: string }) => {
      const geometry = new THREE.BoxGeometry(2.3, 3.22, 0.03);
      geometries.push(geometry);

      const edge = new THREE.MeshStandardMaterial({ color: 0xd8cdb0 });
      materials.push(edge);

      let front: import('three').MeshStandardMaterial;
      if (face) {
        const tex = new THREE.CanvasTexture(
          this.drawCardFace(face.rank, face.suit, face.color),
        );
        tex.colorSpace = THREE.SRGBColorSpace;
        textures.push(tex);
        front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
      } else {
        front = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.6 });
      }
      const back = new THREE.MeshStandardMaterial({ map: backTexture, roughness: 0.6 });
      materials.push(front, back);

      // BoxGeometry: [+x, -x, +y, -y, +z(front), -z(back)]
      return new THREE.Mesh(geometry, [edge, edge, edge, edge, front, back]);
    };

    // La mano del fish: 7♥ 4♣ in primo piano, contorno di dorsi
    const cards = [
      { mesh: makeCard({ rank: '7', suit: '♥', color: '#b3402e' }), x: 2.6, y: -0.2, z: 1.5, rotZ: 0.18, speed: 0.55, phase: 0 },
      { mesh: makeCard({ rank: '4', suit: '♣', color: '#1b2a4a' }), x: 4.6, y: 0.6, z: 0.4, rotZ: -0.22, speed: 0.7, phase: 1.4 },
      { mesh: makeCard(), x: 6.4, y: -1.6, z: -1.6, rotZ: 0.4, speed: 0.45, phase: 2.6 },
      { mesh: makeCard(), x: 1.2, y: 2.3, z: -2.4, rotZ: -0.35, speed: 0.6, phase: 3.4 },
      { mesh: makeCard(), x: -0.6, y: -2.5, z: -3.2, rotZ: 0.5, speed: 0.5, phase: 4.6 },
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

    const clock = new THREE.Clock();
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      if (!running || !visible) return;

      const t = clock.getElapsedTime();
      for (const card of cards) {
        card.mesh.position.y = card.y + Math.sin(t * card.speed + card.phase) * 0.45;
        card.mesh.rotation.y = Math.sin(t * card.speed * 0.6 + card.phase) * 0.38;
        card.mesh.rotation.z = card.rotZ + Math.sin(t * 0.3 + card.phase) * 0.06;
      }
      // parallasse leggera del puntatore
      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 0.55 - camera.position.y) * 0.04;
      camera.lookAt(2.5, 0, 0);

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
