import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, debounceTime, forkJoin, map, of } from 'rxjs';
import {
  HandGameType,
  HandMineView,
  HandQuota,
  HandStreetName,
  HandStreetView,
} from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import {
  HandsService,
  formatBui,
  formatImporto,
} from '../../../core/services/hands.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ReplayContextService } from '../hand-replay/replay-context.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { PlayingCardComponent } from '../hand-replay/playing-card.component';
import { GettoneAzione, carteNuove, notazioneStrada } from './hand-notation';

/**
 * `/mie-mani` — la libreria personale, come **tabella densa** (modello
 * Hand2Note).
 *
 * ⚠️ **Il caricamento NON abita più qui**: la casella di testo, l'anteprima in
 * due passi e la spunta della vetrina sono passate a `/replayer`. Questa pagina
 * è solo l'archivio, e la differenza è tutta nella densità — una riga alta 44px
 * contro le ~89 (desktop) / ~150 (telefono) della lista richiudibile che il
 * Titolare ha bocciato il 26/08/2026.
 *
 * ⚠️ **Ogni cosa che serve a riconoscere una mano sta nella RIGA**, e niente si
 * apre: mano dell'eroe, punto, le quattro strade con carte, piatto e azioni in
 * notazione compatta, livello, netto, data. La riga richiudibile aveva il
 * difetto opposto — per sapere che cosa fosse successo bisognava aprirla una per
 * una, cioè la libreria non si poteva *scorrere*.
 *
 * ⚠️ **`punto` ed `evDiff` arrivano da altri due lotti e possono non esserci
 * ancora.** Sono letti come `unknown` e stampati solo se hanno il tipo giusto:
 * una riga che non li porta deve restare **corretta** (cella vuota), non
 * mostrare `undefined` né far saltare la tabella. Non si aspettano: la colonna
 * c'è già, e si riempirà da sola.
 */

/** Una strada come la mostra la sua cella: carte nuove, piatto, azioni. */
/** Il nome leggibile di una strada, per la riga di dettaglio. */
const ETICHETTA_STRADA: Readonly<Record<string, string>> = {
  PREFLOP: 'Preflop',
  FLOP: 'Flop',
  TURN: 'Turn',
  RIVER: 'River',
};

interface CellaStrada {
  /**
   * ⚠️ Serve **da quando le strade vivono nella riga di dettaglio**: in tabella
   * il nome lo dava l'intestazione della colonna, qui non c'è più nulla che lo
   * dica.
   */
  nome: string;
  carte: string[];
  /**
   * Il piatto **a inizio strada**, ante comprese — arriva dal server.
   * ⚠️ `null` sul preflop: là il piatto è sempre lo stesso (bui più ante) e
   * ripeterlo su ogni riga occuperebbe una colonna per non dire niente.
   */
  pot: string | null;
  gettoni: GettoneAzione[];
}

/** Un importo col suo segno: il colore lo decide il segno, non il testo. */
interface Cifra {
  testo: string;
  segno: 'pos' | 'neg' | 'zero';
  /**
   * ⚠️ **Vero quando il numero è una STIMA**, e va detto a chi lo legge — come
   * il pannello delle presenze live dichiara una durata «stimata».
   *
   * Sull'all-in **preflop** l'equity è sempre campionata (la combinatoria del
   * board residuo è di 1,7 milioni di casi: sopra la soglia di enumerazione), e
   * negli iper-turbo l'all-in preflop è il caso dominante. Quindi non è un caso
   * di bordo: senza questo segno, la maggior parte delle celle mostrerebbe una
   * stima presentata come esatta. Errore tipico misurato: 1,15 punti
   * percentuali di equity.
   */
  stima?: boolean;
}

/**
 * Una riga della tabella, **precalcolata**.
 *
 * ⚠️ Non si chiamano funzioni dal template per queste cose: con 50 righe × 4
 * strade il lavoro si rifarebbe a ogni ciclo di change detection. Qui gira una
 * volta per risposta, dentro un `computed`.
 */
interface RigaMano {
  m: HandMineView;
  id: string;
  publicId: string;
  /** Le due carte dell'eroe, se note. */
  carte: string[];
  punto: string;
  /** Le quattro strade nell'ordine, `null` dove la mano non è arrivata. */
  strade: (CellaStrada | null)[];
  /** Il livello dei bui: «15/30». */
  livello: string;
  vinto: Cifra | null;
  evDiff: Cifra | null;
  /** `playedAt` se c'è, altrimenti il caricamento. */
  quando: string;
  inVetrina: boolean;
  anonimizzata: boolean;
  /** Il nome accessibile della riga: spunta, ▶ e cestino ne hanno bisogno. */
  descrizione: string;
}


/** Le quattro colonne delle strade, nell'ordine in cui si giocano. */
const STRADE: HandStreetName[] = ['PREFLOP', 'FLOP', 'TURN', 'RIVER'];

/** Il momento della mano nel nome accessibile della riga. */
const QUANDO = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** I formati filtrabili. ⚠️ Devono coincidere con `HAND_GAME_TYPES` del server. */
const FORMATI: { valore: HandGameType | ''; etichetta: string }[] = [
  { valore: '', etichetta: 'Tutti i formati' },
  { valore: 'SPIN', etichetta: 'Spin & Go' },
  { valore: 'TWISTER', etichetta: 'Twister' },
  { valore: 'MTT', etichetta: 'Torneo multi-tavolo' },
  { valore: 'SNG', etichetta: 'Sit & Go' },
  { valore: 'HUSNG', etichetta: 'Heads-up' },
  { valore: 'CASH', etichetta: 'Cash game' },
];

@Component({
  selector: 'app-my-hands',
  imports: [DatePipe, FormsModule, IconComponent, PlayingCardComponent, RouterLink],
  templateUrl: './my-hands.component.html',
  styleUrl: './my-hands.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyHandsComponent {
  private readonly hands = inject(HandsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly contesto = inject(ReplayContextService);
  protected readonly auth = inject(AuthService);

  protected readonly formati = FORMATI;

  // ── libreria ──────────────────────────────────────────────────────────
  protected readonly items = signal<HandMineView[]>([]);
  protected readonly total = signal(0);
  protected readonly totalPages = signal(1);
  protected readonly page = signal(1);
  protected readonly quota = signal<HandQuota | null>(null);
  protected readonly caricando = signal(false);
  /** ⚠️ Un errore si MOSTRA: mai travestito da libreria vuota. */
  protected readonly errore = signal<string | null>(null);

  /**
   * ⚠️ **50 per pagina e non 24**: è il tetto che il controller accetta
   * (`Math.min(limit, 50)`), ed è il senso stesso di una tabella densa — 50
   * righe da 44px stanno in due schermate, 50 righe richiudibili da 89 ne
   * occupavano cinque.
   */
  private readonly perPagina = 50;

  // ── filtri ────────────────────────────────────────────────────────────
  protected readonly formato = signal<HandGameType | ''>('');
  protected readonly ricerca = signal('');
  private readonly digitato$ = new Subject<void>();

  // ── selezione multipla ────────────────────────────────────────────────
  /**
   * ⚠️ **La selezione si azzera a ogni caricamento** (pagina, filtro, ricarica),
   * e non è pigrizia: le azioni di gruppo sono distruttive e la barra dice «n
   * selezionate». Tenere selezionate righe che non si vedono più significa
   * cancellare a scatola chiusa — e il conto direbbe un numero che sullo schermo
   * non trova riscontro.
   */
  protected readonly selezione = signal<ReadonlySet<string>>(new Set());
  protected readonly nSelezionate = computed(() => this.selezione().size);
  protected readonly tutteSelezionate = computed(() => {
    const s = this.selezione();
    const i = this.items();
    return i.length > 0 && i.every((m) => s.has(m.id));
  });
  protected readonly alcuneSelezionate = computed(
    () => this.nSelezionate() > 0 && !this.tutteSelezionate(),
  );

  // ── conferme in linea (nel progetto non esiste un solo dialog) ─────────
  protected readonly confermaGruppo = signal<'elimina' | 'anonimizza' | null>(null);
  protected readonly confermaRiga = signal<{
    id: string;
    tipo: 'elimina' | 'anonimizza';
  } | null>(null);
  protected readonly confermaSvuota = signal(false);
  protected readonly inGruppo = signal(false);

  /** ⚠️ Guardia «già caricata per questo id» (idioma di `affiliations`). */
  private idCaricato: string | null = null;
  /** ⚠️ Risposte fuori ordine: vince l'ultima chiesta, non l'ultima arrivata. */
  private seq = 0;

  constructor() {
    /**
     * ⚠️ **`effect` sul signal `auth.user()`**, e nessuna delle due scorciatoie
     * tentate altrove: `ready$.pipe(take(1))` legge lo stato una volta sola e il
     * tetto di 8s del bootstrap può emettere `ready` col refresh ancora in volo;
     * `SKIP_REFRESH` direbbe «accedi» a chi si è collegato venti minuti fa.
     */
    effect(() => {
      const u = this.auth.user();
      if (!u) {
        this.idCaricato = null;
        return;
      }
      if (this.idCaricato === u.id) return;
      this.idCaricato = u.id;
      this.carica(1);
    });

    // Ricerca con freno a 300ms: l'idioma di `/lezioni` e `/docs`.
    this.digitato$
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => this.carica(1));
  }

  // ── caricamento ───────────────────────────────────────────────────────

  protected carica(pagina: number): void {
    this.caricando.set(true);
    this.errore.set(null);
    // Vedi il commento su `selezione`: ciò che non si vede non si può decidere.
    this.selezione.set(new Set());
    this.confermaGruppo.set(null);
    this.confermaRiga.set(null);
    const mio = ++this.seq;
    this.hands
      .mie(pagina, this.perPagina, {
        gameType: this.formato() || undefined,
        q: this.ricerca(),
      })
      .subscribe({
        next: (r) => {
          if (mio !== this.seq) return;
          this.items.set(r.items);
          this.total.set(r.total);
          this.totalPages.set(r.totalPages);
          this.page.set(r.page);
          this.quota.set(r.quota);
          this.caricando.set(false);
          // Cancellando l'ultima riga di una pagina si resterebbe su una pagina
          // vuota che esiste ancora nel pager: si torna indietro di una.
          if (!r.items.length && r.page > 1) this.carica(r.page - 1);
        },
        error: () => {
          if (mio !== this.seq) return;
          this.errore.set(
            'Non siamo riusciti a caricare la tua libreria. Riprova fra poco.',
          );
          this.caricando.set(false);
        },
      });
  }

  protected digita(v: string): void {
    this.ricerca.set(v);
    this.digitato$.next();
  }

  protected cambiaFormato(v: HandGameType | ''): void {
    this.formato.set(v);
    this.carica(1);
  }

  protected azzeraFiltri(): void {
    this.formato.set('');
    this.ricerca.set('');
    this.carica(1);
  }

  protected readonly filtriAttivi = computed(
    () => !!this.formato() || !!this.ricerca().trim(),
  );

  // ── selezione ─────────────────────────────────────────────────────────

  protected selezionata(id: string): boolean {
    return this.selezione().has(id);
  }

  /**
   * Apre il replayer sulle sole mani spuntate, in **ordine di tabella**.
   *
   * ⚠️ **L'elenco si SPINGE nel contesto, ed è l'unica origine che lo fa** — le
   * altre due le deduce la pagina della mano dal percorso di provenienza (il
   * riquadro di `ReplayContextService` spiega perché). Qui non è deducibile:
   * quali righe siano spuntate lo sa solo questa schermata.
   *
   * ⚠️ **`righe()` e non `selezione()`**: il primo è l'ordine che l'utente ha
   * davanti, il secondo un `Set` — e l'ordine di un `Set` è quello di
   * inserimento, cioè l'ordine in cui si è **cliccato**. Le frecce ▲▼ del
   * replayer scorrerebbero le mani in un ordine che a schermo non esiste.
   */
  protected rivediSelezionate(): void {
    const scelte = this.righe().filter((r) => this.selezionata(r.id));
    if (!scelte.length) return;
    this.contesto.impostaSelezione(scelte.map((r) => r.m));
    void this.router.navigate(['/replayer', scelte[0].publicId]);
  }

  protected cambiaSelezione(id: string, acceso: boolean): void {
    // Un `Set` nuovo a ogni giro: un signal confronta per identità.
    const s = new Set(this.selezione());
    if (acceso) s.add(id);
    else s.delete(id);
    this.selezione.set(s);
    if (!s.size) this.confermaGruppo.set(null);
  }

  protected cambiaTutte(acceso: boolean): void {
    this.selezione.set(acceso ? new Set(this.items().map((m) => m.id)) : new Set());
    if (!acceso) this.confermaGruppo.set(null);
  }

  // ── azioni di gruppo ──────────────────────────────────────────────────

  /**
   * ⚠️ **Non esiste un endpoint di gruppo**: sono N chiamate, una per mano. Da
   * qui due conseguenze scritte apposta nel messaggio finale — il conto è «n su
   * m» e non un successo secco (una sola può fallire), e ogni chiamata è
   * incapsulata in un `catchError` perché un `forkJoin` nudo butterebbe via
   * anche gli esiti buoni al primo errore.
   */
  private suSelezione(
    op: (id: string) => Observable<unknown>,
    fatto: (ok: number, ko: number) => void,
  ): void {
    const ids = [...this.selezione()];
    if (!ids.length || this.inGruppo()) return;
    this.inGruppo.set(true);
    forkJoin(
      ids.map((id) =>
        op(id).pipe(
          map(() => true),
          catchError(() => of(false)),
        ),
      ),
    ).subscribe((esiti) => {
      const ok = esiti.filter(Boolean).length;
      this.inGruppo.set(false);
      this.confermaGruppo.set(null);
      fatto(ok, esiti.length - ok);
      this.carica(this.page());
    });
  }

  protected eliminaSelezionate(): void {
    this.suSelezione(
      (id) => this.hands.cancella(id),
      (ok, ko) =>
        ko
          ? this.toast.error(`Cancellate ${ok} mani; ${ko} non è stato possibile.`)
          : this.toast.success(
              ok === 1 ? 'Mano cancellata.' : `${ok} mani cancellate.`,
            ),
    );
  }

  protected anonimizzaSelezionate(): void {
    this.suSelezione(
      (id) => this.hands.anonimizza(id),
      (ok, ko) =>
        ko
          ? this.toast.error(`Nomi rimossi da ${ok} mani; ${ko} non è riuscita.`)
          : this.toast.success('Nomi sostituiti con le posizioni al tavolo.'),
    );
  }

  /**
   * ⚠️ **Due pulsanti e non un interruttore**: su una selezione mista un
   * «inverti la vetrina» non ha un significato dichiarabile, e chi lo preme non
   * può prevedere che cosa diventerà pubblico. Qui il verbo dice l'esito.
   */
  protected vetrinaSelezionate(dentro: boolean): void {
    this.suSelezione(
      (id) => this.hands.vetrinaSet(id, dentro),
      (ok, ko) =>
        ko
          ? this.toast.error(`Aggiornate ${ok} mani; ${ko} non è riuscita.`)
          : this.toast.success(
              dentro
                ? 'Le mani compariranno nella vetrina pubblica.'
                : 'Le mani non sono più nella vetrina.',
            ),
    );
  }

  // ── azioni su una riga ────────────────────────────────────────────────

  protected arma(id: string, tipo: 'elimina' | 'anonimizza'): void {
    this.confermaRiga.set({ id, tipo });
  }

  protected disarma(): void {
    this.confermaRiga.set(null);
  }

  /**
   * La riga il cui dettaglio per strada è aperto.
   *
   * ⚠️ **Una sola per volta.** Aprendone più d'una la tabella diventa
   * un'alternanza di righe alte e basse in cui le colonne non si leggono più in
   * verticale — cioè si perde esattamente ciò per cui una tabella esiste.
   */
  /**
   * Il numero di colonne della tabella, per il `colspan` delle righe aggiuntive.
   *
   * ⚠️⚠️ **Era scritto a mano in TRE punti**, e si è appena rotto: togliendo le
   * quattro colonne di strada e aggiungendo il comando che apre il dettaglio, il
   * conto è passato da 13 a 10 e i `colspan` sono rimasti indietro. Un `colspan`
   * sbagliato **non dà alcun errore**: il browser inventa una colonna in più e
   * la tabella si disallinea di poco, cioè nel modo che nessuno nota subito. Ora
   * il numero sta in una sede sola, e lo spec lo confronta con le `<th>` vere.
   */
  protected readonly COLONNE = 10;

  protected readonly aperta = signal<string | null>(null);

  protected apriDettaglio(id: string): void {
    this.aperta.update((a) => (a === id ? null : id));
  }

  /**
   * ⚠️ Serve al template per **cedere il posto** a una conferma: il dettaglio e
   * la conferma sono entrambi righe aggiuntive sotto la stessa riga, e due
   * insieme si leggono come un errore di resa.
   */
  protected armataQualunque(id: string): boolean {
    return this.confermaRiga()?.id === id;
  }

  protected armata(id: string, tipo: 'elimina' | 'anonimizza'): boolean {
    const c = this.confermaRiga();
    return c?.id === id && c.tipo === tipo;
  }

  protected cancella(id: string): void {
    this.hands.cancella(id).subscribe({
      next: () => {
        this.confermaRiga.set(null);
        this.toast.success('Mano cancellata.');
        this.carica(this.page());
      },
      error: () => this.toast.error('Cancellazione non riuscita.'),
    });
  }

  /** ⚠️ Irreversibile: i nickname vengono sovrascritti, non nascosti. */
  protected anonimizza(id: string): void {
    this.hands.anonimizza(id).subscribe({
      next: () => {
        this.confermaRiga.set(null);
        this.toast.success('Nomi sostituiti con le posizioni al tavolo.');
        this.carica(this.page());
      },
      error: () => this.toast.error('Operazione non riuscita.'),
    });
  }

  /** ⚠️ L'azione più distruttiva che un utente possa fare sui propri dati. */
  protected svuota(): void {
    this.hands.svuota().subscribe({
      next: (r) => {
        this.confermaSvuota.set(false);
        this.toast.success(
          r.cancellate === 1
            ? 'Libreria svuotata: 1 mano cancellata.'
            : `Libreria svuotata: ${r.cancellate} mani cancellate.`,
        );
        this.carica(1);
      },
      error: () => this.toast.error('Svuotamento non riuscito.'),
    });
  }

  // ── le righe ──────────────────────────────────────────────────────────

  protected readonly righe = computed<RigaMano[]>(() =>
    this.items().map((m) => this.riga(m)),
  );

  private riga(m: HandMineView): RigaMano {
    const carte = m.players.find((p) => p.isHero)?.carte ?? [];
    const quando = m.playedAt ?? m.createdAt;
    return {
      m,
      id: m.id,
      publicId: m.publicId,
      carte,
      punto: this.punto(m),
      strade: STRADE.map((nome) => this.cella(m, nome)),
      livello: `${formatImporto(m.smallBlind, m.decimali)}/${formatImporto(
        m.bigBlind,
        m.decimali,
      )}`,
      vinto: this.vinto(m),
      evDiff: this.evDiff(m),
      quando,
      inVetrina: m.inVetrina,
      anonimizzata: m.anonimizzata,
      // ⚠️ Il nome accessibile NON porta le carte: `7h Qc` letto ad alta voce è
      // rumore, e la riga si identifica con formato e momento.
      descrizione: `${m.gameTypeLabel} del ${QUANDO.format(new Date(quando))}`,
    };
  }

  private cella(m: HandMineView, nome: HandStreetName): CellaStrada | null {
    const s: HandStreetView | undefined = m.streets.find((x) => x.strada === nome);
    if (!s) return null;
    return {
      nome: ETICHETTA_STRADA[nome] ?? nome,
      carte: carteNuove(s),
      // ⚠️ `pot` (inizio strada) e mai `potDopo` di un'azione, che comprende la
      // puntata non chiamata: su una mano vera dava 672 al posto di 250.
      pot: nome === 'PREFLOP' ? null : this.potStrada(m, s),
      gettoni: notazioneStrada(s, m.heroSeat, m.bigBlind),
    };
  }

  /**
   * Il piatto di una strada, **senza l'unità**.
   *
   * ⚠️ L'unità la dichiara la legenda sotto la tabella, una volta per tutte:
   * ripetere « bb» in tre colonne per riga costava **~60px** di larghezza —
   * misurato — cioè esattamente la colonna delle azioni fuori schermo a 1280px.
   * Nel netto e nella differenza di EV l'unità resta, perché quelle due colonne
   * si leggono da sole e sono l'unico numero che l'utente cita a voce.
   *
   * ⚠️ Il ripiego quando il grande buio non è noto è l'importo in fiche: là non
   * c'è unità da togliere, e se un domani `formatBui` cambiasse suffisso il
   * peggio che accade è che la colonna torni larga com'era.
   */
  private potStrada(m: HandMineView, s: HandStreetView): string {
    const bui = formatBui(s.pot, m.bigBlind);
    return bui ? bui.replace(' bb', '') : formatImporto(s.pot, m.decimali);
  }

  /**
   * Il **punto** dell'eroe, quando il lotto che lo calcola sarà in linea.
   * ⚠️ Il controllo di tipo non è difensivismo: finché il campo non esiste vale
   * `undefined`, e un giorno potrebbe arrivare in una forma che qui non si sa
   * stampare — meglio una cella vuota che `[object Object]` su ogni riga.
   */
  private punto(m: HandMineView): string {
    // ⚠️ È un oggetto, non una stringa: l'etichetta è già in italiano e già
    // adatta a una cella («Colore all'asso», «Full di donne sui nove»). La prima
    // stesura si aspettava una stringa e la cella restava **vuota su ogni riga**
    // pur essendoci il dato — un difetto muto, perché una colonna vuota si legge
    // come «non c'è niente da dire».
    return m.punto?.etichetta ?? '';
  }

  /** Il netto dell'eroe: quanto ha vinto **o perso**, col segno. */
  private vinto(m: HandMineView): Cifra | null {
    if (m.heroSeat === null) return null;
    const n = m.netti.find((x) => x.seat === m.heroSeat);
    if (!n || !Number.isFinite(n.netto)) return null;
    return this.cifra(n.netto, m);
  }

  /**
   * La differenza rispetto all'atteso all'all-in. ⚠️ **Positivo = ha corso
   * bene**, come in Hand2Note; `null` quando non c'è un all-in da valutare, e
   * `null` è diverso da `0` («è andata esattamente come doveva»).
   */
  private evDiff(m: HandMineView): Cifra | null {
    return m.evDiff === null || !Number.isFinite(m.evDiff)
      ? null
      : { ...this.cifra(m.evDiff, m), stima: m.evStima === true };
  }

  /**
   * ⚠️ Il segno si stampa **sempre** e il colore lo segue: in una colonna di
   * numeri, «12,5» e «-12,5» si distinguono solo per un trattino largo due
   * pixel, ed è l'informazione che si cerca per prima scorrendo la libreria.
   * Il `+` si scrive a mano — nessun formattatore lo mette.
   */
  private cifra(valore: number, m: HandMineView): Cifra {
    const assoluto =
      formatBui(Math.abs(valore), m.bigBlind) ??
      formatImporto(Math.abs(valore), m.decimali);
    if (valore > 0) return { testo: `+${assoluto}`, segno: 'pos' };
    if (valore < 0) return { testo: `-${assoluto}`, segno: 'neg' };
    return { testo: assoluto, segno: 'zero' };
  }

  /** `-1` significa «nessun tetto» (amministratore). */
  protected quotaTesto(q: HandQuota): string {
    if (q.tetto < 0) return `${q.usate} mani caricate`;
    return `${q.usate} di ${q.tetto} mani`;
  }
}
