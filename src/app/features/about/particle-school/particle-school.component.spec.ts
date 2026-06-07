import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ParticleSchoolComponent } from './particle-school.component';
import {
  DIORAMA_CAPABILITIES,
  type DioramaCapabilities,
} from '../../../shared/three/three-capabilities';
import { THREE_LOADER } from '../../../shared/three/three-loader';

function setup(caps: Partial<DioramaCapabilities>) {
  const loader = jasmine.createSpy('loadThree');
  TestBed.configureTestingModule({
    imports: [ParticleSchoolComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: DIORAMA_CAPABILITIES,
        useValue: {
          hasWebGL: () => false,
          prefersReducedMotion: () => false,
          hasFinePointer: () => false,
          ...caps,
        } satisfies DioramaCapabilities,
      },
      { provide: THREE_LOADER, useValue: loader },
    ],
  });
  return { fixture: TestBed.createComponent(ParticleSchoolComponent), loader };
}

describe('ParticleSchoolComponent', () => {
  it('il canvas è decorativo (aria-hidden) e parte spento', async () => {
    const { fixture } = setup({});
    await fixture.whenStable();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect(canvas.classList.contains('is-on')).toBeFalse();
  });

  it('senza WebGL non carica three (la pagina vive senza banco)', async () => {
    const { fixture, loader } = setup({ hasWebGL: () => false });
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
  });

  it('con prefers-reduced-motion non inizializza nulla', async () => {
    const { fixture, loader } = setup({
      hasWebGL: () => true,
      prefersReducedMotion: () => true,
    });
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
  });

  it('la destroy è sicura subito dopo la creazione', async () => {
    const { fixture } = setup({ hasWebGL: () => true });
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
