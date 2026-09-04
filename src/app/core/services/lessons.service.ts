import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Lesson,
  LessonCategoriaFiltro,
  LessonPayload,
  LessonStakes,
  LessonViewSummary,
  LessonViewer,
  LessonViewsRow,
  LessonVisibility,
  LessonsSommario,
  Paginated,
} from '../models/api.models';
import { SKIP_REFRESH } from './auth.service';

const API = environment.API_URL;

/** Filtri/paginazione della lista lezioni (tutti applicati dal backend). */
export interface LessonListOpts {
  page?: number;
  limit?: number;
  /** ricerca substring su titolo/descrizione/tag */
  q?: string;
  /** tag in AND, serializzati CSV */
  tags?: string[];
  visibility?: LessonVisibility;
  /** sezione stakes (Low/High) */
  stakes?: LessonStakes;
  /** categoria, o la sentinella `NESSUNA` = non ancora classificate */
  categoria?: LessonCategoriaFiltro;
}

@Injectable({ providedIn: 'root' })
export class LessonsService {
  private readonly http = inject(HttpClient);

  /** Elenco paginato (envelope { items, total, page, limit, totalPages }). */
  getLessons(opts: LessonListOpts = {}): Observable<Paginated<Lesson>> {
    let params = new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? 24);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.tags?.length) params = params.set('tags', opts.tags.join(','));
    if (opts.visibility) params = params.set('visibility', opts.visibility);
    if (opts.stakes) params = params.set('stakes', opts.stakes);
    if (opts.categoria) params = params.set('categoria', opts.categoria);
    return this.http.get<Paginated<Lesson>>(`${API}/lessons`, { params });
  }

  /**
   * Tag distinti; con una categoria si restringono a quelli usati lì dentro.
   *
   * ⚠️ Senza categoria l'URL deve restare `/lessons/tags` NUDO: il `beforeEach`
   * delle spec di /lezioni fa `expectOne('${API}/lessons/tags')`, che confronta
   * `urlWithParams` — un `?categoria=` vuoto farebbe fallire NOVE spec, e il
   * messaggio non nominerebbe questa riga.
   */
  getTags(categoria?: LessonCategoriaFiltro): Observable<string[]> {
    const opts = categoria
      ? { params: new HttpParams().set('categoria', categoria) }
      : {};
    return this.http.get<string[]>(`${API}/lessons/tags`, opts);
  }

  /** Conteggi per categoria + la coda da classificare (pillole e pannello admin). */
  sommario(): Observable<LessonsSommario> {
    return this.http.get<LessonsSommario>(`${API}/lessons/sommario`);
  }

  /**
   * L'utente ha aperto il player di questa lezione.
   *
   * ⚠️ `SKIP_REFRESH`: è un evento accessorio, e senza questo contesto un 401
   * (sessione scaduta mentre si guarda) farebbe partire il refresh e, se
   * fallisse, l'interceptor porterebbe l'utente al login. Meglio perdere
   * l'evento che sbattere fuori qualcuno da un video.
   */
  trackView(lessonId: string): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API}/lessons/${lessonId}/view`,
      {},
      { context: new HttpContext().set(SKIP_REFRESH, true) },
    );
  }

  /**
   * Avanzamento della visione (secondi guardati al massimo + durata del video).
   * Stesso `SKIP_REFRESH` di `trackView`, per lo stesso motivo.
   */
  trackProgress(
    lessonId: string,
    seconds: number,
    duration: number,
  ): Observable<{ ok: true }> {
    return this.http.post<{ ok: true }>(
      `${API}/lessons/${lessonId}/progress`,
      { seconds: Math.round(seconds), duration: Math.round(duration) },
      { context: new HttpContext().set(SKIP_REFRESH, true) },
    );
  }

  /** Lezioni già aperte dall'utente (badge "già visto"). */
  myViews(): Observable<LessonViewSummary[]> {
    return this.http.get<LessonViewSummary[]>(`${API}/lessons/my-views`);
  }

  /** Admin: quante persone distinte hanno aperto ciascuna lezione. */
  viewsSummary(): Observable<LessonViewsRow[]> {
    return this.http.get<LessonViewsRow[]>(`${API}/lessons/views-summary`);
  }

  /** Admin: chi ha aperto una certa lezione. */
  viewers(lessonId: string): Observable<LessonViewer[]> {
    return this.http.get<LessonViewer[]>(`${API}/lessons/${lessonId}/views`);
  }

  create(payload: LessonPayload): Observable<Lesson> {
    return this.http.post<Lesson>(`${API}/lessons`, payload);
  }

  update(id: string, payload: Partial<LessonPayload>): Observable<Lesson> {
    return this.http.patch<Lesson>(`${API}/lessons/${id}`, payload);
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/lessons/${id}`);
  }
}
