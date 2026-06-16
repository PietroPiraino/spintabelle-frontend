import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Lesson,
  LessonPayload,
  LessonStakes,
  LessonVisibility,
  Paginated,
} from '../models/api.models';

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
