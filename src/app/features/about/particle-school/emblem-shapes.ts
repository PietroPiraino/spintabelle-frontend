import { seededRandom } from '../../../shared/three/seeded-random';

/**
 * Emblemi dei coach: i QUATTRO SEMI delle carte, campionati in nuvole di
 * punti che il banco di particelle "forma" quando il pannello è al centro
 * dello schermo. ♠ Exivezz · ♥ Nagato (il cuore/founder) · ♦ Bastogne ·
 * ♣ come sigillo sulla CTA.
 */
export type EmblemId = 'spade' | 'heart' | 'diamond' | 'club';

const SIZE = 320;

type DrawFn = (ctx: CanvasRenderingContext2D) => void;

/** Glifo tipografico pieno (♠/♣): la serif di sistema disegna semi perfetti. */
function glyph(symbol: string): DrawFn {
  return (ctx) => {
    ctx.font = `300px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, SIZE / 2, SIZE / 2 + 14);
  };
}

const EMBLEMS: Record<EmblemId, DrawFn> = {
  spade: glyph('♠'),
  heart: glyph('♥'),
  diamond: glyph('♦'),
  club: glyph('♣'),
};

/**
 * Campiona la sagoma in `count` punti normalizzati in [-0.5, 0.5]² (y verso
 * il basso, come i pixel). Deterministico: stesso emblema+seed → stessi punti.
 */
export function sampleEmblemPoints(id: EmblemId, count: number, seed = 7): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';
  ctx.save();
  EMBLEMS[id](ctx);
  ctx.restore();

  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const candidates: number[] = [];
  // passo 2: ~25k candidati max, più che sufficienti e veloci da raccogliere
  for (let y = 0; y < SIZE; y += 2) {
    for (let x = 0; x < SIZE; x += 2) {
      if (data[(y * SIZE + x) * 4 + 3] > 128) candidates.push(x, y);
    }
  }

  const points = new Float32Array(count * 2);
  const rand = seededRandom(seed + id.length * 31);
  const total = candidates.length / 2;
  for (let i = 0; i < count; i++) {
    const pick = Math.floor(rand() * total) % total;
    // micro-jitter sub-pixel: il bordo della sagoma resta organico
    points[i * 2] = (candidates[pick * 2] + rand() - 0.5) / SIZE - 0.5;
    points[i * 2 + 1] = (candidates[pick * 2 + 1] + rand() - 0.5) / SIZE - 0.5;
  }
  return points;
}
