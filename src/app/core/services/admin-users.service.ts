import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminActionLogEntry,
  AdminUser,
  Paginated,
  Role,
  SubscriptionRequest,
  SubscriptionTier,
} from '../models/api.models';

const API = environment.API_URL;

/** Gestione iscritti dal pannello admin (rotte ADMIN-only su /admin/users). */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);

  list(filters?: {
    q?: string;
    role?: Role;
    expiring?: number;
    page?: number;
    limit?: number;
  }): Observable<Paginated<AdminUser>> {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.role) params = params.set('role', filters.role);
    if (filters?.expiring) params = params.set('expiring', filters.expiring);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    return this.http.get<Paginated<AdminUser>>(`${API}/admin/users`, { params });
  }

  updateRole(id: string, role: Role): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API}/admin/users/${id}/role`, { role });
  }

  /** Imposta (ISO) o rimuove (null) la scadenza abbonamento. */
  setSubscriptionExpiry(
    id: string,
    expiresAt: string | null,
    notify?: boolean,
  ): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API}/admin/users/${id}/subscription`, {
      expiresAt,
      ...(notify ? { notify: true } : {}),
    });
  }

  /** Concessione manuale di un abbonamento (tier + scadenza assoluta). */
  grantSubscription(
    id: string,
    tier: SubscriptionTier,
    expiresAt: string,
    note?: string,
  ): Observable<AdminUser> {
    return this.http.post<AdminUser>(
      `${API}/admin/users/${id}/grant-subscription`,
      { tier, expiresAt, ...(note ? { note } : {}) },
    );
  }

  /** Rettifica email / nickname / verificato. */
  updateProfile(
    id: string,
    patch: { email?: string; nickname?: string; verified?: boolean },
  ): Observable<AdminUser> {
    return this.http.patch<AdminUser>(
      `${API}/admin/users/${id}/profile`,
      patch,
    );
  }

  /** Storico richieste di abbonamento dell'utente. */
  subscriptionRequests(id: string): Observable<SubscriptionRequest[]> {
    return this.http.get<SubscriptionRequest[]>(
      `${API}/admin/users/${id}/subscription-requests`,
    );
  }

  /** Storico azioni admin sull'utente (audit). */
  auditLog(id: string): Observable<AdminActionLogEntry[]> {
    return this.http.get<AdminActionLogEntry[]>(
      `${API}/admin/users/${id}/audit`,
    );
  }

  /** Log globale paginato di tutte le azioni admin. */
  auditAll(
    page = 1,
    limit = 25,
  ): Observable<Paginated<AdminActionLogEntry>> {
    let params = new HttpParams();
    params = params.set('page', page);
    params = params.set('limit', limit);
    return this.http.get<Paginated<AdminActionLogEntry>>(`${API}/admin/audit`, {
      params,
    });
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/admin/users/${id}`);
  }

  resendVerification(id: string): Observable<unknown> {
    return this.http.post(`${API}/admin/users/${id}/resend-verification`, {});
  }
}
