import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { SceneResources } from '../../../shared/three/disposable-scene';
import { seededRandom } from '../../../shared/three/seeded-random';
import { bindSuitPalette, createSuitPoints } from '../../../shared/three/suit-points';

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

    // ---- polvere di semi + scia dal cursore (stesso canvas, factory condivisa) ----
    // Un unico SuitPoints: indici [0..DUST) = pulviscolo in controluce dietro
    // le carte, indici [DUST..DUST+TRAIL) = pool della scia davanti alle carte.
    const finePointer = matchMedia('(pointer: fine)').matches;
    const DUST = innerWidth < 600 ? 240 : 500;
    const TRAIL = 24;
    const TOTAL = DUST + TRAIL;

    const res = new SceneResources();
    this.cleanupFns.push(() => res.disposeAll());

    const sp = createSuitPoints(THREE, res, {
      count: TOTAL,
      seed: 0xb1f ^ 0x70e5,
      perspective: true,
      attenRef: 10,
      sizeFactor: 6, // i semi devono leggersi come FORME, non come punti
      sizeMin: 2.4, // sprite più grossi: il seme si riconosce a colpo d'occhio
      sizeSpan: 3.4, // taglia 2.4..5.8 (default 1.7..4.3 era troppo minuto)
      redShare: 0.32,
    });
    sp.points.name = 'hero-dust';
    sp.points.renderOrder = -1; // dietro le carte nel sort trasparente
    scene.add(sp.points);
    this.cleanupFns.push(bindSuitPalette(sp.material));

    const { positions, angles, alphas, seeds } = sp;

    // Stato della polvere: home y (per il wrap), fase d'ondeggio, ampiezze.
    const rand = seededRandom(0xb1f);
    const dustBaseX = new Float32Array(DUST);
    const dustY = new Float32Array(DUST);
    const dustZ = new Float32Array(DUST);
    const dustPhase = new Float32Array(DUST);
    const dustSwayAmp = new Float32Array(DUST);
    const dustRiseSpeed = new Float32Array(DUST);
    const dustAngAmp = new Float32Array(DUST);
    // Volume dietro le carte, ma VICINO alla camera: a z più profondi la
    // prospettiva li rimpiccioliva fino a sparire. Più stretto in z = più grossi.
    // X confinato alla BANDA VISIBILE a questa profondità (camera fov 38 @ z14
    // su (3.2,0,0)): fuori da ~[-2.5, 9.5] i semi cadevano oltre il bordo e
    // metà polvere finiva sprecata fuori frame.
    const DUST_X0 = -2.5;
    const DUST_X1 = 9.5;
    const DUST_Y0 = -5;
    const DUST_Y1 = 5;
    const DUST_Z0 = -4.5;
    const DUST_Z1 = -1.8;
    for (let i = 0; i < DUST; i++) {
      dustBaseX[i] = DUST_X0 + rand() * (DUST_X1 - DUST_X0);
      dustY[i] = DUST_Y0 + rand() * (DUST_Y1 - DUST_Y0);
      dustZ[i] = DUST_Z0 + rand() * (DUST_Z1 - DUST_Z0);
      dustPhase[i] = rand() * Math.PI * 2;
      dustSwayAmp[i] = 0.25 + rand() * 0.45; // ondeggio orizzontale leggero
      dustRiseSpeed[i] = 0.06 + rand() * 0.08; // deriva 0.06..0.14 verso l'alto
      dustAngAmp[i] = 0.25 + rand() * 0.1; // rotazione ±0.35
      // alpha per-particella alto: presenza netta (basta col subliminale)
      alphas[i] = 0.72 + rand() * 0.25; // 0.72..0.97
    }

    // Pool della scia: vita, posizione e velocità per particella.
    const trailLife = new Float32Array(TRAIL); // tempo (s) di morte; <=t = spenta
    const trailBornAt = new Float32Array(TRAIL);
    const trailX = new Float32Array(TRAIL);
    const trailY = new Float32Array(TRAIL);
    const trailZ = new Float32Array(TRAIL).fill(2); // piano davanti alle carte
    const trailVX = new Float32Array(TRAIL);
    const trailVY = new Float32Array(TRAIL);
    const TRAIL_DURATION = 0.85;
    for (let i = 0; i < TRAIL; i++) {
      const g = DUST + i;
      positions[g * 3] = trailX[i];
      positions[g * 3 + 1] = trailY[i];
      positions[g * 3 + 2] = trailZ[i];
      alphas[g] = 0; // a riposo nel pool: invisibili
    }
    sp.markDirty();

    // ---- interazione e ciclo di render ----
    const pointer = { x: 0, y: 0 };
    // posizione cursore in pixel CSS relativi al canvas (per l'unproject).
    // La velocità si misura PER FRAME nel loop (cursor.x vs frameX): robusto
    // anche con più pointermove fra due rAF.
    const cursor = { x: 0, y: 0, has: false };
    let frameX = 0; // posizione del cursore all'inizio del frame precedente
    let frameY = 0;
    // ray riusabile per l'unproject — nessuna allocazione nel loop
    const ndc = new THREE.Vector3();
    const rayDir = new THREE.Vector3();
    let lastSpawnAt = -1;
    let nextTrail = 0;
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / innerWidth) * 2 - 1;
      pointer.y = (event.clientY / innerHeight) * 2 - 1;
      if (finePointer) {
        const rect = hostEl.getBoundingClientRect();
        cursor.x = event.clientX - rect.left;
        cursor.y = event.clientY - rect.top;
        if (!cursor.has) {
          // primo evento: niente delta spurio al frame successivo
          frameX = cursor.x;
          frameY = cursor.y;
        }
        cursor.has = true;
      }
    };
    addEventListener('pointermove', onPointerMove, { passive: true });
    this.cleanupFns.push(() => removeEventListener('pointermove', onPointerMove));

    let running = true;
    let visible = true;

    // niente THREE.Clock (deprecato): basta il tempo trascorso
    const start = performance.now();
    let lastT = 0;
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      if (!running || !visible) return;

      const t = (performance.now() - start) / 1000;
      const dt = Math.min(Math.max(t - lastT, 0), 0.066);
      lastT = t;

      for (const card of cards) {
        card.mesh.position.y = card.y + Math.sin(t * card.speed + card.phase) * 0.45;
        card.mesh.rotation.y = Math.sin(t * card.speed * 0.6 + card.phase) * 0.38;
        card.mesh.rotation.z = card.rotZ + Math.sin(t * 0.3 + card.phase) * 0.06;
      }
      // parallasse leggera del puntatore
      camera.position.x += (pointer.x * 0.9 - camera.position.x) * 0.04;
      camera.position.y += (-pointer.y * 0.55 - camera.position.y) * 0.04;
      camera.lookAt(3.2, 0, 0);

      // ---- polvere: deriva verso l'alto + ondeggio + rotazione, tutto lento ----
      for (let i = 0; i < DUST; i++) {
        // deriva verticale lentissima con wrap quando esce in alto
        dustY[i] += dustRiseSpeed[i] * dt;
        if (dustY[i] > DUST_Y1) dustY[i] = DUST_Y0;
        const sway = Math.sin(t * 0.18 + dustPhase[i]) * dustSwayAmp[i];
        positions[i * 3] = dustBaseX[i] + sway;
        positions[i * 3 + 1] = dustY[i];
        positions[i * 3 + 2] = dustZ[i];
        angles[i] = Math.sin(t * 0.22 + dustPhase[i]) * dustAngAmp[i];
      }

      // ---- scia dal cursore: spawn su movimento veloce, poi vita 0.85s ----
      if (finePointer && cursor.has) {
        const mx = cursor.x - frameX;
        const my = cursor.y - frameY;
        frameX = cursor.x;
        frameY = cursor.y;
        const moved = Math.hypot(mx, my);
        // velocità > ~25px per frame e rate-limit ~1 spawn / 30ms
        if (moved > 25 && t - lastSpawnAt > 0.03) {
          lastSpawnAt = t;
          // unproject del cursore sul piano z=+2 (davanti alle carte)
          const rect = hostEl.getBoundingClientRect();
          const nx = rect.width > 0 ? (cursor.x / rect.width) * 2 - 1 : 0;
          const ny = rect.height > 0 ? -(cursor.y / rect.height) * 2 + 1 : 0;
          ndc.set(nx, ny, 0.5).unproject(camera);
          rayDir.copy(ndc).sub(camera.position).normalize();
          const tHit = (2 - camera.position.z) / rayDir.z;
          const sx = camera.position.x + rayDir.x * tHit;
          const sy = camera.position.y + rayDir.y * tHit;
          const slot = nextTrail;
          nextTrail = (nextTrail + 1) % TRAIL;
          trailBornAt[slot] = t;
          trailLife[slot] = t + TRAIL_DURATION;
          trailX[slot] = sx;
          trailY[slot] = sy;
          // direzione del movimento (px → scena, y invertita) * piccolo + deriva giù
          const inv = 1 / (moved || 1);
          trailVX[slot] = mx * inv * 1.4;
          trailVY[slot] = -my * inv * 1.4 - 0.6;
        }
      }
      // integrazione + alpha della pool della scia
      for (let i = 0; i < TRAIL; i++) {
        const g = DUST + i;
        if (trailLife[i] > t) {
          trailX[i] += trailVX[i] * dt;
          trailY[i] += trailVY[i] * dt;
          trailVY[i] -= 1.2 * dt; // deriva verso il basso che accelera piano
          const prog = (t - trailBornAt[i]) / TRAIL_DURATION;
          alphas[g] = Math.sin(Math.PI * prog) * 0.95;
          positions[g * 3] = trailX[i];
          positions[g * 3 + 1] = trailY[i];
          positions[g * 3 + 2] = 2;
          angles[g] = Math.atan2(trailVY[i], trailVX[i]) * 0.3;
        } else if (alphas[g] !== 0) {
          alphas[g] = 0; // rientro nel pool: invisibile
        }
      }

      sp.markDirty();
      sp.material.uniforms['uTime'].value = t;
      // fade-in globale del pulviscolo; boost per-tema (il teal su navy e il
      // navy su crema si perdono entrambi, in misura diversa)
      const opTarget = document.documentElement.dataset['theme'] === 'dark' ? 1.5 : 1.35;
      const op = sp.material.uniforms['uOpacity'];
      op.value = Math.min(opTarget, op.value + dt / 1.4);

      renderer.render(scene, camera);
    };

    const resize = () => {
      const { clientWidth, clientHeight } = hostEl;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      // la polvere/scia usano l'attenuazione prospettica in pixel: tieni il
      // uPixelRatio allineato al renderer dopo ogni resize
      sp.material.uniforms['uPixelRatio'].value = renderer.getPixelRatio();
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
