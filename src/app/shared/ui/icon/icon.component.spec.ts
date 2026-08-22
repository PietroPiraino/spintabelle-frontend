import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ICON_NAMES, IconComponent, type IconName } from './icon.component';

/** Rende l'icona e restituisce il suo `<svg>` radice. */
function rendi(nome: IconName): SVGSVGElement {
  const fixture = TestBed.createComponent(IconComponent);
  fixture.componentRef.setInput('name', nome);
  fixture.detectChanges();
  const svg = (fixture.nativeElement as HTMLElement).querySelector('svg');
  if (!svg) throw new Error(`nessun <svg> reso per "${nome}"`);
  return svg as SVGSVGElement;
}

describe('IconComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IconComponent],
      providers: [provideZonelessChangeDetection()],
    });
  });

  /**
   * ⚠️ **La spec che rende rumoroso un fallimento altrimenti muto.**
   *
   * Aggiungere un'icona richiede DUE gesti: il nome in `ICON_NAMES` e il ramo
   * `@case` nel template. Farne solo uno compila senza un errore, senza un
   * avviso e senza un test rosso — l'unico effetto è un `<svg>` vuoto, cioè un
   * pulsante con un buco al posto dell'icona, che si scopre guardando la
   * pagina. Qui si itera su **tutta** la tupla e non sulle sole icone del
   * momento: così la garanzia vale anche per le prossime, senza che nessuno
   * debba ricordarsi di aggiungere un caso a questo file.
   */
  for (const nome of ICON_NAMES) {
    it(`"${nome}" rende almeno un figlio dentro l'<svg> (nome *e* ramo @case)`, () => {
      expect(rendi(nome).children.length)
        .withContext(
          `l'icona "${nome}" è in ICON_NAMES ma non rende nulla: manca il suo ramo @case nel template`,
        )
        .toBeGreaterThan(0);
    });
  }

  /**
   * ⚠️ I tre marchi sono forme **piene**, mentre il root SVG del componente è
   * `fill="none" stroke-width="2"`: senza l'override per-path il glifo esce
   * come un contorno spesso e illeggibile invece che come sagoma. È l'altro
   * modo silenzioso di sbagliarli — rende *qualcosa*, quindi la spec qui sopra
   * resterebbe verde. Precedente identico dei rami `record` e `square`.
   */
  for (const marchio of ['whatsapp', 'telegram', 'facebook'] as const) {
    it(`"${marchio}" è una forma piena: ogni path ha fill=currentColor e stroke=none`, () => {
      const paths = Array.from(rendi(marchio).querySelectorAll('path'));
      expect(paths.length).toBeGreaterThan(0);
      for (const p of paths) {
        expect(p.getAttribute('fill')).toBe('currentColor');
        expect(p.getAttribute('stroke')).toBe('none');
      }
    });
  }
});
