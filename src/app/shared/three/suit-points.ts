import type { ThreeModule } from './diorama.types';
import type { SceneResources } from './disposable-scene';
import { seededRandom } from './seeded-random';

/**
 * Il linguaggio particellare del sito: micro-semi di carte ♠♥♦♣.
 * Factory condivisa fra il banco del /chi-siamo e gli elementi soft della
 * home (polvere nel hero, divisori vivi, passaggi sulla CTA): UNA geometria
 * Points + ShaderMaterial con atlante dei semi, alpha per-particella e
 * bicromia da carte (♥♦ caldi / ♠♣ base) theme-aware.
 */

/**
 * Atlante 2×2 dei semi: ♠ alto-sx, ♥ alto-dx, ♦ basso-sx, ♣ basso-dx;
 * ♥♦ sono i "rossi" (indici 1 e 2) per la bicromia da carte.
 */
export function drawSuitAtlas(size = 256): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cell = size / 2;
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(cell * 0.82)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const suits: Array<[string, number, number]> = [
    ['♠', 0, 0],
    ['♥', 1, 0],
    ['♦', 0, 1],
    ['♣', 1, 1],
  ];
  for (const [symbol, col, row] of suits) {
    ctx.fillText(symbol, col * cell + cell / 2, row * cell + cell / 2 + cell * 0.04);
  }
  return canvas;
}

export interface SuitPointsOptions {
  count: number;
  seed: number;
  /** Moltiplicatore di gl_PointSize (default 3.3, come il banco). */
  sizeFactor?: number;
  /** Range della taglia base per particella (default 1.7 + rand·2.6). */
  sizeMin?: number;
  sizeSpan?: number;
  /** Quota di semi rossi ♥♦ (default 0.32: il banco resta elegante). */
  redShare?: number;
  /**
   * Ampiezza del brillìo per-particella (0 = nessuno, default 0.56 = look
   * storico: alpha che pulsa fra ~0.44 e 1). Abbassalo per polveri "calme".
   */
  twinkle?: number;
  /**
   * Camera prospettica: attiva l'attenuazione della taglia con la distanza
   * (gl_PointSize ∝ attenRef / -z). Default false = ortografica in pixel.
   */
  perspective?: boolean;
  attenRef?: number;
}

export interface SuitPoints {
  points: import('three').Points;
  material: import('three').ShaderMaterial;
  /** Array vivi della simulazione: scrivi qui e chiama markDirty(). */
  positions: Float32Array; // xyz per particella
  angles: Float32Array;
  alphas: Float32Array; // alpha per-particella (default 1)
  seeds: Float32Array;
  sizes: Float32Array;
  suits: Float32Array;
  /** Segna position/angle/alpha da ricaricare sulla GPU. */
  markDirty(): void;
}

/** Crea il sistema di micro-semi; ogni risorsa è tracciata nel registro. */
export function createSuitPoints(
  THREE: ThreeModule,
  res: SceneResources,
  {
    count,
    seed,
    sizeFactor = 3.3,
    sizeMin = 1.7,
    sizeSpan = 2.6,
    redShare = 0.32,
    twinkle = 0.56,
    perspective = false,
    attenRef = 10,
  }: SuitPointsOptions,
): SuitPoints {
  const rand = seededRandom(seed);

  const positions = new Float32Array(count * 3);
  const angles = new Float32Array(count);
  const alphas = new Float32Array(count).fill(1);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  const suits = new Float32Array(count);

  const blackShare = 1 - redShare;
  for (let i = 0; i < count; i++) {
    seeds[i] = rand();
    sizes[i] = sizeMin + rand() * sizeSpan;
    // ♠/♥/♦/♣ sbilanciati sui neri: i rossi sono i lampi caldi
    const roll = rand();
    suits[i] =
      roll < blackShare / 2 ? 0 : roll < blackShare / 2 + redShare / 2 ? 1 : roll < blackShare / 2 + redShare ? 2 : 3;
  }

  const geometry = res.track(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aSuit', new THREE.BufferAttribute(suits, 1));

  const atlas = res.track(new THREE.CanvasTexture(drawSuitAtlas()));
  atlas.flipY = false; // v verso il basso, come gl_PointCoord
  // NIENTE mipmap: è un ATLANTE 2×2, ai livelli mip grossolani le quattro celle
  // si mescolano fra loro (il ♦ si sporca di ♠/♣ scuri) e, col variare della
  // taglia dello sprite, il livello mip oscilla → flicker "appare/sparisce".
  atlas.generateMipmaps = false;
  atlas.minFilter = THREE.LinearFilter;

  const material = res.track(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: 1 },
        uOpacity: { value: 0 },
        uTwinkle: { value: twinkle },
        uSizeFactor: { value: sizeFactor },
        uPerspective: { value: perspective ? 1 : 0 },
        uAttenRef: { value: attenRef },
        uAtlas: { value: atlas },
        uColorA: { value: new THREE.Color(0x1b2a4a) },
        uColorB: { value: new THREE.Color(0xff6a1f) },
        uColorC: { value: new THREE.Color(0x00d4d4) },
      },
      vertexShader: /* glsl */ `
        attribute float aAngle;
        attribute float aAlpha;
        attribute float aSeed;
        attribute float aSize;
        attribute float aSuit;
        uniform float uPixelRatio;
        uniform float uSizeFactor;
        uniform float uPerspective;
        uniform float uAttenRef;
        varying float vAngle;
        varying float vAlpha;
        varying float vSeed;
        varying float vSuit;
        void main() {
          vAngle = aAngle;
          vAlpha = aAlpha;
          vSeed = aSeed;
          vSuit = aSuit;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPos;
          float atten = mix(1.0, uAttenRef / max(0.1, -mvPos.z), uPerspective);
          gl_PointSize = aSize * uPixelRatio * uSizeFactor * atten;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uTwinkle;
        uniform sampler2D uAtlas;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        varying float vAngle;
        varying float vAlpha;
        varying float vSeed;
        varying float vSuit;
        void main() {
          // micro-seme ♠♥♦♣: cella dell'atlante, inclinato lungo il moto
          vec2 pc = gl_PointCoord - 0.5;
          float ca = cos(vAngle);
          float sa = sin(vAngle);
          vec2 uv = vec2(pc.x * ca + pc.y * sa, -pc.x * sa + pc.y * ca) + 0.5;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
          float col = mod(vSuit, 2.0);
          float row = floor(vSuit / 2.0 + 0.001);
          float body = texture2D(uAtlas, (uv + vec2(col, row)) * 0.5).a;
          if (body < 0.05) discard;
          // brillio individuale lento (ampiezza pilotata da uTwinkle; default
          // 0.56 = pulsa fra ~0.44 e 1, identico al look storico)
          float tw = (1.0 - uTwinkle) + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.2 + vSeed * 2.2) + vSeed * 40.0));
          // bicromia da carte: ♥♦ (1 e 2) nel colore caldo, ♠♣ nel base
          float red = step(0.5, vSuit) * step(vSuit, 2.5);
          vec3 color = mix(uColorA, uColorB, red);
          // qualche seme "raro" nel colore accento
          color = mix(color, uColorC, step(0.95, vSeed));
          gl_FragColor = vec4(color, body * tw * vAlpha * uOpacity);
        }
      `,
    }),
  );

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.name = 'suit-points';

  const positionAttr = geometry.getAttribute('position');
  const angleAttr = geometry.getAttribute('aAngle');
  const alphaAttr = geometry.getAttribute('aAlpha');

  return {
    points,
    material,
    positions,
    angles,
    alphas,
    seeds,
    sizes,
    suits,
    markDirty() {
      positionAttr.needsUpdate = true;
      angleAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    },
  };
}

/**
 * Palette theme-aware dai token CSS: base navy/ciano, caldo copper, accento
 * ciano/oro a seconda del tema. Osserva data-theme e aggiorna i uniform.
 * Ritorna la cleanup function (disconnette l'observer).
 */
export function bindSuitPalette(material: import('three').ShaderMaterial): () => void {
  const apply = () => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    const dark = document.documentElement.dataset['theme'] === 'dark';
    const u = material.uniforms;
    (u['uColorA'].value as { set(c: string): unknown }).set(
      token(dark ? '--neon-cyan' : '--navy-700'),
    );
    (u['uColorB'].value as { set(c: string): unknown }).set(token('--copper-500'));
    (u['uColorC'].value as { set(c: string): unknown }).set(
      token(dark ? '--gold' : '--neon-cyan'),
    );
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observer.disconnect();
}
