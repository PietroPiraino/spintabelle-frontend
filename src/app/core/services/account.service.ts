import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Percorso } from '../models/api.models';

const API = environment.API_URL;

/**
 * Le letture dell'area personale che non appartengono a un altro modulo.
 * (Profilo, password, export e cancellazione restano in `AuthService`, che
 * tiene anche lo stato della sessione che quelle chiamate toccano.)
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);

  /** «Il mio percorso»: un aggregato, ogni blocco `null` sul proprio errore. */
  percorso(): Observable<Percorso> {
    return this.http.get<Percorso>(`${API}/account/percorso`);
  }
}
