import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
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
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  GadgetFulfillStatus,
  GadgetPayload,
  GadgetResource,
  Paginated,
  ShopOrder,
  ShopOrderStatus,
  ShopOrderType,
} from '../../../core/models/api.models';
import { ShopService } from '../../../core/services/shop.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

/** Elementi per pagina (pager classico, come iscritti/lezioni/richieste). */
const PAGE_SIZE = 25;

/** Tetto upload immagine lato client (come admin-documents). */
const MAX_MB = 5;

type ShopView = 'prodotti' | 'ordini';

type TypeFilter = 'all' | ShopOrderType;
type StatusFilter = 'all' | ShopOrderStatus;

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'VOUCHER', label: 'Buoni' },
  { key: 'SUBSCRIPTION', label: 'Abbonamenti' },
  { key: 'GADGET', label: 'Gadget' },
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tutti' },
  { key: 'RICEVUTO', label: 'Ricevuto' },
  { key: 'SPEDITO', label: 'Spedito' },
  { key: 'CONSEGNATO', label: 'Consegnato' },
  { key: 'ANNULLATO', label: 'Annullato' },
  { key: 'COMPLETED', label: 'Completato' },
];

@Component({
  selector: 'app-admin-shop',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-shop.component.html',
  styleUrls: ['../admin-shared.scss', './admin-shop.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminShopComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ShopService);

  protected readonly maxMb = MAX_MB;

  /** Sotto-vista attiva: catalogo prodotti o lista ordini. */
  protected readonly view = signal<ShopView>('prodotti');

  // ── Prodotti (gadget CRUD) ──

  protected readonly prodPage = signal<Paginated<GadgetResource> | null>(null);
  protected readonly prodLoading = signal(false);
  protected readonly prodListError = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly prodError = signal<string | null>(null);
  protected readonly prodFeedback = signal<string | null>(null);
  /** Conferma eliminazione inline (id del gadget da eliminare). */
  protected readonly confirmDeleteId = signal<string | null>(null);
  /** Immagine scelta nel form (null = nessuna; in modifica = mantieni quella attuale). */
  protected readonly selectedImage = signal<File | null>(null);
  private readonly prodPageNum = signal(1);

  protected readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(120)],
    ],
    description: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
    ],
    /** Vuoto = non acquistabile con i punti (serve almeno un prezzo: punti o euro). */
    pricePoints: [null as number | null, [Validators.min(1)]],
    /** Vuoto = non acquistabile in euro. */
    priceEur: [null as number | null, [Validators.min(0)]],
    /** Vuoto = stock illimitato. */
    stock: [null as number | null, [Validators.min(0)]],
    active: [true],
  });

  // ── Ordini ──

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');

  protected readonly ordPage = signal<Paginated<ShopOrder> | null>(null);
  protected readonly ordLoading = signal(false);
  protected readonly ordError = signal<string | null>(null);
  protected readonly ordFeedback = signal<string | null>(null);
  /** Id dell'ordine su cui è in corso un'azione (evasione/annullamento). */
  protected readonly actingId = signal<string | null>(null);
  /** Riga con input nota di tracking aperto. */
  protected readonly trackingId = signal<string | null>(null);
  /** Riga con conferma annullamento aperta. */
  protected readonly cancelId = signal<string | null>(null);

  protected readonly typeFilters = TYPE_FILTERS;
  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly statusFilter = signal<StatusFilter>('all');
  private readonly ordPageNum = signal(1);

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.ordPageNum.set(1);
        this.loadOrders();
      });
    this.loadProducts();
  }

  // ── Switch vista ──

  protected setView(v: ShopView): void {
    if (this.view() === v) return;
    this.view.set(v);
    if (v === 'ordini' && !this.ordPage()) this.loadOrders();
    if (v === 'prodotti' && !this.prodPage()) this.loadProducts();
  }

  // ─────────────────────────────── PRODOTTI ───────────────────────────────

  private loadProducts(): void {
    this.prodLoading.set(true);
    this.prodListError.set(null);
    this.api.adminGadgets({ page: this.prodPageNum(), limit: PAGE_SIZE }).subscribe({
      next: (page) => {
        this.prodPage.set(page);
        this.prodLoading.set(false);
      },
      error: (err: unknown) => {
        this.prodLoading.set(false);
        this.prodPageNum.set(this.prodPage()?.page ?? 1);
        this.prodListError.set(
          apiErrorMessage(err, 'Caricamento prodotti non riuscito.'),
        );
      },
    });
  }

  protected goToProdPage(n: number): void {
    const total = this.prodPage()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.prodPageNum()) return;
    this.prodPageNum.set(n);
    this.loadProducts();
  }

  protected stockLabel(stock: number | null): string {
    return stock == null ? '∞' : String(stock);
  }

  /** Prezzi del gadget (punti e/o euro) come stringa compatta per la lista. */
  protected priceLabel(g: GadgetResource): string {
    const parts: string[] = [];
    if (g.pricePoints != null) parts.push(`${g.pricePoints} pt`);
    if (g.priceEur != null) parts.push(`€${g.priceEur}`);
    return parts.join(' · ') || '—';
  }

  /** Importo di un ordine: euro (con metodo) per gli ordini off-site, altrimenti punti. */
  protected orderAmountLabel(o: ShopOrder): string {
    if (o.amountEur != null) {
      const m =
        o.paymentMethod && o.paymentMethod !== 'punti'
          ? ` (${o.paymentMethod})`
          : '';
      return `€${o.amountEur.toFixed(2)}${m}`;
    }
    return `−${o.pointsSpent} pt`;
  }

  protected onImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && file.size > MAX_MB * 1024 * 1024) {
      this.prodError.set(`L'immagine supera il limite di ${MAX_MB} MB.`);
      this.selectedImage.set(null);
      input.value = '';
      return;
    }
    this.prodError.set(null);
    this.selectedImage.set(file);
  }

  protected editProduct(g: GadgetResource): void {
    this.editingId.set(g.id);
    this.prodFeedback.set(null);
    this.prodError.set(null);
    this.selectedImage.set(null);
    this.form.patchValue({
      title: g.title,
      description: g.description,
      pricePoints: g.pricePoints,
      priceEur: g.priceEur,
      stock: g.stock,
      active: g.active,
    });
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.selectedImage.set(null);
    this.form.reset({
      pricePoints: null,
      priceEur: null,
      stock: null,
      active: true,
    });
    this.prodError.set(null);
  }

  protected submitProduct(): void {
    const id = this.editingId();
    // In creazione l'immagine è obbligatoria; in modifica è opzionale.
    if (this.form.invalid || this.saving() || (!id && !this.selectedImage())) {
      this.form.markAllAsTouched();
      if (!id && !this.selectedImage()) {
        this.prodError.set("Seleziona un'immagine per il prodotto.");
      }
      return;
    }
    const raw = this.form.getRawValue();
    // Serve almeno un prezzo (in punti o in euro): un gadget senza prezzo non è ordinabile.
    const hasPoints = raw.pricePoints != null && raw.pricePoints >= 1;
    const hasEur = raw.priceEur != null && raw.priceEur > 0;
    if (!hasPoints && !hasEur) {
      this.prodError.set('Imposta almeno un prezzo: in punti o in euro.');
      return;
    }
    this.saving.set(true);
    this.prodError.set(null);
    this.prodFeedback.set(null);

    const payload: GadgetPayload = {
      title: raw.title,
      description: raw.description,
      active: raw.active,
    };
    if (hasPoints) payload.pricePoints = raw.pricePoints!;
    // priceEur: 0 in modifica rimuove il prezzo in euro; se assente non lo tocchiamo.
    if (raw.priceEur != null) payload.priceEur = raw.priceEur;
    // Stock vuoto = illimitato: ometti il campo.
    if (raw.stock != null) payload.stock = raw.stock;

    const image = this.selectedImage();
    const request$ = id
      ? this.api.updateGadget(id, payload, image ?? undefined)
      : this.api.createGadget(payload, image!);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.prodFeedback.set(id ? 'Prodotto aggiornato.' : 'Prodotto creato.');
        this.cancelEdit();
        // Un prodotto nuovo appare in cima: torna a pagina 1.
        if (!id) this.prodPageNum.set(1);
        this.loadProducts();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.prodError.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected askDelete(g: GadgetResource): void {
    this.confirmDeleteId.set(g.id);
  }

  protected cancelDelete(): void {
    this.confirmDeleteId.set(null);
  }

  protected confirmDelete(g: GadgetResource): void {
    this.confirmDeleteId.set(null);
    this.api.removeGadget(g.id).subscribe({
      next: () => {
        this.prodFeedback.set('Prodotto eliminato.');
        if (this.editingId() === g.id) this.cancelEdit();
        const p = this.prodPage();
        if (p && p.items.length === 1 && p.page > 1) {
          this.prodPageNum.set(p.page - 1);
        }
        this.loadProducts();
      },
      error: (err: unknown) =>
        this.prodError.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }

  // ─────────────────────────────── ORDINI ───────────────────────────────

  private loadOrders(): void {
    this.ordLoading.set(true);
    this.ordError.set(null);
    const type = this.typeFilter();
    const status = this.statusFilter();
    this.api
      .listOrders({
        page: this.ordPageNum(),
        limit: PAGE_SIZE,
        q: this.query() || undefined,
        type: type === 'all' ? undefined : type,
        status: status === 'all' ? undefined : status,
      })
      .subscribe({
        next: (page) => {
          this.ordPage.set(page);
          this.ordLoading.set(false);
        },
        error: (err: unknown) => {
          this.ordLoading.set(false);
          this.ordPageNum.set(this.ordPage()?.page ?? 1);
          this.ordError.set(
            apiErrorMessage(err, 'Caricamento ordini non riuscito.'),
          );
        },
      });
  }

  protected setTypeFilter(t: TypeFilter): void {
    if (this.typeFilter() === t) return;
    this.typeFilter.set(t);
    this.ordPageNum.set(1);
    this.ordFeedback.set(null);
    this.ordError.set(null);
    this.loadOrders();
  }

  protected setStatusFilter(s: StatusFilter): void {
    if (this.statusFilter() === s) return;
    this.statusFilter.set(s);
    this.ordPageNum.set(1);
    this.ordFeedback.set(null);
    this.ordError.set(null);
    this.loadOrders();
  }

  protected goToOrdPage(n: number): void {
    const total = this.ordPage()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.ordPageNum()) return;
    this.ordPageNum.set(n);
    this.loadOrders();
  }

  /** Un ordine gadget è ancora evadibile finché non è consegnato/annullato. */
  protected canFulfill(o: ShopOrder): boolean {
    return (
      o.type === 'GADGET' &&
      o.status !== 'CONSEGNATO' &&
      o.status !== 'ANNULLATO'
    );
  }

  protected statusChipClass(status: ShopOrderStatus): string {
    return `shop-chip shop-chip--${status.toLowerCase()}`;
  }

  // Nota di tracking inline per "Segna spedito".

  protected toggleTracking(o: ShopOrder): void {
    this.trackingId.set(this.trackingId() === o.id ? null : o.id);
    this.cancelId.set(null);
  }

  protected markShipped(o: ShopOrder, note: string): void {
    this.runFulfill(o, 'SPEDITO', note.trim() || undefined);
  }

  protected markDelivered(o: ShopOrder): void {
    this.runFulfill(o, 'CONSEGNATO');
  }

  private runFulfill(
    o: ShopOrder,
    status: GadgetFulfillStatus,
    note?: string,
  ): void {
    if (this.actingId()) return;
    this.actingId.set(o.id);
    this.ordError.set(null);
    this.ordFeedback.set(null);
    this.api.setOrderStatus(o.id, status, note).subscribe({
      next: (updated) => {
        this.actingId.set(null);
        this.trackingId.set(null);
        this.ordFeedback.set(
          `Ordine di ${updated.userNickname || updated.userEmail} aggiornato a "${updated.statusLabel}".`,
        );
        this.loadOrders();
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.ordError.set(apiErrorMessage(err, 'Aggiornamento non riuscito.'));
      },
    });
  }

  // Annullamento + rimborso inline.

  protected toggleCancel(o: ShopOrder): void {
    this.cancelId.set(this.cancelId() === o.id ? null : o.id);
    this.trackingId.set(null);
  }

  protected confirmCancel(o: ShopOrder, reason: string): void {
    if (this.actingId()) return;
    this.actingId.set(o.id);
    this.ordError.set(null);
    this.ordFeedback.set(null);
    this.api.cancelOrder(o.id, reason.trim() || undefined).subscribe({
      next: (updated) => {
        this.actingId.set(null);
        this.cancelId.set(null);
        const who = updated.userNickname || updated.userEmail;
        // Ordine in euro: nessun punto da rimborsare (rimborso off-site manuale).
        this.ordFeedback.set(
          updated.amountEur != null
            ? `Ordine annullato: eventuali buoni rilasciati. Il rimborso in euro va gestito off-site.`
            : `Ordine annullato: rimborsati ${
                updated.refundedPoints ?? updated.pointsSpent
              } pt a ${who}.`,
        );
        this.loadOrders();
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.ordError.set(apiErrorMessage(err, 'Annullamento non riuscito.'));
      },
    });
  }
}
