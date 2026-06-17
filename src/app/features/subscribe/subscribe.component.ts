import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin, take } from 'rxjs';
import {
  DiscountValidation,
  MySubscription,
  PaymentInfo,
  PaymentMethod,
  SubscriptionTier,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
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

  protected readonly selectedTier = signal<SubscriptionTier | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  // ── Codice sconto ──
  protected readonly discountControl = new FormControl<string>('', {
    nonNullable: true,
  });
  protected readonly discountChecking = signal(false);
  protected readonly discountError = signal<string | null>(null);
  protected readonly discount = signal<DiscountValidation | null>(null);

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

  /** Prezzo effettivo da inviare: scontato se un codice è applicato. */
  protected readonly effectivePrice = computed(() => {
    const d = this.discount();
    return d ? d.discountedPriceEur : this.selectedPrice();
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

    // Stato account + receivers reali solo quando la sessione è pronta e attiva.
    this.auth.ready$.pipe(take(1)).subscribe(() => {
      if (!this.auth.isAuthenticated()) return;
      forkJoin({
        info: this.subs.paymentInfo(),
        me: this.subs.mySubscription(),
      }).subscribe({
        next: ({ info, me }) => {
          this.info.set(info);
          this.me.set(me);
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
    // Anonimo: per abbonarsi serve un account → al login, poi ritorno qui.
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], {
        queryParams: { redirect: '/abbonati' },
      });
      return;
    }
    this.selectedTier.set(tier);
    this.submitError.set(null);
    // lo sconto è validato per uno specifico tier: cambiando piano si azzera
    this.clearDiscount();
  }

  protected cancelChoice(): void {
    this.selectedTier.set(null);
    this.submitError.set(null);
    this.clearDiscount();
  }

  /** Valida il codice sconto per il tier selezionato e mostra il prezzo scontato. */
  protected applyDiscount(): void {
    const tier = this.selectedTier();
    const code = this.discountControl.value.trim();
    if (!tier || !code || this.discountChecking()) return;
    this.discountChecking.set(true);
    this.discountError.set(null);
    this.subs.validateDiscount(code, tier).subscribe({
      next: (res) => {
        this.discountChecking.set(false);
        this.discount.set(res);
      },
      error: (err: unknown) => {
        this.discountChecking.set(false);
        this.discount.set(null);
        this.discountError.set(
          apiErrorMessage(err, 'Codice sconto non valido.'),
        );
      },
    });
  }

  protected clearDiscount(): void {
    this.discount.set(null);
    this.discountError.set(null);
    this.discountChecking.set(false);
    this.discountControl.reset('');
  }

  protected submit(): void {
    const tier = this.selectedTier();
    if (!tier || this.submitting()) return;
    this.submitting.set(true);
    this.submitError.set(null);

    const reference = this.reference.value.trim();
    this.subs
      .createRequest({
        tier,
        paymentMethod: this.method.value,
        paymentReference: reference || undefined,
        discountCode: this.discount()?.code,
      })
      .subscribe({
        next: (request) => {
          this.submitting.set(false);
          this.selectedTier.set(null);
          this.reference.reset('');
          this.clearDiscount();
          // riflette subito la richiesta pending senza un altro giro di rete
          const base = this.me();
          this.me.set({
            role: base?.role ?? 'USER',
            tier: base?.tier ?? null,
            subscriptionExpiresAt: base?.subscriptionExpiresAt ?? null,
            pendingRequest: request,
          });
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.submitError.set(
            apiErrorMessage(err, 'Invio della richiesta non riuscito.'),
          );
        },
      });
  }
}
