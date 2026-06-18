import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { DocumentResource, Paginated } from '../../core/models/api.models';
import { DocsComponent } from './docs.component';

const API = environment.API_URL;

const docOf = (
  id: string,
  over: Partial<DocumentResource> = {},
): DocumentResource => ({
  id,
  title: `Doc ${id}`,
  description: 'descrizione',
  category: 'PT4_FILTER',
  visibility: 'PESCE_ROSSO',
  fileName: `${id}.xml`,
  fileExt: 'xml',
  mimeType: 'application/xml',
  sizeBytes: 2048,
  downloadCount: 0,
  locked: false,
  createdAt: '2026-06-01T00:00:00.000Z',
  ...over,
});

const pageOf = (
  items: DocumentResource[],
  over: Partial<Paginated<DocumentResource>> = {},
): Paginated<DocumentResource> => ({
  items,
  total: items.length,
  page: 1,
  limit: 24,
  totalPages: 1,
  ...over,
});

describe('DocsComponent', () => {
  let fixture: ComponentFixture<DocsComponent>;
  let http: HttpTestingController;
  const isList = (r: { url: string }) => r.url === `${API}/documents`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocsComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('mostra Scarica per i materiali sbloccati e Sblocca per quelli bloccati', async () => {
    http
      .expectOne(isList)
      .flush(pageOf([docOf('a', { locked: false }), docOf('b', { locked: true })]));
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Scarica');
    expect(el.textContent).toContain('Sblocca');
    expect(el.textContent).toContain('Riservato agli abbonati');
  });

  it('il filtro categoria ricarica con il parametro category', async () => {
    http.expectOne(isList).flush(pageOf([docOf('a')]));
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const pdfBtn = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'PDF',
    );
    pdfBtn!.click();

    const req = http.expectOne(isList);
    expect(req.request.params.get('category')).toBe('PDF');
    req.flush(pageOf([]));
    await fixture.whenStable();
  });

  it('Scarica ottiene il link firmato (via XHR) e avvia il download', async () => {
    http.expectOne(isList).flush(pageOf([docOf('a', { locked: false })]));
    await fixture.whenStable();
    fixture.detectChanges();

    const clickSpy = spyOn(HTMLAnchorElement.prototype, 'click');
    const el = fixture.nativeElement as HTMLElement;
    const dl = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Scarica'),
    );
    dl!.click();

    const req = http.expectOne(`${API}/documents/a/download`);
    expect(req.request.method).toBe('GET');
    req.flush({ url: 'https://cdn/x?token=t&expires=1', fileName: 'a.xml' });
    await fixture.whenStable();

    expect(clickSpy).toHaveBeenCalled();
  });

  it('un errore di caricamento è mostrato con Riprova, non come catalogo vuoto', async () => {
    http
      .expectOne(isList)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Caricamento dei materiali non riuscito');
    expect(el.textContent).toContain('Riprova');
    expect(el.textContent).not.toContain('Nessun materiale trovato');
  });
});
