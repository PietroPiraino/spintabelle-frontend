import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LiveSession, LiveSessionPayload } from '../models/api.models';

const API = environment.API_URL;

/** Sessioni live: lettura per tutti gli autenticati, mutazioni ADMIN. */
@Injectable({ providedIn: 'root' })
export class LiveService {
  private readonly http = inject(HttpClient);

  /** Sessioni in arrivo/in corso, ordinate per inizio crescente. */
  getSessions(): Observable<LiveSession[]> {
    return this.http.get<LiveSession[]>(`${API}/live`);
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
