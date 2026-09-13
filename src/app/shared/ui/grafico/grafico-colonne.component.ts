import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

/** Il tono di una serie: un alias dei token `--serie-*`, o il SEGNO del valore. */
export type TonoSerie = 'uno' | 'due' | 'tre' | 'neutra' | 'segno';

export type ModoGrafico = 'affiancate' | 'impilate';

/**
 * Una colonna del grafico: i NUMERI servono alla geometria, le STRINGHE al
 * tooltip e al readout. `testi[k]` è il valore `valori[k]` già formattato dal
 * chiamante — centesimi ed euro float non attraversano mai questo componente
 * come unità, e la scelta sbagliata fra i due è un fattore 100.
 */
export interface ColonnaGrafico {
  /** Identità stabile della colonna (il mese, il giorno): la chiave del `@for`. */
  readonly chiave: string;
  /** L'etichetta sotto l'asse: corta («set»). */
  readonly etichetta: string;
  /** L'etichetta nel tooltip e nel readout: per esteso («settembre 2026»). */
  readonly etichettaLunga?: string;
  /** Un valore per serie, nello stesso ordine di `serie`. */
  readonly valori: readonly number[];
  /** `valori` già formattati, uno per serie. */
  readonly testi: readonly string[];
  /** Il punto della linea sovrapposta (il margine), se `etichettaLinea` è dato. */
  readonly linea?: number;
  readonly testoLinea?: string;
  /** Un mese aperto: colonna tratteggiata e parola «provvisorio» nel tooltip. */
  readonly provvisorio?: boolean;
}

export interface SerieGrafico {
  readonly nome: string;
  readonly tono: TonoSerie;
}

/** Una barra già proiettata nel viewBox 0..1000 × 0..1000. */
interface Barra {
  readonly chiave: string;
  readonly colonna: number;
  readonly tono: TonoSerie;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly negativa: boolean;
  readonly provvisoria: boolean;
}

interface Tick {
  readonly v: number;
  /** In unità del viewBox (0 = in alto). */
  readonly y: number;
  readonly testo: string;
}

interface Geometria {
  readonly zeroY: number;
  readonly ticks: readonly Tick[];
  readonly barre: readonly Barra[];
  /** Gli `points` della polyline, o '' se nessuna colonna porta un `linea`. */
  readonly linea: string;
}

/** Il viewBox è quadrato e si stira: le proporzioni le dà il CSS, non l'SVG. */
const V = 1000;
/** Quanta parte dello slot occupa il gruppo di barre (il resto è aria). */
const RIEMPIMENTO = 0.7;

let seq = 0;

/**
 * Tick «belli» (1/2/5 × 10^k) su un dominio che comprende sempre lo zero.
 *
 * Il passo grezzo è un terzo dell'escursione, arrotondato al primo valore
 * bello dalla sua parte: dà 3-4 tick, mai una scala fitta che nessuno legge.
 * Il dominio si allarga ai multipli del passo, così il tick più alto sta in
 * cima all'area e non a metà.
 *
 * ⚠️ Su dati INTERI il passo non scende sotto 1. Un dominio degenere (tutto a
 * zero, o un massimo di 1) dava un passo di 0,5 e tick a 0 · 0,5 · 1: su una
 * scala di centesimi, o di conteggi, mezzo tick non esiste — e un
 * formattatore che arrotonda stampava due etichette uguali una sopra
 * l'altra. Il clamp vale SOLO se ogni valore è intero: euro float da 0,5 €
 * vogliono ancora il loro tick frazionario.
 */
function niceTicks(
  min: number,
  max: number,
  interi: boolean,
): { lo: number; hi: number; ticks: number[] } {
  let hi = max;
  if (hi <= min) hi = min + 1;
  const grezzo = (hi - min) / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const norm = grezzo / mag;
  let passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  if (interi && passo < 1) passo = 1;
  const lo = Math.floor(min / passo) * passo;
  hi = Math.ceil(hi / passo) * passo;
  const ticks: number[] = [];
  for (let k = 0; lo + k * passo <= hi + passo / 2; k += 1) {
    // ⚠️ Somma dal capo e non accumulata: 0.1 + 0.1 + 0.1 non fa 0.3, e un
    // tick a 0.30000000000000004 si formatterebbe con la coda.
    ticks.push(Number((lo + k * passo).toPrecision(12)));
  }
  return { lo, hi, ticks };
}

/**
 * Il dominio verticale: sempre ancorato allo zero, e con le linee dentro.
 * Impilate, conta la SOMMA dei positivi sopra e quella dei negativi sotto —
 * cioè l'altezza che la pila raggiunge davvero. `interi` dice se OGNI valore
 * (linea compresa, quando c'è) è un intero: è ciò che permette a `niceTicks`
 * di non scendere sotto il passo 1.
 */
function dominio(
  colonne: readonly ColonnaGrafico[],
  impilate: boolean,
  conLinea: boolean,
): { min: number; max: number; interi: boolean } {
  let min = 0;
  let max = 0;
  let interi = true;
  for (const c of colonne) {
    if (impilate) {
      let sopra = 0;
      let sotto = 0;
      for (const v of c.valori) {
        if (!Number.isFinite(v)) continue;
        if (!Number.isInteger(v)) interi = false;
        if (v >= 0) sopra += v;
        else sotto += v;
      }
      max = Math.max(max, sopra);
      min = Math.min(min, sotto);
    } else {
      for (const v of c.valori) {
        if (!Number.isFinite(v)) continue;
        if (!Number.isInteger(v)) interi = false;
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
    }
    if (conLinea && c.linea != null && Number.isFinite(c.linea)) {
      if (!Number.isInteger(c.linea)) interi = false;
      max = Math.max(max, c.linea);
      min = Math.min(min, c.linea);
    }
  }
  return { min, max, interi };
}

/**
 * L'UNICO tipo di grafico del pannello: colonne verticali (affiancate o
 * impilate), zero ancorato, valori negativi, colonne «provvisorie»
 * tratteggiate, una linea opzionale sovrapposta (il margine).
 *
 * ⚠️ SVG inline e non canvas: `fill: var(--serie-1)` si ritema da solo — niente
 * `MutationObserver` su `data-theme`, niente `getComputedStyle` — e le
 * asserzioni di Karma leggono `<rect>` e `points` invece di pixel. Il viewBox
 * è 1000×1000 con `preserveAspectRatio="none"`: solo `rect`, `line` e
 * `polyline` stanno nell'SVG (con `vector-effect="non-scaling-stroke"`, o il
 * tratto si stirerebbe con la scala); tick e etichette dell'asse X sono HTML,
 * perché un `<text>` in un SVG stirato esce deformato.
 *
 * ⚠️ Il grafico riceve NUMERI per la geometria e STRINGHE già formattate per
 * tooltip e readout (`testi`, `testoLinea`): non conosce l'unità, e
 * `formattaAsse` gliela presta solo per i tick. Centesimi ed euro float non lo
 * attraversano mai come unità.
 *
 * ⚠️ La «LENTE»: un solo `button.grafico__lente` sopra l'SVG è l'unico stop di
 * Tab del grafico. Il MOUSE che passa muove il tooltip VISIVO sulla colonna
 * più vicina (regge anche 90 colonne da 8px: si sceglie lo slot, non si
 * colpisce la barra); un tap/clic la FISSA — resta finché non si tocca fuori
 * — ed emette `scegli`; frecce/Home/End la muovono da tastiera, Escape
 * azzera, Invio/Spazio (il default del bottone) equivale al clic. Al primo
 * fuoco senza selezione si sceglie l'ULTIMA colonna, la più recente; il fuoco
 * che TORNA dopo un blur ritrova la colonna che era fissata (Escape, che è un
 * congedo esplicito, la dimentica).
 *
 * ⚠️ Col DITO il `pointermove` non sceglie niente: un dito che striscia sul
 * grafico sta scorrendo la pagina (`touch-action: pan-y`), e non esiste un
 * «fuori» che lo azzeri — il dito si alza, e la prima stesura lasciava un
 * tooltip orfano sull'ultima colonna sfiorata. Col dito si sceglie SOLO col
 * tap, che fissa e arma il tocco-fuori.
 *
 * ⚠️ Il readout `aria-live` cambia SOLO da tastiera e da tap, MAI a ogni
 * `pointermove`: uno screen reader che leggesse dodici mesi mentre il mouse
 * attraversa il grafico è un annuncio che si smette di ascoltare. Il tooltip
 * visivo è `aria-hidden`; il readout è un `visually-hidden` a parte. E un
 * fuoco che arriva da un `pointerdown` (il mouse, o il tap su Android) non
 * annuncia: lo farà il `click` che segue, sulla colonna toccata — senza la
 * guardia un tap leggeva l'ULTIMA colonna al fuoco e poi quella toccata.
 *
 * ⚠️ Il tooltip si MISURA dopo il render (`afterRenderEffect`) e si piazza in
 * px, stretto dentro `.grafico__area`: con un `left` in percentuale e
 * `translateX(-50%)` nella fascia centrale, a 340px e tre serie usciva
 * dall'area da un lato o dall'altro. Finché non è misurato resta
 * `visibility: hidden`, e il `linkedSignal` lo rimette in attesa a ogni cambio
 * di colonna — la misura vale per QUEL contenuto.
 *
 * ⚠️ Le etichette dell'asse X sono ASSOLUTE, una per colonna etichettata, e
 * non una cella flex per colonna: con novanta celle da 7px e `overflow:
 * hidden`, ogni etichetta stampata usciva mozza. La cella larga uno slot era
 * la geometria giusta per DODICI colonne e sbagliata per tutte le altre; ora
 * `.grafico__x` riserva solo l'altezza, e ogni etichetta sta centrata sul
 * proprio slot (`left: centroX%` + `translateX(-50%)`), ancorata al bordo nel
 * primo/ultimo 8% per non uscire dall'asse.
 *
 * ⚠️ Nessuna animazione sui dati: nulla da gatare con `prefers-reduced-motion`,
 * e un grafico che «cresce» all'arrivo dell'API è un salto di layout. L'altezza
 * è DICHIARATA (`altezza` → `--grafico-h`) e lo scheletro `.admin-scheletro
 * --grafico` legge la stessa variabile: zero CLS.
 *
 * ⚠️ Nessun `.admin-stato` qui dentro: `admin-shared.scss` non è compilato in
 * questo componente, e una classe che dipende da un foglio del chiamante è un
 * contratto muto. «Provvisorio» nel tooltip è un `<em>` proprio.
 */
@Component({
  selector: 'app-grafico-colonne',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './grafico-colonne.component.html',
  styleUrl: './grafico-colonne.component.scss',
})
export class GraficoColonneComponent {
  /** Titolo: `aria-label` dell'SVG e didascalia. */
  readonly titolo = input.required<string>();
  readonly colonne = input.required<readonly ColonnaGrafico[]>();
  readonly serie = input.required<readonly SerieGrafico[]>();
  readonly modo = input<ModoGrafico>('affiancate');
  /** Se presente, disegna la polyline sui `linea` delle colonne. */
  readonly etichettaLinea = input<string | null>(null);
  /** In px, DICHIARATA: è l'altezza riservata prima che arrivi il dato (CLS). */
  readonly altezza = input(180);
  /** Il formattatore dei tick: il grafico non conosce l'unità. */
  readonly formattaAsse = input.required<(v: number) => string>();
  /** Una riga sotto il grafico («I numeri esatti stanno nella tabella…»). */
  readonly nota = input<string>('');
  /** Indice della colonna scelta con un clic/tap o con Invio. */
  readonly scegli = output<number>();

  protected readonly idReadout = `grafico-readout-${++seq}`;
  protected readonly scelto = signal<number | null>(null);
  protected readonly annuncio = signal('');
  /** La selezione è stata FISSATA (tap, clic, tastiera): il puntatore non la sposta. */
  private readonly fisso = signal(false);
  /**
   * L'ultima colonna FISSATA, che il blur non cancella: il fuoco che torna la
   * ritrova. Solo Escape — un congedo esplicito — la dimentica.
   */
  private ultimoFisso: number | null = null;
  /**
   * Un `pointerdown` sulla lente è appena arrivato: il `focus` che ne segue
   * non deve scegliere né annunciare, lo farà il `click`. Si consuma al fuoco
   * o al clic, e si azzera se il puntatore viene annullato (uno scorrimento
   * partito sulla lente non produce alcun clic).
   */
  private fuocoDaPuntatore = false;

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly tipEl = viewChild<ElementRef<HTMLElement>>('tip');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private ascoltando = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.smetti());

    // La misura del tooltip: DOPO il render, quando esiste ed è largo quanto il
    // suo contenuto. ⚠️ Non legge `tipX`, o si rieseguirebbe da sola; e misura
    // con `left` a zero (il `linkedSignal` l'ha appena azzerato), perché un
    // assoluto con `left` in px ha come larghezza disponibile `area − left`:
    // misurato a metà area, un tooltip largo si sarebbe già ripiegato e la
    // misura direbbe una larghezza che non è la sua.
    afterRenderEffect(() => {
      const sc = this.colonnaScelta();
      const tip = this.tipEl()?.nativeElement;
      const n = this.n();
      if (!sc || !tip || !n) return;
      const area = tip.parentElement;
      if (!area) return;
      // I rect e non `offsetWidth`/`clientWidth`, che sono interi arrotondati:
      // mezzo pixel di troppo sul bordo destro è già «fuori».
      const larghezza = area.getBoundingClientRect().width;
      const tipW = tip.getBoundingClientRect().width;
      if (larghezza <= 0) return;
      const centro = ((sc.i + 0.5) / n) * larghezza;
      const x = Math.max(0, Math.min(centro - tipW / 2, larghezza - tipW));
      untracked(() => this.tipX.set(x));
    });
  }

  protected readonly n = computed(() => this.colonne().length);

  /**
   * L'etichetta della linea, NORMALIZZATA: `''` vale come assente. Prima la
   * geometria confrontava con `null` e il template con la falsità, e una
   * stringa vuota allargava il dominio a una linea che nessuno disegnava.
   * Tutto il componente legge questo e mai l'input.
   */
  protected readonly lineaAttiva = computed<string | null>(() => this.etichettaLinea() || null);

  protected readonly geometria = computed<Geometria>(() => {
    const cols = this.colonne();
    const ser = this.serie();
    const impilate = this.modo() === 'impilate';
    const conLinea = this.lineaAttiva() !== null;
    const { min, max, interi } = dominio(cols, impilate, conLinea);
    const { lo, hi, ticks } = niceTicks(min, max, interi);
    const y = (v: number) => ((hi - v) / (hi - lo)) * V;
    const zeroY = y(0);
    const fmt = this.formattaAsse();

    const n = cols.length;
    const slot = n ? V / n : 0;
    const interno = slot * RIEMPIMENTO;
    const bordo = (slot - interno) / 2;
    const m = ser.length;
    const barre: Barra[] = [];
    const punti: string[] = [];

    cols.forEach((c, i) => {
      let sopra = 0;
      let sotto = 0;
      for (let k = 0; k < m; k += 1) {
        const grezzo = c.valori[k];
        const v = Number.isFinite(grezzo) ? grezzo : 0;
        let x: number;
        let w: number;
        let top: number;
        let base: number;
        if (impilate) {
          x = i * slot + bordo;
          w = interno;
          if (v >= 0) {
            top = sopra + v;
            base = sopra;
            sopra += v;
          } else {
            top = sotto;
            base = sotto + v;
            sotto += v;
          }
        } else {
          w = interno / m;
          x = i * slot + bordo + k * w;
          top = Math.max(v, 0);
          base = Math.min(v, 0);
        }
        barre.push({
          chiave: `${c.chiave}|${k}`,
          colonna: i,
          tono: ser[k].tono,
          x,
          y: y(top),
          w,
          h: Math.max(0, y(base) - y(top)),
          negativa: v < 0,
          provvisoria: !!c.provvisorio,
        });
      }
      if (conLinea && c.linea != null && Number.isFinite(c.linea)) {
        punti.push(`${i * slot + slot / 2},${y(c.linea)}`);
      }
    });

    return {
      zeroY,
      ticks: ticks.map((v) => ({ v, y: y(v), testo: fmt(v) })),
      barre,
      linea: punti.join(' '),
    };
  });

  /** Ogni quante colonne si stampa l'etichetta sotto l'asse. */
  protected readonly passoEtichette = computed(() => {
    const n = this.n();
    return n <= 12 ? 1 : n <= 18 ? 2 : n <= 36 ? 3 : 7;
  });

  /** Ancorato all'ULTIMA colonna: la più recente porta sempre l'etichetta. */
  protected mostraEtichetta(i: number): boolean {
    return (this.n() - 1 - i) % this.passoEtichette() === 0;
  }

  /**
   * La colonna scelta, con la sua riga. ⚠️ Un `computed` e non `@if (scelto();
   * as i)` nel template: l'indice 0 è falso, e la prima colonna non avrebbe mai
   * avuto un tooltip. Regge anche una selezione rimasta fuori dall'elenco dopo
   * un cambio di dati.
   */
  protected readonly colonnaScelta = computed<{ i: number; c: ColonnaGrafico } | null>(() => {
    const i = this.scelto();
    if (i === null) return null;
    const c = this.colonne()[i];
    return c ? { i, c } : null;
  });

  /**
   * Il `left` del tooltip in px, misurato dopo il render. `null` = non ancora
   * misurato per questa colonna (nascosto): il `linkedSignal` torna a `null`
   * da solo a ogni cambio di `colonnaScelta`, così una misura presa su un
   * altro contenuto non piazza mai il tooltip nuovo.
   */
  protected readonly tipX = linkedSignal<unknown, number | null>({
    source: this.colonnaScelta,
    computation: () => null,
  });

  /** L'`aria-label` dell'SVG: cosa c'è, non i valori (quelli stanno in tabella). */
  protected readonly riassunto = computed(() => {
    const cols = this.colonne();
    const nomi = this.serie().map((s) => s.nome).join(', ');
    if (!cols.length) return `${this.titolo()}: nessun dato`;
    const prima = cols[0];
    const ultima = cols[cols.length - 1];
    const da = prima.etichettaLunga ?? prima.etichetta;
    const a = ultima.etichettaLunga ?? ultima.etichetta;
    const linea = this.lineaAttiva();
    return (
      `${this.titolo()}: ${cols.length} colonne da ${da} a ${a}; serie ${nomi}` +
      (linea ? `; linea ${linea}` : '')
    );
  });

  protected centroX(i: number): number {
    return ((i + 0.5) / this.n()) * 100;
  }

  /**
   * Nel primo/ultimo 8% l'etichetta dell'asse X si ancora al bordo invece che
   * al centro dello slot, o la metà sporgente uscirebbe dall'asse.
   */
  protected ancoraggio(i: number): 'sinistra' | 'centro' | 'destra' {
    const x = this.centroX(i);
    return x < 8 ? 'sinistra' : x > 92 ? 'destra' : 'centro';
  }

  // ── La lente ──────────────────────────────────────────────────────────────

  /**
   * Il puntatore che passa: muove solo il tooltip visivo, solo col MOUSE, e
   * solo se non è fissa. Col dito il passaggio è uno scorrimento: si sceglie
   * col tap (`tocca`), che fissa e arma il tocco-fuori.
   */
  protected daPuntatore(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.fisso()) return;
    const i = this.vicina(e);
    if (i !== null) this.scelto.set(i);
  }

  /** Un `pointerdown` sulla lente: il fuoco che segue non deve annunciare. */
  protected premuta(): void {
    this.fuocoDaPuntatore = true;
  }

  /** Il puntatore annullato (uno scorrimento partito qui): nessun clic seguirà. */
  protected annullata(): void {
    this.fuocoDaPuntatore = false;
  }

  /**
   * Il puntatore che esce: azzera SOLO col mouse e SOLO se non è fissa. Col
   * dito non esiste un «fuori» — il dito si alza — e la selezione deve restare
   * finché non si tocca altrove.
   */
  protected lascia(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.fisso()) return;
    this.scelto.set(null);
  }

  /**
   * Clic o tap sulla lente (e Invio/Spazio, che il bottone traduce in un clic
   * con `detail === 0`): fissa la colonna, aggiorna il readout, emette.
   */
  protected tocca(e: MouseEvent): void {
    this.fuocoDaPuntatore = false;
    const n = this.n();
    if (!n) return;
    const daTastiera = e.detail === 0;
    const i = daTastiera
      ? (this.scelto() ?? n - 1)
      : (this.vicina(e) ?? this.scelto() ?? n - 1);
    this.fissa(i);
    this.scegli.emit(i);
  }

  /**
   * Il fuoco: ritrova la colonna fissata prima del blur, o — al primo fuoco —
   * sceglie l'ULTIMA, la più recente. Un fuoco che arriva da un `pointerdown`
   * non fa niente: il `click` che segue sceglie e annuncia, una volta sola.
   */
  protected alFuoco(): void {
    if (this.fuocoDaPuntatore) {
      this.fuocoDaPuntatore = false;
      return;
    }
    const n = this.n();
    if (this.scelto() !== null || !n) return;
    const u = this.ultimoFisso;
    this.fissa(u !== null && u < n ? u : n - 1);
  }

  protected onTasto(e: KeyboardEvent): void {
    const n = this.n();
    if (!n) return;
    const i = this.scelto();
    let j: number;
    switch (e.key) {
      case 'ArrowLeft':
        j = i === null ? n - 1 : Math.max(0, i - 1);
        break;
      case 'ArrowRight':
        j = i === null ? n - 1 : Math.min(n - 1, i + 1);
        break;
      case 'Home':
        j = 0;
        break;
      case 'End':
        j = n - 1;
        break;
      case 'Escape':
        // ⚠️ Si ferma qui SOLO se c'era qualcosa da azzerare: a selezione vuota
        // l'Escape prosegue verso chi sta sopra (una modale, se un giorno il
        // grafico ci finisce dentro). `preventDefault` e non solo
        // `stopPropagation`: la chiusura di un `<dialog>` nativo è l'azione
        // PREDEFINITA del tasto, e la propagazione non c'entra.
        if (i === null) return;
        e.preventDefault();
        e.stopPropagation();
        this.azzera();
        // Un congedo esplicito: il fuoco che tornerà riparte dall'ultima colonna.
        this.ultimoFisso = null;
        return;
      default:
        return;
    }
    e.preventDefault();
    this.fissa(j);
  }

  /**
   * Niente più selezione: Escape, il fuoco che se ne va, un tocco fuori. La
   * selezione non deve restare aperta su un grafico che non si sta più
   * esplorando. `ultimoFisso` resta: è quello che il fuoco che torna ritrova.
   */
  protected azzera(): void {
    this.scelto.set(null);
    this.fisso.set(false);
    this.annuncio.set('');
    this.smetti();
  }

  /** Fissa la colonna `i`: selezione, memoria, readout, tocco-fuori armato. */
  private fissa(i: number): void {
    this.scelto.set(i);
    this.fisso.set(true);
    this.ultimoFisso = i;
    this.annuncia(i);
    this.ascolta();
  }

  /** Lo slot più vicino al puntatore, misurato sull'SVG e non sulla lente. */
  private vicina(e: { clientX: number }): number | null {
    const el = this.svg()?.nativeElement;
    const n = this.n();
    if (!el || !n) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return null;
    const frac = (e.clientX - r.left) / r.width;
    return Math.min(n - 1, Math.max(0, Math.floor(frac * n)));
  }

  /** «set 2026, provvisorio: Entrate 1.200,00 €, Uscite 300,00 €, Margine 900,00 €» */
  private annuncia(i: number): void {
    const c = this.colonne()[i];
    if (!c) return;
    const voci = this.serie().map((s, k) => `${s.nome} ${c.testi[k] ?? ''}`.trim());
    const linea = this.lineaAttiva();
    if (linea && c.testoLinea != null) voci.push(`${linea} ${c.testoLinea}`);
    const nome = c.etichettaLunga ?? c.etichetta;
    this.annuncio.set(`${nome}${c.provvisorio ? ', provvisorio' : ''}: ${voci.join(', ')}`);
  }

  // ── Chiudere toccando fuori ───────────────────────────────────────────────
  // ⚠️ Registrato SOLO mentre la selezione è fissa e tolto in `DestroyRef`: un
  // listener permanente su `document` per ogni grafico in pagina è il prezzo
  // di sei grafici pagato anche quando nessuno ne sta toccando uno. Serve
  // perché su iOS un tap su un `<button>` NON gli dà il fuoco, quindi il
  // `blur` non arriverebbe mai e la selezione resterebbe fissa per sempre.
  private readonly chiudiFuori = (e: Event): void => {
    if (this.host.contains(e.target as Node)) return;
    this.azzera();
  };

  private ascolta(): void {
    if (this.ascoltando) return;
    document.addEventListener('pointerdown', this.chiudiFuori);
    this.ascoltando = true;
  }

  private smetti(): void {
    if (!this.ascoltando) return;
    document.removeEventListener('pointerdown', this.chiudiFuori);
    this.ascoltando = false;
  }
}
