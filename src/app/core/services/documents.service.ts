import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DocumentCategory,
  DocumentPayload,
  DocumentResource,
  Paginated,
} from '../models/api.models';

const API = environment.API_URL;

/** Filtri/paginazione della lista documenti (applicati dal backend). */
export interface DocumentListOpts {
  page?: number;
  limit?: number;
  /** ricerca substring su titolo/descrizione/nome file */
  q?: string;
  category?: DocumentCategory;
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient);

  /** Elenco paginato (envelope { items, total, page, limit, totalPages }). */
  list(opts: DocumentListOpts = {}): Observable<Paginated<DocumentResource>> {
    let params = new HttpParams()
      .set('page', opts.page ?? 1)
      .set('limit', opts.limit ?? 24);
    if (opts.q) params = params.set('q', opts.q);
    if (opts.category) params = params.set('category', opts.category);
    return this.http.get<Paginated<DocumentResource>>(`${API}/documents`, {
      params,
    });
  }

  /**
   * Link CDN firmato (a scadenza breve) per il download: richiede via XHR così
   * l'access token in memoria viaggia nell'header; poi il chiamante naviga sul
   * link. 403 se il ruolo non sblocca il documento.
   */
  downloadUrl(id: string): Observable<{ url: string; fileName: string }> {
    return this.http.get<{ url: string; fileName: string }>(
      `${API}/documents/${id}/download`,
    );
  }

  /** Crea (multipart): metadati + file. */
  create(payload: DocumentPayload, file: File): Observable<DocumentResource> {
    return this.http.post<DocumentResource>(
      `${API}/documents`,
      this.toFormData(payload, file),
    );
  }

  /** Aggiorna i metadati e, opzionalmente, sostituisce il file. */
  update(
    id: string,
    payload: Partial<DocumentPayload>,
    file?: File,
  ): Observable<DocumentResource> {
    return this.http.patch<DocumentResource>(
      `${API}/documents/${id}`,
      this.toFormData(payload, file),
    );
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${API}/documents/${id}`);
  }

  /** Costruisce il FormData; Angular imposta da sé il Content-Type multipart. */
  private toFormData(payload: Partial<DocumentPayload>, file?: File): FormData {
    const fd = new FormData();
    if (payload.title !== undefined) fd.set('title', payload.title);
    if (payload.description !== undefined)
      fd.set('description', payload.description);
    if (payload.category !== undefined) fd.set('category', payload.category);
    if (payload.visibility !== undefined)
      fd.set('visibility', payload.visibility);
    if (file) fd.set('file', file, file.name);
    return fd;
  }
}
