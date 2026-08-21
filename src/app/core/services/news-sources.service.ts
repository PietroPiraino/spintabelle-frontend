import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  NewsSource,
  NewsSourcePayload,
  NewsSourceRemoved,
  NewsSourceSeed,
  NewsSourceUpdatePayload,
} from '../models/api.models';

const API = environment.API_URL;

/**
 * Le sorgenti della redazione (`/admin/news-sources`, class-guarded ADMIN).
 *
 * ⚠️ **Questa è tutta la superficie che esiste.** Non c'è una rotta "prova la
 * sorgente adesso" e non va inventata lato client: sarebbe un fetch verso un
 * indirizzo scelto al momento, dal browser, contro una redazione vera — la
 * prova è accendere la riga e leggere il primo tick. Non ci sono nemmeno
 * metriche del tick, conteggi degli item ingeriti o link agli articoli
 * prodotti: la domanda «cosa ha preso l'ultimo giro» si risponde **solo** con
 * `lastItemAt` + `emaItemsPerDay` della riga.
 *
 * ⚠️ Nessun `getById`: `list()` torna un array **nudo** con tutte le righe
 * (≤20 per disegno, nessuna paginazione, nessun envelope) e porta già ogni
 * campo che il dettaglio mostrerebbe. Una seconda chiamata darebbe solo un
 * secondo momento in cui i due dati possono divergere.
 */
@Injectable({ providedIn: 'root' })
export class NewsSourcesService {
  private readonly http = inject(HttpClient);

  /** Configurazione **e** stato di salute sulla stessa riga, ordinate per slug. */
  list(): Observable<NewsSource[]> {
    return this.http.get<NewsSource[]>(`${API}/admin/news-sources`);
  }

  /**
   * Le cinque righe del censimento, per **precompilare** il form.
   *
   * ⚠️ **Non scrive niente e non è un seeding**: gli hostname non sono stati
   * verificati contro i siti veri, quindi la conferma resta umana. Il pannello
   * riempie il form e aspetta un salvataggio.
   */
  seed(): Observable<NewsSourceSeed[]> {
    return this.http.get<NewsSourceSeed[]>(`${API}/admin/news-sources/seed`);
  }

  /**
   * ⚠️ 409 con messaggio italiano sullo slug già usato (unico indice unique);
   * 400 su parser incompatibile con la strategia, indirizzo non interrogabile
   * (deny-list) o categorie su una strategia diversa da WP REST.
   */
  create(payload: NewsSourcePayload): Observable<NewsSource> {
    return this.http.post<NewsSource>(`${API}/admin/news-sources`, payload);
  }

  /**
   * ⚠️ **Effetto collaterale da dire nel pannello**: se cambia `strategy`,
   * `endpointUrl`, `parserKey` o `excludeCategoryIds`, il server azzera
   * `consecutiveFailures` e butta `etag`/`lastModified`/`backoffUntil` — i
   * validatori del GET condizionale descrivono la *vecchia* domanda, e un 304
   * su una domanda diversa farebbe credere che non ci sia niente di nuovo.
   * Cambiare solo nome, nota, cadenza o `enabled` non azzera niente.
   *
   * ⚠️ `healthState` **non** viene ricalcolato qui: resta quello di prima
   * finché il prossimo tick non rivaluta.
   *
   * ⚠️ Mandare solo i campi che si vogliono scrivere, e **mai** una chiave con
   * `undefined`: `forbidNonWhitelisted` fa 400 l'intera chiamata.
   */
  update(
    id: string,
    payload: NewsSourceUpdatePayload,
  ): Observable<NewsSource> {
    return this.http.patch<NewsSource>(
      `${API}/admin/news-sources/${id}`,
      payload,
    );
  }

  /** ⚠️ Non cancella a cascata i grezzi già ingeriti (TTL 45 giorni). */
  remove(id: string): Observable<NewsSourceRemoved> {
    return this.http.delete<NewsSourceRemoved>(
      `${API}/admin/news-sources/${id}`,
    );
  }
}
