import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import {
  MySubscription,
  PaymentInfo,
  PaymentMethod,
  SubscriptionTier,
} from '../../core/models/api.models';
import { SubscriptionsService } from '../../core/services/subscriptions.service';
import { apiErrorMessage } from '../../core/utils/http-error';

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
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './subscribe.component.html',
  styleUrl: './subscribe.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscribeComponent {
  private readonly subs = inject(SubscriptionsService);

  protected readonly features = TIER_FEATURES;
  protected readonly tierOrder: SubscriptionTier[] = ['PESCE_ROSSO', 'SQUALO'];

  protected readonly info = signal<PaymentInfo | null>(null);
  protected readonly me = signal<MySubscription | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);

  protected readonly selectedTier = signal<SubscriptionTier | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

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

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      info: this.subs.paymentInfo(),
      me: this.subs.mySubscription(),
    }).subscribe({
      next: ({ info, me }) => {
        this.info.set(info);
        this.me.set(me);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(
          apiErrorMessage(err, 'Caricamento della pagina non riuscito.'),
        );
      },
    });
  }

  protected priceFor(tier: SubscriptionTier): number | null {
    return this.info()?.tiers.find((t) => t.tier === tier)?.priceEur ?? null;
  }

  protected labelFor(tier: SubscriptionTier): string {
    return this.info()?.tiers.find((t) => t.tier === tier)?.label ?? '';
  }

  protected choose(tier: SubscriptionTier): void {
    this.selectedTier.set(tier);
    this.submitError.set(null);
  }

  protected cancelChoice(): void {
    this.selectedTier.set(null);
    this.submitError.set(null);
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
      })
      .subscribe({
        next: (request) => {
          this.submitting.set(false);
          this.selectedTier.set(null);
          this.reference.reset('');
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
