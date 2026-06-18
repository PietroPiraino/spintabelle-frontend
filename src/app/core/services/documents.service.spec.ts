import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  DocumentPayload,
  DocumentResource,
  Paginated,
} from '../models/api.models';
import { DocumentsService } from './documents.service';

const API = environment.API_URL;

const emptyPage: Paginated<DocumentResource> = {
  items: [],
  total: 0,
  page: 1,
  limit: 24,
  totalPages: 1,
};

const payload: DocumentPayload = {
  title: 'Filtro',
  description: 'descrizione di prova',
  category: 'PT4_FILTER',
  visibility: 'PESCE_ROSSO',
};

describe('DocumentsService', () => {
  let service: DocumentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(DocumentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list invia SEMPRE page/limit e i filtri solo se presenti', () => {
    service.list().subscribe();
    const req = http.expectOne((r) => r.url === `${API}/documents`);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('24');
    expect(req.request.params.has('q')).toBeFalse();
    expect(req.request.params.has('category')).toBeFalse();
    req.flush(emptyPage);
  });

  it('list serializza q e category', () => {
    service.list({ page: 2, limit: 10, q: 'icm', category: 'PDF' }).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/documents`);
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.get('q')).toBe('icm');
    expect(req.request.params.get('category')).toBe('PDF');
    req.flush(emptyPage);
  });

  it('downloadUrl fa GET /documents/:id/download', () => {
    service.downloadUrl('abc').subscribe();
    const req = http.expectOne(`${API}/documents/abc/download`);
    expect(req.request.method).toBe('GET');
    req.flush({ url: 'https://cdn/x?token=t&expires=1', fileName: 'f.xml' });
  });

  it('create POST multipart con metadati + file', () => {
    const file = new File(['x'], 'filtro.xml', { type: 'application/xml' });
    service.create(payload, file).subscribe();
    const req = http.expectOne(`${API}/documents`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect(body.get('title')).toBe('Filtro');
    expect(body.get('category')).toBe('PT4_FILTER');
    expect(body.get('visibility')).toBe('PESCE_ROSSO');
    expect(body.get('file')).toBeInstanceOf(File);
    req.flush({} as DocumentResource);
  });

  it('update PATCH multipart; senza file non include il campo "file"', () => {
    service.update('abc', { title: 'Nuovo' }).subscribe();
    const req = http.expectOne(`${API}/documents/abc`);
    expect(req.request.method).toBe('PATCH');
    const body = req.request.body as FormData;
    expect(body.get('title')).toBe('Nuovo');
    expect(body.has('file')).toBeFalse();
    req.flush({} as DocumentResource);
  });

  it('remove fa DELETE /documents/:id', () => {
    service.remove('abc').subscribe();
    const req = http.expectOne(`${API}/documents/abc`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
  });
});
