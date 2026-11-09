import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnnuncioAwards,
  AnteprimaInvito,
  AwardsCategoria,
  AwardsMio,
  CandidatoAdmin,
  CandidatoConLink,
  CategoriaSpoglio,
  DateAwards,
  EdizioneAwards,
  EdizioneAwardsAdmin,
  EsitoAnnuncio,
  PropostaAwards,
  StatoAnnuncio,
} from '../models/awards.models';

/** I 3 Max Hyper Awards (voce di registro A20). */
@Injectable({ providedIn: 'root' })
export class AwardsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.API_URL}/awards`;

  /**
   * ⚠️ Pubblica, e parte **anche durante il prerender**: la pagina `/awards` è
   * prerenderizzata e la risposta finisce nell'HTML statico. ⚠️ `/awards` è
   * ESCLUSO dalla transfer cache (`app.config.ts`): fase, finalisti e vincitori
   * cambiano senza deploy, e senza il secondo giro all'idratazione la pagina
   * resterebbe ferma al giorno del build.
   */
  edizione(): Observable<EdizioneAwards> {
    return this.http.get<EdizioneAwards>(`${this.base}/edizione`);
  }

  /** Le mie proposte, i miei voti, le mie candidature (JWT). */
  mio(): Observable<AwardsMio> {
    return this.http.get<AwardsMio>(`${this.base}/me`);
  }

  /** Salva le proposte: una per categoria, nickname vuoto = togli. */
  salvaProposte(proposte: PropostaAwards[]): Observable<PropostaAwards[]> {
    return this.http.put<PropostaAwards[]>(`${this.base}/proposte`, {
      proposte,
    });
  }

  // ── Invito ────────────────────────────────────────────────────────────────
  // ⚠️ Il token viaggia SEMPRE nel corpo di una POST, mai nell'URL.

  /** Pubblica: basta il token. */
  anteprimaInvito(token: string): Observable<AnteprimaInvito> {
    return this.http.post<AnteprimaInvito>(`${this.base}/invito/anteprima`, {
      token,
    });
  }

  /** Pubblica: rifiutare non richiede un account. */
  rifiutaInvito(token: string): Observable<void> {
    return this.http.post<void>(`${this.base}/invito/rifiuta`, { token });
  }

  /** JWT: accettare collega la candidatura al tuo account. */
  accettaInvito(
    token: string,
    categorie: AwardsCategoria[],
  ): Observable<{ accettate: AwardsCategoria[] }> {
    return this.http.post<{ accettate: AwardsCategoria[] }>(
      `${this.base}/invito/accetta`,
      { token, categorie, consenso: true },
    );
  }

  /** JWT: il candidato si ritira da alcune categorie. */
  ritira(
    candidatoId: string,
    categorie: AwardsCategoria[],
  ): Observable<{ ritirate: AwardsCategoria[] }> {
    return this.http.post<{ ritirate: AwardsCategoria[] }>(
      `${this.base}/candidature/${candidatoId}/ritira`,
      { categorie },
    );
  }

  // ── Pannello (ADMIN) ──────────────────────────────────────────────────────

  private get admin(): string {
    return `${environment.API_URL}/admin/awards`;
  }

  edizioneAdmin(): Observable<EdizioneAwardsAdmin> {
    return this.http.get<EdizioneAwardsAdmin>(`${this.admin}/edizione`);
  }

  aggiornaEdizione(date: Partial<DateAwards>): Observable<EdizioneAwardsAdmin> {
    return this.http.patch<EdizioneAwardsAdmin>(`${this.admin}/edizione`, date);
  }

  spoglio(): Observable<CategoriaSpoglio[]> {
    return this.http.get<CategoriaSpoglio[]>(`${this.admin}/spoglio`);
  }

  candidati(): Observable<CandidatoAdmin[]> {
    return this.http.get<CandidatoAdmin[]>(`${this.admin}/candidati`);
  }

  creaCandidato(
    nickname: string,
    categorie: AwardsCategoria[],
  ): Observable<CandidatoConLink> {
    return this.http.post<CandidatoConLink>(`${this.admin}/candidati`, {
      nickname,
      categorie,
    });
  }

  aggiungiCategorie(
    id: string,
    categorie: AwardsCategoria[],
  ): Observable<CandidatoAdmin> {
    return this.http.post<CandidatoAdmin>(
      `${this.admin}/candidati/${id}/categorie`,
      { categorie },
    );
  }

  rinnovaInvito(id: string): Observable<CandidatoConLink> {
    return this.http.post<CandidatoConLink>(
      `${this.admin}/candidati/${id}/invito`,
      {},
    );
  }

  rimuoviCandidato(id: string): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.admin}/candidati/${id}`);
  }

  statoAnnuncio(tipo: AnnuncioAwards): Observable<StatoAnnuncio> {
    return this.http.get<StatoAnnuncio>(`${this.admin}/annunci/${tipo}`);
  }

  /** `prova`: solo all'admin che preme, senza toccare cursore né contatori. */
  inviaAnnuncio(
    tipo: AnnuncioAwards,
    corpo: { limite?: number; prova?: boolean },
  ): Observable<EsitoAnnuncio> {
    return this.http.post<EsitoAnnuncio>(
      `${this.admin}/annunci/${tipo}`,
      corpo,
    );
  }
}
