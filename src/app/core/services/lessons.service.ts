import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Lesson,
  LessonPayload,
  LessonStakes,
  LessonViewSummary,
  LessonViewer,
  LessonViewsRow,
  LessonVisibility,
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
    return this.http.get<Paginated<Lesson>>(`${API}/lessons`, { params });
  }

  getTags(): Observable<string[]> {
    return this.http.get<string[]>(`${API}/lessons/tags`);
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
