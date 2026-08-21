import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HealthStatus } from '../models/api.models';

const API = environment.API_URL;

/**
 * `GET /health` — la sonda pubblica del backend (nessuna guard, `@SkipThrottle`).
 *
 * Serve al cruscotto delle Fonti per una ragione sola e non sostituibile:
 * l'interruttore generale della raccolta è una **env di Render**
 * (`NEWS_INGEST_ENABLED`), letta a ogni tick, e nessuna rotta delle sorgenti la
 * espone. Senza questa chiamata il pannello mostrerebbe una fonte "accesa" che
 * non raccoglie niente **senza poterlo dire** — cioè il modo più veloce per far
 * cercare un guasto dove non c'è.
 *
 * ⚠️ Restituisce solo lo **stato** degli interruttori, mai i loro valori
 * segreti (l'URL del deploy hook, il DSN di Sentry): è la stessa forma che
 * l'endpoint dichiara da fuori.
 */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  stato(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${API}/health`);
  }
}
