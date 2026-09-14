import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdjustPointsResult, MyPoints } from '../models/api.models';

const API = environment.API_URL;

/** Punti BFF: saldo+storico utente, rettifica manuale admin. */
@Injectable({ providedIn: 'root' })
export class PointsService {
  private readonly http = inject(HttpClient);

  /**
   * Saldo e movimenti dell'utente loggato, paginati dal più recente. Senza
   * parametri il server risponde come sempre (prima pagina di 20): la chiamata
   * resta identica per chi non sfoglia.
   */
  myPoints(page?: number, limit?: number): Observable<MyPoints> {
    const params: Record<string, string> = {};
    if (page) params['page'] = String(page);
    if (limit) params['limit'] = String(limit);
    return this.http.get<MyPoints>(`${API}/points/me`, { params });
  }

  /** Accredito (delta>0) o storno (delta<0) sul saldo di un utente. */
  adjust(
    userId: string,
    delta: number,
    reason: string,
  ): Observable<AdjustPointsResult> {
    return this.http.post<AdjustPointsResult>(
      `${API}/admin/points/${userId}/adjust`,
      { delta, reason },
    );
  }
}
