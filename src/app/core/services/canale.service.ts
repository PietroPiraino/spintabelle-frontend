import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  StatoCanale,
  UltimoVideoCanale,
  VideoCanaleAdmin,
} from '../models/api.models';

/**
 * Il blocco «ultimo video del canale» della home.
 *
 * Metà pubblica e metà admin nello stesso file, con il confine segnato:
 * idioma di `news.service.ts`.
 */
@Injectable({ providedIn: 'root' })
export class CanaleService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.API_URL;

  // ------------------------------------------------------------ pubblico

  /**
   * ⚠️ **Questa chiamata parte anche durante il PRERENDER**, ed è voluto: la
   * home è prerenderizzata, quindi la risposta finisce nell'HTML statico e il
   * blocco è già pieno al primo pixel — niente spostamento di layout su una
   * pagina che misura CLS 0. All'idratazione il browser la rifà e aggiorna, il
   * che è ciò che permette a un video approvato di comparire **senza un nuovo
   * deploy**.
   *
   * ⚠️⚠️ **E il secondo giro NON deve esistere: `/canale` resta DENTRO la
   * transfer cache**, al contrario di `/news`. Escluderlo farebbe ripartire il
   * segnale da «non so» a ogni idratazione, e la home farebbe comparire e
   * sparire ~360px **sopra la piega** — su una pagina che oggi misura CLS 0.
   * Il blocco news se lo può permettere perché sta sotto la piega; questo no.
   * La freschezza non si perde: ogni approvazione fa partire un rebuild
   * Cloudflare (`deploy.trigger` lato backend, verificato attivo), quindi
   * l'HTML statico si rigenera da sé in pochi minuti. La ragione per esteso
   * sta accanto al filtro in `app.config.ts`.
   */
  ultimoVideo(): Observable<UltimoVideoCanale> {
    return this.http.get<UltimoVideoCanale>(`${this.base}/canale/ultimo-video`);
  }

  // --------------------------------------------------------------- admin

  stato(): Observable<StatoCanale> {
    return this.http.get<StatoCanale>(`${this.base}/admin/canale`);
  }

  controlla(): Observable<{ esito: string; proposto?: VideoCanaleAdmin }> {
    return this.http.post<{ esito: string; proposto?: VideoCanaleAdmin }>(
      `${this.base}/admin/canale/controlla`,
      {},
    );
  }

  /**
   * ⚠️ Il `videoId` viaggia nel corpo e il server **guarda la scrittura su di
   * esso**: il controllo periodico può sostituire la proposta mentre la pagina
   * è aperta, e senza quella guardia si approverebbe un video che non si è
   * guardato — cioè si salterebbe l'unico controllo esistente sulla miniatura.
   * Un 409 qui non è un errore da nascondere: è la richiesta di riguardare.
   */
  approva(videoId: string): Observable<VideoCanaleAdmin> {
    return this.http.post<VideoCanaleAdmin>(`${this.base}/admin/canale/approva`, {
      videoId,
    });
  }

  scarta(videoId: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/admin/canale/scarta`, {
      videoId,
    });
  }

  togliDallaHome(): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/admin/canale`);
  }

  pendingCount(): Observable<{ inAttesa: number }> {
    return this.http.get<{ inAttesa: number }>(
      `${this.base}/admin/canale/pending-count`,
    );
  }
}
