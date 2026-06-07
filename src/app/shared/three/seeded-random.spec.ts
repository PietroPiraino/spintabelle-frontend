import { seededRandom, seededRange } from './seeded-random';

describe('seededRandom', () => {
  it('stesso seed → stessa sequenza (determinismo dei diorami)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 20; i++) {
      expect(a()).toBe(b());
    }
  });

  it('seed diversi → sequenze diverse', () => {
    const a = seededRandom(1);
    const b = seededRandom(2);
    const values = Array.from({ length: 5 }, () => [a(), b()]);
    expect(values.some(([x, y]) => x !== y)).toBeTrue();
  });

  it('seededRange resta nei limiti ed è deterministico', () => {
    const first = seededRange(7, 50, -1, 1);
    const second = seededRange(7, 50, -1, 1);
    expect(first).toEqual(second);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThan(1);
    }
  });
});
