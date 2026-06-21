import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import {
  GadgetResource,
  Role,
  ShippingAddress,
  ShopCatalog,
  ShopVoucherType,
  SubscriptionTier,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ShopService } from '../../core/services/shop.service';
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

  private page = 1;
  /** Scarta le risposte superate da una ricerca più recente. */
  private requestSeq = 0;
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

  protected openOrder(g: GadgetResource): void {
    if (g.outOfStock || !this.canAfford(g.pricePoints)) return;
    this.purchaseError.set(null);
    this.successMsg.set(null);
    this.shippingForm.reset({ country: 'Italia' });
    this.orderingGadgetId.set(g.id);
  }

  protected closeOrder(): void {
    this.orderingGadgetId.set(null);
  }

  protected submitOrder(g: GadgetResource): void {
    if (this.shippingForm.invalid || this.actingId()) {
      this.shippingForm.markAllAsTouched();
      return;
    }
    this.startPurchase(`gadget:${g.id}`);
    const address = this.shippingForm.getRawValue() as ShippingAddress;
    this.shop.orderGadget(g.id, address).subscribe({
      next: () => {
        this.orderingGadgetId.set(null);
        this.onPurchased('Ordine ricevuto! Ti avviseremo alla spedizione.');
        // Ricarica la vetrina: stock/esaurito riflettono l'acquisto.
        this.reload();
      },
      error: (err: unknown) => this.onPurchaseError(err),
    });
  }
}
