import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ColonnaGrafico,
  GraficoColonneComponent,
  ModoGrafico,
  SerieGrafico,
} from './grafico-colonne.component';

// Tre mesi: uno con un valore NEGATIVO nella prima serie, l'ultimo provvisorio.
// I `testi` sono stringhe qualsiasi: il grafico non deve sapere che unità sono.
const COLONNE: readonly ColonnaGrafico[] = [
  {
    chiave: '2026-01',
    etichetta: 'gen',
    etichettaLunga: 'gennaio 2026',
    valori: [1200, 300],
    testi: ['1.200,00 €', '300,00 €'],
    linea: 900,
    testoLinea: '900,00 €',
  },
  {
    chiave: '2026-02',
    etichetta: 'feb',
    etichettaLunga: 'febbraio 2026',
    valori: [-400, 1000],
    testi: ['−400,00 €', '1.000,00 €'],
    linea: -1400,
    testoLinea: '−1.400,00 €',
  },
  {
    chiave: '2026-03',
    etichetta: 'mar',
    etichettaLunga: 'marzo 2026',
    valori: [500, 200],
    testi: ['500,00 €', '200,00 €'],
    linea: 300,
    testoLinea: '300,00 €',
    provvisorio: true,
  },
];

const SERIE: readonly SerieGrafico[] = [
  { nome: 'Entrate', tono: 'uno' },
  { nome: 'Uscite', tono: 'neutra' },
];

/**
 * N colonne con etichette a DUE caratteri (i giorni di un trimestre, ad
 * esempio). La seconda serie è sempre zero: il dominio lo decide `valore`.
 */
function moltiColonne(
  n: number,
  valore: (i: number) => number = (i) => 100 + i,
): ColonnaGrafico[] {
  return Array.from({ length: n }, (_, i) => ({
    chiave: `c${i}`,
    etichetta: String(i % 100).padStart(2, '0'),
    etichettaLunga: `colonna ${i}`,
    valori: [valore(i), 0],
    testi: [`${valore(i)}`, '0'],
  }));
}

@Component({
  imports: [GraficoColonneComponent],
  template: `
    <app-grafico-colonne
      titolo="Entrate e uscite"
      [colonne]="colonne()"
      [serie]="serie()"
      [modo]="modo()"
      [etichettaLinea]="linea()"
      [altezza]="140"
      [formattaAsse]="asse()"
      nota="I numeri esatti stanno nella tabella."
      (scegli)="scelti.push($event)"
    />
  `,
})
class Ospite {
  readonly colonne = signal<readonly ColonnaGrafico[]>(COLONNE);
  readonly serie = signal<readonly SerieGrafico[]>(SERIE);
  readonly modo = signal<ModoGrafico>('affiancate');
  readonly linea = signal<string | null>('Margine netto');
  // Il formattatore dei tick: il grafico gli passa il numero e stampa ciò che torna.
  readonly asse = signal<(v: number) => string>((v) => `${v / 100} €`);
  readonly scelti: number[] = [];
}

describe('app-grafico-colonne', () => {
  let fixture: ComponentFixture<Ospite>;
  let ospite: Ospite;

  const el = (): HTMLElement => fixture.nativeElement;
  const svg = (): SVGSVGElement => el().querySelector('svg.grafico__svg')!;
  const rects = (): SVGRectElement[] => [
    ...el().querySelectorAll<SVGRectElement>('rect.grafico__barra'),
  ];
  const lente = (): HTMLButtonElement => el().querySelector('button.grafico__lente')!;
  const tip = (): HTMLElement | null => el().querySelector('.grafico__tip');
  const readout = (): HTMLElement => el().querySelector('[aria-live="polite"]')!;
  const area = (): HTMLElement => el().querySelector('.grafico__area')!;
  const tickTesti = (): string[] =>
    [...el().querySelectorAll('.grafico__tick-testo')].map((t) => t.textContent!.trim());

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Un evento puntatore sull'SVG, a una frazione della sua larghezza. */
  const puntatore = (tipo: string, frazione: number, extra: PointerEventInit = {}) => {
    const r = svg().getBoundingClientRect();
    return new PointerEvent(tipo, {
      bubbles: true,
      pointerType: 'mouse',
      clientX: r.left + r.width * frazione,
      clientY: r.top + r.height / 2,
      ...extra,
    });
  };

  /** Il clic che il browser produce dopo un tap o un mousedown: `detail === 1` e le coordinate. */
  const clic = (frazione: number) =>
    new MouseEvent('click', {
      bubbles: true,
      detail: 1,
      clientX: svg().getBoundingClientRect().left + svg().getBoundingClientRect().width * frazione,
    });

  const tasto = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ospite],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(Ospite);
    ospite = fixture.componentInstance;
    await stabilizza();
  });

  it('disegna una barra per ogni colonna × serie, più la linea sovrapposta', () => {
    expect(rects().length).toBe(COLONNE.length * SERIE.length);
    const linea = el().querySelector('polyline.grafico__linea')!;
    expect(linea).toBeTruthy();
    // Tre punti «x,y», uno per colonna.
    expect(linea.getAttribute('points')!.trim().split(/\s+/).length).toBe(3);
  });

  it('un valore negativo porta .is-negativa e scende SOTTO la linea dello zero', () => {
    const negative = rects().filter((r) => r.classList.contains('is-negativa'));
    expect(negative.length).toBe(1);
    const zeroY = Number(el().querySelector('line.grafico__zero')!.getAttribute('y1'));
    const y = Number(negative[0].getAttribute('y'));
    const h = Number(negative[0].getAttribute('height'));
    // Il rettangolo parte dallo zero e cresce verso il basso (y aumenta).
    expect(y).toBeCloseTo(zeroY, 6);
    expect(h).toBeGreaterThan(0);
    // E le barre positive stanno tutte sopra: il loro fondo è lo zero.
    const positive = rects().filter((r) => !r.classList.contains('is-negativa'));
    for (const r of positive) {
      const fondo = Number(r.getAttribute('y')) + Number(r.getAttribute('height'));
      expect(fondo).toBeCloseTo(zeroY, 6);
    }
  });

  it('la colonna provvisoria è tratteggiata e il tooltip lo dice a parole', async () => {
    const provvisorie = rects().filter((r) => r.classList.contains('is-provvisoria'));
    // Tutte e sole le barre dell'ultima colonna.
    expect(provvisorie.length).toBe(SERIE.length);
    // Al primo fuoco si seleziona l'ULTIMA colonna, che qui è quella provvisoria.
    // ⚠️ L'evento si spedisce a mano: `focus()` in un browser senza fuoco di
    // finestra può non emettere niente, e la spec direbbe il falso.
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(tip()).toBeTruthy();
    expect(tip()!.textContent).toContain('marzo 2026');
    expect(tip()!.textContent).toContain('provvisorio');
    expect(readout().textContent).toContain('provvisorio');
  });

  it('ArrowLeft sulla lente sposta la selezione e aggiorna il readout coi testi già formattati', async () => {
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readout().textContent).toContain('marzo 2026');

    lente().dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    const detto = readout().textContent!;
    expect(detto).toContain('febbraio 2026');
    // ⚠️ La stringa del chiamante, verbatim: il grafico non formatta niente.
    expect(detto).toContain('Entrate −400,00 €');
    expect(detto).toContain('Uscite 1.000,00 €');
    expect(detto).toContain('Margine netto −1.400,00 €');
    // E la barra scelta porta il contorno.
    const scelte = rects().filter((r) => r.classList.contains('is-scelta'));
    expect(scelte.length).toBe(SERIE.length);

    // Home e End: i due estremi.
    lente().dispatchEvent(tasto('Home'));
    await stabilizza();
    expect(readout().textContent).toContain('gennaio 2026');
    lente().dispatchEvent(tasto('End'));
    await stabilizza();
    expect(readout().textContent).toContain('marzo 2026');
  });

  it('⚠️ il puntatore muove il tooltip ma NON il readout', async () => {
    expect(readout().textContent!.trim()).toBe('');
    lente().dispatchEvent(puntatore('pointermove', 0.01));
    await stabilizza();
    expect(tip()).toBeTruthy();
    expect(tip()!.textContent).toContain('gennaio 2026');
    expect(rects()[0].classList.contains('is-scelta')).toBeTrue();
    // Nessun annuncio: dodici mesi letti mentre il mouse attraversa il grafico
    // sono un aria-live che si smette di ascoltare.
    expect(readout().textContent!.trim()).toBe('');

    // Il mouse che esce azzera (la selezione non è fissa).
    area().dispatchEvent(puntatore('pointerleave', 0.5));
    await stabilizza();
    expect(tip()).toBeNull();
  });

  it('un clic fissa la colonna, emette `scegli` e sopravvive al mouse che esce', async () => {
    lente().dispatchEvent(puntatore('pointermove', 0.5));
    await stabilizza();
    lente().dispatchEvent(clic(0.5));
    await stabilizza();
    expect(ospite.scelti).toEqual([1]);
    expect(readout().textContent).toContain('febbraio 2026');

    area().dispatchEvent(puntatore('pointerleave', 0.5));
    await stabilizza();
    expect(tip()).withContext('fissa: il mouse che esce non la toglie').toBeTruthy();
    // E il puntatore che passa non la sposta più.
    lente().dispatchEvent(puntatore('pointermove', 0.01));
    await stabilizza();
    expect(tip()!.textContent).toContain('febbraio 2026');

    // Un tocco FUORI dal grafico la chiude.
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await stabilizza();
    expect(tip()).toBeNull();
  });

  it('Invio (un clic senza coordinate) sceglie la colonna già selezionata', async () => {
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    lente().dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    // Il bottone traduce Invio in un click con `detail === 0` e senza coordinate.
    lente().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    await stabilizza();
    expect(ospite.scelti).toEqual([1]);
  });

  it('Escape azzera la selezione', async () => {
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(tip()).toBeTruthy();
    lente().dispatchEvent(tasto('Escape'));
    await stabilizza();
    expect(tip()).toBeNull();
    expect(rects().some((r) => r.classList.contains('is-scelta'))).toBeFalse();
  });

  it('i tick passano da `formattaAsse`, e uno è lo zero', () => {
    const testi = tickTesti();
    expect(testi.length).toBeGreaterThanOrEqual(3);
    for (const t of testi) expect(t).toMatch(/ €$/);
    expect(testi).toContain('0 €');
  });

  it("⚠️ nessun <text> dentro l'SVG: stirato, uscirebbe deformato", () => {
    expect(svg().querySelector('text')).toBeNull();
    expect(svg().getAttribute('preserveAspectRatio')).toBe('none');
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toContain('Entrate e uscite');
  });

  it("l'altezza è dichiarata sulla figura come --grafico-h", () => {
    const figura = el().querySelector('figure.grafico') as HTMLElement;
    expect(figura.style.getPropertyValue('--grafico-h')).toBe('140px');
    expect(el().querySelector('.grafico__nota')!.textContent).toContain('tabella');
  });

  it('impilate: la seconda serie poggia sulla prima', async () => {
    ospite.modo.set('impilate');
    await stabilizza();
    // Colonna 0: [1200, 300], entrambe positive → la seconda parte dal tetto della prima.
    const [prima, seconda] = rects().slice(0, 2);
    expect(prima.getAttribute('x')).toBe(seconda.getAttribute('x'));
    const cimaPrima = Number(prima.getAttribute('y'));
    const fondoSeconda = Number(seconda.getAttribute('y')) + Number(seconda.getAttribute('height'));
    expect(fondoSeconda).toBeCloseTo(cimaPrima, 6);
  });

  it('senza colonne: nessuna barra, nessuna lente, resta la didascalia', async () => {
    ospite.colonne.set([]);
    await stabilizza();
    expect(rects().length).toBe(0);
    expect(el().querySelector('button.grafico__lente')).toBeNull();
    expect(el().querySelector('figcaption')!.textContent).toContain('Entrate e uscite');
    expect(svg().getAttribute('aria-label')).toContain('nessun dato');
    // Lo spazio resta riservato: la figura ha ancora la sua altezza dichiarata.
    const figura = el().querySelector('figure.grafico') as HTMLElement;
    expect(figura.style.getPropertyValue('--grafico-h')).toBe('140px');
  });

  it("le etichette dell'asse X sono una per colonna e a passo 1 sotto le 12", () => {
    const voci = [...el().querySelectorAll('.grafico__x-voce')].map((v) => v.textContent!.trim());
    expect(voci).toEqual(['gen', 'feb', 'mar']);
  });

  // ── Le etichette dell'asse X ──────────────────────────────────────────────

  it("⚠️ 90 colonne in 700px: le etichette dell'asse X non si tagliano e non si sovrappongono", async () => {
    el().style.width = '700px';
    ospite.colonne.set(moltiColonne(90));
    ospite.linea.set(null);
    await stabilizza();

    const voci = [...el().querySelectorAll<HTMLElement>('.grafico__x-voce')];
    // Si rendono SOLO le colonne etichettate (passo 7 sopra le 36): niente
    // celle vuote larghe uno slot.
    expect(voci.length).toBeGreaterThan(5);
    expect(voci.length).toBeLessThan(90);
    const asse = el().querySelector('.grafico__x')!.getBoundingClientRect();
    for (const v of voci) {
      expect(v.textContent!.trim().length).withContext('ogni voce resa porta un testo').toBe(2);
      // ⚠️ Nessun taglio: prima ogni voce era larga uno slot (7px su 90) con
      // `overflow: hidden`, e a 30-90 colonne OGNI etichetta stampata usciva
      // mozza. `scrollWidth > clientWidth` è esattamente quel taglio.
      expect(v.scrollWidth)
        .withContext(`«${v.textContent}» tagliata`)
        .toBeLessThanOrEqual(v.clientWidth);
      const r = v.getBoundingClientRect();
      expect(r.left).withContext('dentro il bordo sinistro').toBeGreaterThanOrEqual(asse.left - 0.5);
      expect(r.right).withContext('dentro il bordo destro').toBeLessThanOrEqual(asse.right + 0.5);
    }
    // E nessuna sovrapposizione: ordinate per `left`, ognuna comincia dove
    // finisce la precedente o più a destra.
    const rette = voci.map((v) => v.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    for (let k = 1; k < rette.length; k += 1) {
      expect(rette[k].left)
        .withContext(`voce ${k} sopra la ${k - 1}`)
        .toBeGreaterThanOrEqual(rette[k - 1].right);
    }
  });

  it('12 colonne: 12 etichette, tutte con il proprio testo', async () => {
    el().style.width = '700px';
    ospite.colonne.set(moltiColonne(12));
    await stabilizza();
    const voci = [...el().querySelectorAll('.grafico__x-voce')].map((v) => v.textContent!.trim());
    expect(voci).toEqual(Array.from({ length: 12 }, (_, i) => String(i).padStart(2, '0')));
  });

  // ── I tick ────────────────────────────────────────────────────────────────

  it('⚠️ su dati interi i tick sono interi: tutto a zero → distinti e interi; massimo 1 → [0, 1]', async () => {
    ospite.asse.set((v) => String(v));
    ospite.linea.set(null);

    ospite.colonne.set(moltiColonne(3, () => 0));
    await stabilizza();
    let t = tickTesti();
    expect(t.length).toBeGreaterThanOrEqual(2);
    expect(new Set(t).size).withContext('nessun tick doppio').toBe(t.length);
    for (const x of t) expect(Number.isInteger(Number(x))).withContext(`tick «${x}»`).toBeTrue();

    ospite.colonne.set(moltiColonne(3, (i) => (i === 1 ? 1 : 0)));
    await stabilizza();
    expect(tickTesti()).toEqual(['0', '1']);

    // Il verso che nega: con un dato NON intero il passo può scendere sotto 1.
    ospite.colonne.set(moltiColonne(3, (i) => (i === 1 ? 0.5 : 0)));
    await stabilizza();
    t = tickTesti();
    expect(t.some((x) => !Number.isInteger(Number(x))))
      .withContext('0,5 vuole un tick frazionario')
      .toBeTrue();
  });

  // ── Il dito ───────────────────────────────────────────────────────────────

  it('⚠️ col dito il pointermove NON seleziona (è uno scorrimento): nessun tooltip orfano; il tap sì', async () => {
    lente().dispatchEvent(puntatore('pointermove', 0.01, { pointerType: 'touch' }));
    await stabilizza();
    expect(tip()).withContext('lo scrub col dito non sceglie').toBeNull();
    area().dispatchEvent(puntatore('pointerleave', 0.01, { pointerType: 'touch' }));
    await stabilizza();
    expect(tip()).withContext('nessun tooltip rimasto dopo che il dito si alza').toBeNull();

    // Il tap: pointerdown (nessun `focus`, come su iOS) e poi il click.
    lente().dispatchEvent(puntatore('pointerdown', 0.01, { pointerType: 'touch' }));
    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(tip()).toBeTruthy();
    expect(tip()!.textContent).toContain('gennaio 2026');
    expect(ospite.scelti).toEqual([0]);

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }),
    );
    await stabilizza();
    expect(tip()).toBeNull();
  });

  // ── Il tooltip ────────────────────────────────────────────────────────────

  it("⚠️ a 340px con tre serie lunghe il tooltip resta DENTRO l'area (colonna 2 di 12)", async () => {
    el().style.width = '340px';
    ospite.serie.set([
      { nome: 'Entrate', tono: 'uno' },
      { nome: 'Uscite', tono: 'due' },
      { nome: 'Commissioni rakeback', tono: 'tre' },
    ]);
    ospite.colonne.set(
      Array.from({ length: 12 }, (_, i) => ({
        chiave: `m${i}`,
        etichetta: `m${i}`,
        etichettaLunga: `mese numero ${i} del 2026`,
        valori: [1234567, 234567, 34567],
        testi: ['1.234.567,00 €', '234.567,00 €', '34.567,00 €'],
        linea: 1000000,
        testoLinea: '1.000.000,00 €',
      })),
    );
    await stabilizza();
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    lente().dispatchEvent(tasto('Home'));
    lente().dispatchEvent(tasto('ArrowRight'));
    lente().dispatchEvent(tasto('ArrowRight'));
    await stabilizza();
    expect(tip()!.textContent).toContain('mese numero 2 del 2026');
    // Misurato e piazzato: non è più nascosto in attesa della misura.
    expect(getComputedStyle(tip()!).visibility).not.toBe('hidden');
    const a = area().getBoundingClientRect();
    const t = tip()!.getBoundingClientRect();
    expect(t.width).toBeGreaterThan(0);
    expect(t.left).withContext('bordo sinistro').toBeGreaterThanOrEqual(a.left - 0.5);
    expect(t.right).withContext('bordo destro').toBeLessThanOrEqual(a.right + 0.5);
  });

  // ── etichettaLinea vuota ──────────────────────────────────────────────────

  it("etichettaLinea = '' vale come assente: niente polyline, niente legenda, e il dominio la ignora", async () => {
    ospite.linea.set(null);
    await stabilizza();
    const senza = tickTesti();

    ospite.linea.set('');
    await stabilizza();
    expect(el().querySelector('polyline.grafico__linea')).toBeNull();
    expect(el().querySelector('.grafico__voce--linea')).toBeNull();
    // ⚠️ La riga da −1.400 € del secondo mese NON allarga più la scala: con
    // `!== null` la geometria la contava e il template no, e i tick uscivano
    // di una linea che nessuno vedeva.
    expect(tickTesti()).toEqual(senza);

    ospite.linea.set('Margine netto');
    await stabilizza();
    expect(tickTesti().length).toBeGreaterThan(senza.length);
  });

  // ── Il fuoco che torna ────────────────────────────────────────────────────

  it("il fuoco che torna ritrova la colonna FISSATA prima del blur, non l'ultima", async () => {
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    lente().dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    expect(readout().textContent).toContain('febbraio 2026');

    lente().dispatchEvent(new Event('blur'));
    await stabilizza();
    expect(tip()).toBeNull();

    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readout().textContent).toContain('febbraio 2026');
    expect(tip()!.textContent).toContain('febbraio 2026');

    // Escape è un congedo esplicito: dopo, il fuoco riparte dall'ultima colonna.
    lente().dispatchEvent(tasto('Escape'));
    lente().dispatchEvent(new Event('blur'));
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readout().textContent).toContain('marzo 2026');
  });

  it('⚠️ un fuoco preceduto da un pointerdown non annuncia: il clic che segue annuncia UNA volta sola', async () => {
    // Android: tap → pointerdown → focus → click. Senza la guardia il readout
    // leggeva l'ULTIMA colonna al fuoco e poi quella toccata al clic.
    lente().dispatchEvent(puntatore('pointerdown', 0.01, { pointerType: 'touch' }));
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readout().textContent!.trim())
      .withContext('nessun annuncio al fuoco da puntatore')
      .toBe('');
    expect(tip()).toBeNull();

    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(readout().textContent).toContain('gennaio 2026');
    expect(ospite.scelti).toEqual([0]);

    // E il fuoco da TASTIERA annuncia ancora: la guardia si consuma col clic.
    lente().dispatchEvent(new Event('blur'));
    await stabilizza();
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readout().textContent).toContain('gennaio 2026');
  });
});
