import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUser, Paginated, Role } from '../models/api.models';

const API = environment.API_URL;

/** Gestione iscritti dal pannello admin (rotte ADMIN-only su /admin/users). */
@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);

  list(filters?: {
    q?: string;
    page?: number;
    limit?: number;
  }): Observable<Paginated<AdminUser>> {
    let params = new HttpParams();
    if (filters?.q) params = params.set('q', filters.q);
    if (filters?.page) params = params.set('page', filters.page);
    if (filters?.limit) params = params.set('limit', filters.limit);
    return this.http.get<Paginated<AdminUser>>(`${API}/admin/users`, { params });
  }

  updateRole(id: string, role: Role): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${API}/admin/users/${id}/role`, { role });
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/admin/users/${id}`);
  }

  resendVerification(id: string): Observable<unknown> {
    return this.http.post(`${API}/admin/users/${id}/resend-verification`, {});
  }
}
