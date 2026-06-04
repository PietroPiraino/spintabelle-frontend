import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Lesson, LessonPayload } from '../models/api.models';

const API = environment.API_URL;

@Injectable({ providedIn: 'root' })
export class LessonsService {
  private readonly http = inject(HttpClient);

  getLessons(filters?: { tag?: string; q?: string }): Observable<Lesson[]> {
    let params = new HttpParams();
    if (filters?.tag) params = params.set('tag', filters.tag);
    if (filters?.q) params = params.set('q', filters.q);
    return this.http.get<Lesson[]>(`${API}/lessons`, { params });
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
