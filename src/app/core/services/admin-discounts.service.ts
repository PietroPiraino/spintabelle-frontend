import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DiscountAudience,
  DiscountCode,
  DiscountCodeDetail,
  DiscountCodePayload,
  Paginated,
} from '../models/api.models';

const API = environment.API_URL;

/** Gestione codici sconto dal pannello admin (rotte ADMIN-only su /admin/discounts). */
@Injectable({ providedIn: 'root' })
export class AdminDiscountsService {
  private readonly http = inject(HttpClient);

  list(filters?: {
    q?: string;
    audience?: DiscountAudience;
    active?: boolean;
    page?: number;
    limit?: number;
  }): Observable<Paginated<DiscountCode>> {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.audience) params = params.set('audience', filters.audience);
    if (filters?.active !== undefined)
      params = params.set('active', filters.active);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    return this.http.get<Paginated<DiscountCode>>(`${API}/admin/discounts`, {
      params,
    });
  }

  getOne(id: string): Observable<DiscountCodeDetail> {
    return this.http.get<DiscountCodeDetail>(`${API}/admin/discounts/${id}`);
  }

  create(payload: DiscountCodePayload): Observable<DiscountCode> {
    return this.http.post<DiscountCode>(`${API}/admin/discounts`, payload);
  }

  update(
    id: string,
    payload: Partial<DiscountCodePayload>,
  ): Observable<DiscountCode> {
    return this.http.patch<DiscountCode>(
      `${API}/admin/discounts/${id}`,
      payload,
    );
  }

  remove(id: string): Observable<{ ok: true; softDeleted: boolean }> {
    return this.http.delete<{ ok: true; softDeleted: boolean }>(
      `${API}/admin/discounts/${id}`,
    );
  }

  addEligibility(
    id: string,
    userIds: string[],
  ): Observable<{ added: number; eligibles: DiscountCodeDetail['eligibles'] }> {
    return this.http.post<{
      added: number;
      eligibles: DiscountCodeDetail['eligibles'];
    }>(`${API}/admin/discounts/${id}/eligibility`, { userIds });
  }

  removeEligibility(
    id: string,
    userId: string,
  ): Observable<{ ok: true; eligibles: DiscountCodeDetail['eligibles'] }> {
    return this.http.delete<{
      ok: true;
      eligibles: DiscountCodeDetail['eligibles'];
    }>(`${API}/admin/discounts/${id}/eligibility/${userId}`);
  }
}
