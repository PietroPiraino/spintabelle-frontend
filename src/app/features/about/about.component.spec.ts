import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AboutComponent } from './about.component';
import { COACHES } from './coaches.data';
import { DIORAMA_CAPABILITIES } from '../../shared/three/three-capabilities';
import { THREE_LOADER } from '../../shared/three/three-loader';

describe('AboutComponent', () => {
  let loader: jasmine.Spy;

  beforeEach(async () => {
    loader = jasmine.createSpy('loadThree');
    await TestBed.configureTestingModule({
      imports: [AboutComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          // Il banco di particelle non deve creare WebGL nei test headless
          provide: DIORAMA_CAPABILITIES,
          useValue: {
            hasWebGL: () => false,
            prefersReducedMotion: () => false,
            hasFinePointer: () => false,
          },
        },
        { provide: THREE_LOADER, useValue: loader },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AboutComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mostra un pannello per ogni coach, con lati alternati', () => {
    const el = render();
    const panels = el.querySelectorAll('.coachpanel');
    expect(panels.length).toBe(COACHES.length);
    expect(Array.from(panels).map((p) => p.getAttribute('data-side'))).toEqual([
      'left',
      'right',
      'left',
    ]);
  });

  it('mostra nickname, ruolo, bio e quote dei coach reali', () => {
    const el = render();
    const text = el.textContent ?? '';
    for (const coach of COACHES) {
      expect(text).toContain(coach.nickname);
      expect(text).toContain(coach.eyebrow);
      expect(text).toContain(coach.quote);
    }
  });

  it('il badge founder compare una sola volta (NagatoUzumaki)', () => {
    const el = render();
    const badges = el.querySelectorAll('.coachpanel__founder');
    expect(badges.length).toBe(1);
    expect(badges[0].textContent).toContain('Ha creato la scuola e il sito');
  });

  it('ogni coach ha la sua ancora-emblema per il banco (+ il club sulla CTA)', () => {
    const el = render();
    const anchors = Array.from(el.querySelectorAll('[data-emblem]')).map((a) =>
      a.getAttribute('data-emblem'),
    );
    expect(anchors).toEqual(['spade', 'heart', 'diamond', 'club']);
    // decorativi: l'identità dei coach è tutta nel testo
    el.querySelectorAll('[data-emblem]').forEach((a) => {
      expect(a.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('monta il banco di particelle (un solo canvas, dietro al contenuto)', () => {
    const el = render();
    const canvases = el.querySelectorAll('canvas.ps__canvas');
    expect(canvases.length).toBe(1);
    expect(canvases[0].getAttribute('aria-hidden')).toBe('true');
    // senza WebGL il loader non viene mai chiamato (resta la pagina pura)
    expect(loader).not.toHaveBeenCalled();
  });

  it('mostra tutte le stat chips', () => {
    const el = render();
    const expected = COACHES.reduce((sum, coach) => sum + coach.stats.length, 0);
    expect(el.querySelectorAll('.statchip').length).toBe(expected);
  });

  it('la CTA punta a registrazione e lezioni', () => {
    const el = render();
    const links = Array.from(el.querySelectorAll('.about__cta a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(links).toContain('/registrazione');
    expect(links).toContain('/lezioni');
  });
});
