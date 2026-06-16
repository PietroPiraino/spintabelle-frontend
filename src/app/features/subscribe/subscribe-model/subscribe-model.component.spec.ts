import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DIORAMA_CAPABILITIES } from '../../../shared/three/three-capabilities';
import { THREE_LOADER } from '../../../shared/three/three-loader';
import {
  SubscribeModelComponent,
  SubscribeModelSpec,
} from './subscribe-model.component';

const SPEC: SubscribeModelSpec = {
  url: '/models/fish.glb',
  alt: 'Pesce di test',
  accent: 0xff6a1f,
  baseRotation: [0, 1.25, 0],
};

describe('SubscribeModelComponent', () => {
  let loadThreeSpy: jasmine.Spy;

  function configure(hasWebGL: boolean): void {
    // loadThree non deve mai risolvere nei test: una Promise pendente basta
    loadThreeSpy = jasmine
      .createSpy('loadThree')
      .and.returnValue(new Promise(() => {}));
    TestBed.configureTestingModule({
      imports: [SubscribeModelComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: DIORAMA_CAPABILITIES,
          useValue: {
            hasWebGL: () => hasWebGL,
            prefersReducedMotion: () => true,
            hasFinePointer: () => false,
          },
        },
        { provide: THREE_LOADER, useValue: loadThreeSpy },
      ],
    });
  }

  function create(): ComponentFixture<SubscribeModelComponent> {
    const fixture = TestBed.createComponent(SubscribeModelComponent);
    fixture.componentRef.setInput('spec', SPEC);
    fixture.detectChanges();
    return fixture;
  }

  it('mostra sempre fallback + canvas (chrome della card)', () => {
    configure(false);
    const el = create().nativeElement as HTMLElement;
    expect(el.querySelector('.sub3d__fallback')).toBeTruthy();
    expect(el.querySelector('canvas.sub3d__canvas')).toBeTruthy();
  });

  it('senza WebGL non carica three: resta il fallback CSS', async () => {
    configure(false);
    const fixture = create();
    await fixture.whenStable();
    expect(loadThreeSpy).not.toHaveBeenCalled();
  });

  it('espone accentCss come #rrggbb (con padding)', () => {
    configure(false);
    const fixture = create();
    // accent 0xff6a1f → "#ff6a1f"
    expect(
      (fixture.componentInstance as unknown as { accentCss(): string }).accentCss(),
    ).toBe('#ff6a1f');
  });

  it('con WebGL disponibile prova a caricare three (chunk lazy)', async () => {
    configure(true);
    const fixture = create();
    await fixture.whenStable();
    expect(loadThreeSpy).toHaveBeenCalled();
  });
});
