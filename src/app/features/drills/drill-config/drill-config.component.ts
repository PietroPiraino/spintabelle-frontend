import {
  ChangeDetectionStrategy,
  Component,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  DrillCombo,
  DrillConfigPayload,
  DrillDifficulty,
  DrillSpotType,
  DrillPreset,
  DrillStatsBucket,
  PreflopMeta,
} from '../../../core/models/api.models';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { DrillService } from '../../../core/services/drill.service';
import { PreflopService } from '../../../core/services/preflop.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { anteOffset, depthDisplay } from '../../tables/preflop-display';
import { frecceRadiogroup } from '../../../shared/a11y/radiogroup';
import { HeroCardsComponent } from '../../../shared/ui/hero-cards/hero-cards.component';
import {
  DIFFICULTY_HINTS,
  DIFFICULTY_LABELS,
  SPOT_TYPE_LABELS,
  formatLabel,
} from '../drill-display';
import {
  PERCORSI,
  Percorso,
  bucketSano,
  dettaglioPercorso,
} from '../drill-percorsi';
import {
  frasePoolVuoto,
  frasePreparazione,
  testoProfondita,
} from '../drill-frase';
import {
  MsOpzione,
  MultiSelectComponent,
} from '../../../shared/ui/multi-select/multi-select.component';

/**
 * Quante `depth_label` grezze il payload può portare, cioè lo specchio di
 * `@ArrayMaxSize(160)` sul DTO del backend.
 *
 * ⚠️ È una CINTURA, non l'autorità: l'autorità resta il DTO. Serve perché il
 * 400 del `ValidationPipe` arriva come array di messaggi, il `??` di
 * `drill.service.ts` non scatta, e a schermo finisce
 * `depths must contain not more than 160 elements` — in inglese e sulla
 * schermata del runner, cioè dopo un cambio di rotta.
 * ⚠️ Va tenuta allineata a mano col DTO: due numeri, due repo, nessuna guardia.
 */
const MAX_DEPTHS_PAYLOAD = 160;

interface DepthOption {
  /** valore mostrato (offset ante tolto), es. "10" — chiave del chip */
  display: string;
  /** valore base numerico, per l'ordinamento */
  base: number;
  /** TUTTE le depth_label grezze che collassano su questo display (es. "10","10.17") */
  rawLabels: string[];
}

@Component({
  selector: 'app-drill-config',
  imports: [RouterLink, HeroCardsComponent, MultiSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drill-config.component.html',
  styleUrl: './drill-config.component.scss',
})
export class DrillConfigComponent {
  protected readonly auth = inject(AuthService);
  private readonly preflop = inject(PreflopService);
  private readonly drill = inject(DrillService);
  private readonly router = inject(Router);

  protected readonly meta = signal<PreflopMeta | null>(null);
  protected readonly metaError = signal(false);
  /** Combinazioni reali (formato/depth/posizione/spot) per il meta-driving. */
  private readonly combos = signal<DrillCombo[]>([]);

  protected readonly selectedFormats = signal<Set<string>>(new Set());
  protected readonly selectedDepths = signal<Set<string>>(new Set());
  protected readonly selectedPositions = signal<Set<string>>(new Set());
  protected readonly selectedSpotTypes = signal<Set<DrillSpotType>>(new Set());
  protected readonly difficulty = signal<DrillDifficulty>('STANDARD');
  protected readonly questions = signal(20);

  protected readonly positions = ['BTN', 'SB', 'BB'];
  /**
   * ⚠️ CINQUE, non quattro: `LIMPED` mancava del tutto qui, mentre il backend
   * lo accetta da sempre (`SPOT_TYPES` in `drills.types.ts`, `@IsIn` sul DTO) e
   * i dati ne contengono 1.533 nodi. Chi voleva allenare i piatti non aperti
   * poteva solo lasciare l'asse vuoto e prenderseli mescolati a tutto il resto.
   * ⚠️ Aggiungerlo CAMBIA il pool per chi oggi spunta tutti e quattro i chip:
   * prima era «tutto meno i non aperti», adesso è tutto.
   */
  protected readonly spotTypes: DrillSpotType[] = [
    'OPEN',
    'VS_OPEN',
    'VS_3BET',
    'VS_4BET_PLUS',
    'LIMPED',
  ];
  protected readonly difficulties: DrillDifficulty[] = [
    'STANDARD',
    'MIXED_ONLY',
    'MARGINAL',
    'ALL',
  ];
  protected readonly questionCounts = [10, 20, 50];

  protected readonly spotLabels = SPOT_TYPE_LABELS;
  protected readonly difficultyLabels = DIFFICULTY_LABELS;
  protected readonly difficultyHints = DIFFICULTY_HINTS;

  protected readonly formatOptions = computed(() =>
    (this.meta()?.formats ?? []).map((f) => ({
      format: f.format,
      label: formatLabel(f.format),
    })),
  );

  /**
   * Profondità disponibili (unione dei formati scelti, o di tutti),
   * DEDUPLICATE per valore mostrato: "10" (spin) e "10.17" (spin_ante)
   * collassano su un solo chip "10 bb" che, se scelto, filtra entrambe.
   */
  protected readonly availableDepths = computed<DepthOption[]>(() => {
    const m = this.meta();
    if (!m) return [];
    const sel = this.selectedFormats();
    const formats = m.formats.filter((f) =>
      sel.size ? sel.has(f.format) : true,
    );
    const byDisplay = new Map<string, { base: number; raws: Set<string> }>();
    for (const f of formats) {
      for (const d of f.depths) {
        const display = depthDisplay(d, f.format);
        const base = parseFloat(d) - anteOffset(f.format);
        const entry = byDisplay.get(display) ?? { base, raws: new Set<string>() };
        entry.raws.add(d);
        byDisplay.set(display, entry);
      }
    }
    return [...byDisplay.entries()]
      .map(([display, v]) => ({ display, base: v.base, rawLabels: [...v.raws] }))
      .sort((a, b) => a.base - b.base);
  });

  /** depth_label grezze corrispondenti ai chip profondità selezionati. */
  private readonly selectedRawDepths = computed(() => {
    const sel = this.selectedDepths();
    return new Set(
      this.availableDepths()
        .filter((d) => sel.has(d.display))
        .flatMap((d) => d.rawLabels),
    );
  });

  /** Combinazioni filtrate per i soli formato+profondità scelti. */
  private readonly combosForBase = computed(() => {
    const fmt = this.selectedFormats();
    const depths = this.selectedRawDepths();
    return this.combos().filter(
      (c) =>
        (fmt.size ? fmt.has(c.format) : true) &&
        (depths.size ? depths.has(c.depth) : true),
    );
  });

  /** Posizioni che hanno spot dato lo spot-type selezionato (vuoto = tutte). */
  protected readonly availablePositions = computed<Set<string>>(() => {
    if (!this.combos().length) return new Set(this.positions); // load: non bloccare
    const spt = this.selectedSpotTypes();
    return new Set(
      this.combosForBase()
        .filter((c) => (spt.size ? spt.has(c.spotType) : true))
        .map((c) => c.position),
    );
  });

  /** Tipi di spot che hanno spot data la posizione selezionata (vuoto = tutti). */
  protected readonly availableSpotTypes = computed<Set<DrillSpotType>>(() => {
    if (!this.combos().length) return new Set(this.spotTypes);
    const pos = this.selectedPositions();
    return new Set(
      this.combosForBase()
        .filter((c) => (pos.size ? pos.has(c.position) : true))
        .map((c) => c.spotType),
    );
  });

  /** Quante combinazioni soddisfano la selezione completa (0 = config vuota). */
  protected readonly matchedCount = computed(() => {
    const pos = this.selectedPositions();
    const spt = this.selectedSpotTypes();
    return this.combosForBase().filter(
      (c) =>
        (pos.size ? pos.has(c.position) : true) &&
        (spt.size ? spt.has(c.spotType) : true),
    ).length;
  });

  // ⚠️ QUI C'ERA LA RIGA DI CONTESTO (Gioco / Varianti / Durata), tolta il
  // 04/09/2026 con tutta la sua macchina di proiezione — una quindicina di
  // membri: `basi`, `baseAttiva`, `anteDisponibile`, `applicaParti`…
  //
  // Non era solo ridondante a vedersi: `setBase`/`toggleAnte`/`toggleAsim`
  // scrivevano lo STESSO `selectedFormats` della tendina Formato, e per farlo
  // ricomponevano la selezione su UN formato — quindi chi ne aveva scelti tre
  // dalla tendina e poi sfiorava «Gioco» ne perdeva due, in silenzio.
  //
  // Ed era un residuo dell'ordine di costruzione: quella riga è nata per non
  // mostrare nove chip di formato in prima schermata, problema che la tendina
  // ha risolto in un altro modo. Se qualcuno la rimette, rimette anche la
  // perdita silenziosa.

  // ── Percorsi ──────────────────────────────────────────────────────────────

  /**
   * Che cosa conta il numero accanto a ogni percorso.
   *
   * ⚠️ Conta COMBINAZIONI (formato × profondità × posizione × tipo di
   * situazione), non mani e non nodi: 2.178 in tutto il dataset. Per questo
   * cambiando difficoltà il numero NON si muove — la difficoltà filtra le mani
   * DENTRO ogni situazione, non le situazioni. È corretto e sembra un guasto,
   * quindi va spiegato dove lo si legge. (È anche il motivo per cui il percorso
   * «Le mani al fotofinish» è stato tolto: accanto ad «Allenamento misto»
   * mostrava lo stesso identico conteggio e si leggeva come un doppione.)
   */
  protected readonly spiegaConteggio =
    'Combinazioni di formato, profondità, posizione e tipo di situazione comprese nella scelta. Non è il numero di mani: la difficoltà filtra le mani dentro ogni situazione, quindi non cambia questo numero.';

  /**
   * I cinque bucket in cui l'utente perde più EV, dal suo storico.
   *
   * ⚠️ Già ripuliti con `bucketSano`: dal ripiego sulla chiave di `byBucket`
   * escono `"10,17"` e `"spin_ante_2,5x_nolimp"`, che i DTO rifiutano entrambi.
   * Filtrare QUI e non al momento della partenza significa che il percorso si
   * mostra disabilitato invece di prendere un 400 sulla schermata del runner.
   */
  private readonly peggiori = signal<DrillStatsBucket[]>([]);
  /** Quante risposte ha dato in tutto: sotto la soglia il percorso non serve. */
  private readonly risposteTotali = signal(0);

  // ── I preset dello studente ───────────────────────────────────────────────

  protected readonly preset = signal<DrillPreset[]>([]);
  /** Il modulo «dai un nome» è aperto: nessun `prompt()` nativo. */
  protected readonly salvataggioAperto = signal(false);
  protected readonly nomePreset = signal('');
  protected readonly erroreSalvataggio = signal<string | null>(null);
  /** Preset su cui è aperta la conferma di cancellazione (una alla volta). */
  protected readonly presetDaCancellare = signal<string | null>(null);

  protected readonly percorsi = PERCORSI;
  /** Le profondità grezze coperte da un percorso (vuoto = tutte). */
  private rawDepthsPercorso(p: Percorso): Set<string> {
    if (p.minBb === undefined && p.maxBb === undefined) return new Set();
    return new Set(
      this.availableDepths()
        .filter(
          (d) =>
            d.base >= (p.minBb ?? -Infinity) && d.base <= (p.maxBb ?? Infinity),
        )
        .flatMap((d) => d.rawLabels),
    );
  }

  /**
   * Quante combinazioni copre un percorso, DATO il contesto corrente.
   * ⚠️ È una funzione pura sui `combos()`: non tocca i signal della selezione,
   * altrimenti mostrare i conteggi cambierebbe la configurazione dell'utente.
   */
  private contaPercorso(p: Percorso): number {
    const fmt = this.selectedFormats();
    const raw = this.rawDepthsPercorso(p);
    const pos = new Set(p.positions ?? []);
    const spt = new Set<string>(p.spotTypes ?? []);
    return this.combos().filter(
      (c) =>
        (fmt.size ? fmt.has(c.format) : true) &&
        (raw.size ? raw.has(c.depth) : true) &&
        (pos.size ? pos.has(c.position) : true) &&
        (spt.size ? spt.has(c.spotType) : true),
    ).length;
  }

  /** Sotto questa soglia lo storico non dice ancora niente di utile. */
  private static readonly MIN_RISPOSTE_PEGGIORI = 30;

  /**
   * Il percorso costruito sullo storico: dettaglio, conteggio e — se non c'è
   * ancora materiale — il motivo per cui è spento.
   *
   * ⚠️ Resta VISIBILE e disabilitato invece di sparire: una voce che compare e
   * scompare a seconda di quanto hai giocato fa cercare un guasto. E il motivo
   * dice che cosa fare per accenderla, che è l'unica informazione utile.
   */
  private risolviPeggiori(p: Percorso) {
    const buckets = this.peggiori();
    if (this.risposteTotali() < DrillConfigComponent.MIN_RISPOSTE_PEGGIORI) {
      return {
        p,
        conteggio: -1,
        vuoto: true,
        // ⚠️ Il motivo è GIÀ nella riga di dettaglio: senza questo flag il
        // template aggiungerebbe anche il suo generico («Nessuna situazione di
        // questo tipo nel formato scelto»), che qui è pure FALSO — non manca il
        // materiale nei dati, manca lo storico.
        motivoProprio: true,
        dettaglio: `Allenati ancora un po' e qui comparirà dove sbagli di più (servono almeno ${DrillConfigComponent.MIN_RISPOSTE_PEGGIORI} risposte).`,
      };
    }
    if (!buckets.length) {
      return {
        p,
        conteggio: -1,
        vuoto: true,
        motivoProprio: true,
        dettaglio:
          'Non abbiamo ancora abbastanza risposte su una stessa combinazione per dire dove sbagli di più.',
      };
    }
    // ⚠️ Il formato lo dettano i BUCKET, non il contesto in cima alla pagina:
    // è l'unico percorso che ignora quella scelta, e per questo la riga di
    // dettaglio lo NOMINA — così la sorpresa non c'è.
    const formati = [...new Set(buckets.map((b) => b.format))];
    const profondita = [...new Set(buckets.map((b) => b.depthLabel))];
    return {
      p,
      conteggio: -1,
      vuoto: false,
      motivoProprio: true,
      dettaglio: `${formati.map(formatLabel).join(', ')} · ${profondita
        .map((d) => d.replace('.', ','))
        .join(', ')} bb · dove perdi più EV`,
    };
  }

  /** I percorsi con la loro riga di dettaglio e il conteggio, pronti da rendere. */
  protected readonly percorsiRisolti = computed(() => {
    const dep = this.availableDepths();
    const min = dep.length ? dep[0].base : 0;
    const max = dep.length ? dep[dep.length - 1].base : 0;
    // ⚠️ Senza le combinazioni caricate NON si disabilita niente: è lo stesso
    // degrado di `canStart`, e la guardia vera resta il backend.
    const conteggiNoti = this.combos().length > 0;
    return this.percorsi.map((p) => {
      if (p.datiUtente) return this.risolviPeggiori(p);
      const n = conteggiNoti ? this.contaPercorso(p) : -1;
      return {
        p,
        conteggio: n,
        vuoto: conteggiNoti && n === 0,
        motivoProprio: false,
        dettaglio: dettaglioPercorso(p, {
          posizioni: p.positions ?? [],
          situazioni: (p.spotTypes ?? []).map((s) => SPOT_TYPE_LABELS[s]),
          minDisponibile: min,
          maxDisponibile: max,
        }),
      };
    });
  });

  // ── I quattro assi come tendine ───────────────────────────────────────────

  protected readonly opzioniFormato = computed<MsOpzione[]>(() =>
    this.formatOptions().map((f) => ({ valore: f.format, etichetta: f.label })),
  );

  protected readonly opzioniProfondita = computed<MsOpzione[]>(() =>
    this.availableDepths().map((d) => ({
      valore: d.display,
      etichetta: `${d.display} bb`,
    })),
  );

  /**
   * Il MOTIVO accanto a una voce spenta: è metà della ragione per cui questa
   * pagina usa una tendina custom e non una `<select multiple>` nativa.
   */
  private motivoDa(altre: readonly string[], asse: string): string {
    if (!altre.length) return `Nessuno spot con il formato scelto.`;
    return `Nessuno spot con ${asse} ${altre.join(', ')}.`;
  }

  protected readonly opzioniPosizione = computed<MsOpzione[]>(() => {
    const disp = this.availablePositions();
    const spot = [...this.selectedSpotTypes()].map((s) => SPOT_TYPE_LABELS[s]);
    return this.positions.map((p) => ({
      valore: p,
      etichetta: p,
      disabilitata: !disp.has(p),
      motivo: disp.has(p) ? undefined : this.motivoDa(spot, 'la situazione'),
    }));
  });

  protected readonly opzioniSituazione = computed<MsOpzione[]>(() => {
    const disp = this.availableSpotTypes();
    const pos = [...this.selectedPositions()];
    return this.spotTypes.map((s) => ({
      valore: s,
      etichetta: SPOT_TYPE_LABELS[s],
      disabilitata: !disp.has(s),
      motivo: disp.has(s) ? undefined : this.motivoDa(pos, 'la posizione'),
    }));
  });

  /** «da 8 a 15 bb» quando il tratto è contiguo, altrimenti l'elenco. */
  protected readonly testoProf = computed(() =>
    testoProfondita(this.selectedDepths(), this.availableDepths()),
  );

  /**
   * Fasce rapide. ⚠️ I confini sono un GIUDIZIO EDITORIALE, non un dato: 10 e
   * 20 bb sono la zona push/fold e quella in cui l'open-shove smette di essere
   * automatico. Nessun campo del backend li conosce, e si cambiano qui.
   */
  protected readonly fasce = [
    // ⚠️ Etichette corte perché il pannello è largo ~300px: con «Corto (fino a
    // 10 bb)» le tre fasce si impilavano su tre righe, e il senso di una fascia
    // rapida è che sia UN colpo d'occhio. Il confine resta scritto.
    { id: 'corto', etichetta: '≤ 10 bb', min: -Infinity, max: 10 },
    { id: 'medio', etichetta: '10-20 bb', min: 10, max: 20 },
    { id: 'profondo', etichetta: '> 20 bb', min: 20, max: Infinity },
  ];

  /** Avviso di potatura: che cosa è stato tolto e perché. */
  protected readonly avvisoPotatura = signal<string | null>(null);

  // ── Riepilogo e freni ─────────────────────────────────────────────────────

  private readonly datiFrase = computed(() => ({
    mani: this.questions(),
    formati: this.formatOptions()
      .filter((f) => this.selectedFormats().has(f.format))
      .map((f) => f.label),
    profondita: this.testoProf(),
    posizioni: [...this.selectedPositions()],
    situazioni: [...this.selectedSpotTypes()].map((s) => SPOT_TYPE_LABELS[s]),
    difficolta: this.difficulty(),
  }));

  protected readonly frase = computed(() => frasePreparazione(this.datiFrase()));
  protected readonly fraseVuota = computed(() => frasePoolVuoto(this.datiFrase()));

  /**
   * ⚠️ TERZO STATO OBBLIGATORIO. `matchedCount` NON degrada quando
   * `/drills/options` fallisce: l'errore è ingoiato in silenzio, `combos()`
   * resta vuota e `combosForBase()` filtra un array vuoto dando **0**. Senza
   * questo ramo la pagina direbbe «0 situazioni» e «non c'è niente da
   * allenare» accanto a un bottone abilitato e perfettamente funzionante.
   */
  protected readonly conteggioNoto = computed(() => this.combos().length > 0);

  /**
   * Le `depth_label` grezze che partirebbero adesso: è la cintura contro il
   * tetto del DTO.
   *
   * ⚠️ Il 400 arriva sulla schermata del RUNNER, dopo un cambio di rotta
   * rispetto al punto in cui si è scelto — quindi spegnere il CTA qui è
   * l'unica cosa che tiene il rifiuto dove l'utente sta guardando.
   */
  protected readonly troppePronfondita = computed(
    () => this.rawDepthsScelte().length > MAX_DEPTHS_PAYLOAD,
  );

  private readonly rawDepthsScelte = computed(() =>
    this.availableDepths()
      .filter((d) => this.selectedDepths().has(d.display))
      .flatMap((d) => d.rawLabels),
  );

  protected readonly canStart = computed(() => {
    if (this.selectedFormats().size === 0) return false;
    if (this.troppePronfondita()) return false;
    // opzioni non caricate → non blocco (il backend fa da guardia comunque)
    if (!this.combos().length) return true;
    return this.matchedCount() > 0;
  });

  constructor() {
    // la meta (+ le combinazioni allenabili) popola i selettori: parte
    // appena l'utente è loggato
    effect(() => {
      if (!this.auth.user() || this.meta() || this.metaError()) return;
      untracked(() => {
        this.preflop.getMeta().subscribe({
          next: (m) => this.meta.set(m),
          error: () => this.metaError.set(true),
        });
        this.drill.getOptions().subscribe({
          next: (o) => this.combos.set(o.combos),
          // degrada in silenzio: niente disabling, ma il backend fa da guardia
          error: () => undefined,
        });
        // Lo storico alimenta il solo percorso «Le tue situazioni peggiori».
        // ⚠️ Best-effort come le altre due: senza, la pagina perde un percorso,
        // non la configurazione. E sta QUI, dentro l'effect gated su
        // `auth.user()`, mai nel costruttore: la rotta è pubblica e
        // prerenderizzata, e una chiamata incondizionata sparerebbe un 401 a
        // ogni visita anonima.
        // ⚠️ Best-effort come le altre: senza, la pagina perde la sezione dei
        // preset, non la configurazione.
        this.drill.getPresets().subscribe({
          next: (p) => this.preset.set(p),
          error: () => undefined,
        });
        this.drill.getStats().subscribe({
          next: (st) => {
            this.risposteTotali.set(st.totalAnswered);
            this.peggiori.set(st.worstBuckets.filter(bucketSano));
          },
          error: () => undefined,
        });
      });
    });

    // default: il primo gioco base (preferendo spin) appena la meta è pronta
    effect(() => {
      const m = this.meta();
      if (!m) return;
      untracked(() => {
        if (this.selectedFormats().size) return;
        const fmts = m.formats.map((f) => f.format);
        const def =
          fmts.find((f) => f === 'spin') ??
          fmts.find((f) => !f.includes('_')) ??
          fmts[0];
        if (def) this.selectedFormats.set(new Set([def]));
      });
    });

    // tieni coerenti le profondità scelte coi formati attivi (per display)
    effect(() => {
      const avail = new Set(this.availableDepths().map((d) => d.display));
      untracked(() => {
        const cur = this.selectedDepths();
        if (![...cur].every((d) => avail.has(d))) {
          const tolte = [...cur].filter((d) => !avail.has(d));
          this.selectedDepths.set(new Set([...cur].filter((d) => avail.has(d))));
          // ⚠️ È l'asse che ne rimuove DI PIÙ (fino a 42 valori) ed è quello
          // che, chiuso in una tendina, sparirebbe in silenzio.
          this.segnalaPotatura(
            tolte.map((d) => `${d} bb`),
            'dalle profondità scelte',
          );
        }
      });
    });

    // quando cambia il "base" (formato/depth/combinazioni) ripulisci posizioni e
    // spot che non hanno più spot. Traccia SOLO combosForBase: la prune scrive le
    // selezioni in untracked, quindi non si auto-ritriggera (niente loop).
    effect(() => {
      this.combosForBase();
      untracked(() => this.pruneSelections());
    });
  }

  /**
   * Rimuove dalle selezioni le posizioni/spot che, data l'altra dimensione e il
   * formato/depth scelti, non hanno alcuno spot. Prima le posizioni (dato lo
   * spot), poi gli spot (date le posizioni aggiornate). Un solo passaggio.
   */
  private pruneSelections(): void {
    if (!this.combos().length) return;
    const base = this.combosForBase();
    const spt0 = this.selectedSpotTypes();
    const validPos = new Set(
      base
        .filter((c) => (spt0.size ? spt0.has(c.spotType) : true))
        .map((c) => c.position),
    );
    const pos = this.selectedPositions();
    const np = new Set([...pos].filter((p) => validPos.has(p)));
    if (np.size !== pos.size) {
      this.selectedPositions.set(np);
      this.segnalaPotatura(
        [...pos].filter((p) => !validPos.has(p)),
        'dalle posizioni scelte',
      );
    }

    const pos2 = this.selectedPositions();
    const validSpt = new Set(
      base
        .filter((c) => (pos2.size ? pos2.has(c.position) : true))
        .map((c) => c.spotType),
    );
    const spt = this.selectedSpotTypes();
    const ns = new Set([...spt].filter((s) => validSpt.has(s)));
    if (ns.size !== spt.size) {
      this.selectedSpotTypes.set(ns);
      this.segnalaPotatura(
        [...spt].filter((s) => !validSpt.has(s)).map((s) => SPOT_TYPE_LABELS[s]),
        'dalle situazioni scelte',
      );
    }
  }

  /**
   * Dice ad alta voce che cosa è stato tolto.
   *
   * ⚠️ Prima la potatura era MUTA, e con i chip a schermo si vedeva comunque
   * («quel bottone si è spento»). Chiusa dentro una tendina diventerebbe
   * INVISIBILE — cioè il redesign peggiorerebbe il difetto invece di curarlo.
   * ⚠️ Va chiamata da ENTRAMBI i meccanismi di potatura: questo, e l'effect che
   * riallinea le profondità ai formati attivi — che è quello che ne rimuove di
   * più (fino a 42 valori) ed è anche il più facile da dimenticare.
   */
  private segnalaPotatura(tolte: string[], dove: string): void {
    if (!tolte.length) return;
    this.avvisoPotatura.set(
      `Abbiamo tolto ${tolte.join(', ')} ${dove}: con il resto della scelta non ci sono spot.`,
    );
  }

  // ── Comandi dei quattro assi ──────────────────────────────────────────────

  protected setFormati(sel: ReadonlySet<string>): void {
    if (sel.size === 0) return; // «tutti» non esiste qui: canStart lo esige
    this.selectedFormats.set(new Set(sel));
  }

  protected setProfondita(sel: ReadonlySet<string>): void {
    this.selectedDepths.set(new Set(sel));
  }

  protected setPosizioni(sel: ReadonlySet<string>): void {
    this.selectedPositions.set(new Set(sel));
    this.pruneSelections();
  }

  protected setSituazioni(sel: ReadonlySet<string>): void {
    this.selectedSpotTypes.set(new Set(sel as ReadonlySet<DrillSpotType>));
    this.pruneSelections();
  }

  /** Una fascia rapida seleziona il tratto contiguo che ci ricade dentro. */
  protected applicaFascia(f: { min: number; max: number }): void {
    this.selectedDepths.set(
      new Set(
        this.availableDepths()
          .filter((d) => d.base > f.min - 0.0001 && d.base <= f.max)
          .map((d) => d.display),
      ),
    );
  }

  /** Estremo scelto nei due `<select>` dell'intervallo; '' = quello della scala. */
  protected estremo(quale: 'da' | 'a'): string {
    const scala = this.availableDepths();
    if (!scala.length) return '';
    const scelti = scala.filter((d) => this.selectedDepths().has(d.display));
    const usati = scelti.length ? scelti : scala;
    return quale === 'da' ? usati[0].display : usati[usati.length - 1].display;
  }

  /**
   * Sposta un estremo dell'intervallo: seleziona il TRATTO CONTIGUO fra i due.
   *
   * ⚠️ Le chiavi restano le stringhe MOSTRATE, mai un indice numerico né un
   * float: `1.17 − 0.17` fa `0.9999999999999999`, e su questa scala i valori
   * decimali sono la metà. Il confronto avviene sugli indici della scala.
   */
  protected setEstremo(quale: 'da' | 'a', display: string): void {
    const scala = this.availableDepths();
    const i = scala.findIndex((d) => d.display === display);
    if (i < 0) return;
    const altro = scala.findIndex(
      (d) => d.display === this.estremo(quale === 'da' ? 'a' : 'da'),
    );
    const [lo, hi] =
      quale === 'da' ? [i, Math.max(i, altro)] : [Math.min(i, altro), i];
    this.selectedDepths.set(
      new Set(scala.slice(lo, hi + 1).map((d) => d.display)),
    );
  }

  protected toggleFormat(format: string): void {
    this.toggle(this.selectedFormats, format);
  }
  protected toggleDepth(label: string): void {
    this.toggle(this.selectedDepths, label);
  }
  protected togglePosition(pos: string): void {
    if (!this.availablePositions().has(pos)) return; // chip disabilitato
    this.toggle(this.selectedPositions, pos);
    this.pruneSelections(); // coerenza con gli spot già scelti
  }
  protected toggleSpot(spot: DrillSpotType): void {
    if (!this.availableSpotTypes().has(spot)) return; // chip disabilitato
    this.toggle(this.selectedSpotTypes, spot);
    this.pruneSelections(); // coerenza con le posizioni già scelte
  }
  protected setDifficulty(d: DrillDifficulty): void {
    this.difficulty.set(d);
  }

  /** L'avviso di potatura si spegne al tocco successivo: è un fatto, non uno stato. */
  protected chiudiAvviso(): void {
    this.avvisoPotatura.set(null);
  }
  protected setQuestions(n: number): void {
    this.questions.set(n);
  }

  protected onDurataKeydown(event: KeyboardEvent): void {
    frecceRadiogroup(
      event,
      this.questionCounts.length,
      this.questionCounts.indexOf(this.questions()),
      (j) => this.setQuestions(this.questionCounts[j]),
    );
  }

  /**
   * Fa partire un percorso: SCRIVE i sei signal e chiama lo `start()` di
   * sempre. Nessun campo nuovo nel payload — vedi il commento in testa a
   * `drill-percorsi.ts`.
   */
  protected avviaPercorso(p: Percorso): void {
    if (p.datiUtente) {
      const buckets = this.peggiori();
      if (!buckets.length) return;
      // ⚠️ Anche questo percorso SCRIVE I SIGNAL e passa dallo `start()` di
      // sempre — la regola portante di `drill-percorsi.ts`. La tentazione era
      // comporre il payload a mano con le `depth_label` grezze dello storico,
      // ma allora aprendo «Personalizza» subito dopo si sarebbe letto «tutte le
      // profondità» mentre la sessione girava su cinque valori: il pannello
      // avrebbe mentito su ciò che era appena partito.
      // ⚠️ Il prezzo, dichiarato: le etichette grezze si traducono nel valore
      // MOSTRATO, e `10` e `10.17` collassano sullo stesso. Se i bucket
      // toccano sia `spin` sia `spin_ante`, la sessione prende entrambe — ma
      // entrambi quei formati sono comunque fra i selezionati, quindi è
      // materiale legittimo, non un allargamento arbitrario.
      const grezze = new Set(buckets.map((b) => b.depthLabel));
      this.selectedFormats.set(new Set(buckets.map((b) => b.format)));
      this.selectedDepths.set(
        new Set(
          this.availableDepths()
            .filter((d) => d.rawLabels.some((r) => grezze.has(r)))
            .map((d) => d.display),
        ),
      );
      this.selectedPositions.set(new Set());
      this.selectedSpotTypes.set(new Set());
      this.difficulty.set('STANDARD');
      // ⚠️ `start()` esce in silenzio se `canStart()` è falso, e un bottone che
      // non fa niente è peggio di un bottone spento. Qui può capitare in un
      // caso solo — un re-import dello scraper che ha tolto quei nodi — ma è
      // proprio il caso in cui nessuno capirebbe perché.
      if (!this.canStart()) {
        this.avvisoPotatura.set(
          'Le situazioni in cui sbagliavi di più non sono più fra quelle disponibili: prova un altro percorso.',
        );
        return;
      }
      this.start();
      return;
    }
    // ⚠️ Percorso senza estremi = TUTTE le profondità, cioè l'insieme VUOTO e
    // non «tutte elencate»: `depths: []` per il backend significa «qualunque»,
    // ed è anche l'unica forma che non rischia di sfondare `@ArrayMaxSize`.
    const senzaEstremi = p.minBb === undefined && p.maxBb === undefined;
    this.selectedDepths.set(
      senzaEstremi
        ? new Set()
        : new Set(
            this.availableDepths()
              .filter(
                (d) =>
                  d.base >= (p.minBb ?? -Infinity) &&
                  d.base <= (p.maxBb ?? Infinity),
              )
              .map((d) => d.display),
          ),
    );
    this.selectedPositions.set(new Set(p.positions ?? []));
    this.selectedSpotTypes.set(new Set(p.spotTypes ?? []));
    this.difficulty.set(p.difficulty ?? 'STANDARD');
    this.start();
  }

  // ── Comandi dei preset ────────────────────────────────────────────────────

  /** La configurazione corrente, nella forma esatta che il server accetta. */
  private configCorrente(): DrillConfigPayload {
    return {
      formats: [...this.selectedFormats()],
      depths: this.rawDepthsScelte(),
      positions: [...this.selectedPositions()],
      spotTypes: [...this.selectedSpotTypes()],
      difficulty: this.difficulty(),
      questionsPerSession: this.questions(),
    };
  }

  protected apriSalvataggio(): void {
    this.erroreSalvataggio.set(null);
    // ⚠️ Nome proposto, non imposto: un campo vuoto su mobile fa chiudere e
    // riaprire. La frase di riepilogo è già la descrizione migliore che
    // abbiamo, tagliata a quello che ci sta.
    this.nomePreset.set(this.nomeProposto());
    this.salvataggioAperto.set(true);
  }

  /** «Spin & Go · da 8 a 15 bb · BB» — abbastanza per ritrovarlo in un elenco. */
  private nomeProposto(): string {
    const parti = [
      this.formatOptions()
        .filter((f) => this.selectedFormats().has(f.format))
        .map((f) => f.label)
        .join(', '),
      this.testoProf(),
      [...this.selectedPositions()].join(', '),
      [...this.selectedSpotTypes()].map((s) => SPOT_TYPE_LABELS[s]).join(', '),
    ].filter(Boolean);
    return parti.join(' · ').slice(0, 60);
  }

  protected chiudiSalvataggio(): void {
    this.salvataggioAperto.set(false);
    this.erroreSalvataggio.set(null);
  }

  protected onNomePreset(event: Event): void {
    this.nomePreset.set((event.target as HTMLInputElement).value);
  }

  protected salvaPreset(): void {
    const nome = this.nomePreset().trim();
    if (!nome) {
      this.erroreSalvataggio.set('Dai un nome alla configurazione.');
      return;
    }
    this.erroreSalvataggio.set(null);
    this.drill.savePreset(nome, this.configCorrente()).subscribe({
      next: (p) => {
        this.preset.set(p);
        this.salvataggioAperto.set(false);
      },
      // ⚠️ L'errore si MOSTRA: il tetto per-utente arriva da qui, e un
      // salvataggio che non fa niente in silenzio è il pulsante che si ripreme
      // per sempre.
      error: (err: unknown) =>
        this.erroreSalvataggio.set(
          apiErrorMessage(err, 'Salvataggio non riuscito.'),
        ),
    });
  }

  protected confermaCancella(id: string | null): void {
    this.presetDaCancellare.set(id);
  }

  protected cancellaPreset(id: string): void {
    this.drill.deletePreset(id).subscribe({
      next: (p) => {
        this.preset.set(p);
        this.presetDaCancellare.set(null);
      },
      error: () => this.presetDaCancellare.set(null),
    });
  }

  /**
   * Applica un preset: SCRIVE i signal e basta — non parte.
   *
   * ⚠️ Non fa partire la sessione, a differenza di un percorso: un preset è la
   * TUA configurazione, e volerla rivedere (o ritoccarla di un asse) prima di
   * cominciare è il caso normale. Il pulsante di partenza è già lì sopra.
   * ⚠️ Le profondità sono grezze e vanno ritradotte nei valori mostrati, o il
   * costruttore direbbe «tutte le profondità» su una configurazione che ne ha
   * cinque — la stessa regola di «Le tue situazioni peggiori».
   */
  protected applicaPreset(p: DrillPreset): void {
    this.selectedFormats.set(new Set(p.formats));
    const grezze = new Set(p.depths);
    this.selectedDepths.set(
      new Set(
        this.availableDepths()
          .filter((d) => d.rawLabels.some((r) => grezze.has(r)))
          .map((d) => d.display),
      ),
    );
    this.selectedPositions.set(new Set(p.positions));
    this.selectedSpotTypes.set(new Set(p.spotTypes as DrillSpotType[]));
    this.difficulty.set(p.difficulty);
    this.questions.set(p.questionsPerSession);
    this.avvisoPotatura.set(null);
  }

  protected retry(): void {
    this.metaError.set(false);
  }

  protected viewResults(): void {
    void this.router.navigate(['/allenamento/risultati']);
  }

  protected start(): void {
    if (!this.canStart()) return;
    const payload: DrillConfigPayload = {
      formats: [...this.selectedFormats()],
      // ogni display scelto si espande in TUTTE le sue depth_label grezze
      depths: this.availableDepths()
        .filter((d) => this.selectedDepths().has(d.display))
        .flatMap((d) => d.rawLabels),
      positions: [...this.selectedPositions()],
      spotTypes: [...this.selectedSpotTypes()],
      difficulty: this.difficulty(),
      questionsPerSession: this.questions(),
    };
    this.drill.begin(payload);
    void this.router.navigate(['/allenamento/sessione']);
  }

  private toggle<T>(sig: WritableSignal<Set<T>>, value: T): void {
    sig.update((s) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }
}
