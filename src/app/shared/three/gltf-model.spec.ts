import { tintMaterial } from './gltf-model';

/** Materiale finto col minimo che tintMaterial tocca. */
function fakeMaterial(name: string) {
  return { name, color: { setHex: jasmine.createSpy('setHex') }, needsUpdate: false };
}

/** Mesh finto: isMesh + uno o più materiali. */
function fakeMesh(...mats: ReturnType<typeof fakeMaterial>[]) {
  return { isMesh: true, material: mats.length === 1 ? mats[0] : mats };
}

/** Root finto la cui traverse visita se stesso + i figli passati. */
function fakeRoot(children: unknown[]) {
  return {
    isMesh: false,
    traverse(cb: (o: unknown) => void) {
      cb(this);
      children.forEach((c) => cb(c));
    },
  };
}

describe('tintMaterial', () => {
  it('tinge solo i materiali col nome che matcha (case-insensitive)', () => {
    const body = fakeMaterial('Fish_01');
    const eye = fakeMaterial('Eye_Lens');
    const root = fakeRoot([fakeMesh(body), fakeMesh(eye)]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tintMaterial(root as any, 'fish_01', 0xff7a2e);

    expect(body.color.setHex).toHaveBeenCalledWith(0xff7a2e);
    expect(body.needsUpdate).toBeTrue();
    expect(eye.color.setHex).not.toHaveBeenCalled();
  });

  it('gestisce i mesh con array di materiali', () => {
    const a = fakeMaterial('Body');
    const b = fakeMaterial('Trim');
    const root = fakeRoot([fakeMesh(a, b)]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tintMaterial(root as any, 'trim', 0x00ff00);

    expect(b.color.setHex).toHaveBeenCalledWith(0x00ff00);
    expect(a.color.setHex).not.toHaveBeenCalled();
  });

  it('non tocca nulla se nessun nome matcha', () => {
    const a = fakeMaterial('Alpha');
    const root = fakeRoot([fakeMesh(a)]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tintMaterial(root as any, 'zzz', 0x123456);

    expect(a.color.setHex).not.toHaveBeenCalled();
  });
});
