import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminNewsListOpts,
  CodaRedazione,
  News,
  NewsAdmin,
  NewsApprovePayload,
  NewsPausaSettings,
  NewsPayload,
  NewsPendingCount,
  Paginated,
} from '../models/api.models';

const API = environment.API_URL;

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly http = inject(HttpClient);

  getNews(page = 1, limit = 10): Observable<Paginated<News>> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<Paginated<News>>(`${API}/news`, { params });
  }

  getLatest(count = 3): Observable<News[]> {
    return this.getNews(1, count).pipe(map((res) => res.items));
  }

  getById(id: string): Observable<News> {
    return this.http.get<News>(`${API}/news/${id}`);
  }

  create(payload: NewsPayload): Observable<News> {
    return this.http.post<News>(`${API}/news`, payload);
  }

  update(id: string, payload: Partial<NewsPayload>): Observable<News> {
    return this.http.patch<News>(`${API}/news/${id}`, payload);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/news/${id}`);
  }

  // ── Redazione (admin) ──
  // ⚠️ Superficie separata da quella pubblica qui sopra: `/admin/news` è un
  // controller a sé, class-guarded ADMIN. Le rotte pubbliche mostrano solo gli
  // articoli `PUBBLICATO` — chiedere una bozza a `GET /news/:id` dà 404, non 403.

  /**
   * La coda. Default lato server: `status: 'IN_REVISIONE'`, 25 per pagina,
   * ordinata per deperibilità residua (mai FIFO, mai `confidence`).
   *
   * ⚠️ L'envelope porta anche `pausaFino` (modalità assenza): non esiste una
   * `GET` gemella e non serve — dopo una scrittura sulle impostazioni si
   * rilegge la coda.
   */
  adminList(opts: AdminNewsListOpts = {}): Observable<CodaRedazione> {
    let params = new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? 25);
    if (opts.status) params = params.set('status', opts.status);
    return this.http.get<CodaRedazione>(`${API}/admin/news`, { params });
  }

  /** Badge della sidebar: quante righe aspettano una decisione. */
  pendingCount(): Observable<NewsPendingCount> {
    return this.http.get<NewsPendingCount>(`${API}/admin/news/pending-count`);
  }

  /** La riga intera (stato, note interne, fonti): dettaglio per la coda. */
  adminGetById(id: string): Observable<NewsAdmin> {
    return this.http.get<NewsAdmin>(`${API}/admin/news/${id}`);
  }

  /**
   * `IN_REVISIONE → PUBBLICATO`: il cancello umano. Le correzioni al volo
   * viaggiano nel corpo, e vengono ri-passate dal gate art. 9 **prima** della
   * transizione.
   *
   * ⚠️ Passare `{}` quando non si è corretto nulla — e mai una chiave con
   * `undefined`: `forbidNonWhitelisted` fa 400 l'intera chiamata su un campo che
   * il DTO non dichiara, e `body` non è fra quelli dichiarati (per riscriverlo
   * si usa `adminUpdate`).
   */
  approve(
    id: string,
    payload: NewsApprovePayload = {},
  ): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(
      `${API}/admin/news/${id}/approve`,
      payload,
    );
  }

  /**
   * `IN_REVISIONE → SCARTATO`. ⚠️ La nota è **obbligatoria** (min 3 caratteri):
   * un `{}` è un 400 del ValidationPipe, prima del service e prima dell'audit.
   * Il testo resta in archivio — nota + corpo sono il materiale con cui si
   * correggono i prompt.
   */
  reject(id: string, note: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(`${API}/admin/news/${id}/reject`, {
      note,
    });
  }

  /**
   * "Rimanda" (D35): la riga scende in fondo alla coda per due ore, **lo stato
   * resta `IN_REVISIONE`**. ⚠️ Senza corpo: la rotta non dichiara alcun DTO, e
   * una chiave qualsiasi sarebbe un 400.
   *
   * ⚠️ La scadenza vince comunque: una riga rimandata che scade diventa
   * `SCADUTO` alla lettura successiva della coda.
   */
  snooze(id: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(`${API}/admin/news/${id}/snooze`, {});
  }

  /** `IN_REVISIONE → BOZZA` ("riporta in bozza"): nota facoltativa. ≠ snooze. */
  riportaInBozza(id: string, note?: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(
      `${API}/admin/news/${id}/bozza`,
      note === undefined ? {} : { note },
    );
  }

  /** `BOZZA → IN_REVISIONE`: la bozza entra in coda. Senza corpo. */
  inviaInRevisione(id: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(
      `${API}/admin/news/${id}/in-revisione`,
      {},
    );
  }

  /**
   * `SCARTATO`/`SCADUTO → IN_REVISIONE`: la via di ritorno dagli stati
   * terminali (il service azzera anche `scadeIl`, o la riga ri-scadrebbe
   * subito). Senza corpo.
   */
  riapri(id: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(`${API}/admin/news/${id}/riapri`, {});
  }

  /** `PUBBLICATO → BOZZA` (ritiro): `publishedAt` si conserva. */
  ritira(id: string, note?: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(
      `${API}/admin/news/${id}/ritira`,
      note === undefined ? {} : { note },
    );
  }

  /**
   * Nota di rettifica su un articolo pubblicato. ⚠️ È **pubblica** — la legge il
   * lettore in fondo all'articolo — al contrario di `decisionNote`. Il campo si
   * chiama `nota`, non `note`.
   */
  rettifica(id: string, nota: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(`${API}/admin/news/${id}/rettifica`, {
      nota,
    });
  }

  /** Ri-conio dello slug: il vecchio finisce in `slugStorici[]` (tiene il 301). */
  rinominaSlug(id: string): Observable<NewsAdmin> {
    return this.http.post<NewsAdmin>(
      `${API}/admin/news/${id}/rinomina-slug`,
      {},
    );
  }

  /** Casa canonica delle modifiche: qui il corpo si riscrive davvero. */
  adminUpdate(id: string, payload: Partial<NewsPayload>): Observable<NewsAdmin> {
    return this.http.patch<NewsAdmin>(`${API}/admin/news/${id}`, payload);
  }

  adminRemove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/admin/news/${id}`);
  }

  /**
   * Modalità assenza: ferma (o riavvia) la **generazione**, mai la revisione.
   *
   * ⚠️ Una data, non un interruttore: la pausa finisce da sola. `null` significa
   * "riprendi subito" ed è un valore legittimo — non ometterlo trasformandolo in
   * un `{}` "più pulito", anche se il backend accetta entrambi.
   */
  impostaPausa(pausaFino: string | null): Observable<NewsPausaSettings> {
    return this.http.put<NewsPausaSettings>(`${API}/admin/news/settings`, {
      pausaFino,
    });
  }
}
