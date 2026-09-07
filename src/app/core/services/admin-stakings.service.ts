import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Paginated,
  StakingDettaglio,
  StakingMovimento,
  StakingRow,
  StakingStato,
  StakingTipo,
} from '../models/api.models';

const API = environment.API_URL;

/**
 * Il registro degli staking (rotte ADMIN-only su /admin/stakings).
 *
 * ⚠️ Gli importi viaggiano in CENTESIMI INTERI in entrambe le direzioni: la
 * conversione in euro vive in un punto solo, `staking-format.ts`, sul bordo
 * dell'interfaccia.
 */
@Injectable({ providedIn: 'root' })
export class AdminStakingsService {
  private readonly http = inject(HttpClient);

  list(filtri?: {
    stato?: StakingStato;
    page?: number;
    limit?: number;
  }): Observable<Paginated<StakingRow>> {
    let params = new HttpParams();
    if (filtri?.stato) params = params.set('stato', filtri.stato);
    if (filtri?.page) params = params.set('page', filtri.page);
    if (filtri?.limit) params = params.set('limit', filtri.limit);
    return this.http.get<Paginated<StakingRow>>(`${API}/admin/stakings`, {
      params,
    });
  }

  dettaglio(id: string): Observable<StakingDettaglio> {
    return this.http.get<StakingDettaglio>(`${API}/admin/stakings/${id}`);
  }

  /**
   * ⚠️ Torna la riga aggiornata INSIEME al movimento: senza, il client
   * dovrebbe rileggere il dettaglio con una seconda chiamata, e fra le due
   * l'anteprima del saldo mentirebbe.
   */
  aggiungiMovimento(
    id: string,
    body: { tipo: StakingTipo; importoCent: number; causale: string },
  ): Observable<{ riga: StakingRow; movimento: StakingMovimento }> {
    return this.http.post<{ riga: StakingRow; movimento: StakingMovimento }>(
      `${API}/admin/stakings/${id}/movimenti`,
      body,
    );
  }

  chiudi(id: string): Observable<StakingRow> {
    return this.http.post<StakingRow>(`${API}/admin/stakings/${id}/chiudi`, {});
  }

  riapri(id: string): Observable<StakingRow> {
    return this.http.post<StakingRow>(`${API}/admin/stakings/${id}/riapri`, {});
  }

  nota(id: string, nota: string): Observable<StakingRow> {
    return this.http.patch<StakingRow>(`${API}/admin/stakings/${id}/nota`, {
      nota,
    });
  }
}
