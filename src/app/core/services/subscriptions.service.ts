import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateSubscriptionRequest,
  DiscountValidation,
  MySubscription,
  Paginated,
  PaymentInfo,
  SubscriptionPlans,
  SubscriptionRequest,
  SubscriptionRequestStatus,
  SubscriptionTier,
} from '../models/api.models';

const API = environment.API_URL;

/** Abbonamenti: endpoint utente (/subscriptions) e admin (/admin/subscription-requests). */
@Injectable({ providedIn: 'root' })
export class SubscriptionsService {
  private readonly http = inject(HttpClient);

  // ── Pubblico ──

  /** PUBBLICO: piani + prezzi + durata per le card (niente login). */
  plans(): Observable<SubscriptionPlans> {
    return this.http.get<SubscriptionPlans>(`${API}/subscriptions/plans`);
  }

  // ── Utente ──

  /** Email destinatarie PayPal/Skrill + prezzi + durata (loggato). */
  paymentInfo(): Observable<PaymentInfo> {
    return this.http.get<PaymentInfo>(`${API}/subscriptions/payment-info`);
  }

  /** Stato abbonamento + eventuale richiesta in attesa. */
  mySubscription(): Observable<MySubscription> {
    return this.http.get<MySubscription>(`${API}/subscriptions/me`);
  }

  createRequest(
    payload: CreateSubscriptionRequest,
  ): Observable<SubscriptionRequest> {
    return this.http.post<SubscriptionRequest>(
      `${API}/subscriptions/request`,
      payload,
    );
  }

  /** Valida un codice sconto e ottiene il prezzo scontato (prima del pagamento). */
  validateDiscount(
    code: string,
    tier: SubscriptionTier,
  ): Observable<DiscountValidation> {
    return this.http.post<DiscountValidation>(
      `${API}/subscriptions/validate-discount`,
      { code, tier },
    );
  }

  // ── Admin ──

  listRequests(filters?: {
    status?: SubscriptionRequestStatus;
    q?: string;
    page?: number;
    limit?: number;
  }): Observable<Paginated<SubscriptionRequest>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    return this.http.get<Paginated<SubscriptionRequest>>(
      `${API}/admin/subscription-requests`,
      { params },
    );
  }

  approve(id: string): Observable<SubscriptionRequest> {
    return this.http.post<SubscriptionRequest>(
      `${API}/admin/subscription-requests/${id}/approve`,
      {},
    );
  }

  reject(id: string, note?: string): Observable<SubscriptionRequest> {
    return this.http.post<SubscriptionRequest>(
      `${API}/admin/subscription-requests/${id}/reject`,
      note ? { note } : {},
    );
  }
}
