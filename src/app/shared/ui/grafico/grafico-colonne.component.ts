import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
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
 */
function niceTicks(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  let hi = max;
  if (hi <= min) hi = min + 1;
  const grezzo = (hi - min) / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const norm = grezzo / mag;
  const passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
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
 * cioè l'altezza che la pila raggiunge davvero.
 */
function dominio(
  colonne: readonly ColonnaGrafico[],
  impilate: boolean,
  conLinea: boolean,
): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const c of colonne) {
    if (impilate) {
      let sopra = 0;
      let sotto = 0;
      for (const v of c.valori) {
        if (!Number.isFinite(v)) continue;
        if (v >= 0) sopra += v;
        else sotto += v;
      }
      max = Math.max(max, sopra);
      min = Math.min(min, sotto);
    } else {
      for (const v of c.valori) {
        if (!Number.isFinite(v)) continue;
        max = Math.max(max, v);
        min = Math.min(min, v);
      }
    }
    if (conLinea && c.linea != null && Number.isFinite(c.linea)) {
      max = Math.max(max, c.linea);
      min = Math.min(min, c.linea);
    }
  }
  return { min, max };
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
 * Tab del grafico. Il puntatore che passa muove il tooltip VISIVO sulla
 * colonna più vicina (regge anche 90 colonne da 8px: si sceglie lo slot, non
 * si colpisce la barra); un tap/clic la FISSA — resta finché non si tocca
 * fuori — ed emette `scegli`; frecce/Home/End la muovono da tastiera, Escape
 * azzera, Invio/Spazio (il default del bottone) equivale al clic. Al primo
 * fuoco senza selezione si sceglie l'ULTIMA colonna, la più recente.
 *
 * ⚠️ Il readout `aria-live` cambia SOLO da tastiera e da tap, MAI a ogni
 * `pointermove`: uno screen reader che leggesse dodici mesi mentre il mouse
 * attraversa il grafico è un annuncio che si smette di ascoltare. Il tooltip
 * visivo è `aria-hidden`; il readout è un `visually-hidden` a parte.
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

  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private ascoltando = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.smetti());
  }

  protected readonly n = computed(() => this.colonne().length);

  protected readonly geometria = computed<Geometria>(() => {
    const cols = this.colonne();
    const ser = this.serie();
    const impilate = this.modo() === 'impilate';
    const conLinea = this.etichettaLinea() !== null;
    const { min, max } = dominio(cols, impilate, conLinea);
    const { lo, hi, ticks } = niceTicks(min, max);
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
  protected readonly colonnaScelta = computed(() => {
    const i = this.scelto();
    const c = i === null ? undefined : this.colonne()[i];
    return c ? { i, c } : null;
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
    const linea = this.etichettaLinea();
    return (
      `${this.titolo()}: ${cols.length} colonne da ${da} a ${a}; serie ${nomi}` +
      (linea ? `; linea ${linea}` : '')
    );
  });

  protected centroX(i: number): number {
    return ((i + 0.5) / this.n()) * 100;
  }

  /** Nel primo/ultimo 15% il tooltip si ancora al bordo, o uscirebbe dall'area. */
  protected ancoraggio(i: number): 'sinistra' | 'centro' | 'destra' {
    const x = this.centroX(i);
    return x < 15 ? 'sinistra' : x > 85 ? 'destra' : 'centro';
  }

  // ── La lente ──────────────────────────────────────────────────────────────

  /** Il puntatore che passa: muove solo il tooltip visivo, e solo se non è fissa. */
  protected daPuntatore(e: PointerEvent): void {
    if (this.fisso()) return;
    const i = this.vicina(e);
    if (i !== null) this.scelto.set(i);
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
    const n = this.n();
    if (!n) return;
    const daTastiera = e.detail === 0;
    const i = daTastiera
      ? (this.scelto() ?? n - 1)
      : (this.vicina(e) ?? this.scelto() ?? n - 1);
    this.scelto.set(i);
    this.fisso.set(true);
    this.annuncia(i);
    this.scegli.emit(i);
    this.ascolta();
  }

  /** Al primo fuoco senza selezione si sceglie l'ULTIMA colonna, la più recente. */
  protected alFuoco(): void {
    const n = this.n();
    if (this.scelto() !== null || !n) return;
    this.scelto.set(n - 1);
    this.fisso.set(true);
    this.annuncia(n - 1);
    this.ascolta();
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
        return;
      default:
        return;
    }
    e.preventDefault();
    this.scelto.set(j);
    this.fisso.set(true);
    this.annuncia(j);
    this.ascolta();
  }

  /**
   * Niente più selezione: Escape, il fuoco che se ne va, un tocco fuori. La
   * selezione non deve restare aperta su un grafico che non si sta più
   * esplorando.
   */
  protected azzera(): void {
    this.scelto.set(null);
    this.fisso.set(false);
    this.annuncio.set('');
    this.smetti();
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
    const linea = this.etichettaLinea();
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
