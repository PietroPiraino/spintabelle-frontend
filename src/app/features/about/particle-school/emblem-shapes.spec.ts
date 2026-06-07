import { sampleEmblemPoints, type EmblemId } from './emblem-shapes';

describe('sampleEmblemPoints', () => {
  const EMBLEMS: EmblemId[] = ['spade', 'heart', 'diamond', 'club'];

  for (const emblem of EMBLEMS) {
    it(`campiona "${emblem}" nel numero richiesto di punti, dentro i limiti`, () => {
      const points = sampleEmblemPoints(emblem, 500);
      expect(points.length).toBe(1000);
      for (const value of points) {
        expect(value).toBeGreaterThanOrEqual(-0.5);
        expect(value).toBeLessThanOrEqual(0.5);
      }
    });
  }

  it('è deterministico: stesso emblema+seed → stessi punti', () => {
    const a = sampleEmblemPoints('spade', 300, 7);
    const b = sampleEmblemPoints('spade', 300, 7);
    expect(a).toEqual(b);
  });

  it('emblemi diversi producono nuvole diverse', () => {
    const spade = sampleEmblemPoints('spade', 300, 7);
    const diamond = sampleEmblemPoints('diamond', 300, 7);
    let different = 0;
    for (let i = 0; i < spade.length; i++) {
      if (Math.abs(spade[i] - diamond[i]) > 0.01) different++;
    }
    expect(different).toBeGreaterThan(spade.length * 0.5);
  });
});
