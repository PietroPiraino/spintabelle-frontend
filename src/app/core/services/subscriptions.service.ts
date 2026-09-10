import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateSubscriptionRequest,
  DiscountValidation,
  DiscountsValidation,
  Incassante,
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

  /** Valida più buoni cumulati e ottiene il prezzo finale (regola €-vs-%). */
  validateDiscounts(
    codes: string[],
    tier: SubscriptionTier,
  ): Observable<DiscountsValidation> {
    return this.http.post<DiscountsValidation>(
      `${API}/subscriptions/validate-discounts`,
      { codes, tier },
    );
  }

  /** Ritira la propria richiesta in attesa (rilascia i buoni riservati). */
  withdraw(): Observable<SubscriptionRequest> {
    return this.http.post<SubscriptionRequest>(
      `${API}/subscriptions/withdraw`,
      {},
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

  /**
   * Corregge un incasso già registrato.
   *
   * ⚠️ È la **prima** interfaccia di una rotta che esisteva dal 10/09/2026 e che
   * nessun client chiamava: `incassatoDa` era raccolto, dichiarato nel registro
   * dei trattamenti e **invisibile in tutto il sito**.
   *
   * ⚠️ `motivo` è obbligatorio e non è burocrazia: la correzione è IN PLACE,
   * quindi senza la coppia before/after dell'audit «quanto c'era scritto prima»
   * sarebbe perduto per sempre — e su un contante non esiste alcun estratto
   * conto da cui ricostruirlo.
   *
   * ⚠️ I campi facoltativi si mandano SOLO se presenti: `forbidNonWhitelisted`
   * è globale e un `undefined` esplicito farebbe fallire l'INTERA chiamata.
   *
   * ⚠️⚠️ `dataIncasso` scrive `decidedAt`, cioè **sposta la riga di MESE**: chi
   * la usa deve ricaricare il mese, o resta a guardare un elenco che non
   * contiene più quella riga.
   */
  correggiIncasso(
    id: string,
    patch: {
      importoEur?: number;
      incassatoDa?: Incassante;
      paymentReference?: string;
      dataIncasso?: string;
    },
    motivo: string,
  ): Observable<SubscriptionRequest> {
    return this.http.patch<SubscriptionRequest>(
      `${API}/admin/subscription-requests/${id}/incasso`,
      {
        ...(patch.importoEur !== undefined
          ? { importoEur: patch.importoEur }
          : {}),
        ...(patch.incassatoDa ? { incassatoDa: patch.incassatoDa } : {}),
        ...(patch.paymentReference !== undefined
          ? { paymentReference: patch.paymentReference }
          : {}),
        ...(patch.dataIncasso ? { dataIncasso: patch.dataIncasso } : {}),
        motivo,
      },
    );
  }
}
