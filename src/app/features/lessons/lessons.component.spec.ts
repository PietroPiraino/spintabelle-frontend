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
import { AuthService } from '../../core/services/auth.service';
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

    // ⚠️ Sessione finta OBBLIGATORIA da quando /lezioni non ha più `authGuard`.
    // La rotta è prerenderizzata e il componente monta anche per un anonimo: il
    // caricamento parte da un effect gated su `auth.user()`, e senza utente non
    // parte NESSUNA chiamata (renderebbe il teaser pubblico). Prima le chiamate
    // erano nel costruttore e partivano sempre.
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'test@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges(); // fa girare l'effect

    // i tag della toolbar partono col primo utente disponibile
    http.expectOne(`${API}/lessons/tags`).flush(['icm', '3bet']);
    // e con loro le lezioni già viste (badge "già visto"): una sola richiesta
    // per sessione, best-effort — va comunque consumata o http.verify() fallisce
    http.expectOne(`${API}/lessons/my-views`).flush([]);
    // ⚠️ Terza chiamata dell'effect: i conteggi per categoria. Va consumata o
    // `afterEach(http.verify())` fa fallire OGNI spec del blocco, con un
    // messaggio che nomina l'URL ma non la spec — cioè manda a cercare il
    // difetto nel posto sbagliato.
    http
      .expectOne(`${API}/lessons/sommario`)
      .flush({ categorie: [], senzaCategoria: 0 });
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

// ── Card in evidenza, chip dei filtri, taglio dei tag ────────────────────────
//
// ⚠️ Queste spec proteggono cose che NESSUNA guardia di build può vedere: le
// guardie di `npm run build` leggono il ramo ANONIMO (pavimento parole, un solo
// h1, canonical), cioè l'unica metà che questo lotto non tocca. `npm run build`
// verde con il ramo autenticato rotto è uno stato raggiungibile.

describe('LessonsComponent — evidenza, chip dei filtri, taglio dei tag', () => {
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
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'test@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(`${API}/lessons/tags`).flush(['icm', '3bet']);
    http.expectOne(`${API}/lessons/my-views`).flush([]);
    // ⚠️ Terza chiamata dell'effect: i conteggi per categoria. Va consumata o
    // `afterEach(http.verify())` fa fallire OGNI spec del blocco, con un
    // messaggio che nomina l'URL ma non la spec — cioè manda a cercare il
    // difetto nel posto sbagliato.
    http
      .expectOne(`${API}/lessons/sommario`)
      .flush({ categorie: [], senzaCategoria: 0 });
  });

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;

  const carica = async (n: number, total = n) => {
    http.expectOne(isList).flush(
      pageOf(
        Array.from({ length: n }, (_, i) => lessonOf(`l${i}`)),
        1,
        total,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const cliccaTag = (nome: string) =>
    (
      Array.from(el().querySelectorAll('.lessons__tags button')).find(
        (b) => b.textContent?.trim() === nome,
      ) as HTMLButtonElement
    ).click();

  it('mette la prima lezione in evidenza e NON la ripete in griglia', async () => {
    await carica(5);
    // una in evidenza + quattro in griglia: il totale resta 5, cioè il dedup,
    // il conteggio e l'offset non si accorgono di niente
    expect(el().querySelectorAll('.lesson-card--hero').length).toBe(1);
    expect(el().querySelectorAll('article.lesson-card').length).toBe(5);
    expect(el().querySelectorAll('.grid article.lesson-card').length).toBe(4);
    expect(el().textContent).toContain("L'ultima lezione");
    // ed è la PRIMA dell'elenco, non una a caso
    expect(el().querySelector('.lesson-card--hero h2')!.textContent).toContain(
      'Lezione l0',
    );
  });

  it("con UNA sola lezione non c'è evidenza: sarebbe una card sopra una griglia vuota", async () => {
    await carica(1);
    expect(el().querySelector('.lesson-card--hero')).toBeNull();
    expect(el().querySelectorAll('article.lesson-card').length).toBe(1);
  });

  it("⚠️ l'evidenza sparisce appena un filtro è attivo", async () => {
    await carica(5);
    expect(el().querySelector('.lesson-card--hero')).not.toBeNull();

    cliccaTag('icm');
    http.expectOne(isList).flush(pageOf([lessonOf('a'), lessonOf('b')], 1, 2));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el().querySelector('.lesson-card--hero')).toBeNull();
    // ...e al suo posto la pagina DICE che cosa sta mostrando, invece di far
    // sembrare che una card sia svanita
    expect(el().textContent).toContain('Argomento: icm');
  });

  it('⚠️ il player non è montato prima del clic NEMMENO sulla card in evidenza', async () => {
    // Stesso vincolo art. 122 della griglia, e vale per costruzione: le due
    // card condividono UN solo `<ng-template #media>`, cioè un solo punto di
    // montaggio dell'iframe. Questa spec esiste perché quella condivisione non
    // si rompa in silenzio il giorno in cui qualcuno duplica il blocco.
    http.expectOne(isList).flush(
      pageOf(
        [
          lessonOf('l1', {
            bunnyEmbedUrl: 'https://iframe.mediadelivery.net/embed/1/g',
          }),
          lessonOf('l2'),
        ],
        1,
        2,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const hero = el().querySelector('.lesson-card--hero')!;
    expect(hero.querySelector('app-bunny-player')).toBeNull();
    expect(hero.querySelector('iframe')).toBeNull();

    hero.querySelector<HTMLButtonElement>('.lesson-card__poster')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(hero.querySelector('app-bunny-player')).not.toBeNull();
    http.expectOne(`${API}/lessons/l1/view`).flush({ ok: true });
  });

  it("⚠️ il ritardo dell'animazione resta relativo al BATCH, non all'indice di griglia", async () => {
    // Con la prima lezione fuori dalla griglia gli indici scalano di uno. Se il
    // ritardo seguisse l'indice di griglia, la prima card del secondo batch
    // prenderebbe 1380ms — e `.rise` ha `animation-fill-mode: both`, cioè
    // 1380ms passati a `opacity: 0` dopo aver premuto «Carica altre lezioni».
    await carica(24, 30);
    const more = Array.from(el().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Carica altre lezioni'),
    );
    more!.click();
    http.expectOne(isList).flush(
      pageOf(
        Array.from({ length: 6 }, (_, i) => lessonOf(`m${i}`)),
        2,
        30,
      ),
    );
    await fixture.whenStable();
    fixture.detectChanges();

    const inGriglia = el().querySelectorAll<HTMLElement>(
      'article.lesson-card.rise',
    );
    expect(inGriglia.length).toBe(29); // 30 meno quella in evidenza
    // indice di griglia 23 = 24ª lezione assoluta = prima del secondo batch
    expect(inGriglia[23].style.animationDelay).toBe('0ms');
    expect(inGriglia[22].style.animationDelay).toBe('1380ms');
  });

  it('i chip dei filtri attivi spengono UN filtro per volta', async () => {
    await carica(5);
    expect(el().querySelector('.lessons__attivi')).toBeNull();

    cliccaTag('icm');
    http.expectOne(isList).flush(pageOf([lessonOf('a')], 1, 1));
    await fixture.whenStable();
    fixture.detectChanges();

    const chip = el().querySelector<HTMLButtonElement>('.lessons__chip')!;
    expect(chip.textContent).toContain('icm');

    chip.click();
    const req = http.expectOne(isList);
    expect(req.request.params.has('tags')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([lessonOf('a'), lessonOf('b')], 1, 2));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el().querySelector('.lessons__attivi')).toBeNull();
  });

  it('in griglia i tag si fermano a quattro; in evidenza restano tutti', async () => {
    const molti = ['a', 'b', 'c', 'd', 'e', 'f'];
    http
      .expectOne(isList)
      .flush(
        pageOf(
          [lessonOf('h', { tags: molti }), lessonOf('g', { tags: molti })],
          1,
          2,
        ),
      );
    await fixture.whenStable();
    fixture.detectChanges();

    // in evidenza c'è spazio: si leggono tutti
    const hero = el().querySelector('.lesson-card--hero')!;
    expect(hero.querySelectorAll('.lesson-card__taglist button').length).toBe(6);
    expect(hero.querySelector('.lesson-card__tag-piu')).toBeNull();

    // in griglia si fermano a quattro, e il resto è un'ETICHETTA non cliccabile
    // (un `<button class="badge--tag">` si alzerebbe a 44px per regola globale)
    const inGriglia = el().querySelector('.grid article.lesson-card')!;
    expect(
      inGriglia.querySelectorAll('.lesson-card__taglist button').length,
    ).toBe(4);
    const piu = inGriglia.querySelector('.lesson-card__tag-piu')!;
    expect(piu.tagName).toBe('SPAN');
    expect(piu.textContent!.trim()).toBe('+2');
    expect(piu.getAttribute('title')).toBe('e, f');
  });
});

// ── La fila degli argomenti è adattiva al numero di tag ──────────────────────

describe('LessonsComponent — fila degli argomenti, adattiva', () => {
  const isList = (r: { url: string }) => r.url === `${API}/lessons`;

  /** Monta il componente con un elenco di tag deciso dal caso di prova. */
  const monta = async (tags: string[]) => {
    await TestBed.configureTestingModule({
      imports: [LessonsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LessonsComponent);
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'test@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(`${API}/lessons/tags`).flush(tags);
    http.expectOne(`${API}/lessons/my-views`).flush([]);
    // ⚠️ Terza chiamata dell'effect: i conteggi per categoria. Va consumata o
    // `afterEach(http.verify())` fa fallire OGNI spec del blocco, con un
    // messaggio che nomina l'URL ma non la spec — cioè manda a cercare il
    // difetto nel posto sbagliato.
    http
      .expectOne(`${API}/lessons/sommario`)
      .flush({ categorie: [], senzaCategoria: 0 });
    http.expectOne(isList).flush(pageOf([lessonOf('a'), lessonOf('b')], 1, 2));
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  };

  const nTag = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

  it('con pochi tag la fila resta nuda: un disclosure su cinque bottoni è una perdita', async () => {
    const { http, el } = await monta(nTag(5));
    expect(el.querySelector('.lessons__argomenti')).toBeNull();
    expect(el.querySelectorAll('.lessons__tags button').length).toBe(5);
    http.verify();
  });

  it('sopra la soglia si richiude in un <details> NATIVO, e i bottoni restano nel DOM', async () => {
    const { http, el } = await monta(nTag(12));
    const det = el.querySelector<HTMLDetailsElement>('.lessons__argomenti')!;
    expect(det.tagName).toBe('DETAILS');
    expect(det.open).toBe(false);
    expect(det.querySelector('summary')!.textContent).toContain(
      'Filtra per argomento (12)',
    );
    // ⚠️ Il verso che conta: CHIUSO non vuol dire ASSENTE. Con un `@if` i
    // bottoni sparirebbero dal DOM, e con loro la spec che ne clicca uno.
    expect(el.querySelectorAll('.lessons__tags button').length).toBe(12);
    // e con dodici tag la ricerca interna non serve ancora
    expect(el.querySelector('.lessons__cerca-tag')).toBeNull();
    http.verify();
  });

  it('con molti tag compare la ricerca interna, che NON è un input[type=search]', async () => {
    const { fixture, http, el } = await monta([...nTag(24), 'zulu']);
    const cerca = el.querySelector<HTMLInputElement>('.lessons__cerca-tag')!;
    // ⚠️ Se fosse `type="search"`, la spec della ricerca in testata
    // (`querySelector('input[type="search"]')`) troverebbe QUESTO campo, che
    // fa tutt'altro: filtra i tag in locale, non interroga il server.
    expect(cerca.type).toBe('text');
    expect(
      el.querySelector<HTMLInputElement>('input[type="search"]')!.className,
    ).toContain('lessons__search');

    cerca.value = 'zul';
    cerca.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(
      Array.from(el.querySelectorAll('.lessons__tags button')).map((b) =>
        b.textContent!.trim(),
      ),
    ).toEqual(['zulu']);
    // la ricerca fra i tag è client-side: nessuna richiesta parte
    http.verify();
  });
});

// ── Le pillole di categoria: l'asse primario ─────────────────────────────────

describe('LessonsComponent — categorie', () => {
  let fixture: ComponentFixture<LessonsComponent>;
  let http: HttpTestingController;

  const isList = (r: { url: string }) => r.url === `${API}/lessons`;
  const isTags = (r: { url: string }) => r.url === `${API}/lessons/tags`;

  const SOMMARIO = {
    categorie: [
      { categoria: 'fondamentali' as const, count: 2 },
      { categoria: '3-max' as const, count: 12 },
      { categoria: 'sessioni-live' as const, count: 3 },
    ],
    senzaCategoria: 1,
  };

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
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'test@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(isTags).flush(['icm', '3bet']);
    http.expectOne(`${API}/lessons/my-views`).flush([]);
    http.expectOne(`${API}/lessons/sommario`).flush(SOMMARIO);
    http.expectOne(isList).flush(pageOf([lessonOf('a'), lessonOf('b')], 1, 18));
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const pillole = () =>
    Array.from(el().querySelectorAll<HTMLButtonElement>('.lessons__cats button'));

  it('disegna «Tutte» + una pillola per categoria, col conteggio del catalogo', () => {
    // ⚠️ «Tutte 18» e non «Tutte»: il totale del catalogo disambigua dalla
    // pillola «Tutte» degli stakes, una riga più sotto.
    expect(pillole().map((b) => b.textContent!.replace(/\s+/g, ' ').trim())).toEqual([
      'Tutte 18',
      'Fondamentali 2',
      '3-max 12',
      'Sessioni dal vivo 3',
    ]);
    // ⚠️ Le cinque categorie a zero non compaiono: è il server a filtrarle, e la
    // riga dice quanto catalogo c'è davvero, non quanto ne era stato immaginato.
    expect(pillole().length).toBe(4);
  });

  it('⚠️ l’asse primario porta lo stato FORTE, quello secondario no', () => {
    // Due assi con lo stesso identico stato attivo si appiattiscono, ed è
    // precisamente il «confusionario» da cui questo lotto nasce.
    expect(pillole()[0].classList).toContain('is-active--forte');
    const tag = el().querySelector('.lessons__tags button')!;
    expect(tag.classList).not.toContain('is-active--forte');
    // ...ed è una scelta ESCLUSIVA, quindi radiogroup e non aria-pressed
    expect(
      el().querySelector('.lessons__cats')!.getAttribute('role'),
    ).toBe('radiogroup');
    expect(pillole()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('scegliere una categoria riparte da pagina 1 e RISTRINGE i tag a quella categoria', async () => {
    pillole()[2].click(); // 3-max

    // i tag si richiedono di nuovo, stavolta con la categoria
    const tagReq = http.expectOne(isTags);
    expect(tagReq.request.params.get('categoria')).toBe('3-max');
    tagReq.flush(['btn', 'bb bvb']);

    const req = http.expectOne(isList);
    expect(req.request.params.get('categoria')).toBe('3-max');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pageOf([lessonOf('c')], 1, 12));
    await fixture.whenStable();
    fixture.detectChanges();

    // la pagina dichiara che cosa sta mostrando
    expect(el().textContent).toContain('3-max');
    // ...e i conteggi delle pillole NON si muovono: sono la dimensione del
    // catalogo, non del risultato filtrato
    expect(pillole()[2].textContent).toContain('12');
  });

  it('⚠️ cambiando categoria i tag scelti si azzerano', async () => {
    // Sopravvivendo al cambio resterebbero accesi filtri che nella nuova
    // categoria non esistono, e la lista uscirebbe vuota senza spiegazione.
    const tag = Array.from(
      el().querySelectorAll<HTMLButtonElement>('.lessons__tags button'),
    ).find((b) => b.textContent?.trim() === 'icm')!;
    tag.click();
    http.expectOne(isList).flush(pageOf([lessonOf('a')], 1, 1));
    await fixture.whenStable();
    fixture.detectChanges();

    pillole()[1].click(); // Fondamentali
    http.expectOne(isTags).flush(['teoria']);
    const req = http.expectOne(isList);
    expect(req.request.params.has('tags')).toBe(false);
    expect(req.request.params.get('categoria')).toBe('fondamentali');
    req.flush(pageOf([lessonOf('d')], 1, 2));
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('la categoria ha il suo chip removibile fra i filtri attivi', async () => {
    pillole()[3].click(); // Sessioni dal vivo
    http.expectOne(isTags).flush(['live']);
    http.expectOne(isList).flush(pageOf([lessonOf('e')], 1, 3));
    await fixture.whenStable();
    fixture.detectChanges();

    const chip = el().querySelector<HTMLButtonElement>('.lessons__chip')!;
    expect(chip.textContent).toContain('Sessioni dal vivo');

    chip.click();
    http.expectOne(isTags).flush(['icm', '3bet']);
    const req = http.expectOne(isList);
    expect(req.request.params.has('categoria')).toBe(false);
    req.flush(pageOf([lessonOf('a'), lessonOf('b')], 1, 18));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(pillole()[0].getAttribute('aria-checked')).toBe('true');
  });

  it('⚠️ senza sommario la pagina funziona lo stesso: la riga semplicemente non c’è', async () => {
    // Best-effort: contro un backend vecchio `/lessons/sommario` cade su
    // `@Get(':id')` e torna 404. La lista non deve accorgersene.
    const f2 = TestBed.createComponent(LessonsComponent);
    f2.detectChanges();
    http.expectOne(isTags).flush([]);
    http.expectOne(`${API}/lessons/my-views`).flush([]);
    http
      .expectOne(`${API}/lessons/sommario`)
      .flush('nope', { status: 404, statusText: 'Not Found' });
    http.expectOne(isList).flush(pageOf([lessonOf('z')], 1, 1));
    await f2.whenStable();
    f2.detectChanges();

    const el2 = f2.nativeElement as HTMLElement;
    expect(el2.querySelector('.lessons__cats')).toBeNull();
    expect(el2.querySelectorAll('article.lesson-card').length).toBe(1);
  });
});
