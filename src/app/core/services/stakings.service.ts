import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StakingMio } from '../models/api.models';

const API = environment.API_URL;

/** Il registro di staking letto dal GIOCATORE (l'admin usa admin-stakings.service). */
@Injectable({ providedIn: 'root' })
export class StakingsService {
  private readonly http = inject(HttpClient);

  /** Il proprio registro, o `null` per chi non ha un accordo. */
  mio(): Observable<StakingMio | null> {
    return this.http.get<StakingMio | null>(`${API}/stakings/mio`);
  }
}
