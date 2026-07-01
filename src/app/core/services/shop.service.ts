import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DiscountsValidation,
  GadgetFulfillStatus,
  GadgetPayload,
  GadgetResource,
  MyVoucher,
  Paginated,
  ShippingAddress,
  ShopCatalog,
  ShopOrder,
  ShopOrderStatus,
  ShopOrderType,
  ShopPaymentMethod,
  ShopVoucherType,
  SubscriptionTier,
} from '../models/api.models';

const API = environment.API_URL;

export interface GadgetListOpts {
  page?: number;
  limit?: number;
  q?: string;
}

export interface OrderListOpts {
  page?: number;
  limit?: number;
  q?: string;
  type?: ShopOrderType;
  status?: ShopOrderStatus;
}

/** Negozio: endpoint utente (/shop) e admin (/admin/shop). */
@Injectable({ providedIn: 'root' })
export class ShopService {
  private readonly http = inject(HttpClient);

  // ── Pubblico / vetrina ──

  /** PUBBLICO: catalogo buoni + abbonamenti (prezzi in punti). */
  catalog(): Observable<ShopCatalog> {
    return this.http.get<ShopCatalog>(`${API}/shop/catalog`);
  }

  /** PUBBLICO: vetrina gadget (solo attivi), paginata. */
  gadgets(opts: GadgetListOpts = {}): Observable<Paginated<GadgetResource>> {
    let params = new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? 24);
    if (opts.q) params = params.set('q', opts.q);
    return this.http.get<Paginated<GadgetResource>>(`${API}/shop/gadgets`, {
      params,
    });
  }

  gadget(id: string): Observable<GadgetResource> {
    return this.http.get<GadgetResource>(`${API}/shop/gadgets/${id}`);
  }

  // ── Utente ──

  myVouchers(): Observable<MyVoucher[]> {
    return this.http.get<MyVoucher[]>(`${API}/shop/my-vouchers`);
  }

  myOrders(): Observable<ShopOrder[]> {
    return this.http.get<ShopOrder[]>(`${API}/shop/my-orders`);
  }

  buyVoucher(voucher: ShopVoucherType): Observable<ShopOrder> {
    return this.http.post<ShopOrder>(`${API}/shop/vouchers`, { voucher });
  }

  buySubscription(tier: SubscriptionTier): Observable<ShopOrder> {
    return this.http.post<ShopOrder>(`${API}/shop/subscription`, { tier });
  }

  orderGadget(
    id: string,
    shippingAddress: ShippingAddress,
    opts?: {
      paymentMethod?: ShopPaymentMethod;
      paymentReference?: string;
      discountCodes?: string[];
    },
  ): Observable<ShopOrder> {
    return this.http.post<ShopOrder>(`${API}/shop/gadgets/${id}/order`, {
      shippingAddress,
      ...(opts?.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
      ...(opts?.paymentReference
        ? { paymentReference: opts.paymentReference }
        : {}),
      ...(opts?.discountCodes?.length
        ? { discountCodes: opts.discountCodes }
        : {}),
    });
  }

  /** Anteprima sconti su un gadget in euro (prima del pagamento off-site). */
  validateGadgetDiscounts(
    id: string,
    codes: string[],
  ): Observable<DiscountsValidation> {
    return this.http.post<DiscountsValidation>(
      `${API}/shop/gadgets/${id}/validate-discounts`,
      { codes },
    );
  }

  // ── Admin: prodotti ──

  adminGadgets(opts: GadgetListOpts = {}): Observable<Paginated<GadgetResource>> {
    let params = new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? 25);
    if (opts.q) params = params.set('q', opts.q);
    return this.http.get<Paginated<GadgetResource>>(
      `${API}/admin/shop/gadgets`,
      { params },
    );
  }

  createGadget(payload: GadgetPayload, image: File): Observable<GadgetResource> {
    return this.http.post<GadgetResource>(
      `${API}/admin/shop/gadgets`,
      this.toFormData(payload, image),
    );
  }

  updateGadget(
    id: string,
    payload: Partial<GadgetPayload>,
    image?: File,
  ): Observable<GadgetResource> {
    return this.http.patch<GadgetResource>(
      `${API}/admin/shop/gadgets/${id}`,
      this.toFormData(payload, image),
    );
  }

  removeGadget(id: string): Observable<unknown> {
    return this.http.delete(`${API}/admin/shop/gadgets/${id}`);
  }

  // ── Admin: ordini ──

  listOrders(opts: OrderListOpts = {}): Observable<Paginated<ShopOrder>> {
    let params = new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? 25);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.type) params = params.set('type', opts.type);
    if (opts.status) params = params.set('status', opts.status);
    return this.http.get<Paginated<ShopOrder>>(`${API}/admin/shop/orders`, {
      params,
    });
  }

  setOrderStatus(
    id: string,
    status: GadgetFulfillStatus,
    trackingNote?: string,
  ): Observable<ShopOrder> {
    return this.http.post<ShopOrder>(`${API}/admin/shop/orders/${id}/status`, {
      status,
      trackingNote,
    });
  }

  cancelOrder(id: string, reason?: string): Observable<ShopOrder> {
    return this.http.post<ShopOrder>(`${API}/admin/shop/orders/${id}/cancel`, {
      reason,
    });
  }

  /** FormData per il multipart gadget; Angular imposta da sé il boundary. */
  private toFormData(payload: Partial<GadgetPayload>, image?: File): FormData {
    const fd = new FormData();
    if (payload.title !== undefined) fd.set('title', payload.title);
    if (payload.description !== undefined)
      fd.set('description', payload.description);
    if (payload.pricePoints !== undefined)
      fd.set('pricePoints', String(payload.pricePoints));
    // priceEur solo se definito: Number('') === 0 renderebbe gratis il gadget.
    if (payload.priceEur !== undefined)
      fd.set('priceEur', String(payload.priceEur));
    if (payload.stock !== undefined) fd.set('stock', String(payload.stock));
    if (payload.active !== undefined) fd.set('active', String(payload.active));
    if (image) fd.set('image', image, image.name);
    return fd;
  }
}
