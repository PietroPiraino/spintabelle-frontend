import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { News, NewsPayload, Paginated } from '../models/api.models';

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
}
