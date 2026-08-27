import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HandReportReason } from '../models/api.models';

const API = environment.API_URL;

/** Una segnalazione nella coda di moderazione. */
export interface HandReportRow {
  id: string;
  handId: string;
  handPublicId: string;
  motivo: HandReportReason;
  dettaglio: string;
  contatto: string;
  stato: 'APERTA' | 'ACCOLTA' | 'RESPINTA';
  decisionNote: string;
  createdAt: string;
  /**
   * ⚠️ **L'informazione da guardare per prima.** Una segnalazione senza account
   * viene quasi sempre da un **terzo** che si è trovato nominato in una mano:
   * non è un nostro iscritto, non ha altro canale, e non saprà mai se nessuno
   * legge. È il caso per cui la coda esiste.
   */
  senzaAccount: boolean;
  mano: {
    publicId: string;
    gameType: string;
    roomLabel: string;
    status: string;
    anonimizzata: boolean;
    players: { nome: string; posizione: string; isHero: boolean }[];
  } | null;
}

export interface HandReportPage {
  items: HandReportRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * La moderazione delle mani. ⚠️ Ogni decisione richiede un **motivo**: il DTO
 * lato server lo impone, e una chiamata senza risponde 400 — una decisione su
 * dati personali di terzi che nessuno può più spiegare non è una decisione.
 */
@Injectable({ providedIn: 'root' })
export class AdminHandsService {
  private readonly http = inject(HttpClient);

  /** ⚠️ Il predefinito lato server è `APERTA`: la coda È ciò che aspetta. */
  reports(page = 1, stato: 'APERTA' | 'TUTTE' = 'APERTA'): Observable<HandReportPage> {
    const params = new HttpParams().set('page', page).set('stato', stato);
    return this.http.get<HandReportPage>(`${API}/admin/hands/reports`, { params });
  }

  segnalazioniAperte(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${API}/admin/hands/reports/pending-count`);
  }

  rimuovi(handId: string, decisionNote: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${API}/admin/hands/${handId}/rimuovi`, {
      decisionNote,
    });
  }

  ripristina(handId: string, decisionNote: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(`${API}/admin/hands/${handId}/ripristina`, {
      decisionNote,
    });
  }

  /** ⚠️ Irreversibile: i nickname vengono sovrascritti, non nascosti. */
  anonimizza(handId: string): Observable<{ ok: true }> {
    return this.http.patch<{ ok: true }>(`${API}/admin/hands/${handId}/anonimizza`, {});
  }

  accogli(reportId: string, decisionNote: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API}/admin/hands/reports/${reportId}/accogli`,
      { decisionNote },
    );
  }

  respingi(reportId: string, decisionNote: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API}/admin/hands/reports/${reportId}/respingi`,
      { decisionNote },
    );
  }
}
