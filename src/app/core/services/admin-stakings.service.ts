import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Cassa,
  ElencoStakings,
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

  /**
   * ⚠️ L'envelope porta anche i due TOTALI di fondi ed EV, calcolati dal server
   * sull'intero insieme filtrato: non esiste una `GET /admin/stakings/totali`
   * gemella, e non va aggiunta — sarebbe una seconda lettura che può dissentire
   * dalla prima proprio su una cifra di denaro (idioma di `pausaFino`
   * sull'elenco della redazione).
   */
  list(filtri?: {
    stato?: StakingStato;
    page?: number;
    limit?: number;
  }): Observable<ElencoStakings> {
    let params = new HttpParams();
    if (filtri?.stato) params = params.set('stato', filtri.stato);
    if (filtri?.page) params = params.set('page', filtri.page);
    if (filtri?.limit) params = params.set('limit', filtri.limit);
    return this.http.get<ElencoStakings>(`${API}/admin/stakings`, {
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
    // ⚠️ `cassa` MANCAVA in questo tipo mentre il componente la mandava: uno
    // spread condizionale aggira il controllo sulle proprietà in eccesso, quindi
    // compilava e il tipo mentiva. Obbligatoria sui FONDI (il server risponde
    // 400 senza), rifiutata sugli altri due assi.
    body: {
      tipo: StakingTipo;
      importoCent: number;
      causale: string;
      cassa?: Cassa;
    },
  ): Observable<{ riga: StakingRow; movimento: StakingMovimento }> {
    return this.http.post<{ riga: StakingRow; movimento: StakingMovimento }>(
      `${API}/admin/stakings/${id}/movimenti`,
      body,
    );
  }

  /**
   * Attribuisce la tasca a un movimento di fondi scritto prima che il campo
   * esistesse.
   *
   * ⚠️ L'id è quello del MOVIMENTO, non della riga di staking: la rotta è
   * `movimenti/:id/cassa` e non `:id/movimenti/…`.
   *
   * ⚠️ Una volta sola: il server guarda la scrittura su `cassa` ASSENTE e
   * risponde **409** se è già attribuita. Non è una correzione, è il
   * completamento di un'annotazione mai esistita — se si sbaglia tasca la via
   * d'uscita è una coppia di movimenti compensativi.
   */
  attribuisciCassa(
    movimentoId: string,
    cassa: Cassa,
  ): Observable<StakingMovimento> {
    return this.http.patch<StakingMovimento>(
      `${API}/admin/stakings/movimenti/${movimentoId}/cassa`,
      { cassa },
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
