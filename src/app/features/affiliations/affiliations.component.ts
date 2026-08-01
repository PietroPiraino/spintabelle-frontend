import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  AffiliationStatus,
  MyAffiliation,
  PokerRoom,
} from '../../core/models/api.models';
import { AffiliationsService } from '../../core/services/affiliations.service';
import { AuthService } from '../../core/services/auth.service';
import { SOCIAL_LINKS } from '../../core/social-links';
import { apiErrorMessage } from '../../core/utils/http-error';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import { ToastService } from '../../shared/ui/toast/toast.service';

/** Percorso della pagina: finisce nel `redirect` della CTA di accesso. */
const PAGE_PATH = '/affiliazioni';

/**
 * ⚠️ **Copia consapevole** di `FIRST_CLIENT_LOGIN_REMINDER` (backend
 * `src/affiliations/affiliations.types.ts`), dove oggi vive da sola ed è
 * stampata solo nell'email del link. La duplicazione è una scelta, non una
 * distrazione: l'alternativa — farla servire dall'API — sta nel piano (§9.1) e
 * non è stata presa per la v1. Il prezzo è che le due copie possono divergere in
 * silenzio, quindi **se cambia una cambia l'altra**: è la frase che spiega
 * all'utente perché il suo username non risulta ancora.
 */
const FIRST_CLIENT_LOGIN_REMINDER =
  'Dopo aver creato il conto, fai un primo accesso al client di poker. Prima di quel passaggio il tuo username non risulta e non possiamo verificarlo.';

/**
 * ⚠️ Seconda frase del **testo canonico di retention** (PLAN-affiliazioni §12.7),
 * riportata **verbatim**: la stessa che viaggia nella nota dell'email del link.
 * La cancellazione è silenziosa — senza questa riga la card tornerebbe a
 * "Richiedi" senza spiegazioni, e sembrerebbe un guasto del nostro sito invece
 * della regola che abbiamo pubblicato. Non riformularla: promette un orizzonte.
 */
const RETENTION_NOTICE =
  'Una richiesta mai completata, o annullata, si chiude dopo 6 mesi di inattività.';

/**
 * Specchio del default server di `AFFILIATIONS_MAX_PENDING`.
 *
 * ⚠️ Il limite VERO è quello del backend, che può avere una env diversa: qui si
 * evita solo un round-trip il cui unico esito possibile è un 409. Se i due
 * numeri divergono vince il server, e il suo messaggio — che dice anche come
 * uscirne — arriva comunque in pagina attraverso `apiErrorMessage`.
 */
const MAX_PENDING = 5;

/**
 * Limiti esterni di `SubmitIdentifierDto` (backend): si usano solo quando la
 * sala non è più in vetrina e non abbiamo i suoi min/max reali.
 */
const IDENTIFIER_FALLBACK_MIN = 2;
const IDENTIFIER_FALLBACK_MAX = 60;

/** Quale dei due form inline è aperto (uno alla volta, su una sola card). */
type OpenFormKind = 'richiesta' | 'dati';

/**
 * Una card della vetrina.
 *
 * ⚠️ `room` può essere `null`: una sala disattivata **sparisce dalla vetrina ma
 * le righe già aperte restano** (§6). Senza questo caso l'utente perderebbe di
 * vista una richiesta in corso — link, numero di pratica e stato compresi —
 * senza che nulla glielo dica. Su quelle card non si richiede nulla: è
 * esattamente ciò che `roomAttiva:false` serve a spiegare.
 */
interface RoomCard {
  /** id della sala: chiave delle rotte e suffisso degli id in pagina */
  id: string;
  name: string;
  /** chiave del deep-link `?completa=<slug>` */
  slug: string | null;
  network?: string;
  room: PokerRoom | null;
  aff: MyAffiliation | null;
}

/**
 * `/affiliazioni` — programma di affiliazione, lato utente.
 *
 * ⚠️ **La rotta è pubblica e PRERENDERIZZATA**: tutto ciò che sta fuori dal ramo
 * autenticato finisce nell'HTML indicizzabile. Lì dentro non entrano marchi di
 * operatore, percentuali, importi né linguaggio promozionale — il catalogo vero
 * arriva da `GET /affiliations/rooms`, che richiede il JWT (§9.3, D4).
 *
 * ⚠️ **Il catalogo si carica da un `effect()` sul signal `auth.user()`**, con una
 * guardia "già caricato per questo id". Le due scorciatoie tentanti sono
 * entrambe sbagliate, ed è deciso una volta per tutte (§3):
 * - `ready$.pipe(take(1))` legge lo stato **una volta sola**, e il cap di 8s del
 *   bootstrap può far emettere `ready` col refresh ancora in volo: pagina da
 *   anonimo a un utente loggato, mentre l'header si sistema due secondi dopo;
 * - `SKIP_REFRESH` sulla chiamata: l'access token vive 15 minuti e non esiste
 *   alcun refresh proattivo, quindi direbbe "accedi" a chi è loggato da venti
 *   minuti. Il catalogo fa il percorso normale: 401 → refresh → retry.
 */
@Component({
  selector: 'app-affiliations',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, IconComponent],
  templateUrl: './affiliations.component.html',
  styleUrl: './affiliations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliationsComponent {
  private readonly api = inject(AffiliationsService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly discordUrl = SOCIAL_LINKS.discord;
  protected readonly firstLoginReminder = FIRST_CLIENT_LOGIN_REMINDER;
  protected readonly retentionNotice = RETENTION_NOTICE;

  /**
   * Campo d'appoggio per il ripiego della copia: fuori da un contesto sicuro
   * `navigator.clipboard` è `undefined`. ⚠️ Non `display:none` — un campo non
   * renderizzato non si può selezionare.
   */
  private readonly copyFallback =
    viewChild<ElementRef<HTMLInputElement>>('copyFallback');

  // ── Stato ─────────────────────────────────────────────────────────────────

  /** Sale attive; `null` = catalogo non ancora caricato (o utente anonimo). */
  protected readonly rooms = signal<PokerRoom[] | null>(null);
  protected readonly mine = signal<MyAffiliation[]>([]);
  protected readonly loading = signal(false);
  /** Errore del caricamento: mai mascherato da "nessuna sala disponibile". */
  protected readonly error = signal<string | null>(null);

  /** id della sala su cui è in corso una chiamata (attesa + disabilitazioni). */
  protected readonly actingRoomId = signal<string | null>(null);
  /** id della sala con la conferma inline di annullamento aperta. */
  protected readonly confirmingRoomId = signal<string | null>(null);
  /** id della sala col form aperto (uno solo alla volta, come /negozio). */
  protected readonly openFormRoomId = signal<string | null>(null);
  protected readonly openFormKind = signal<OpenFormKind>('richiesta');
  /** Errore dell'ultima azione sulla card aperta. */
  protected readonly formError = signal<string | null>(null);
  /** Esito annunciato nella regione `aria-live` (la card muta sul posto). */
  protected readonly liveMessage = signal<string | null>(null);
  /**
   * Sala per cui l'ultimo invio email è fallito: `emailSent:false` è un caso
   * reale (invio best-effort), e la card deve dirlo mostrando il link in pagina
   * invece di lasciare l'utente ad aspettare un'email che non arriverà.
   */
  protected readonly emailFailedRoomId = signal<string | null>(null);

  /** Query string corrente: alimenta CTA di accesso e deep-link. */
  private readonly queryParams = toSignal(this.route.queryParams, {
    initialValue: {} as Params,
  });

  /** Il catalogo è già stato caricato per questo utente (guardia dell'effect). */
  private loadedForUserId: string | null = null;
  /** Il deep-link si applica una volta sola per visita. */
  private deepLinkDone = false;

  // ── Form ──────────────────────────────────────────────────────────────────

  /**
   * Richiesta del link: **tre spunte e nient'altro** (§3).
   *
   * ⚠️ Nessun campo identificativo qui dentro: l'username di login esiste solo
   * dopo aver creato il conto, e `RequestAffiliationDto` non lo dichiara — col
   * `forbidNonWhitelisted` globale un corpo che lo porta prende un 400 su tutta
   * la chiamata. I due `requiredTrue` rispecchiano gli `@Equals(true)` dei DTO:
   * una spunta mancante è un bottone disabilitato, mai un 400 da decifrare.
   */
  protected readonly requestForm = this.fb.group({
    accountEsistente: new FormControl<boolean | null>(null, {
      validators: Validators.required,
    }),
    dichiaraProprieta: new FormControl(false, {
      nonNullable: true,
      validators: Validators.requiredTrue,
    }),
    accettaTermini: new FormControl(false, {
      nonNullable: true,
      validators: Validators.requiredTrue,
    }),
  });

  /**
   * Invio (o correzione) dell'identificativo: è il **secondo** form, sulla
   * stessa card. I validator si riallineano alla sala in `openIdentifierForm` —
   * validator disallineati dai limiti della sala sono un 400 dal backend su un
   * form che il client dava per valido.
   */
  protected readonly identifierForm = this.fb.nonNullable.group({
    roomUsername: ['', [Validators.required]],
    roomUserId: [''],
    dichiaraProprieta: [false, [Validators.requiredTrue]],
  });

  constructor() {
    // Catalogo: parte quando arriva un utente, una volta per id. Un refresh di
    // sessione ricrea l'oggetto User ma non cambia l'id → non ricarica nulla.
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        // Uscita: si azzera tutto, così un nuovo accesso ricarica davvero.
        this.loadedForUserId = null;
        this.rooms.set(null);
        this.mine.set([]);
        return;
      }
      if (this.loadedForUserId === user.id) return;
      this.loadedForUserId = user.id;
      this.load();
    });

    // Deep-link `?completa=<slug>`: scatta quando vetrina e righe personali
    // sono entrambe in pagina (arrivano insieme, vedi `load`).
    effect(() => {
      if (this.deepLinkDone) return;
      const slug = this.deepLinkSlug();
      if (!slug || this.rooms() === null) return;
      this.deepLinkDone = true;
      const card = this.cards().find((c) => c.slug === slug);
      if (card) this.openDeepLink(card);
    });
  }

  // ── Derivati ──────────────────────────────────────────────────────────────

  /** La mia riga per sala: alimenta stato, azioni e testi di ogni card. */
  protected readonly statusByRoom = computed(
    () => new Map(this.mine().map((a) => [a.roomId, a])),
  );

  protected readonly cards = computed<RoomCard[]>(() => {
    const rooms = this.rooms() ?? [];
    const byRoom = this.statusByRoom();
    const cards: RoomCard[] = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      slug: room.slug,
      network: room.network,
      room,
      aff: byRoom.get(room.id) ?? null,
    }));
    // Righe su sale uscite dalla vetrina: restano visibili, senza richiesta.
    for (const aff of this.mine()) {
      if (rooms.some((r) => r.id === aff.roomId)) continue;
      cards.push({
        id: aff.roomId,
        name: aff.roomName,
        slug: aff.roomSlug ?? null,
        room: null,
        aff,
      });
    }
    return cards;
  });

  /** Richieste aperte: è ciò che conta il tetto `AFFILIATIONS_MAX_PENDING`. */
  protected readonly openRequests = computed(
    () =>
      this.mine().filter(
        (a) => a.status === 'RICHIESTO' || a.status === 'IN_VERIFICA',
      ).length,
  );

  protected readonly atPendingCap = computed(
    () => this.openRequests() >= MAX_PENDING,
  );

  /** Slug del deep-link (`?completa=`), se presente. */
  protected readonly deepLinkSlug = computed(() => {
    const raw: unknown = this.queryParams()['completa'];
    return typeof raw === 'string' && raw ? raw : null;
  });

  /**
   * Destinazione post-accesso: **il percorso corrente con la sua query string**,
   * altrimenti un deep-link arrivato per email muore sul login. La codifica del
   * valore la applica il serializer del Router (semantica di
   * `encodeURIComponent`: `?`, `&` e `/` restano codificati), quindi
   * `?completa=<slug>` sopravvive intero dentro `redirect`.
   */
  protected readonly loginRedirect = computed(() => {
    const params = this.queryParams();
    const qs = Object.keys(params)
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`,
      )
      .join('&');
    return qs ? `${PAGE_PATH}?${qs}` : PAGE_PATH;
  });

  // ── Caricamento ───────────────────────────────────────────────────────────

  /**
   * Vetrina e righe personali insieme: senza le seconde le card mostrerebbero
   * "Richiedi" a chi ha già una richiesta in corso, che è peggio di un errore.
   * Per questo un errore su una delle due è un errore della pagina, con
   * "Riprova" — e mai un catalogo vuoto.
   */
  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ rooms: this.api.rooms(), mine: this.api.mine() }).subscribe({
      next: ({ rooms, mine }) => {
        this.rooms.set(rooms.items);
        this.mine.set(mine);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(err, 'Caricamento delle sale non riuscito.'),
        );
      },
    });
  }

  protected retry(): void {
    if (this.loading()) return;
    this.load();
  }

  // ── Etichette e testi ─────────────────────────────────────────────────────

  /**
   * Etichetta del campo identificativo: dalla sala se è in vetrina, altrimenti
   * dallo snapshot congelato sulla riga (la sala può essere stata disattivata).
   */
  protected identifierLabel(card: RoomCard): string {
    return (
      card.room?.identifierLabel ??
      card.aff?.identifierLabel ??
      'Il tuo username di login sulla sala'
    );
  }

  protected identifierMin(card: RoomCard): number {
    return card.room?.identifierMinLen ?? IDENTIFIER_FALLBACK_MIN;
  }

  protected identifierMax(card: RoomCard): number {
    return card.room?.identifierMaxLen ?? IDENTIFIER_FALLBACK_MAX;
  }

  protected identifierErrorText(card: RoomCard): string {
    return `Inserisci il tuo username: da ${this.identifierMin(card)} a ${this.identifierMax(card)} caratteri.`;
  }

  /**
   * `aria-describedby` del campo username: l'aiuto della sala **e** l'errore,
   * ognuno solo se davvero renderizzato. Gli id sono suffissati con l'id della
   * riga — più card ripetono le stesse etichette, e id duplicati manderebbero
   * uno screen reader sulla card sbagliata.
   */
  protected identifierDescribedBy(card: RoomCard): string | null {
    const ids: string[] = [];
    if (card.room?.identifierHelp) ids.push(`aiuto-${card.id}`);
    if (this.identifierInvalid()) ids.push(`errore-username-${card.id}`);
    return ids.length ? ids.join(' ') : null;
  }

  protected identifierInvalid(): boolean {
    const c = this.identifierForm.controls.roomUsername;
    return c.invalid && c.touched;
  }

  protected secondIdentifierInvalid(): boolean {
    const c = this.identifierForm.controls.roomUserId;
    return c.invalid && c.touched;
  }

  // ── Stato della riga ──────────────────────────────────────────────────────

  protected isTracked(a: MyAffiliation): boolean {
    return a.status === 'APPROVATO';
  }

  /**
   * Stati da cui l'utente può (ri)mandare l'identificativo.
   *
   * ⚠️ `ANNULLATO` è escluso **solo lato UI**: il backend lo accetterebbe, ma su
   * una riga annullata la card offre "Richiedi di nuovo", che rimette anche il
   * link in casella — una sola strada invece di due che fanno cose diverse.
   * `APPROVATO` lo rifiuta il server (409): cambiare l'username di un
   * tracciamento vivo non è una correzione, è un altro account.
   */
  protected canSubmitIdentifier(a: MyAffiliation): boolean {
    return a.status !== 'APPROVATO' && a.status !== 'ANNULLATO';
  }

  /** Stati chiusi: una nuova richiesta riapre la STESSA riga, stesso codice. */
  protected canRequestAgain(a: MyAffiliation): boolean {
    return (
      a.status === 'RIFIUTATO' ||
      a.status === 'REVOCATO' ||
      a.status === 'ANNULLATO'
    );
  }

  /** Il rinvio dispaccia sullo stato: link o ricevuta. Altrove non c'è nulla. */
  protected canResend(a: MyAffiliation): boolean {
    return a.status === 'RICHIESTO' || a.status === 'IN_VERIFICA';
  }

  /**
   * Perché "Richiedi" è bloccato, o `null` se non lo è. Il server riapplica ogni
   * regola: qui si evita solo una chiamata dall'esito già noto, e si scrive
   * accanto al bottone il motivo **e la via d'uscita**.
   */
  protected requestBlockedReason(card: RoomCard): string | null {
    if (!card.room || card.aff?.roomAttiva === false) {
      return 'Questa sala non accetta nuove richieste.';
    }
    if (this.atPendingCap()) {
      return `Hai ${this.openRequests()} richieste aperte: annullane una per aprirne un'altra.`;
    }
    return null;
  }

  /**
   * Ramo "ho già un account" su una sala che non lo collega (tutte e otto,
   * oggi): la richiesta non parte proprio. Non è un vicolo cieco — il
   * ricollegamento quasi ovunque si fa **a mano**, e la card instrada
   * sull'invito Discord del footer (mai su un profilo: un messaggio diretto fra
   * chi non condivide un server è bloccato, e l'uscita non si aprirebbe).
   */
  protected blockedExistingAccount(card: RoomCard): boolean {
    return (
      this.requestForm.controls.accountEsistente.value === true &&
      card.room?.consenteAccountEsistenti === false
    );
  }

  protected chipOk(s: AffiliationStatus): boolean {
    return s === 'APPROVATO';
  }

  protected chipWait(s: AffiliationStatus): boolean {
    return s === 'IN_VERIFICA';
  }

  protected chipKo(s: AffiliationStatus): boolean {
    return s === 'RIFIUTATO' || s === 'REVOCATO';
  }

  // ── Apertura dei form ─────────────────────────────────────────────────────

  protected isFormOpen(card: RoomCard, kind: OpenFormKind): boolean {
    return this.openFormRoomId() === card.id && this.openFormKind() === kind;
  }

  /** Apre il form di richiesta: **azzera prima**, poi apre (§9.1). */
  protected openRequestForm(card: RoomCard, scroll = false): void {
    if (this.requestBlockedReason(card)) return;
    this.formError.set(null);
    this.confirmingRoomId.set(null);
    this.requestForm.reset({
      accountEsistente: null,
      dichiaraProprieta: false,
      accettaTermini: false,
    });
    this.openFormKind.set('richiesta');
    this.openFormRoomId.set(card.id);
    this.focusInto(`richiesta-${card.id}`, scroll);
  }

  /** Apre il form dell'identificativo, riallineando i validator alla sala. */
  protected openIdentifierForm(card: RoomCard, scroll = false): void {
    this.formError.set(null);
    this.confirmingRoomId.set(null);
    const username = this.identifierForm.controls.roomUsername;
    username.setValidators([
      Validators.required,
      Validators.minLength(this.identifierMin(card)),
      Validators.maxLength(this.identifierMax(card)),
    ]);
    const second = this.identifierForm.controls.roomUserId;
    second.setValidators(
      card.room?.richiedeSecondoId ? [Validators.required] : [],
    );
    this.identifierForm.reset({
      // Una correzione parte dal valore già dichiarato: è il caso più frequente
      // dopo un rifiuto per refuso.
      roomUsername: card.aff?.roomUsername ?? '',
      roomUserId: card.aff?.roomUserId ?? '',
      dichiaraProprieta: false,
    });
    username.updateValueAndValidity();
    second.updateValueAndValidity();
    this.openFormKind.set('dati');
    this.openFormRoomId.set(card.id);
    this.focusInto(`dati-${card.id}`, scroll);
  }

  protected closeForm(): void {
    this.openFormRoomId.set(null);
    this.formError.set(null);
  }

  /** Il deep-link porta dove c'è qualcosa da fare, non solo sulla card. */
  private openDeepLink(card: RoomCard): void {
    const aff = card.aff;
    if (aff && this.canSubmitIdentifier(aff)) {
      this.openIdentifierForm(card, true);
      return;
    }
    if (
      (!aff || this.canRequestAgain(aff)) &&
      !this.requestBlockedReason(card)
    ) {
      this.openRequestForm(card, true);
      return;
    }
    // Niente da completare (tracciamento attivo, sala chiusa, tetto raggiunto):
    // si porta comunque la card sotto gli occhi, senza aprire nulla.
    this.focusInto(`card-${card.id}`, true);
  }

  // ── Azioni ────────────────────────────────────────────────────────────────

  protected submitRequest(card: RoomCard): void {
    const room = card.room;
    if (!room || this.actingRoomId()) return;
    if (this.blockedExistingAccount(card)) return;
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      this.focusFirstInvalid(`richiesta-${card.id}`);
      return;
    }
    const v = this.requestForm.getRawValue();
    this.startAction(card);
    this.api
      .request(room.id, {
        accountEsistente: v.accountEsistente === true,
        dichiaraProprieta: v.dichiaraProprieta,
        accettaTermini: v.accettaTermini,
      })
      .subscribe({
        next: (row) => {
          this.actingRoomId.set(null);
          this.closeForm();
          this.upsertMine(row);
          this.emailFailedRoomId.set(row.emailSent ? null : row.roomId);
          this.liveMessage.set(
            row.emailSent
              ? `${row.roomName}: ti abbiamo inviato il link per email. Lo trovi anche qui sotto.`
              : `${row.roomName}: non siamo riusciti a inviarti l'email — il link è qui sotto.`,
          );
        },
        error: (err: unknown) =>
          this.onActionError(err, 'Richiesta non riuscita.'),
      });
  }

  protected submitIdentifier(card: RoomCard): void {
    if (this.actingRoomId()) return;
    if (this.identifierForm.invalid) {
      this.identifierForm.markAllAsTouched();
      this.focusFirstInvalid(`dati-${card.id}`);
      return;
    }
    const v = this.identifierForm.getRawValue();
    const roomUserId = v.roomUserId.trim();
    this.startAction(card);
    this.api
      .submitIdentifier(card.id, {
        roomUsername: v.roomUsername.trim(),
        // Campo assente ≠ campo vuoto: una stringa vuota è un valore, e il
        // backend proverebbe a normalizzarla.
        ...(roomUserId ? { roomUserId } : {}),
        dichiaraProprieta: v.dichiaraProprieta,
      })
      .subscribe({
        next: (row) => {
          this.actingRoomId.set(null);
          this.closeForm();
          this.upsertMine(row);
          this.liveMessage.set(
            `${row.roomName}: dati inviati. Controlliamo a mano, di solito entro 48 ore.`,
          );
        },
        error: (err: unknown) => this.onActionError(err, 'Invio non riuscito.'),
      });
  }

  protected resend(card: RoomCard): void {
    if (this.actingRoomId()) return;
    this.startAction(card);
    this.api.resend(card.id).subscribe({
      next: (res) => {
        this.actingRoomId.set(null);
        this.emailFailedRoomId.set(res.emailSent ? null : card.id);
        this.liveMessage.set(
          res.emailSent
            ? `${card.name}: email inviata di nuovo.`
            : `${card.name}: non siamo riusciti a inviare l'email — trovi tutto qui sotto.`,
        );
      },
      error: (err: unknown) => this.onActionError(err, 'Rinvio non riuscito.'),
    });
  }

  protected askCancel(card: RoomCard): void {
    this.formError.set(null);
    this.openFormRoomId.set(null);
    this.confirmingRoomId.set(card.id);
  }

  protected dismissCancel(): void {
    this.confirmingRoomId.set(null);
  }

  /**
   * Annullamento: disponibile in **ogni** stato, `Tracciato` compreso — è
   * l'unica uscita self-service, e senza di essa l'unico modo di far togliere i
   * dati sarebbe cancellare l'account. ⚠️ Non chiude il rapporto con la sala: il
   * testo della conferma lo dice in chiaro e non va addolcito.
   */
  protected cancel(card: RoomCard): void {
    if (this.actingRoomId()) return;
    this.startAction(card);
    this.api.cancel(card.id).subscribe({
      next: (row) => {
        this.actingRoomId.set(null);
        this.confirmingRoomId.set(null);
        this.upsertMine(row);
        this.liveMessage.set(
          `${row.roomName}: richiesta annullata. Non conserviamo più i tuoi dati di collegamento.`,
        );
      },
      error: (err: unknown) =>
        this.onActionError(err, 'Annullamento non riuscito.'),
    });
  }

  private startAction(card: RoomCard): void {
    this.actingRoomId.set(card.id);
    this.formError.set(null);
    this.liveMessage.set(null);
  }

  private onActionError(err: unknown, fallback: string): void {
    this.actingRoomId.set(null);
    // I messaggi del backend sono italiani e utili (minuti residui del
    // cooldown, tetto delle richieste con la via d'uscita, username già
    // collegato a un altro account): mai sostituirli con uno generico.
    const message = apiErrorMessage(err, fallback);
    this.formError.set(message);
    this.liveMessage.set(message);
  }

  /** Sostituisce la riga della sala (o la aggiunge) senza ricaricare tutto. */
  private upsertMine(row: MyAffiliation): void {
    this.mine.update((list) => [
      ...list.filter((a) => a.roomId !== row.roomId),
      row,
    ]);
  }

  // ── Copia ─────────────────────────────────────────────────────────────────

  /**
   * Copia negli appunti codice promozionale e numero di pratica: due stringhe
   * fatte per essere portate altrove a mano (la prima si digita sul sito della
   * sala — un refuso lì è una registrazione che non ci viene attribuita; la
   * seconda si incolla in un messaggio **a noi**, e non si dà mai alla sala).
   *
   * ⚠️ `navigator.clipboard` è `undefined` fuori da un contesto sicuro: si
   * ripiega su un campo nascosto + `execCommand`, e se fallisce anche quello il
   * codice resta visibile e selezionabile. Mai un bottone morto.
   */
  protected copy(value: string, okMessage: string): void {
    const clip = navigator.clipboard;
    if (clip?.writeText) {
      void clip.writeText(value).then(
        () => this.toast.success(okMessage),
        () => this.copyWithFallback(value, okMessage),
      );
      return;
    }
    this.copyWithFallback(value, okMessage);
  }

  private copyWithFallback(value: string, okMessage: string): void {
    const input = this.copyFallback()?.nativeElement;
    if (input) {
      input.value = value;
      input.select();
      input.setSelectionRange(0, value.length);
      let done = false;
      try {
        done = document.execCommand('copy');
      } catch {
        done = false;
      }
      input.blur();
      if (done) {
        this.toast.success(okMessage);
        return;
      }
    }
    this.toast.error(
      'Copia non riuscita: seleziona il codice in pagina e copialo a mano.',
    );
  }

  // ── Fuoco e scorrimento ───────────────────────────────────────────────────

  /**
   * Porta il fuoco DENTRO il contenitore appena aperto (e, se richiesto, la
   * viewport). ⚠️ In zoneless il DOM non esiste subito dopo il cambio di stato:
   * il `setTimeout(0)` aspetta il giro di change detection. ⚠️ E lo scorrimento
   * da solo non basta: sposta la vista e lascia tastiera e screen reader dov'e-
   * rano, mentre la pagina salta sotto di loro.
   */
  private focusInto(elementId: string, scroll: boolean): void {
    setTimeout(() => {
      const root = document.getElementById(elementId);
      if (!root) return;
      if (scroll) root.scrollIntoView({ block: 'center' });
      const first = root.querySelector<HTMLElement>(
        'input:not([type="hidden"]), select, textarea, button, a[href]',
      );
      first?.focus();
    }, 0);
  }

  /**
   * `markAllAsTouched()` non basta su un invio non valido: senza questo, chi usa
   * la tastiera resta in fondo a un form i cui errori sono tutti sopra di lui.
   */
  private focusFirstInvalid(formId: string): void {
    setTimeout(() => {
      const root = document.getElementById(formId);
      const el = root?.querySelector<HTMLElement>(
        'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
      );
      el?.focus();
    }, 0);
  }

  protected scrollToTerms(): void {
    document.getElementById('aff-termini')?.scrollIntoView({ block: 'start' });
  }
}
