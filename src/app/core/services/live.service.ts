import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LiveSession, LiveSessionPayload } from '../models/api.models';

const API = environment.API_URL;

/** Sessioni live: lettura per tutti gli autenticati, mutazioni ADMIN. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly http = inject(HttpClient);

  /**
   * Sessioni: di default solo imminenti/in corso (vista utente). Con
   * includePast l'admin riceve anche le passate (per gestirle).
   */
  getSessions(includePast = false): Observable<LiveSession[]> {
    let params = new HttpParams();
    if (includePast) params = params.set('includePast', 'true');
    return this.http.get<LiveSession[]>(`${API}/live`, { params });
  }

  create(payload: LiveSessionPayload): Observable<LiveSession> {
    return this.http.post<LiveSession>(`${API}/live`, payload);
  }

  update(
    id: string,
    payload: Partial<LiveSessionPayload>,
  ): Observable<LiveSession> {
    return this.http.patch<LiveSession>(`${API}/live/${id}`, payload);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/live/${id}`);
  }
}
