import { SceneResources } from './disposable-scene';

describe('SceneResources', () => {
  it('traccia le risorse e le restituisce (uso fluido)', () => {
    const res = new SceneResources();
    const fake = { dispose: jasmine.createSpy('dispose') };
    expect(res.track(fake)).toBe(fake);
    expect(res.size).toBe(1);
  });

  it('disposeAll libera tutto in ordine inverso ed è idempotente', () => {
    const res = new SceneResources();
    const order: string[] = [];
    res.track({ dispose: () => order.push('a') });
    res.track({ dispose: () => order.push('b') });

    res.disposeAll();
    expect(order).toEqual(['b', 'a']);
    expect(res.size).toBe(0);

    res.disposeAll(); // seconda chiamata: nessun doppio dispose
    expect(order).toEqual(['b', 'a']);
  });
});
