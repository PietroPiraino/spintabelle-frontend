import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { Lesson, Paginated } from '../../../core/models/api.models';
import { AdminLessonsComponent } from './admin-lessons.component';

const API = environment.API_URL;

const lessonOf = (id: string): Lesson => ({
  id,
  title: `Lezione ${id}`,
  description: 'descrizione di prova',
  tags: [],
  visibility: 'USER',
  locked: false,
  videoDate: '2026-06-01T00:00:00.000Z',
});

const pageOf = (
  items: Lesson[],
  page: number,
  total: number,
  limit = 25,
): Paginated<Lesson> => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

describe('AdminLessonsComponent (pager + errori espliciti)', () => {
  let fixture: ComponentFixture<AdminLessonsComponent>;
  let http: HttpTestingController;

  const isList = (r: { url: string }) => r.url === `${API}/lessons`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLessonsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLessonsComponent);
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API}/lessons/tags`).flush([]);
  });

  afterEach(() => http.verify());

  it('carica pagina 1 con limit 25 e mostra il pager se serve', async () => {
    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(
      pageOf(
        Array.from({ length: 25 }, (_, i) => lessonOf(`l${i}`)),
        1,
        26,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Pagina 1 di 2');
    expect(el.textContent).toContain('26 lezioni');
  });

  it('il pager chiede la pagina successiva', async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf(
          Array.from({ length: 25 }, (_, i) => lessonOf(`l${i}`)),
          1,
          26,
        ),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const next = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Successive'),
    );
    next!.click();

    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pageOf([lessonOf('ultima')], 2, 26));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Pagina 2 di 2');
  });

  it("eliminata l'ultima lezione di una pagina, arretra alla precedente", async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf(
          Array.from({ length: 25 }, (_, i) => lessonOf(`l${i}`)),
          1,
          26,
        ),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    // vai a pagina 2 (un solo elemento)
    (fixture.componentInstance as unknown as { goToPage(n: number): void }).goToPage(2);
    http.expectOne(isList).flush(pageOf([lessonOf('ultima')], 2, 26));
    await fixture.whenStable();
    fixture.detectChanges();

    spyOn(window, 'confirm').and.returnValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const del = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Elimina'),
    );
    del!.click();

    http
      .expectOne((r) => r.url === `${API}/lessons/ultima`)
      .flush({ ok: true });
    await fixture.whenStable();

    // il reload riparte dalla pagina 1 (la 2 non esiste più) + refresh dei tag
    const reload = http.expectOne(isList);
    expect(reload.request.params.get('page')).toBe('1');
    reload.flush(
      pageOf(
        Array.from({ length: 25 }, (_, i) => lessonOf(`l${i}`)),
        1,
        25,
      ),
    );
    http.expectOne(`${API}/lessons/tags`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).not.toContain('Pagina 2');
  });

  it('dopo un errore del pager il clic successivo ritenta la stessa pagina', async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf(
          Array.from({ length: 25 }, (_, i) => lessonOf(`l${i}`)),
          1,
          26,
        ),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const next = () =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Successive'),
      );

    next()!.click();
    http
      .expectOne(isList)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Caricamento lezioni non riuscito');

    // currentPage è stata riallineata alla pagina realmente caricata (1):
    // il clic NON è un no-op e ritenta pagina 2
    next()!.click();
    const retry = http.expectOne(isList);
    expect(retry.request.params.get('page')).toBe('2');
    retry.flush(pageOf([lessonOf('ultima')], 2, 26));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Pagina 2 di 2');
  });

  it('un errore di caricamento è mostrato, non mascherato da "Nessuna lezione"', async () => {
    http
      .expectOne(isList)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Caricamento lezioni non riuscito');
    expect(el.textContent).not.toContain('Nessuna lezione ancora');
  });
});
