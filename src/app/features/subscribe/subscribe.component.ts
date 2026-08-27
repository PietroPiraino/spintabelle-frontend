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

  /** Prezzo effettivo da inviare: scontato se uno o più buoni sono applicati. */
  protected readonly effectivePrice = computed(() => {
    const d = this.discounts();
    return d?.discountedPriceEur ?? this.selectedPrice();
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
    if (this.appliedCodes().length === 0) {
      this.discounts.set(null);
      return;
    }
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
    if (codes.length === 0) {
      this.discounts.set(null);
      this.discountError.set(null);
      return;
    }
    this.applying.set(true);
    this.discountError.set(null);
    this.subs.validateDiscounts(codes, tier).subscribe({
      next: (res) => {
        this.applying.set(false);
        this.discounts.set(res);
      },
      error: (err: unknown) => {
        this.applying.set(false);
        // niente prezzo scontato valido: azzera il cumulo per non mostrare un
        // prezzo incoerente con i codici applicati.
        this.discounts.set(null);
        this.discountError.set(apiErrorMessage(err, 'Buono non valido.'));
        // rollback del codice appena aggiunto: non resta bloccato
        if (justAdded) {
          this.appliedCodes.update((c) => c.filter((x) => x !== justAdded));
        }
      },
    });
  }

  protected clearDiscounts(): void {
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
    this.subs
      .createRequest({
        tier,
        paymentMethod: this.method.value,
        paymentReference: reference || undefined,
        discountCodes: codes.length ? codes : undefined,
      })
      .subscribe({
        next: (request) => {
          this.submitting.set(false);
          this.selectedTier.set(null);
          this.reference.reset('');
          this.clearDiscounts();
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
