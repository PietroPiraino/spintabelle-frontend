import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Lesson, Paginated } from '../../core/models/api.models';
import { LessonsComponent } from './lessons.component';

const API = environment.API_URL;

const lessonOf = (id: string, over: Partial<Lesson> = {}): Lesson => ({
  id,
  title: `Lezione ${id}`,
  description: 'descrizione di prova',
  tags: ['icm'],
  visibility: 'USER',
  locked: false,
  videoDate: '2026-06-01T00:00:00.000Z',
  ...over,
});

const pageOf = (
  items: Lesson[],
  page: number,
  total: number,
  limit = 24,
): Paginated<Lesson> => ({
  items,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

describe('LessonsComponent (lista paginata, filtri server-side)', () => {
  let fixture: ComponentFixture<LessonsComponent>;
  let http: HttpTestingController;

  const isList = (r: { url: string }) => r.url === `${API}/lessons`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LessonsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LessonsComponent);
    http = TestBed.inject(HttpTestingController);
    // i tag della toolbar partono subito col componente
    http.expectOne(`${API}/lessons/tags`).flush(['icm', '3bet']);
    // e con loro le lezioni già viste (badge "già visto"): una sola richiesta
    // per sessione, best-effort — va comunque consumata o http.verify() fallisce
    http.expectOne(`${API}/lessons/my-views`).flush([]);
  });

  afterEach(() => http.verify());

  it('al bootstrap carica pagina 1 e mostra "Carica altre" se ci sono più pagine', async () => {
    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('24');
    req.flush(
      pageOf(
        Array.from({ length: 24 }, (_, i) => lessonOf(`l${i}`)),
        1,
        30,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('article.lesson-card').length).toBe(24);
    expect(el.textContent).toContain('30 lezioni');
    expect(el.textContent).toContain('Carica altre lezioni');
  });

  it('"Carica altre" appende la pagina successiva senza perdere la prima', async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf(
          Array.from({ length: 24 }, (_, i) => lessonOf(`l${i}`)),
          1,
          30,
        ),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const more = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Carica altre lezioni'),
    );
    more!.click();

    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('2');
    req.flush(
      pageOf(
        Array.from({ length: 6 }, (_, i) => lessonOf(`m${i}`)),
        2,
        30,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('article.lesson-card').length).toBe(30);
    // tutte le pagine caricate: il bottone sparisce
    expect(el.textContent).not.toContain('Carica altre lezioni');
  });

  it('il filtro tag riparte da pagina 1 e SOSTITUISCE i risultati (non appende)', async () => {
    http
      .expectOne(isList)
      .flush(pageOf([lessonOf('a'), lessonOf('b')], 1, 2));
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const tagBtn = Array.from(
      el.querySelectorAll('.lessons__tags button'),
    ).find((b) => b.textContent?.trim() === 'icm') as HTMLButtonElement;
    tagBtn.click();

    const req = http.expectOne(isList);
    expect(req.request.params.get('tags')).toBe('icm');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([lessonOf('a')], 1, 1));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelectorAll('article.lesson-card').length).toBe(1);
    expect(el.textContent).toContain('1 lezione');
  });

  it('la ricerca è debounced e passa q al backend', async () => {
    http.expectOne(isList).flush(pageOf([lessonOf('a')], 1, 1));
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'turbo';
    input.dispatchEvent(new Event('input'));

    // prima del debounce (300ms) nessuna richiesta
    http.expectNone(isList);
    await new Promise((r) => setTimeout(r, 350));

    const req = http.expectOne(isList);
    expect(req.request.params.get('q')).toBe('turbo');
    req.flush(pageOf([], 1, 0));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Nessuna lezione trovata');
  });

  it('su errore mostra il banner con Riprova, non un finto catalogo vuoto', async () => {
    http
      .expectOne(isList)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.spinner')).toBeNull();
    expect(el.textContent).toContain('Caricamento delle lezioni non riuscito');
    expect(el.textContent).not.toContain('Nessuna lezione trovata');

    // Riprova rilancia dalla pagina 1
    const riprova = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Riprova'),
    );
    riprova!.click();
    const req = http.expectOne(isList);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([lessonOf('a')], 1, 1));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelectorAll('article.lesson-card').length).toBe(1);
    expect(el.textContent).not.toContain('Caricamento delle lezioni non riuscito');
  });

  it('se carica-altre fallisce, il retry richiede la STESSA pagina (niente buchi)', async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf(
          Array.from({ length: 24 }, (_, i) => lessonOf(`l${i}`)),
          1,
          30,
        ),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const moreBtn = () =>
      Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Carica altre lezioni'),
      );

    moreBtn()!.click();
    http
      .expectOne(isList)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    moreBtn()!.click();
    const retry = http.expectOne(isList);
    expect(retry.request.params.get('page')).toBe('2'); // non 3
    retry.flush(
      pageOf(
        Array.from({ length: 6 }, (_, i) => lessonOf(`m${i}`)),
        2,
        30,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelectorAll('article.lesson-card').length).toBe(30);
  });

  // ── Click-to-load del player: vincolo LEGALE, non estetico ──────────────--
  //
  // Il player bunny scrive in localStorage già al CARICAMENTO dell'iframe (non
  // al play): l'esimente dell'art. 122 Codice Privacy poggia sul fatto che
  // l'iframe non esiste finché l'utente non chiede il video. Montarlo al
  // caricamento della pagina la farebbe cadere — con essa la conclusione
  // "niente banner cookie". Finora nessun test lo proteggeva.

  it('il player NON è montato prima del clic (vincolo art. 122)', async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf([lessonOf('l1', { bunnyEmbedUrl: 'https://iframe.mediadelivery.net/embed/1/g' })], 1, 1),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-bunny-player')).toBeNull();
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.querySelector('.lesson-card__poster')).not.toBeNull();
  });

  it('il clic monta il player e registra l\'apertura (fire-and-forget)', async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf([lessonOf('l1', { bunnyEmbedUrl: 'https://iframe.mediadelivery.net/embed/1/g' })], 1, 1),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.lesson-card__poster')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-bunny-player')).not.toBeNull();
    const req = http.expectOne(`${API}/lessons/l1/view`);
    expect(req.request.method).toBe('POST');
    // il badge "già visto" compare subito, senza aspettare la risposta
    expect(el.textContent).toContain('Vista');
    req.flush({ ok: true });
  });

  it("se il tracking fallisce, la visione non ne risente e l'errore non si vede", async () => {
    http
      .expectOne(isList)
      .flush(
        pageOf([lessonOf('l1', { bunnyEmbedUrl: 'https://iframe.mediadelivery.net/embed/1/g' })], 1, 1),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.lesson-card__poster')!.click();
    await fixture.whenStable();
    http
      .expectOne(`${API}/lessons/l1/view`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.querySelector('app-bunny-player')).not.toBeNull();
    expect(el.textContent).not.toContain('non riuscito');
  });
});
