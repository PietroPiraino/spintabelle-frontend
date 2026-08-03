import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  Observable,
  concat,
  debounceTime,
  distinctUntilChanged,
  toArray,
} from 'rxjs';
import {
  AFFILIATION_STATUSES,
  AffiliationAdmin,
  AffiliationStatus,
  IdentifierFormat,
  Paginated,
  PokerRoomAdmin,
  PokerRoomPayload,
  PokerRoomUpdatePayload,
} from '../../../core/models/api.models';
import { AffiliationsService } from '../../../core/services/affiliations.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/** Elementi per pagina (pager classico, come iscritti/lezioni/negozio). */
const PAGE_SIZE = 25;

/**
 * Tetto del logo lato client.
 *
 * ⚠️ Rispecchia il default del backend (`AFFILIATIONS_MAX_LOGO_MB` || 2, cap
 * duro 5 in `admin-affiliations.controller.ts`): la guardia qui evita di
 * spedire — e far scartare a multer, con un errore molto meno leggibile — un
 * file che non passerà mai. Se l'owner alza la env, questa resta più stretta:
 * l'errore va nella direzione innocua (un rifiuto in più, mai un upload che
 * muore a metà).
 */
const MAX_LOGO_MB = 2;

/** Formati ammessi per l'identificativo dichiarato (enum del backend). */
const IDENTIFIER_FORMATS: IdentifierFormat[] = [
  'LIBERO',
  'ALFANUMERICO',
  'NUMERICO',
];

/**
 * Passo della scala che le frecce ▲▼ riscrivono sull'elenco: 10, 20, 30, …
 *
 * ⚠️ **Perché una rinumerazione e non uno scambio dei due valori.** Il backend
 * ordina per `{ordine: 1, createdAt: -1}` e **tutte le sale nascono con
 * `ordine = 100`**: nel caso reale di oggi ogni riga ha lo stesso numero e
 * l'ordine visibile è deciso solo dal tiebreak sulla data. Scambiare i valori
 * di due righe che valgono entrambe 100 non produce **alcun** movimento, e
 * nessun valore singolo può spostare una riga di **una** posizione dentro un
 * blocco di pari merito: qualunque numero minore di 100 la manda in cima al
 * blocco, qualunque maggiore in fondo. L'unica mossa che vale una posizione è
 * quindi ridistribuire numeri **distinti** su tutte le righe.
 *
 * Alla prima mossa la scala viene stesa da capo (10, 20, 30…) e si PATCHano
 * solo le righe il cui numero cambia davvero; da lì in poi uno scambio fra
 * adiacenti tocca **due sole righe**, perché il valore di posizione non dipende
 * dalla riga ma dall'indice. Il passo 10 lascia spazio per infilare a mano un
 * numero fra due sale dal campo «Ordine in vetrina» senza rifare la scala.
 *
 * ⚠️ Le frecce **possiedono** la scala: usarne una rinormalizza i numeri di
 * tutte le sale (l'ordine visibile resta identico, cambiano solo i numeri). Chi
 * vuole un valore preciso lo scrive nel campo del form — ed è detto lì.
 */
const ORDER_STEP = 10;

type AffiliationsView = 'richieste' | 'sale';

/** Pannello inline aperto su una riga (uno alla volta, idioma di admin-users). */
type RowAction = 'approva' | 'rifiuta' | 'revoca' | 'nota';

/**
 * Tab **Affiliazioni** del pannello admin: coda delle richieste (decisioni,
 * rinvii, note interne) e catalogo delle poker room.
 *
 * ⚠️ Nessuna mappa stato→etichetta qui dentro: l'italiano delle righe arriva dal
 * server in `statusLabel` (unica fonte di verità per pagina utente, pannello ed
 * email). Le pillole di filtro non hanno una riga da cui leggerlo, quindi la
 * loro etichetta è **derivata meccanicamente** dal token (`IN_VERIFICA` → "In
 * verifica"): una derivazione non può divergere, una seconda tabella sì.
 */
@Component({
  selector: 'app-admin-affiliations',
  imports: [ReactiveFormsModule, DatePipe, IconComponent],
  templateUrl: './admin-affiliations.component.html',
  styleUrls: ['../admin-shared.scss', './admin-affiliations.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAffiliationsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AffiliationsService);
  private readonly toast = inject(ToastService);

  protected readonly maxLogoMb = MAX_LOGO_MB;
  protected readonly statuses = AFFILIATION_STATUSES;
  protected readonly identifierFormats = IDENTIFIER_FORMATS;

  /**
   * Nota fissa sul ritardo di attribuzione (§4 del piano). ⚠️ Parla della
   * **registrazione** e dell'**username dichiarato**: verso la sala non parte
   * alcun codice nostro, quindi un "il codice non risulta ancora" manderebbe
   * owner e utente a cercare qualcosa che non può esserci.
   */
  protected readonly ritardoAttribuzione =
    "Se la registrazione non risulta ancora, l'attribuzione può richiedere fino a 48 ore.";

  /** Sotto-vista attiva: coda delle richieste o catalogo delle sale. */
  protected readonly view = signal<AffiliationsView>('richieste');

  // ── Richieste ──

  protected readonly reqPage = signal<Paginated<AffiliationAdmin> | null>(null);
  protected readonly reqLoading = signal(false);
  protected readonly reqError = signal<string | null>(null);
  protected readonly reqFeedback = signal<string | null>(null);
  /** Riga su cui è in corso una chiamata: blocca il doppio clic. */
  protected readonly actingId = signal<string | null>(null);
  /** Pannello inline aperto (uno solo in tutta la lista). */
  protected readonly openAction = signal<{
    id: string;
    kind: RowAction;
  } | null>(null);
  /** Quante righe aspettano una decisione (badge sulla pillola). */
  protected readonly pending = signal<number | null>(null);

  /** ⚠️ Default `IN_VERIFICA`: è la coda da lavorare, e il server usa lo stesso. */
  protected readonly statusFilter = signal<AffiliationStatus>('IN_VERIFICA');
  /** Filtro per sala, impostato dalla scorciatoia "Reinvia il link aggiornato". */
  protected readonly roomFilter = signal<{ id: string; name: string } | null>(
    null,
  );
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');
  private readonly reqPageNum = signal(1);

  // ── Sale ──

  protected readonly roomPage = signal<Paginated<PokerRoomAdmin> | null>(null);
  protected readonly roomLoading = signal(false);
  protected readonly roomListError = signal<string | null>(null);
  protected readonly roomError = signal<string | null>(null);
  protected readonly roomFeedback = signal<string | null>(null);
  /** null = creazione; altrimenti id della sala in modifica. */
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly selectedLogo = signal<File | null>(null);
  /**
   * Un logo è stato scartato dalla guardia MB e non è stato sostituito.
   *
   * ⚠️ Blocca il salvataggio finché non si decide: il logo è **facoltativo**, e
   * senza questo flag un file troppo grande verrebbe scartato in silenzio e la
   * sala nascerebbe senza logo — con l'admin convinto di averlo caricato. La via
   * d'uscita esplicita è il pulsante "Salva senza logo".
   */
  protected readonly logoRejected = signal(false);
  protected readonly confirmDeleteId = signal<string | null>(null);
  /**
   * Sala su cui è in corso una rinumerazione: blocca entrambe le frecce di
   * quella riga (e tutte le altre) finché la cascata non è finita. Stesso
   * idioma di `actingId` nella coda delle richieste, signal separato perché è
   * un'altra vista con un'altra banda errore.
   */
  protected readonly movingId = signal<string | null>(null);
  /**
   * Esito di uno spostamento. ⚠️ Banda propria, stampata **accanto all'elenco**
   * e non in quella del form: il form sta in un'altra colonna (e su mobile
   * sopra, fuori schermo), mentre `roomListError` viene azzerata da ogni
   * `loadRooms()` — cioè proprio dalla ricarica che segue l'errore.
   */
  protected readonly moveError = signal<string | null>(null);
  protected readonly moveFeedback = signal<string | null>(null);
  /**
   * ⚠️ Le frecce si spengono quando l'elenco non sta in una pagina sola.
   *
   * Una rinumerazione è sicura solo se **vede tutte le righe**: rifare la scala
   * sulle 25 visibili mentre le altre restano a 100 riordinerebbe in silenzio
   * righe che non sono sullo schermo (a parità di numero la pagina 2 vale
   * quanto la 1). Sopra le 25 sale l'ordine si imposta col campo numerico del
   * form, che è preciso e non ha bisogno di vedere il resto — e il pannello lo
   * dice, invece di offrire frecce che spostano oltre il bordo pagina.
   */
  protected readonly ordinePaginato = computed(
    () => (this.roomPage()?.totalPages ?? 1) > 1,
  );
  /**
   * Avviso dopo un PATCH che ha cambiato il template del link: quante righe
   * ancora in attesa portano il link precedente. ⚠️ Va stampato, altrimenti un
   * tracker ruotato è un guasto silenzioso il cui unico sintomo è che le
   * registrazioni smettono di essere attribuite.
   */
  protected readonly linkWarning = signal<{
    room: PokerRoomAdmin;
    righe: number;
  } | null>(null);
  private readonly roomPageNum = signal(1);

  protected readonly form = this.fb.nonNullable.group({
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    ],
    // ⚠️ Solo in creazione: lo slug è la chiave dei deep-link `?completa=<slug>`
    // già finiti nelle email spedite, e il backend lo rifiuta sulla PATCH.
    slug: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      ],
    ],
    network: ['', [Validators.maxLength(80)]],
    descrizione: ['', [Validators.maxLength(2000)]],
    condizioni: ['', [Validators.maxLength(2000)]],
    istruzioni: ['', [Validators.maxLength(4000)]],
    affiliateUrlTemplate: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(1000)],
    ],
    codicePromozionale: ['', [Validators.maxLength(40)]],
    // Vuoto = default del server ("Username di login").
    identifierLabel: ['', [Validators.minLength(2), Validators.maxLength(80)]],
    identifierHelp: ['', [Validators.maxLength(300)]],
    identifierFormat: ['LIBERO' as IdentifierFormat],
    identifierMinLen: [
      3 as number | null,
      [Validators.min(1), Validators.max(60)],
    ],
    identifierMaxLen: [
      40 as number | null,
      [Validators.min(1), Validators.max(60)],
    ],
    identifierCaseSensitive: [false],
    richiedeSecondoId: [false],
    secondIdentifierLabel: ['', [Validators.maxLength(80)]],
    consenteAccountEsistenti: [false],
    ordine: [100 as number | null, [Validators.min(0), Validators.max(9999)]],
    // ⚠️ NASCE SPENTA: una sala si pubblica di proposito, mai salvandola.
    active: [false],
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.reqPageNum.set(1);
        this.loadRequests();
      });
    this.loadRequests();
    this.loadPending();
  }

  // ── Switch vista (il catalogo si carica alla prima apertura) ──

  protected setView(v: AffiliationsView): void {
    if (this.view() === v) return;
    this.view.set(v);
    // L'esito di uno spostamento vale per il momento in cui è avvenuto: tornare
    // sul catalogo più tardi non deve ritrovarlo lì come se fosse appena
    // successo.
    this.moveFeedback.set(null);
    this.moveError.set(null);
    if (v === 'sale' && !this.roomPage()) this.loadRooms();
  }

  /**
   * Etichetta della pillola di filtro, derivata dal token: `IN_VERIFICA` → "In
   * verifica". ⚠️ Non è una mappa stato→etichetta (quella vive sul server, in
   * `statusLabel`): è una trasformazione meccanica, che non può divergere.
   */
  protected statusFilterLabel(s: AffiliationStatus): string {
    const t = s.toLowerCase().replace(/_/g, ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ─────────────────────────────── RICHIESTE ───────────────────────────────

  private loadRequests(): void {
    this.reqLoading.set(true);
    this.reqError.set(null);
    this.api
      .adminList({
        page: this.reqPageNum(),
        limit: PAGE_SIZE,
        status: this.statusFilter(),
        roomId: this.roomFilter()?.id,
        q: this.query() || undefined,
      })
      .subscribe({
        next: (page) => {
          this.reqPage.set(page);
          this.reqLoading.set(false);
        },
        error: (err: unknown) => {
          this.reqLoading.set(false);
          this.reqPageNum.set(this.reqPage()?.page ?? 1);
          this.reqError.set(
            apiErrorMessage(err, 'Caricamento richieste non riuscito.'),
          );
        },
      });
  }

  /** Badge sulla pillola: quante righe aspettano una decisione. */
  private loadPending(): void {
    this.api.pendingCount().subscribe({
      next: (res) => this.pending.set(res.inVerifica),
      // Il conteggio è un accessorio: un errore qui non deve rubare la banda
      // errore della lista, che è l'unica informazione che serve davvero.
      error: () => this.pending.set(null),
    });
  }

  protected setStatusFilter(s: AffiliationStatus): void {
    if (this.statusFilter() === s) return;
    this.statusFilter.set(s);
    this.reqPageNum.set(1);
    this.openAction.set(null);
    this.reqFeedback.set(null);
    this.loadRequests();
  }

  protected clearRoomFilter(): void {
    if (!this.roomFilter()) return;
    this.roomFilter.set(null);
    this.reqPageNum.set(1);
    this.loadRequests();
  }

  protected goToReqPage(n: number): void {
    const total = this.reqPage()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.reqPageNum()) return;
    this.reqPageNum.set(n);
    this.openAction.set(null);
    this.loadRequests();
  }

  protected chipClass(status: AffiliationStatus): string {
    return `aff-chip aff-chip--${status.toLowerCase()}`;
  }

  protected who(a: AffiliationAdmin): string {
    return a.userNickname || a.userEmail;
  }

  // Pannelli inline (approva / rifiuta / revoca / nota interna): uno alla volta.

  protected toggleAction(a: AffiliationAdmin, kind: RowAction): void {
    const open = this.openAction();
    this.reqError.set(null);
    this.openAction.set(
      open && open.id === a.id && open.kind === kind ? null : { id: a.id, kind },
    );
  }

  protected isAction(a: AffiliationAdmin, kind: RowAction): boolean {
    const open = this.openAction();
    return !!open && open.id === a.id && open.kind === kind;
  }

  /** L'approvazione si spiega da sé: la nota è facoltativa. */
  protected approve(a: AffiliationAdmin, note: string): void {
    this.runOnRow(
      a.id,
      this.api.approve(a.id, note.trim() || undefined),
      (r) => `Affiliazione di ${this.who(r)} approvata.`,
    );
  }

  protected reject(a: AffiliationAdmin, note: string): void {
    const n = note.trim();
    if (!this.assertNote(n)) return;
    this.runOnRow(
      a.id,
      this.api.reject(a.id, n),
      (r) => `Richiesta di ${this.who(r)} rifiutata.`,
    );
  }

  protected revoke(a: AffiliationAdmin, note: string): void {
    const n = note.trim();
    if (!this.assertNote(n)) return;
    this.runOnRow(
      a.id,
      this.api.revoke(a.id, n),
      (r) => `Tracciamento di ${this.who(r)} revocato.`,
    );
  }

  /**
   * Rinvio dell'email: dispaccia sullo stato della riga (link, ricevuta o
   * esito). È anche la riparazione dopo un template ruotato.
   */
  protected resend(a: AffiliationAdmin): void {
    this.runOnRow(a.id, this.api.adminResend(a.id), (res) => {
      if (res.emailSent) return `Email inviata di nuovo a ${this.who(a)}.`;
      return res.prossimoInvioTraMinuti != null
        ? `Email non inviata: riprova fra ${res.prossimoInvioTraMinuti} minuti.`
        : 'Email non inviata: riprova più tardi.';
    });
  }

  /** Nota INTERNA: non esce da nessuna vista utente né da nessuna email. */
  protected saveNote(a: AffiliationAdmin, adminNote: string): void {
    this.runOnRow(
      a.id,
      this.api.setAdminNote(a.id, adminNote.trim()),
      () => 'Nota interna salvata.',
    );
  }

  /**
   * ⚠️ Il motivo è obbligatorio su rifiuto e revoca (min 3 caratteri, come il
   * DTO): lo legge l'utente nell'email d'esito, e una decisione senza motivo è
   * un vicolo cieco che torna indietro come messaggio di supporto.
   */
  private assertNote(note: string): boolean {
    if (note.length >= 3) return true;
    this.reqError.set(
      "Scrivi il motivo della decisione (almeno 3 caratteri): lo legge l'utente nell'email.",
    );
    return false;
  }

  private runOnRow<T>(
    id: string,
    work$: Observable<T>,
    done: (res: T) => string,
  ): void {
    if (this.actingId()) return;
    this.actingId.set(id);
    this.reqError.set(null);
    this.reqFeedback.set(null);
    work$.subscribe({
      next: (res) => {
        this.actingId.set(null);
        this.openAction.set(null);
        this.reqFeedback.set(done(res));
        // ⚠️ Ricarica COMPLETA, non una patch in place: una decisione sposta la
        // riga in un altro bucket e resterebbe visibile nel filtro sbagliato.
        this.loadRequests();
        this.loadPending();
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.reqError.set(apiErrorMessage(err, 'Operazione non riuscita.'));
      },
    });
  }

  // ───────────────────────────────── SALE ─────────────────────────────────

  private loadRooms(): void {
    this.roomLoading.set(true);
    this.roomListError.set(null);
    this.api
      .adminRooms({ page: this.roomPageNum(), limit: PAGE_SIZE })
      .subscribe({
        next: (page) => {
          this.roomPage.set(page);
          this.roomLoading.set(false);
        },
        error: (err: unknown) => {
          this.roomLoading.set(false);
          this.roomPageNum.set(this.roomPage()?.page ?? 1);
          this.roomListError.set(
            apiErrorMessage(err, 'Caricamento sale non riuscito.'),
          );
        },
      });
  }

  protected goToRoomPage(n: number): void {
    const total = this.roomPage()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.roomPageNum()) return;
    this.roomPageNum.set(n);
    this.loadRooms();
  }

  // ── Ordine in vetrina: frecce ▲▼ ──────────────────────────────────────────

  /**
   * ▲ e ▼ di una riga. Sono spente ai due estremi della **lista completa** (che
   * qui coincide con la pagina: le frecce esistono solo a pagina unica, vedi
   * `ordinePaginato`), mentre una cascata è in volo e mentre l'elenco si
   * ricarica — altrimenti la seconda mossa partirebbe da un ordine che sta già
   * cambiando sotto.
   */
  protected canMove(index: number, delta: -1 | 1): boolean {
    const p = this.roomPage();
    if (!p || this.ordinePaginato() || this.movingId() || this.roomLoading()) {
      return false;
    }
    const to = index + delta;
    return to >= 0 && to < p.items.length;
  }

  /**
   * Sposta una sala di **una** posizione riscrivendo la scala `ORDER_STEP`
   * sull'elenco riordinato (vedi la costante: con tutte le sale a 100 uno
   * scambio di valori non muoverebbe nulla).
   *
   * ⚠️ Le PATCH partono **in sequenza** e non sono atomiche: `concat` ferma la
   * cascata alla prima che fallisce, così le successive non partono nemmeno, e
   * in **entrambi** i rami si ricarica l'elenco. Quello che si vede dopo è
   * quindi sempre l'ordine che il server ha davvero, non quello che speravamo:
   * una patch in place mostrerebbe una lista riordinata a metà come se fosse
   * andata bene.
   */
  protected moveRoom(r: PokerRoomAdmin, delta: -1 | 1): void {
    const p = this.roomPage();
    if (!p || this.movingId()) return;
    const from = p.items.findIndex((x) => x.id === r.id);
    if (from < 0 || !this.canMove(from, delta)) return;

    const riordinate = p.items.slice();
    riordinate[from] = p.items[from + delta];
    riordinate[from + delta] = p.items[from];

    // Solo le righe il cui numero cambia davvero: dopo la prima stesura della
    // scala uno scambio fra adiacenti diventa due sole PATCH.
    const patches = riordinate
      .map((room, i) => ({ room, ordine: (i + 1) * ORDER_STEP }))
      .filter((x) => x.room.ordine !== x.ordine)
      .map((x) => this.api.updateRoom(x.room.id, { ordine: x.ordine }));
    if (!patches.length) return;

    this.movingId.set(r.id);
    this.moveError.set(null);
    this.moveFeedback.set(null);
    concat(...patches)
      .pipe(toArray())
      .subscribe({
        next: () => {
          this.movingId.set(null);
          this.moveFeedback.set(
            `${r.name}: spostata più in ${delta < 0 ? 'alto' : 'basso'}.`,
          );
          this.loadRooms();
        },
        error: (err: unknown) => {
          this.movingId.set(null);
          this.moveError.set(
            apiErrorMessage(
              err,
              "Spostamento non riuscito: qui sotto c'è l'ordine che il server ha davvero.",
            ),
          );
          // ⚠️ Anche (soprattutto) nell'errore: parte della cascata può essere
          // già passata, e l'unica verità è quella che risponde il server.
          this.loadRooms();
        },
      });
  }

  /**
   * ⚠️ Dopo un file rifiutato si azzera `input.value`: senza, riselezionare lo
   * stesso file non emette `change` e l'app sembra bloccata.
   */
  protected onLogoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && file.size > MAX_LOGO_MB * 1024 * 1024) {
      this.roomError.set(
        `Il logo supera il limite di ${MAX_LOGO_MB} MB: scegline uno più leggero.`,
      );
      this.selectedLogo.set(null);
      this.logoRejected.set(true);
      input.value = '';
      return;
    }
    this.roomError.set(null);
    this.logoRejected.set(false);
    this.selectedLogo.set(file);
  }

  /** Via d'uscita esplicita dopo un logo scartato: si salva senza immagine. */
  protected saveWithoutLogo(): void {
    this.logoRejected.set(false);
    this.roomError.set(null);
    this.submitRoom();
  }

  protected editRoom(r: PokerRoomAdmin): void {
    this.editingId.set(r.id);
    this.roomFeedback.set(null);
    this.roomError.set(null);
    this.linkWarning.set(null);
    this.selectedLogo.set(null);
    this.logoRejected.set(false);
    this.form.patchValue({
      name: r.name,
      slug: r.slug,
      network: r.network ?? '',
      descrizione: r.descrizione ?? '',
      condizioni: r.condizioni ?? '',
      istruzioni: r.istruzioni ?? '',
      affiliateUrlTemplate: r.affiliateUrlTemplate,
      codicePromozionale: r.codicePromozionale ?? '',
      identifierLabel: r.identifierLabel ?? '',
      identifierHelp: r.identifierHelp ?? '',
      identifierFormat: r.identifierFormat,
      identifierMinLen: r.identifierMinLen,
      identifierMaxLen: r.identifierMaxLen,
      identifierCaseSensitive: r.identifierCaseSensitive,
      richiedeSecondoId: r.richiedeSecondoId,
      secondIdentifierLabel: r.secondIdentifierLabel ?? '',
      consenteAccountEsistenti: r.consenteAccountEsistenti,
      ordine: r.ordine,
      active: r.active,
    });
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.selectedLogo.set(null);
    this.logoRejected.set(false);
    this.form.reset({
      identifierFormat: 'LIBERO',
      identifierMinLen: 3,
      identifierMaxLen: 40,
      ordine: 100,
      // ⚠️ Anche il reset riparte da spenta: la sala si pubblica di proposito.
      active: false,
    });
    this.roomError.set(null);
  }

  protected submitRoom(): void {
    if (this.saving()) return;
    // ⚠️ Un logo scartato ferma il salvataggio: proseguire manderebbe una sala
    // senza immagine a chi crede di averla appena caricata.
    if (this.logoRejected()) {
      this.roomError.set(
        `Il logo supera il limite di ${MAX_LOGO_MB} MB: scegline uno più leggero, oppure salva senza logo.`,
      );
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.roomError.set('Controlla i campi evidenziati.');
      return;
    }
    const raw = this.form.getRawValue();
    const min = raw.identifierMinLen;
    const max = raw.identifierMaxLen;
    // Stessa guardia del backend, ma subito: una sala con minimo > massimo
    // avrebbe un campo che nessun utente può compilare.
    if (min != null && max != null && min > max) {
      this.roomError.set(
        "La lunghezza minima dell'identificativo non può superare la massima.",
      );
      return;
    }

    const id = this.editingId();
    const editing = id !== null;
    // ⚠️ `slug` sta fuori da questa base: sulla PATCH non deve viaggiare (è la
    // chiave dei deep-link `?completa=<slug>` già spediti e il backend lo
    // rifiuta), quindi lo si aggiunge solo al payload di creazione.
    const base: PokerRoomUpdatePayload = {
      name: raw.name.trim(),
      affiliateUrlTemplate: raw.affiliateUrlTemplate.trim(),
      network: this.optText(raw.network, editing),
      descrizione: this.optText(raw.descrizione, editing),
      condizioni: this.optText(raw.condizioni, editing),
      istruzioni: this.optText(raw.istruzioni, editing),
      codicePromozionale: this.optText(raw.codicePromozionale, editing),
      // ⚠️ Mai stringa vuota: il DTO ha `@MinLength(2)` e un '' sarebbe un 400.
      // Vuoto qui significa "lascia il default del server".
      identifierLabel: raw.identifierLabel.trim() || undefined,
      identifierHelp: this.optText(raw.identifierHelp, editing),
      identifierFormat: raw.identifierFormat,
      identifierMinLen: min ?? undefined,
      identifierMaxLen: max ?? undefined,
      identifierCaseSensitive: raw.identifierCaseSensitive,
      richiedeSecondoId: raw.richiedeSecondoId,
      secondIdentifierLabel: this.optText(raw.secondIdentifierLabel, editing),
      consenteAccountEsistenti: raw.consenteAccountEsistenti,
      ordine: raw.ordine ?? undefined,
      active: raw.active,
    };

    this.saving.set(true);
    this.roomError.set(null);
    this.roomFeedback.set(null);
    this.linkWarning.set(null);
    const logo = this.selectedLogo() ?? undefined;

    if (editing) {
      this.api.updateRoom(id, base, logo).subscribe({
        next: (room) => {
          this.saving.set(false);
          this.roomFeedback.set('Sala aggiornata.');
          const righe = room.righeAperteConLinkPrecedente;
          if (righe) this.linkWarning.set({ room, righe });
          this.cancelEdit();
          this.loadRooms();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          this.roomError.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
        },
      });
      return;
    }

    const payload: PokerRoomPayload = {
      ...base,
      // I due obbligatori del DTO di creazione: qui non possono essere vuoti
      // (il form li ha `Validators.required`), ma il tipo parziale non lo sa.
      name: raw.name.trim(),
      affiliateUrlTemplate: raw.affiliateUrlTemplate.trim(),
      slug: raw.slug.trim(),
    };
    this.api.createRoom(payload, logo).subscribe({
      next: () => {
        this.saving.set(false);
        this.roomFeedback.set(
          'Sala creata. Nasce disattivata: spunta "Attiva" quando è pronta per la vetrina.',
        );
        this.cancelEdit();
        this.roomPageNum.set(1);
        this.loadRooms();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.roomError.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  /**
   * Testi facoltativi: in creazione un campo vuoto si **omette** (vale il
   * default del server); in modifica si manda `''` esplicito, che è l'unico
   * modo di svuotarlo davvero — `toFormData` salta gli `undefined`.
   */
  private optText(value: string, editing: boolean): string | undefined {
    const v = value.trim();
    if (v) return v;
    return editing ? '' : undefined;
  }

  /** Scorciatoia dell'avviso: le righe ancora in attesa di quella sala. */
  protected showOpenRows(roomId: string, roomName: string): void {
    this.roomFilter.set({ id: roomId, name: roomName });
    this.statusFilter.set('RICHIESTO');
    this.reqPageNum.set(1);
    this.linkWarning.set(null);
    this.view.set('richieste');
    this.loadRequests();
  }

  protected askDelete(r: PokerRoomAdmin): void {
    this.confirmDeleteId.set(r.id);
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  /**
   * ⚠️ Con tracciamenti esistenti il backend risponde **200** con
   * `disattivata:true`: è un successo (la sala è stata disattivata), non un
   * errore. Trattarlo come tale — e ricaricare — è ciò che evita al pannello di
   * continuare a mostrare attiva una sala che non lo è più.
   */
  protected confirmDelete(r: PokerRoomAdmin): void {
    this.confirmDeleteId.set(null);
    this.roomError.set(null);
    this.api.removeRoom(r.id).subscribe({
      next: (res) => {
        this.roomFeedback.set(res.messaggio);
        if (this.editingId() === r.id) this.cancelEdit();
        const p = this.roomPage();
        if (!res.disattivata && p && p.items.length === 1 && p.page > 1) {
          this.roomPageNum.set(p.page - 1);
        }
        this.loadRooms();
      },
      error: (err: unknown) =>
        this.roomError.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }

  // ────────────────────────────── COPIA NEGLI APPUNTI ──────────────────────

  /**
   * Copia una stringa (numero di pratica, username dichiarato).
   *
   * ⚠️ `navigator.clipboard` è `undefined` fuori da un contesto sicuro: si passa
   * al fallback con un input temporaneo e, se fallisce anche quello, il valore
   * resta comunque visibile e selezionabile in pagina — mai un pulsante morto.
   */
  protected copy(text: string, etichetta: string): void {
    const done = () => this.toast.success(`${etichetta} copiato.`);
    const clip = navigator.clipboard as Clipboard | undefined;
    if (clip?.writeText) {
      clip.writeText(text).then(done, () => this.copyFallback(text, done));
      return;
    }
    this.copyFallback(text, done);
  }

  private copyFallback(text: string, done: () => void): void {
    const el = document.createElement('input');
    el.value = text;
    el.setAttribute('aria-hidden', 'true');
    el.style.position = 'fixed';
    el.style.top = '-1000px';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    el.remove();
    if (ok) done();
    else this.toast.error('Copia non riuscita: seleziona il testo a mano.');
  }
}
