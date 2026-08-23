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

  it('senza WebGL non carica three e restano i quattro semi nitidi', async () => {
    // ⚠️ I semi sono ICONE dal 23/08/2026, non più i caratteri `♠♥♦♣`: come
    // testo, su iOS ♥ e ♦ prendevano la presentazione emoji e la bicromia
    // ♠♣/♥♦ — che è l'identità di questo divisore — non arrivava a schermo.
    // Questo caso resta quello di prima nella sostanza: senza WebGL il canvas
    // non parte e i quattro semi devono esserci lo stesso, nell'ordine.
    const { fixture, loader } = setup({ hasWebGL: () => false });
    await fixture.whenStable();
    expect(loader).not.toHaveBeenCalled();
    const icone = (fixture.nativeElement as HTMLElement).querySelectorAll('.sdl__glyph app-icon');
    expect(Array.from(icone, (i) => i.getAttribute('name'))).toEqual([
      'spade',
      'heart',
      'diamond',
      'club',
    ]);
  });

  it('⚠️ ogni seme disegna davvero qualcosa: un nome senza ramo `@case` è un <svg> VUOTO', async () => {
    // Il modo di fallire di `app-icon` è muto (vedi ICON_NAMES): il nome
    // compila, il componente rende, e in pagina non si vede niente. Qui i
    // quattro nomi sono nuovi, quindi il caso va chiuso sul posto invece di
    // fidarsi che qualcuno guardi la home.
    const { fixture } = setup({});
    await fixture.whenStable();
    const path = (fixture.nativeElement as HTMLElement).querySelectorAll('.sdl__glyph svg path');
    expect(path.length).toBe(4);
    path.forEach((p) => expect(p.getAttribute('d')?.length).toBeGreaterThan(20));
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
