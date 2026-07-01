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
import { Subject, debounceTime } from 'rxjs';
import {
  DiscountsValidation,
  GadgetResource,
  MyVoucher,
  PaymentInfo,
  Role,
  ShippingAddress,
  ShopCatalog,
  ShopVoucherType,
  SubscriptionTier,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ShopService } from '../../core/services/shop.service';
import { SubscriptionsService } from '../../core/services/subscriptions.service';
import { apiErrorMessage } from '../../core/utils/http-error';

/** Gadget per pagina: griglia → batch coerente con /docs e /lezioni. */
const PAGE_SIZE = 24;

/** Rango ruoli per bloccare downgrade lato client (il server riconferma). */
const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  PESCE_ROSSO: 1,
  SQUALO: 2,
  ADMIN: 3,
};

const TIER_RANK: Record<SubscriptionTier, number> = {
  PESCE_ROSSO: 1,
  SQUALO: 2,
};

@Component({
  selector: 'app-shop',
  imports: [ReactiveFormsModule],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopComponent {
  private readonly shop = inject(ShopService);
  private readonly subscriptions = inject(SubscriptionsService);
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly pageSize = PAGE_SIZE;

  // ── Catalogo (buoni + abbonamenti) ──
  protected readonly catalog = signal<ShopCatalog | null>(null);
  protected readonly catalogError = signal<string | null>(null);

  // ── Gadget (lista accumulata, pattern /docs) ──
  protected readonly gadgets = signal<GadgetResource[] | null>(null);
  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  /** Errore dell'ultima richiesta lista: mai mascherato da "nessun gadget". */
  protected readonly error = signal<string | null>(null);
  protected readonly searchTerm = signal('');

  // ── Stato acquisto (un solo acquisto alla volta) ──
  /** id dell'elemento il cui acquisto è in corso (spinner sul bottone). */
  protected readonly actingId = signal<string | null>(null);
  /** id dell'elemento per cui mostrare il riquadro di conferma inline. */
  protected readonly confirmingId = signal<string | null>(null);
  protected readonly successMsg = signal<string | null>(null);
  protected readonly purchaseError = signal<string | null>(null);

  // ── Form di spedizione gadget (uno aperto alla volta) ──
  protected readonly orderingGadgetId = signal<string | null>(null);
  protected readonly shippingForm = this.fb.nonNullable.group({
    // minLength allineati al DTO backend (ShippingAddressDto): evita il 400 server.
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    line1: ['', [Validators.required, Validators.minLength(2)]],
    line2: [''],
    city: ['', [Validators.required, Validators.minLength(2)]],
    zip: ['', [Validators.required, Validators.minLength(2)]],
    province: ['', [Validators.required]],
    country: ['Italia', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(4)]],
  });

  // ── Ordine gadget in EURO (sconti + pagamento off-site "confermato subito") ──
  /** Valuta dell'ordine aperto: punti (istantaneo) o euro (off-site). */
  protected readonly orderCurrency = signal<'points' | 'euro'>('points');
  protected readonly paymentInfo = signal<PaymentInfo | null>(null);
  protected readonly ownedVouchers = signal<MyVoucher[]>([]);
  protected readonly appliedCodes = signal<string[]>([]);
  protected readonly euroDiscounts = signal<DiscountsValidation | null>(null);
  protected readonly discountControl = new FormControl('', {
    nonNullable: true,
  });
  protected readonly discountError = signal<string | null>(null);
  protected readonly applyingDiscount = signal(false);
  protected readonly paymentMethodControl = new FormControl<'paypal' | 'skrill'>(
    'paypal',
    { nonNullable: true },
  );
  protected readonly paymentReferenceControl = new FormControl('', {
    nonNullable: true,
  });
  /** Buoni selezionabili: disponibili e non già applicati. */
  protected readonly pickableVouchers = computed(() =>
    this.ownedVouchers().filter(
      (v) => v.status === 'available' && !this.appliedCodes().includes(v.code),
    ),
  );

  private page = 1;
  /** Scarta le risposte superate da una ricerca più recente. */
  private requestSeq = 0;
  /** Scarta le risposte di validazione sconti superate (out-of-order). */
  private discountSeq = 0;
  private readonly search$ = new Subject<string>();

  protected readonly points = this.auth.points;

  constructor() {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((term) => {
        if (term === this.searchTerm()) return;
        this.searchTerm.set(term);
        this.reload();
      });

    this.shop.catalog().subscribe({
      next: (c) => this.catalog.set(c),
      error: (err: unknown) =>
        this.catalogError.set(
          apiErrorMessage(err, 'Caricamento del catalogo non riuscito.'),
        ),
    });
    this.load();
  }

  // ── Formattazione ──

  protected fmt(n: number): string {
    return new Intl.NumberFormat('it-IT').format(n);
  }

  protected canAfford(price: number): boolean {
    return this.points() >= price;
  }

  /**
   * Un acquisto abbonamento è bloccato se è un downgrade rispetto al tier
   * pagato corrente; il pari tier è consentito (rinnovo). Il server riapplica
   * comunque la stessa logica.
   */
  protected isDowngrade(tier: SubscriptionTier): boolean {
    const role = this.auth.user()?.role;
    if (!role) return false;
    // ADMIN ha già accesso pieno: ogni acquisto sarebbe un downgrade.
    if (role === 'ADMIN') return true;
    return ROLE_RANK[role] > TIER_RANK[tier];
  }

  /** Seme-emblema per tier (linguaggio carte del sito): Pesce Rosso ♦, Squalo ♠. */
  protected subEmblem(tier: SubscriptionTier): string {
    return tier === 'SQUALO' ? '♠' : '♦';
  }

  // ── Lista gadget (pattern /docs) ──

  private reload(): void {
    this.page = 1;
    this.load();
  }

  private load(append = false): void {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    const term = this.searchTerm().trim();
    this.shop
      .gadgets({ page: this.page, limit: PAGE_SIZE, q: term || undefined })
      .subscribe({
        next: (res) => {
          if (seq !== this.requestSeq) return;
          this.gadgets.update((cur) =>
            append
              ? [
                  ...(cur ?? []),
                  // dedup: una pubblicazione concorrente sposta l'offset e
                  // ripresenterebbe l'ultimo item della pagina precedente
                  ...res.items.filter(
                    (it) => !(cur ?? []).some((c) => c.id === it.id),
                  ),
                ]
              : res.items,
          );
          this.total.set(res.total);
          this.hasMore.set(res.page < res.totalPages);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err: unknown) => {
          if (seq !== this.requestSeq) return;
          if (append) this.page -= 1;
          this.gadgets.update((cur) => cur ?? []);
          this.error.set(
            apiErrorMessage(err, 'Caricamento dei gadget non riuscito.'),
          );
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  protected retry(): void {
    this.reload();
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.page += 1;
    this.load(true);
  }

  protected onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  // ── Acquisto buoni / abbonamenti (conferma inline) ──

  protected askConfirm(id: string): void {
    this.purchaseError.set(null);
    this.confirmingId.set(id);
  }

  protected cancelConfirm(): void {
    this.confirmingId.set(null);
  }

  protected buyVoucher(type: ShopVoucherType): void {
    if (this.actingId()) return;
    this.startPurchase(`voucher:${type}`);
    this.shop.buyVoucher(type).subscribe({
      next: () =>
        this.onPurchased(
          "Buono acquistato! Lo trovi in 'Il mio account'.",
        ),
      error: (err: unknown) => this.onPurchaseError(err),
    });
  }

  protected buySubscription(tier: SubscriptionTier): void {
    if (this.actingId()) return;
    this.startPurchase(`subscription:${tier}`);
    this.shop.buySubscription(tier).subscribe({
      next: () => this.onPurchased('Abbonamento attivato!'),
      error: (err: unknown) => this.onPurchaseError(err),
    });
  }

  private startPurchase(id: string): void {
    this.actingId.set(id);
    this.confirmingId.set(null);
    this.purchaseError.set(null);
    this.successMsg.set(null);
  }

  private onPurchased(msg: string): void {
    this.actingId.set(null);
    this.successMsg.set(msg);
    // Aggiorna il saldo punti (badge "gettone" in header + saldi in pagina).
    this.auth.loadMe().subscribe();
  }

  private onPurchaseError(err: unknown): void {
    this.actingId.set(null);
    this.purchaseError.set(apiErrorMessage(err, 'Acquisto non riuscito.'));
  }

  // ── Ordine gadget (form di spedizione inline) ──

  protected openOrder(
    g: GadgetResource,
    currency: 'points' | 'euro' = 'points',
  ): void {
    if (g.outOfStock) return;
    if (
      currency === 'points' &&
      (g.pricePoints == null || !this.canAfford(g.pricePoints))
    ) {
      return;
    }
    if (currency === 'euro' && (g.priceEur == null || g.priceEur <= 0)) return;

    this.purchaseError.set(null);
    this.successMsg.set(null);
    this.shippingForm.reset({ country: 'Italia' });
    this.orderCurrency.set(currency);
    // Reset dello stato sconti/pagamento (un solo ordine aperto alla volta).
    this.appliedCodes.set([]);
    this.euroDiscounts.set(null);
    this.discountControl.reset('');
    this.discountError.set(null);
    this.paymentMethodControl.setValue('paypal');
    this.paymentReferenceControl.reset('');
    this.orderingGadgetId.set(g.id);

    if (currency === 'euro') {
      if (!this.paymentInfo()) {
        this.subscriptions.paymentInfo().subscribe({
          next: (info) => this.paymentInfo.set(info),
          error: () => undefined,
        });
      }
      this.shop.myVouchers().subscribe({
        next: (vs) => this.ownedVouchers.set(vs),
        error: () => this.ownedVouchers.set([]),
      });
    }
  }

  protected closeOrder(): void {
    this.orderingGadgetId.set(null);
  }

  // ── Sconti sull'ordine gadget in euro (riusa la macchina buoni) ──

  /** Prezzo euro effettivo (dopo eventuali sconti) del gadget in ordine. */
  protected effectivePrice(g: GadgetResource): number {
    return this.euroDiscounts()?.discountedPriceEur ?? g.priceEur ?? 0;
  }

  protected voucherValueLabel(v: MyVoucher): string {
    return v.kind === 'PERCENT' ? `${v.value}%` : `€${v.value}`;
  }

  /** Email destinataria del metodo di pagamento selezionato. */
  protected receiver(): string {
    const info = this.paymentInfo();
    if (!info) return '';
    return this.paymentMethodControl.value === 'skrill'
      ? info.receivers.skrill
      : info.receivers.paypal;
  }

  protected addVoucher(gadgetId: string, code: string): void {
    this.addCode(gadgetId, code);
  }

  protected addTyped(gadgetId: string): void {
    const code = this.discountControl.value.trim();
    if (!code) return;
    this.addCode(gadgetId, code);
    this.discountControl.reset('');
  }

  private addCode(gadgetId: string, code: string): void {
    const norm = code.trim().toUpperCase();
    if (!norm || this.appliedCodes().includes(norm)) return;
    this.appliedCodes.update((cs) => [...cs, norm]);
    this.revalidateDiscounts(gadgetId, norm);
  }

  protected removeCode(gadgetId: string, code: string): void {
    this.appliedCodes.update((cs) => cs.filter((c) => c !== code));
    this.revalidateDiscounts(gadgetId);
  }

  private revalidateDiscounts(gadgetId: string, justAdded?: string): void {
    // Invalida ogni validazione in volo: una risposta più vecchia che arriva dopo
    // (add/remove ravvicinati) non deve sovrascrivere il prezzo con codici diversi.
    const seq = ++this.discountSeq;
    if (!this.appliedCodes().length) {
      this.euroDiscounts.set(null);
      this.discountError.set(null);
      this.applyingDiscount.set(false);
      return;
    }
    this.applyingDiscount.set(true);
    this.discountError.set(null);
    this.shop.validateGadgetDiscounts(gadgetId, this.appliedCodes()).subscribe({
      next: (v) => {
        if (seq !== this.discountSeq) return; // risposta superata
        this.applyingDiscount.set(false);
        this.euroDiscounts.set(v);
      },
      error: (err: unknown) => {
        if (seq !== this.discountSeq) return; // risposta superata
        this.applyingDiscount.set(false);
        this.discountError.set(apiErrorMessage(err, 'Codice non valido.'));
        // Rollback del codice appena aggiunto: mantiene lo stato valido precedente.
        if (justAdded) {
          this.appliedCodes.update((cs) => cs.filter((c) => c !== justAdded));
          if (!this.appliedCodes().length) this.euroDiscounts.set(null);
        }
      },
    });
  }

  protected submitOrder(g: GadgetResource): void {
    if (this.shippingForm.invalid || this.actingId()) {
      this.shippingForm.markAllAsTouched();
      return;
    }
    this.startPurchase(`gadget:${g.id}`);
    const address = this.shippingForm.getRawValue() as ShippingAddress;
    const euro = this.orderCurrency() === 'euro';
    const opts = euro
      ? {
          paymentMethod: this.paymentMethodControl.value,
          paymentReference:
            this.paymentReferenceControl.value.trim() || undefined,
          discountCodes: this.appliedCodes(),
        }
      : undefined;
    this.shop.orderGadget(g.id, address, opts).subscribe({
      next: () => {
        this.orderingGadgetId.set(null);
        this.onPurchased(
          euro
            ? 'Ordine ricevuto! Ti confermiamo dopo la verifica del pagamento.'
            : 'Ordine ricevuto! Ti avviseremo alla spedizione.',
        );
        // Ricarica la vetrina: stock/esaurito riflettono l'acquisto.
        this.reload();
      },
      error: (err: unknown) => this.onPurchaseError(err),
    });
  }
}
