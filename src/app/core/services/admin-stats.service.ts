import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminSitoRicercaView,
  AdminSitoTrafficoView,
  AdminStatsView,
  AdminVideoStatsView,
} from '../models/api.models';

const API = environment.API_URL;

/**
 * Statistiche di business del pannello admin (rotte ADMIN-only su /admin/stats).
 *
 * QUATTRO chiamate separate di proposito, come lato backend: `/admin/stats`
 * sono aggregazioni Mongo che rispondono in millisecondi, `/admin/stats/video`
 * è una chiamata di rete a Bunny, `/admin/stats/sito/traffico` e
 * `/admin/stats/sito/ricerca` sono due terzi diversi (Cloudflare e Google) con
 * due latenze e due guasti. Ogni riquadro fallisce da solo — un guasto di
 * Bunny non spegne i numeri di business, e un 403 di Google non spegne il
 * traffico di Cloudflare.
 *
 * ⚠️ Il ValidationPipe del backend gira con `forbidNonWhitelisted`: ogni query
 * param non dichiarato nel DTO fa fallire la richiesta con un 400. Qui si
 * mandano SOLO `months` e `giorni`.
 */
@Injectable({ providedIn: 'root' })
export class AdminStatsService {
  private readonly http = inject(HttpClient);

  /** @param months profondità della serie mensile (1..24, default backend 12). */
  overview(months?: number): Observable<AdminStatsView> {
    let params = new HttpParams();
    if (months) params = params.set('months', months);
    return this.http.get<AdminStatsView>(`${API}/admin/stats`, { params });
  }

  /**
   * Sezione video (Bunny Stream). Risponde 200 anche con Bunny giù
   * (`disponibile: false` + `motivo`): un errore qui è di rete, non di dati.
   *
   * ⚠️ Il parametro si chiama `giorni` (italiano come il payload), NON `days`:
   * il fratello `overview()` usa `months`. Due nomi diversi, non un refuso.
   *
   * @param giorni finestra dell'andamento giornaliero (1..90, default 30).
   */
  video(giorni?: number): Observable<AdminVideoStatsView> {
    let params = new HttpParams();
    if (giorni) params = params.set('giorni', giorni);
    return this.http.get<AdminVideoStatsView>(`${API}/admin/stats/video`, {
      params,
    });
  }

  /**
   * Traffico e Core Web Vitals del sito (Cloudflare Web Analytics via API).
   * Risponde 200 anche senza token o con Cloudflare giù (`disponibile: false`
   * + `causa` + `motivo`): un errore HTTP qui è di rete, non di dati.
   *
   * @param giorni finestra del traffico (1..90, default 30).
   */
  sitoTraffico(giorni?: number): Observable<AdminSitoTrafficoView> {
    let params = new HttpParams();
    if (giorni) params = params.set('giorni', giorni);
    return this.http.get<AdminSitoTrafficoView>(
      `${API}/admin/stats/sito/traffico`,
      { params },
    );
  }

  /**
   * Ricerca su Google e copertura dell'indice (Search Console via account di
   * servizio). Stessa forma best-effort del traffico: la metà di Google può
   * mancare mentre quella di Cloudflare è piena, e viceversa.
   *
   * @param giorni finestra della ricerca (1..90, default 30), la stessa del
   * traffico: il ritardo di Google si DICHIARA in risposta, non si maschera
   * spostando la finestra.
   */
  sitoRicerca(giorni?: number): Observable<AdminSitoRicercaView> {
    let params = new HttpParams();
    if (giorni) params = params.set('giorni', giorni);
    return this.http.get<AdminSitoRicercaView>(
      `${API}/admin/stats/sito/ricerca`,
      { params },
    );
  }
}
