import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, take } from 'rxjs';
import {
  DiscountsValidation,
  MySubscription,
  MyVoucher,
  PaymentInfo,
  PaymentMethod,
  SubscriptionTier,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ShopService } from '../../core/services/shop.service';
import { SubscriptionsService } from '../../core/services/subscriptions.service';
import { apiErrorMessage } from '../../core/utils/http-error';
import {
  SubscribeModelComponent,
  SubscribeModelSpec,
} from './subscribe-model/subscribe-model.component';

/** Vantaggi mostrati per ciascun tier sulla pagina /abbonati. */
const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  PESCE_ROSSO: [
    '2 lezioni dal vivo low stakes a settimana',
    'Tutta la libreria video low stakes',
    'Tabelle GTO e allenamento',
  ],
  SQUALO: [
    'Tutte e 4 le lezioni dal vivo settimanali',
    'Libreria video completa: low + high stakes',
    'Tabelle GTO e allenamento',
  ],
};

@Component({
  selector: 'app-subscribe',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, SubscribeModelComponent],
  templateUrl: './subscribe.component.html',
  styleUrl: './subscribe.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscribeComponent {
  private readonly subs = inject(SubscriptionsService);
  private readonly shop = inject(ShopService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Sessione attiva: guida la UI (form d'acquisto vs CTA login). */
  protected readonly isAuth = this.auth.isAuthenticated;

  protected readonly features = TIER_FEATURES;
  protected readonly tierOrder: SubscriptionTier[] = ['PESCE_ROSSO', 'SQUALO'];

  /** Mascotte 3D per tier (modelli statici CC-BY da public/models). */
  protected readonly modelByTier: Record<SubscriptionTier, SubscribeModelSpec> = {
    PESCE_ROSSO: {
      url: '/models/fish.glb',
      alt: 'Pesce — piano Pesce Rosso',
      accent: 0xff6a1f,
      // profilo ¾ girato verso l'utente, leggera inclinazione
      baseRotation: [-0.12, 1.25, 0],
      tint: { match: 'Fish_01', color: 0xff7a2e }, // corpo virato arancio
    },
    SQUALO: {
      url: '/models/shark.glb',
      alt: 'Squalo — piano Squalo',
      accent: 0x39a0c8,
      baseRotation: [-0.12, -1.25, 0], // speculare al pesce
    },
  };

  protected readonly info = signal<PaymentInfo | null>(null);
  protected readonly me = signal<MySubscription | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  private readonly injector = inject(Injector);

  /** L'h2 del pannello di pagamento: è il bersaglio del focus (vedi `vaiAlPagamento`). */
  private readonly testaPagamento = viewChild<ElementRef<HTMLElement>>('testaPagamento');

  protected readonly selectedTier = signal<SubscriptionTier | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly withdrawing = signal(false);

  // ── Buoni sconto cumulabili ──
  /** Codici attualmente applicati (normalizzati MAIUSCOLO). */
  protected readonly appliedCodes = signal<string[]>([]);
  /** Ultima validazione cumulata andata a buon fine (prezzo + buoni validati). */
  protected readonly discounts = signal<DiscountsValidation | null>(null);
  /** Buoni posseduti dall'utente (per il selettore "Aggiungi"). */
  protected readonly ownedVouchers = signal<MyVoucher[]>([]);
  protected readonly applying = signal(false);
  protected readonly discountError = signal<string | null>(null);
  /** Contatore delle validazioni in volo: vince solo l'ultima partita. */
  private discountSeq = 0;
  /** Input libero per digitare un codice promo. */
  protected readonly discountControl = new FormControl<string>('', {
    nonNullable: true,
  });

  /** Buoni disponibili non ancora applicati: chips "Aggiungi". */
  protected readonly pickableVouchers = computed(() => {
    const applied = this.appliedCodes();
    return this.ownedVouchers().filter(
      (v) => v.status === 'available' && !applied.includes(v.code),
    );
  });

  // ── Punti BFF ──
  /**
   * Punti che l'utente ha deciso di usare. ⚠️ Cambiando piano o togliendo un
   * buono il prezzo si alza e questo valore può finire fuori regola: viene
   * ri-clampato a ogni cambio (`clampPunti`), altrimenti l'invio prenderebbe un
   * 400 DOPO che l'utente ha già pagato fuori sito.
   */
  protected readonly pointsToSpend = signal(0);

  /** Saldo punti dell'utente: il server lo riconferma sull'anteprima. */
  protected readonly pointsBalance = computed(
    () => this.discounts()?.punti?.saldo ?? this.auth.points(),
  );

  /** Taglio dello scatto (arriva dal server, default prudente). */
  protected readonly pointsStep = computed(
    () => this.discounts()?.punti?.passo ?? this.info()?.punti?.passo ?? 1000,
  );

  private readonly pointsRate = computed(
    () => this.discounts()?.punti?.tasso ?? this.info()?.punti?.tasso ?? 1000,
  );

  /**
   * Il prezzo dopo i buoni, espresso in punti. Tutto il conto locale sta su
   * INTERI: sottrarre euro da euro rimetterebbe in gioco l'errore in virgola
   * mobile proprio sul caso che i punti servono a chiudere (un buono del 41%
   * su Pesce Rosso dà €32,45, e `32.45 * 1000` non fa 32450).
   */
  private readonly priceInPoints = computed(() => {
    const d = this.discounts();
    if (d?.punti) return d.punti.prezzoInPunti;
    const eur = this.selectedPrice();
    return eur == null ? 0 : Math.round(eur * this.pointsRate());
  });

  /** Tetto del selettore e valore di «usa il massimo». */
  protected readonly maxPoints = computed(() =>
    Math.max(0, Math.min(this.pointsBalance(), this.priceInPoints())),
  );

  /** Euro coperti dai punti scelti. */
  protected readonly pointsDiscountEur = computed(
    () => Math.round((this.pointsToSpend() / this.pointsRate()) * 100) / 100,
  );

  protected readonly canUsePoints = computed(() => this.maxPoints() > 0);

  protected readonly method = new FormControl<PaymentMethod>('paypal', {
    nonNullable: true,
  });
  protected readonly reference = new FormControl<string>('', {
    nonNullable: true,
  });
  private readonly methodSig = toSignal(this.method.valueChanges, {
    initialValue: this.method.value,
  });
  protected readonly methodLabel = computed(() =>
    this.methodSig() === 'skrill' ? 'Skrill' : 'PayPal',
  );

  protected readonly pending = computed(
    () => this.me()?.pendingRequest ?? null,
  );

  /** Email destinataria del pagamento in base al metodo scelto. */
  protected readonly receiverEmail = computed(() => {
    const info = this.info();
    if (!info) return '';
    return this.methodSig() === 'skrill'
      ? info.receivers.skrill
      : info.receivers.paypal;
  });

  protected readonly selectedPrice = computed(() => {
    const tier = this.selectedTier();
    const info = this.info();
    if (!tier || !info) return null;
    return info.tiers.find((t) => t.tier === tier)?.priceEur ?? null;
  });

  protected readonly selectedLabel = computed(() => {
    const tier = this.selectedTier();
    const info = this.info();
    if (!tier || !info) return '';
    return info.tiers.find((t) => t.tier === tier)?.label ?? '';
  });

  /** Prezzo dopo i soli buoni (i punti non sono uno sconto: sono un pagamento). */
  protected readonly priceAfterVouchers = computed(() => {
    const d = this.discounts();
    return d?.discountedPriceEur ?? this.selectedPrice();
  });

  /**
   * Quanto c'è davvero da pagare: dopo i buoni E dopo i punti.
   * ⚠️ I punti DEVONO entrare qui: il ramo «omaggio» del template si apre su
   * `=== 0`, e senza questa sottrazione un abbonamento coperto interamente dai
   * punti continuerebbe a dire «Invia €125 via PayPal».
   */
  protected readonly effectivePrice = computed(() => {
    const dopoBuoni = this.priceAfterVouchers();
    if (dopoBuoni == null) return null;
    const punti = this.pointsToSpend();
    if (punti <= 0) return dopoBuoni;
    // Sottrazione su interi, poi ritorno in euro: vedi `priceInPoints`.
    const resto = Math.max(0, this.priceInPoints() - punti);
    return Math.round((resto / this.pointsRate()) * 100) / 100;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    // Card pubbliche SUBITO: i prezzi non aspettano la sessione (niente attesa
    // cold-start). `info` viene popolato con receivers vuoti finché non si è
    // loggati — il pannello di pagamento (che li usa) è raggiungibile solo da
    // utenti autenticati.
    this.subs.plans().subscribe({
      next: (plans) => {
        if (!this.me()) {
          this.info.set({ ...plans, receivers: { paypal: '', skrill: '' } });
        }
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          apiErrorMessage(err, 'Caricamento della pagina non riuscito.'),
        );
      },
    });

    // Stato account + receivers reali + buoni posseduti solo quando la sessione
    // è pronta e attiva.
    this.auth.ready$.pipe(take(1)).subscribe(() => {
      if (!this.auth.isAuthenticated()) return;
      forkJoin({
        info: this.subs.paymentInfo(),
        me: this.subs.mySubscription(),
        vouchers: this.shop.myVouchers(),
      }).subscribe({
        next: ({ info, me, vouchers }) => {
          this.info.set(info);
          this.me.set(me);
          this.ownedVouchers.set(vouchers);
        },
        // se fallisce restano i piani pubblici: l'utente può riprovare
        error: () => undefined,
      });
    });
  }

  protected priceFor(tier: SubscriptionTier): number | null {
    return this.info()?.tiers.find((t) => t.tier === tier)?.priceEur ?? null;
  }

  /**
   * Perché questo utente non può abbonarsi, o null se può.
   *
   * ⚠️ Il server rifiuta con un 409 chi ha già accesso pieno senza aver
   * comprato niente (admin, coach, giocatori in staking). Senza questa riga la
   * pagina offriva loro «Scegli Squalo», il pannello di pagamento e le
   * istruzioni PayPal: il rifiuto sarebbe arrivato DOPO che l'utente ha pagato
   * fuori sito, che è l'unico momento in cui non si può più rimediare.
   * ⚠️ Vive nel ramo autenticato (`me()` è null per un anonimo), quindi non
   * raggiunge mai l'HTML prerenderizzato di questa pagina, che è pubblica.
   */
  protected readonly bloccoAbbonamento = computed(() => {
    const role = this.me()?.role;
    if (role === 'ADMIN')
      return 'Come amministratore hai già accesso a tutto: non serve un abbonamento.';
    if (role === 'COACH')
      return 'Come coach hai già accesso completo ai contenuti: non serve un abbonamento.';
    if (role === 'STAKATO')
      return 'Sei in staking con la scuola: hai già accesso completo e senza scadenza, non serve un abbonamento.';
    return null;
  });

  protected labelFor(tier: SubscriptionTier): string {
    return this.info()?.tiers.find((t) => t.tier === tier)?.label ?? '';
  }

  protected choose(tier: SubscriptionTier): void {
    // Scegliendo un piano si va al pannello: nasce sotto tutta la griglia.
    if (this.auth.isAuthenticated()) this.vaiAlPagamento();

    // Anonimo: per abbonarsi serve un account → al login, poi ritorno qui.
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], {
        queryParams: { redirect: '/abbonati' },
      });
      return;
    }
    this.selectedTier.set(tier);
    this.submitError.set(null);
    // i buoni sono validati per uno specifico tier: cambiando piano si azzerano
    this.clearDiscounts();
    // Cambiando piano cambia il prezzo, quindi cambia il tetto dei punti: il
    // valore scelto sul piano precedente sarebbe fuori regola e prenderebbe un
    // 400 all'invio, cioè dopo il pagamento off-site.
    this.pointsToSpend.set(0);
    // Il prezzo del piano nuovo va chiesto al server anche senza buoni: è da lì
    // che arrivano saldo e tetto dei punti.
    this.revalidate();
  }

  /**
   * Porta al pannello di pagamento, che nasce SOTTO l'intera griglia.
   *
   * ⚠️ Non è una comodità: sotto ~660px la griglia è a una colonna, quindi chi
   * tocca «Scegli Pesce Rosso» sulla prima card genera il pannello sotto la
   * SECONDA — a 390px sono ~950px più giù, cioè oltre due schermate. Nessuno
   * sposta scroll o focus da solo (lo scroll custom di `app.config.ts` scatta
   * solo al cambio di percorso), e l'unico segnale che qualcosa è successo
   * usciva dal campo visivo.
   *
   * ⚠️ Si sposta il FOCUS e non solo lo scroll: porta con sé lo scorrimento ed
   * è anche la cosa giusta per chi naviga da tastiera o con uno screen reader,
   * che altrimenti resterebbe sul bottone mentre la pagina cambia sotto.
   *
   * ⚠️ `afterNextRender` e non una chiamata sincrona: in zoneless il pannello
   * è dentro un `@if` che monta nello stesso ciclo, quindi un
   * `querySelector` immediato trova `null` e il difetto diventa «a volte
   * funziona». Il `viewChild` è `signal`-based e lo stesso vale per lui.
   */
  protected vaiAlPagamento(): void {
    afterNextRender(
      () => {
        const h = this.testaPagamento();
        h?.nativeElement.focus({ preventScroll: false });
      },
      { injector: this.injector },
    );
  }

  /**
   * Chiude l'avviso su un buono rifiutato.
   *
   * ⚠️ Serve perché il rollback di `revalidate()` toglie il codice appena
   * aggiunto: spariscono i badge e con essi le «✕» di `removeCode()`, che era
   * l'unico punto che azzerava `discountError`. Restava un messaggio d'errore
   * su un codice non più applicato, e il bottone d'acquisto spento.
   */
  protected chiudiErroreSconto(): void {
    this.discountError.set(null);
  }

  protected cancelChoice(): void {
    this.selectedTier.set(null);
    this.submitError.set(null);
    this.clearDiscounts();
  }

  /** Aggiunge un buono (dal selettore o dall'input) e rivalida il cumulo. */
  protected addCode(code: string): void {
    const normalized = code.trim().toUpperCase();
    if (!normalized || this.applying()) return;
    if (this.appliedCodes().includes(normalized)) return;
    this.appliedCodes.update((codes) => [...codes, normalized]);
    this.discountControl.reset('');
    this.revalidate(normalized);
  }

  /** Aggiunge il codice digitato a mano. */
  protected addTyped(): void {
    this.addCode(this.discountControl.value);
  }

  /** Rimuove un buono applicato e rivalida (o azzera se non ne resta nessuno). */
  protected removeCode(code: string): void {
    this.appliedCodes.update((codes) => codes.filter((c) => c !== code));
    this.discountError.set(null);
    // ⚠️ Anche senza più codici si richiama il server: togliendo un buono il
    // prezzo SALE, quindi cambia il tetto dei punti — e la vecchia uscita
    // anticipata lasciava il selettore tarato sul prezzo scontato.
    this.revalidate();
  }

  /**
   * Rivalida l'intero cumulo di buoni per il tier selezionato. In caso di
   * errore (codice non valido o regola €-vs-% violata) mostra il messaggio del
   * server e fa il rollback del codice appena aggiunto (`justAdded`) così da
   * non lasciarne uno incompatibile bloccato.
   */
  private revalidate(justAdded?: string): void {
    const tier = this.selectedTier();
    const codes = this.appliedCodes();
    if (!tier) return;
    // ⚠️ Si chiama SEMPRE, anche senza buoni: è questa risposta a portare saldo,
    // tetto e prezzo-in-punti del selettore. Uscendo prima (com'era) il caso
    // «solo punti, nessun buono» — quello maggioritario — non avrebbe mai
    // parlato col server.
    if (!this.auth.isAuthenticated()) return;
    // Guardia anti-risposte fuori ordine: due input (buoni e piano) pilotano la
    // stessa chiamata e i bottoni dei piani non sono disabilitati mentre una
    // validazione viaggia. Senza, una risposta in ritardo riscrive un prezzo
    // già corretto. (Idioma di shop.component.ts.)
    const seq = ++this.discountSeq;
    this.applying.set(true);
    this.discountError.set(null);
    this.subs.validateDiscounts(codes, tier).subscribe({
      next: (res) => {
        if (seq !== this.discountSeq) return;
        this.applying.set(false);
        this.discounts.set(res);
        this.clampPunti();
      },
      error: (err: unknown) => {
        if (seq !== this.discountSeq) return;
        this.applying.set(false);
        // niente prezzo scontato valido: azzera il cumulo per non mostrare un
        // prezzo incoerente con i codici applicati.
        this.discounts.set(null);
        // Senza codici in gioco un errore non parla di buoni: è il prezzo che
        // non è arrivato. Accusare il buono sbagliato manda a cercare il guasto
        // dove non è (ed è ciò che farebbe un 429 sullo stepper).
        this.discountError.set(
          this.appliedCodes().length
            ? apiErrorMessage(err, 'Buono non valido.')
            : apiErrorMessage(err, 'Non riesco a calcolare il prezzo.'),
        );
        // rollback del codice appena aggiunto: non resta bloccato
        if (justAdded) {
          this.appliedCodes.update((c) => c.filter((x) => x !== justAdded));
        }
      },
    });
  }

  // ── Punti BFF ──

  /**
   * Riporta i punti scelti dentro le regole correnti: multiplo dello scatto,
   * mai oltre il tetto. ⚠️ Va chiamata a ogni cambio di prezzo (buono tolto o
   * aggiunto, piano cambiato, anteprima ricevuta): il tetto scende quando il
   * prezzo scende, e un valore rimasto sopra fallisce solo all'invio.
   */
  private clampPunti(): void {
    const max = this.maxPoints();
    const passo = this.pointsStep();
    const scelti = this.pointsToSpend();
    if (scelti <= 0) return;
    if (scelti <= max && (scelti % passo === 0 || scelti === max)) return;
    // Il valore che azzera il dovuto è ammesso anche se non è un multiplo:
    // con un buono percentuale il prezzo ha i centesimi e «tutto» è l'unico
    // modo di non lasciare fuori qualche spicciolo.
    const clamped = Math.min(scelti, max);
    this.pointsToSpend.set(
      clamped === max ? max : Math.floor(clamped / passo) * passo,
    );
  }

  /** Aumenta/diminuisce di uno scatto, restando dentro il tetto. */
  protected stepPunti(delta: number): void {
    const passo = this.pointsStep();
    const max = this.maxPoints();
    const attuali = this.pointsToSpend();
    // Dall'ultimo scatto pieno si sale al tetto esatto (che può avere i
    // centesimi), non oltre; e scendendo si torna sul multiplo.
    const grezzo =
      delta > 0
        ? Math.min(max, Math.floor(attuali / passo) * passo + passo)
        : Math.max(0, Math.floor((attuali - 1) / passo) * passo);
    this.pointsToSpend.set(grezzo);
  }

  protected usaMassimoPunti(): void {
    this.pointsToSpend.set(this.maxPoints());
  }

  protected azzeraPunti(): void {
    this.pointsToSpend.set(0);
  }

  protected fmtPunti(n: number): string {
    return new Intl.NumberFormat('it-IT').format(n);
  }

  protected clearDiscounts(): void {
    // ⚠️ Il contatore si alza anche qui: azzerare lo stato senza invalidare le
    // risposte in volo lascerebbe che la prossima ad arrivare lo ripopoli.
    this.discountSeq++;
    this.appliedCodes.set([]);
    this.discounts.set(null);
    this.discountError.set(null);
    this.applying.set(false);
    this.discountControl.reset('');
  }

  protected submit(): void {
    const tier = this.selectedTier();
    if (!tier || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const reference = this.reference.value.trim();
    const codes = this.appliedCodes();
    const punti = this.pointsToSpend();
    this.subs
      .createRequest({
        tier,
        paymentMethod: this.method.value,
        paymentReference: reference || undefined,
        discountCodes: codes.length ? codes : undefined,
        // Solo se > 0: un `pointsSpent: 0` inviato sempre farebbe fallire
        // l'INTERA chiamata (400 da `forbidNonWhitelisted`) contro un backend
        // più vecchio, portandosi dietro anche il flusso dei buoni.
        ...(punti > 0 ? { pointsSpent: punti } : {}),
      })
      .subscribe({
        next: (request) => {
          this.submitting.set(false);
          this.selectedTier.set(null);
          this.reference.reset('');
          this.clearDiscounts();
          this.pointsToSpend.set(0);
          // I punti sono già stati scalati: senza questa riga il gettone in
          // header resterebbe al valore vecchio finché non si ricarica.
          this.auth.loadMe().subscribe({ error: () => undefined });
          // riflette subito la richiesta pending senza un altro giro di rete
          const base = this.me();
          this.me.set({
            role: base?.role ?? 'USER',
            tier: base?.tier ?? null,
            subscriptionExpiresAt: base?.subscriptionExpiresAt ?? null,
            pendingRequest: request,
          });
          // i buoni applicati sono ora riservati: ricarica la lista posseduti
          this.refreshVouchers();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.submitError.set(
            apiErrorMessage(err, 'Invio della richiesta non riuscito.'),
          );
        },
      });
  }

  /**
   * Ritira la richiesta in attesa: libera l'utente a inviarne una nuova e
   * rilascia i buoni riservati. Ricarica lo stato abbonamento e i buoni.
   */
  protected withdraw(): void {
    if (this.withdrawing() || !this.pending()) return;
    this.withdrawing.set(true);
    this.submitError.set(null);
    this.subs.withdraw().subscribe({
      next: () => {
        this.withdrawing.set(false);
        this.selectedTier.set(null);
        this.reference.reset('');
        this.clearDiscounts();
        this.pointsToSpend.set(0);
        // Ritirando, i punti impegnati tornano nel saldo: il gettone deve
        // rifletterlo subito.
        this.auth.loadMe().subscribe({ error: () => undefined });
        this.subs.mySubscription().subscribe({
          next: (me) => this.me.set(me),
          error: () => undefined,
        });
        this.refreshVouchers();
      },
      error: (err: unknown) => {
        this.withdrawing.set(false);
        this.submitError.set(
          apiErrorMessage(err, 'Ritiro della richiesta non riuscito.'),
        );
      },
    });
  }

  /** Ricarica i buoni posseduti (best-effort: stato riservato/disponibile). */
  private refreshVouchers(): void {
    if (!this.auth.isAuthenticated()) return;
    this.shop.myVouchers().subscribe({
      next: (vouchers) => this.ownedVouchers.set(vouchers),
      error: () => undefined,
    });
  }
}
