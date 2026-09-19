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
   * ⚠️⚠️ **Perché il secondo giro esista, `/canale` deve restare ESCLUSO dalla
   * transfer cache** (`app.config.ts`). È stato tolto e rimesso lo stesso
   * giorno, e la storia vale più della regola: escluderlo costa uno sfarfallio
   * dello scheletro, **includerlo costa che un video appena approvato non
   * compaia ricaricando la home** — torna solo navigando via e indietro,
   * quando il componente rifà la chiamata. Trovato dall'owner in cinque
   * minuti. Il rebuild automatico non basta: fra approvazione e build
   * assestato passano minuti, e se il deploy hook fallisce la home resta
   * indietro per sempre, in silenzio.
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
