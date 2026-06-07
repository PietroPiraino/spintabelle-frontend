import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { SuitDividerLiveComponent } from './suit-divider-live.component';
import {
  DIORAMA_CAPABILITIES,
  type DioramaCapabilities,
} from '../three/three-capabilities';
import { THREE_LOADER } from '../three/three-loader';

function setup(caps: Partial<DioramaCapabilities>) {
  const loader = jasmine.createSpy('loadThree');
  TestBed.configureTestingModule({
    imports: [SuitDividerLiveComponent],
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
  return { fixture: TestBed.createComponent(SuitDividerLiveComponent), loader };
}

describe('SuitDividerLiveComponent', () => {
  it('il canvas è decorativo (aria-hidden) e parte spento', async () => {
    const { fixture } = setup({});
    await fixture.whenStable();
    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas')!;
    expect(canvas.getAttribute('aria-hidden')).toBe('true');
    expect((fixture.nativeElement as HTMLElement).classList.contains('is-on')).toBeFalse();
  });

  it('senza WebGL non carica three e restano i glifi nitidi ♠ ♥ ♦ ♣', async () => {
    const { fixture, loader } = setup({ hasWebGL: () => false });
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
    const glyphs = (fixture.nativeElement as HTMLElement).querySelectorAll('.sdl__glyph');
    expect(Array.from(glyphs, (g) => g.textContent?.trim())).toEqual(['♠', '♥', '♦', '♣']);
  });

  it('con prefers-reduced-motion non inizializza nulla', async () => {
    const { fixture, loader } = setup({
      hasWebGL: () => true,
      prefersReducedMotion: () => true,
    });
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
  });

  it('la fila dei glifi è decorativa (aria-hidden)', async () => {
    const { fixture } = setup({});
    await fixture.whenStable();
    const row = (fixture.nativeElement as HTMLElement).querySelector('.sdl__row')!;
    expect(row.getAttribute('aria-hidden')).toBe('true');
  });

  it('la destroy è sicura subito dopo la creazione', async () => {
    const { fixture } = setup({ hasWebGL: () => true });
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });
});
