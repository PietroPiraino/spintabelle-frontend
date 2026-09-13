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
    // ⚠️ Tutte e sole le barre dell'ULTIMA colonna: i rect escono in ordine
    // colonna × serie, quindi le ultime `SERIE.length` sono la sua. Contarle
    // e basta passerebbe anche con la classe messa sulla colonna sbagliata.
    const tutte = rects();
    const ultima = tutte.slice(-SERIE.length);
    const altre = tutte.slice(0, -SERIE.length);
    expect(ultima.length).toBe(SERIE.length);
    for (const r of ultima) expect(r.classList.contains('is-provvisoria')).toBeTrue();
    for (const r of altre) expect(r.classList.contains('is-provvisoria')).toBeFalse();
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
    // ⚠️ La geometria si ferma PRIMA dei tick: senza colonne `niceTicks(0, 0)`
    // inventava un dominio 0..1 e stampava due tick su un grafico vuoto.
    expect(tickTesti()).toEqual([]);
    expect(el().querySelector('polyline.grafico__linea')).toBeNull();
    expect(el().querySelector('line.grafico__zero')).toBeNull();
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
    // ⚠️ Il PRIMO tocco è la lente — mostra il tooltip e NON emette: col dito
    // non c'è un hover che l'abbia già mostrato, e un tap che apre subito il
    // dettaglio non lascia mai leggere i numeri della colonna.
    lente().dispatchEvent(puntatore('pointerdown', 0.01, { pointerType: 'touch' }));
    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(tip()).toBeTruthy();
    expect(tip()!.textContent).toContain('gennaio 2026');
    expect(ospite.scelti).withContext('primo tocco = lente, nessun scegli').toEqual([]);

    // Il SECONDO tocco sulla stessa colonna è l'attivazione: emette una volta.
    lente().dispatchEvent(puntatore('pointerdown', 0.01, { pointerType: 'touch' }));
    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(ospite.scelti).withContext('secondo tocco = dettaglio').toEqual([0]);
    expect(tip()!.textContent).toContain('gennaio 2026');

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
    // Un tap col dito: primo tocco = lente, quindi nessun `scegli` (vedi la
    // spec del dito); qui conta che l'annuncio sia arrivato UNA volta sola.
    expect(ospite.scelti).toEqual([]);

    // E il fuoco da TASTIERA annuncia ancora: la guardia si consuma col clic.
    lente().dispatchEvent(new Event('blur'));
    await stabilizza();
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readout().textContent).toContain('gennaio 2026');
  });

  // ── Il tap: mouse, dito, penna ────────────────────────────────────────────

  it('⚠️ un tap col dito su una colonna NON ancora fissa la sceglie senza emettere; la penna uguale', async () => {
    // Col dito: primo tocco = lente (tooltip), nessun `scegli`.
    lente().dispatchEvent(puntatore('pointerdown', 0.5, { pointerType: 'touch' }));
    lente().dispatchEvent(clic(0.5));
    await stabilizza();
    expect(tip()!.textContent).toContain('febbraio 2026');
    expect(readout().textContent).toContain('febbraio 2026');
    expect(ospite.scelti).toEqual([]);

    // Un tocco su un'ALTRA colonna la sposta: è ancora lente, non dettaglio.
    lente().dispatchEvent(puntatore('pointerdown', 0.01, { pointerType: 'touch' }));
    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(tip()!.textContent).toContain('gennaio 2026');
    expect(ospite.scelti).toEqual([]);

    // Il secondo tocco sulla STESSA colonna emette, una volta.
    lente().dispatchEvent(puntatore('pointerdown', 0.01, { pointerType: 'touch' }));
    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(ospite.scelti).toEqual([0]);

    // La penna si comporta come il dito.
    lente().dispatchEvent(puntatore('pointerdown', 0.99, { pointerType: 'pen' }));
    lente().dispatchEvent(clic(0.99));
    await stabilizza();
    expect(tip()!.textContent).toContain('marzo 2026');
    expect(ospite.scelti).withContext('penna: primo tocco = lente').toEqual([0]);
  });

  it("un clic col MOUSE fissa ED emette al primo colpo: l'hover ha già mostrato il tooltip", async () => {
    lente().dispatchEvent(puntatore('pointerdown', 0.5, { pointerType: 'mouse' }));
    lente().dispatchEvent(clic(0.5));
    await stabilizza();
    expect(ospite.scelti).toEqual([1]);
    // E un clic senza alcun `pointerdown` prima (un browser che non li manda)
    // vale come mouse: il caso predefinito non è mai il dito.
    lente().dispatchEvent(clic(0.01));
    await stabilizza();
    expect(ospite.scelti).toEqual([1, 0]);
  });

  // ── La selezione che sopravvive a un cambio di colonne ───────────────────

  it('⚠️ se le colonne cambiano e la scelta è fuori elenco, la selezione si azzera e la lente torna a funzionare', async () => {
    ospite.colonne.set(moltiColonne(12));
    await stabilizza();
    lente().dispatchEvent(new Event('focus'));
    lente().dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    expect(readout().textContent).toContain('colonna 10');
    expect(tip()!.textContent).toContain('colonna 10');

    // Arrivano 7 colonne: la decima non esiste più.
    const spia = spyOn(document, 'removeEventListener').and.callThrough();
    ospite.colonne.set(moltiColonne(7));
    await stabilizza();
    expect(tip()).withContext("nessun tooltip su una colonna che non c'è").toBeNull();
    expect(rects().some((r) => r.classList.contains('is-scelta'))).toBeFalse();
    expect(readout().textContent!.trim())
      .withContext('il readout non parla di una colonna sparita')
      .toBe('');
    // Il tocco-fuori si è disarmato con la selezione: non resta un listener
    // su `document` per una selezione che non c'è più.
    expect(spia).toHaveBeenCalledWith('pointerdown', jasmine.any(Function));

    // E non è rimasta «fissa» su niente: il mouse che passa muove di nuovo il
    // tooltip. Con `fisso` ancora vero, `daPuntatore` lo ignorava e il grafico
    // sembrava morto finché non si toccava fuori.
    lente().dispatchEvent(puntatore('pointermove', 0.01));
    await stabilizza();
    expect(tip()!.textContent).toContain('colonna 0');
    area().dispatchEvent(puntatore('pointerleave', 0.01));
    await stabilizza();
    expect(tip()).toBeNull();

    // Il fuoco che torna sceglie l'ultima colonna, come al primo fuoco: la
    // decima non c'è più e non va ricordata.
    lente().dispatchEvent(new Event('blur'));
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(tip()!.textContent).toContain('colonna 6');
    expect(readout().textContent).toContain('colonna 6');
  });

  // ── Una colonna senza linea ───────────────────────────────────────────────

  it('⚠️ una colonna senza `linea` non ha un punto: la polyline si ferma, e la riga della linea sparisce da tooltip e readout', async () => {
    ospite.colonne.set([
      COLONNE[0],
      COLONNE[1],
      // Il mese corrente senza «a fine mese»: niente linea, niente testo.
      {
        chiave: '2026-03',
        etichetta: 'mar',
        etichettaLunga: 'marzo 2026',
        valori: [500, 200],
        testi: ['500', '200'],
      },
    ]);
    await stabilizza();
    const linee = [...el().querySelectorAll('polyline.grafico__linea')];
    expect(linee.length).toBe(1);
    // Due punti, non tre: la colonna senza valore non scende a zero.
    expect(linee[0].getAttribute('points')!.trim().split(/\s+/).length).toBe(2);

    // Sull'ultima colonna nessuna riga «Margine netto» — né vuota né a zero.
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(tip()!.textContent).toContain('marzo 2026');
    expect(tip()!.querySelector('.grafico__tip-voce--linea')).toBeNull();
    expect(tip()!.textContent).not.toContain('Margine netto');
    expect(readout().textContent).not.toContain('Margine netto');

    // Sulla prima c'è.
    lente().dispatchEvent(tasto('Home'));
    await stabilizza();
    expect(tip()!.querySelector('.grafico__tip-voce--linea')!.textContent).toContain('900,00 €');
    expect(readout().textContent).toContain('Margine netto 900,00 €');
  });

  it('un buco in mezzo spezza la linea in due tratti, e un punto isolato resta un punto', async () => {
    const con = (i: number, linea?: number): ColonnaGrafico => ({
      chiave: `c${i}`,
      etichetta: `c${i}`,
      valori: [10, 0],
      testi: ['10', '0'],
      ...(linea === undefined ? {} : { linea, testoLinea: String(linea) }),
    });
    ospite.colonne.set([con(0, 5), con(1, 6), con(2), con(3, 7), con(4, 8)]);
    await stabilizza();
    let linee = [...el().querySelectorAll('polyline.grafico__linea')];
    expect(linee.length).toBe(2);
    for (const l of linee) expect(l.getAttribute('points')!.trim().split(/\s+/).length).toBe(2);
    // Nessun punto nello slot vuoto (il terzo su cinque: x fra 400 e 600).
    const xs = linee.flatMap((l) =>
      l
        .getAttribute('points')!
        .trim()
        .split(/\s+/)
        .map((p) => Number(p.split(',')[0])),
    );
    for (const x of xs) {
      expect(x < 400 || x > 600)
        .withContext(`x=${x} nello slot vuoto`)
        .toBeTrue();
    }

    // Un punto isolato: la polyline lo ripete, così il tratto a lunghezza zero
    // con i cap tondi si disegna come un punto invece di sparire.
    ospite.colonne.set([con(0, 5), con(1), con(2, 7)]);
    await stabilizza();
    linee = [...el().querySelectorAll('polyline.grafico__linea')];
    expect(linee.length).toBe(2);
    for (const l of linee) {
      const p = l.getAttribute('points')!.trim().split(/\s+/);
      expect(p.length).toBe(2);
      expect(p[0]).toBe(p[1]);
    }
  });

  // ── Il dettaglio libero della colonna ─────────────────────────────────────

  it('`dettaglio` è una riga in coda al tooltip e una frase in coda al readout', async () => {
    ospite.colonne.set([
      COLONNE[0],
      COLONNE[1],
      { ...COLONNE[2], dettaglio: '3 nuovi iscritti, 1 disdetta' },
    ]);
    await stabilizza();
    lente().dispatchEvent(new Event('focus'));
    await stabilizza();
    const riga = tip()!.querySelector('.grafico__tip-dettaglio');
    expect(riga).toBeTruthy();
    expect(riga!.textContent).toContain('3 nuovi iscritti, 1 disdetta');
    // In coda: è l'ultimo figlio del tooltip.
    expect(tip()!.lastElementChild).toBe(riga);
    // Nel readout viene DOPO i valori, come frase a sé.
    const detto = readout().textContent!;
    expect(detto).toContain('3 nuovi iscritti, 1 disdetta');
    expect(detto.indexOf('Uscite 200,00 €')).toBeLessThan(detto.indexOf('3 nuovi iscritti'));

    // Senza `dettaglio` la riga non c'è: niente contenitore vuoto.
    lente().dispatchEvent(tasto('Home'));
    await stabilizza();
    expect(tip()!.querySelector('.grafico__tip-dettaglio')).toBeNull();
    expect(readout().textContent).not.toContain('nuovi iscritti');
  });
});
