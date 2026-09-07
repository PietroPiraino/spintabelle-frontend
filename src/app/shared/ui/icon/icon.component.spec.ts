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
  // ⚠️ Questo elenco e' SCRITTO A MANO: un'icona piena nuova non ci entra da
  // sola, e senza la sua riga qui l'override fill/stroke resta senza rete —
  // il difetto piu' muto del componente. `more-vertical` e' stata aggiunta il
  // 07/09/2026 insieme all'icona.
  for (const marchio of ['whatsapp', 'telegram', 'facebook', 'spade', 'heart', 'diamond', 'club', 'more-vertical'] as const) {
    it(`"${marchio}" è una forma piena: ogni path ha fill=currentColor e stroke=none`, () => {
      // ⚠️ TUTTE le forme, non solo i <path>: `record` usa un <circle> e dal
      // 30/08/2026 anche il fiori. Interrogando i soli path, una forma piena
      // disegnata con un <circle> senza override sarebbe passata inosservata.
      const forme = Array.from(rendi(marchio).querySelectorAll('path, circle, rect, polygon'));
      expect(forme.length).toBeGreaterThan(0);
      for (const p of forme) {
        expect(p.getAttribute('fill')).toBe('currentColor');
        expect(p.getAttribute('stroke')).toBe('none');
      }
    });
  }

  /**
   * ⚠️ `sunset` e' l'unica forma MISTA del set: la cupola e' piena, le due
   * righe dell'orizzonte sono a tratto. Non puo' entrare nel ciclo qui sopra
   * (che pretende l'override su OGNI path), ma senza una rete il difetto
   * sarebbe muto nello stesso identico modo: dimenticando
   * `fill="currentColor" stroke="none"` sulla cupola, il root
   * `fill="none" stroke-width="2"` la farebbe uscire come un contorno spesso —
   * cioe' renderebbe *qualcosa*, e la spec che itera su ICON_NAMES resterebbe
   * verde. E' anche la meta' che la distingue dal sole a 16px.
   */
  it('"sunset" e una forma MISTA: cupola piena, orizzonte a tratto', () => {
    const paths = Array.from(rendi('sunset').querySelectorAll('path'));
    expect(paths.length).toBe(3);

    const pieni = paths.filter(
      (p) => p.getAttribute('fill') === 'currentColor' && p.getAttribute('stroke') === 'none',
    );
    expect(pieni.length)
      .withContext('la cupola deve avere fill=currentColor e stroke=none, o esce come contorno')
      .toBe(1);

    const aTratto = paths.filter((p) => !p.hasAttribute('fill') && !p.hasAttribute('stroke'));
    expect(aTratto.length)
      .withContext("le due righe dell'orizzonte devono ereditare il tratto dal root")
      .toBe(2);
  });


  /**
   * ⚠️ La costruzione del fiori e' essa stessa la garanzia, quindi va pinnata.
   * Fino al 30/08/2026 era un path unico che non chiudeva dove aveva iniziato:
   * la `z` tirava un segmento dritto di 1,8 unita' sulla sommita' del lobo
   * alto, cioe' una PUNTA su un seme che dev'essere tondo. Con tre cerchi quel
   * difetto non e' piu' esprimibile — un cerchio non ha estremi da far
   * combaciare — e la simmetria e' per costruzione invece che affidata a
   * numeri da tenere allineati a mano.
   *
   * ⚠️ Perche' non una guardia generica «la z non deve percorrere distanza»:
   * il QUADRI e' un poligono e la sua `z` chiude un lato dritto di 12 unita'
   * del tutto legittimo (misurato). Una regola cosi' lo boccerebbe, e una
   * guardia che grida al lupo e' una guardia che si spegne.
   */
  it('"club" e fatto di tre cerchi e un gambo, simmetrici su x=12', () => {
    const svg = rendi('club');
    const cerchi = Array.from(svg.querySelectorAll('circle'));
    expect(cerchi.length).withContext('i tre lobi devono essere <circle>').toBe(3);
    expect(svg.querySelectorAll('path').length).withContext('un solo gambo').toBe(1);

    const cx = cerchi.map((c) => Number(c.getAttribute('cx')));
    const r = cerchi.map((c) => Number(c.getAttribute('r')));
    expect(new Set(r).size).withContext('i tre lobi hanno lo stesso raggio').toBe(1);
    expect(cx[0]).withContext('il lobo alto e centrato').toBe(12);
    expect(cx[1] + cx[2]).withContext('i due lobi bassi sono speculari su x=12').toBe(24);

    // ⚠️ I cerchi DEVONO sovrapporsi, o restano tre palle staccate: la
    // distanza fra i centri dev'essere minore della somma dei raggi.
    const cy = cerchi.map((c) => Number(c.getAttribute('cy')));
    const distanza = Math.hypot(cx[0] - cx[1], cy[0] - cy[1]);
    expect(distanza).withContext('lobo alto e lobo basso devono compenetrarsi').toBeLessThan(2 * r[0]);
  });

});
