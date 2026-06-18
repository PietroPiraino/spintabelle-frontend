import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import { DocumentResource, Paginated } from '../../../core/models/api.models';
import { AdminDocumentsComponent } from './admin-documents.component';

const API = environment.API_URL;

const docOf = (id: string): DocumentResource => ({
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
});

const pageOf = (
  items: DocumentResource[],
  total: number,
  page = 1,
  limit = 25,
): Paginated<DocumentResource> => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Accesso ai membri protected che il test deve pilotare. */
interface Testable {
  form: FormGroup;
  selectedFile: WritableSignal<File | null>;
  submit(): void;
}

describe('AdminDocumentsComponent', () => {
  let fixture: ComponentFixture<AdminDocumentsComponent>;
  let http: HttpTestingController;
  let comp: Testable;
  const isList = (r: { url: string }) => r.url === `${API}/documents`;

  const fillValidForm = () =>
    comp.form.setValue({
      title: 'Filtro 3-bet',
      description: 'descrizione valida',
      category: 'PT4_FILTER',
      visibility: 'PESCE_ROSSO',
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDocumentsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDocumentsComponent);
    http = TestBed.inject(HttpTestingController);
    comp = fixture.componentInstance as unknown as Testable;
  });

  afterEach(() => http.verify());

  it('carica pagina 1 con limit 25 e mostra la lista', async () => {
    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(pageOf([docOf('a')], 1));
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Doc a');
  });

  it('in creazione senza file: errore e nessun POST', async () => {
    http.expectOne(isList).flush(pageOf([], 0));
    await fixture.whenStable();

    fillValidForm();
    comp.submit();
    fixture.detectChanges();

    // nessuna richiesta in volo (niente POST verso /documents)
    http.verify();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Seleziona un file',
    );
  });

  it('con file valido invia POST multipart e ricarica la lista', async () => {
    http.expectOne(isList).flush(pageOf([], 0));
    await fixture.whenStable();

    fillValidForm();
    comp.selectedFile.set(
      new File(['x'], 'filtro.xml', { type: 'application/xml' }),
    );
    comp.submit();

    const post = http.expectOne(
      (r) => r.url === `${API}/documents` && r.method === 'POST',
    );
    const body = post.request.body as FormData;
    expect(body.get('title')).toBe('Filtro 3-bet');
    expect(body.get('file')).toBeInstanceOf(File);
    post.flush(docOf('new'));
    await fixture.whenStable();

    // dopo la creazione ricarica la lista (pagina 1)
    http.expectOne(isList).flush(pageOf([docOf('new')], 1));
    await fixture.whenStable();
  });
});
