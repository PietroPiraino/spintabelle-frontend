import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { DrillConfigComponent } from './drill-config.component';

const API = environment.API_URL;

/**
 * Prima di questo file `features/drills/` non aveva alcuna spec di componente.
 * Quello che si prova qui è ciò che nessuna guardia di build può vedere: le
 * guardie leggono il ramo ANONIMO di /allenamento (506 parole, un solo h1,
 * canonical), cioè l'unica metà che questo lotto non tocca.
 */
describe('DrillConfigComponent — costruttore e percorsi', () => {
  let fixture: ComponentFixture<DrillConfigComponent>;
  let http: HttpTestingController;

  /** Meta ridotta ma REALE nella forma: due giochi, ante su entrambi,
   *  asimmetrico solo su spin — è la ragione per cui l'interruttore sparisce. */
  const META = {
    formats: [
      { format: 'spin', depths: ['5', '10', '25'] },
      { format: 'spin_ante', depths: ['5.17', '10.17', '25.17'] },
      { format: 'spin_asymmetric', depths: ['10', '25'] },
      { format: 'husng', depths: ['5', '10', '25'] },
      { format: 'husng_ante', depths: ['5.125', '10.125'] },
    ],
    depths: [],
  };

  const COMBOS = {
    combos: [
      { format: 'spin', depth: '5', position: 'BTN', spotType: 'OPEN' },
      { format: 'spin', depth: '5', position: 'BB', spotType: 'VS_OPEN' },
      { format: 'spin', depth: '5', position: 'BB', spotType: 'LIMPED' },
      { format: 'spin', depth: '25', position: 'BTN', spotType: 'OPEN' },
      { format: 'spin', depth: '25', position: 'SB', spotType: 'VS_3BET' },
      { format: 'husng', depth: '10', position: 'SB', spotType: 'OPEN' },
    ],
  };

  /** Storico finto: due bucket sani, uno CORROTTO dal ripiego sulla chiave. */
  const STATS = {
    totalAnswered: 120,
    totalCorrect: 80,
    accuracyPct: 66,
    avgEvLoss: 0.1,
    totalEvLoss: 12,
    sessionsCompleted: 6,
    buckets: [],
    worstBuckets: [
      { key: 'spin|10', format: 'spin', depthLabel: '10', answered: 9, correct: 4, avgEvLoss: 0.4 },
      { key: 'spin|25', format: 'spin', depthLabel: '25', answered: 7, correct: 3, avgEvLoss: 0.3 },
      // ⚠️ La forma che il ripiego su `key.split('|')` produce sulle righe
      // scritte prima che `format`/`depthLabel` esistessero: la virgola al
      // posto del punto. I DTO la rifiutano — e deve sparire QUI.
      {
        key: 'spin_ante_2,5x_nolimp|10,17',
        format: 'spin_ante_2,5x_nolimp',
        depthLabel: '10,17',
        answered: 5,
        correct: 1,
        avgEvLoss: 0.9,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrillConfigComponent],
      providers: [
        provideZonelessChangeDetection(),
        // ⚠️ La rotta della sessione DEVE esistere: `start()` naviga, e con un
        // router vuoto ogni avvio rigetta con NG04002. Non è un dettaglio del
        // test — sono rejection non gestite che fanno cadere l'intero runner
        // Karma per timeout, con un errore che non nomina questa spec.
        provideRouter([{ path: 'allenamento/sessione', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DrillConfigComponent);
    http = TestBed.inject(HttpTestingController);
    // ⚠️ Senza utente non parte NIENTE: la rotta è pubblica e prerenderizzata,
    // e il caricamento vive in un effect gated su `auth.user()`.
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'qa@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(`${API}/preflop/meta`).flush(META);
    http.expectOne(`${API}/drills/options`).flush(COMBOS);
    // ⚠️ Terza chiamata dell'effect: lo storico, che alimenta il solo percorso
    // «Le tue situazioni peggiori». Va consumata o `afterEach(http.verify())`
    // fa fallire OGNI spec del file, con un messaggio che nomina l'URL e non
    // la spec.
    // ⚠️ QUARTA chiamata dell'effect: i preset. Ogni volta che il componente ne
    // aggiunge una, questa lista va allungata — o `afterEach(http.verify())`
    // fa fallire OGNI spec del blocco con un messaggio che nomina l'URL e non
    // la spec, mandando a cercare il difetto nel posto sbagliato.
    http.expectOne(`${API}/drills/presets`).flush([]);
    http.expectOne(`${API}/drills/stats`).flush(STATS);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const bottoni = (sel: string) =>
    Array.from(el().querySelectorAll<HTMLButtonElement>(sel));
  const perTesto = (sel: string, testo: string) =>
    bottoni(sel).find((b) => b.textContent?.trim() === testo)!;

  // ── Il costruttore ────────────────────────────────────────────────────────

  it('⚠️ apre sul COSTRUTTORE, senza disclosure e senza riga di contesto', () => {
    // Fino al 04/09/2026 apriva sui percorsi con «Personalizza» chiuso, e sopra
    // c'era una riga «Gioco / Varianti / Durata» che scriveva lo STESSO signal
    // della tendina Formato — due controlli sullo stesso dato, e toccare
    // «Gioco» collassava in silenzio una selezione multipla a un formato solo.
    expect(el().querySelectorAll('app-multi-select').length).toBe(4);
    expect(el().querySelector('.dc__personalizza')).toBeNull();
    expect(el().querySelector('.dc__contesto')).toBeNull();
    // e il pulsante di partenza è subito lì, non dietro un clic
    expect(el().querySelector('.dc__riepilogo-azioni .btn--primary')).not.toBeNull();
  });

  it('i quattro assi ci sono, e la situazione ha CINQUE voci', () => {
    const etichette = Array.from(
      el().querySelectorAll('.ms__label'),
    ).map((e) => e.textContent!.trim());
    expect(etichette).toEqual([
      'Formato',
      'Profondità',
      'La tua posizione',
      'Situazione',
    ]);
    // ⚠️ `LIMPED` mancava del tutto: il backend lo accetta da sempre.
    expect(el().textContent).toContain('Piatto non aperto');
  });

  it('⚠️ la durata sta DENTRO il costruttore, non in una riga a parte', () => {
    // Era salita nel contesto quando i percorsi erano l'elemento principale;
    // ora che lo è il costruttore, tenerla fuori spezzerebbe in due la
    // costruzione della sessione.
    expect(el().querySelector('#dc-manuale')).toBeNull();
    expect(el().textContent).toContain('Numero di mani');
  });

  it('la durata scelta arriva nel payload', async () => {
    perTesto('[role="radio"]', '50').click();
    fixture.detectChanges();
    el().querySelector<HTMLButtonElement>('.dc__riepilogo-azioni .btn--primary')!.click();
    await fixture.whenStable();
    const req = http.expectOne(`${API}/drills/sessions`);
    expect(
      (req.request.body as { questionsPerSession: number }).questionsPerSession,
    ).toBe(50);
    req.flush({ id: 's3', questionsPerSession: 50 });
    http.expectOne(`${API}/drills/sessions/s3/next`).flush({ finished: true });
  });

  // ── Percorsi ──────────────────────────────────────────────────────────────

  it('ogni percorso porta la sua riga di dettaglio, generata dai dati', () => {
    const testo = el().textContent!;
    expect(testo).toContain('Push or fold sotto i 10 bb');
    expect(testo).toContain('fino a 10 bb');
    expect(testo).toContain('situazioni');
  });

  it('⚠️ far partire un percorso SCRIVE i signal e usa lo start() di sempre', async () => {
    // ⚠️ Righe uniformi, niente card in evidenza: i percorsi sono scorciatoie
    // sotto il costruttore, non l'elemento principale della pagina.
    const riga = Array.from(el().querySelectorAll('.dc__riga')).find((r) =>
      r.textContent?.includes('Push or fold'),
    )!;
    riga.querySelector<HTMLButtonElement>('.dc__riga-azione')!.click();
    await fixture.whenStable();

    const req = http.expectOne(`${API}/drills/sessions`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as {
      formats: string[];
      depths: string[];
      positions: string[];
      spotTypes: string[];
      difficulty: string;
      questionsPerSession: number;
    };
    // Nessun campo nuovo: è esattamente il payload di prima.
    expect(Object.keys(body).sort()).toEqual([
      'depths',
      'difficulty',
      'formats',
      'positions',
      'questionsPerSession',
      'spotTypes',
    ]);
    // «fino a 10 bb» su `spin` = le etichette 5 e 10, non 25
    expect(body.depths.sort()).toEqual(['10', '5']);
    expect(body.positions).toEqual([]);
    expect(body.difficulty).toBe('STANDARD');
    expect(body.questionsPerSession).toBe(20);
    req.flush({ id: 's1', questionsPerSession: 20 });
    http.expectOne(`${API}/drills/sessions/s1/next`).flush({ finished: true });
  });

  it('⚠️ un percorso senza estremi manda `depths: []`, non tutte le etichette', async () => {
    // `[]` per il backend significa «qualunque»: è anche l'unica forma che non
    // può sfondare `@ArrayMaxSize` quando i formati accesi sono tanti.
    // ⚠️ Si cerca la riga PER NOME e non «l'ultima»: l'elenco è editoriale e
    // cresce (l'ultima è diventata «Le tue situazioni peggiori» il giorno in
    // cui è arrivata), e un test ancorato alla posizione fallisce per un motivo
    // che non c'entra con ciò che prova.
    const riga = Array.from(el().querySelectorAll('.dc__riga')).find((r) =>
      r.textContent?.includes('Allenamento misto'),
    )!;
    riga.querySelector<HTMLButtonElement>('.dc__riga-azione')!.click();
    await fixture.whenStable();
    const req = http.expectOne(`${API}/drills/sessions`);
    expect((req.request.body as { depths: string[] }).depths).toEqual([]);
    req.flush({ id: 's2', questionsPerSession: 20 });
    http.expectOne(`${API}/drills/sessions/s2/next`).flush({ finished: true });
  });

  const rigaPeggiori = () =>
    Array.from(el().querySelectorAll('.dc__riga')).find((r) =>
      r.textContent?.includes('Le tue situazioni peggiori'),
    )!;

  it('⚠️ scarta i bucket CORROTTI dal ripiego sulla chiave di byBucket', async () => {
    // `bucketKey` sostituisce ogni `.` con `,`: dal ripiego escono `"10,17"` e
    // `"spin_ante_2,5x_nolimp"`, che i DTO rifiutano ENTRAMBI. Filtrarli qui è
    // ciò che evita un 400 sull'intera chiamata, per un array che l'utente non
    // ha mai visto, sulla schermata del runner.
    const testo = rigaPeggiori().textContent!;
    expect(testo).toContain('Spin & Go');
    expect(testo).not.toContain('2,5x');
    expect(testo).not.toContain('10,17');

    rigaPeggiori().querySelector<HTMLButtonElement>('.dc__riga-azione')!.click();
    await fixture.whenStable();
    const req = http.expectOne(`${API}/drills/sessions`);
    const body = req.request.body as { formats: string[]; depths: string[] };
    expect(body.formats).toEqual(['spin']);
    expect(body.depths.sort()).toEqual(['10', '25']);
    req.flush({ id: 'sp', questionsPerSession: 20 });
    http.expectOne(`${API}/drills/sessions/sp/next`).flush({ finished: true });
  });

  it('⚠️ scrive anche i SIGNAL: il costruttore non deve mentire su cosa è partito', async () => {
    rigaPeggiori().querySelector<HTMLButtonElement>('.dc__riga-azione')!.click();
    await fixture.whenStable();
    http
      .expectOne(`${API}/drills/sessions`)
      .flush({ id: 'sp', questionsPerSession: 20 });
    http.expectOne(`${API}/drills/sessions/sp/next`).flush({ finished: true });
    fixture.detectChanges();

    // ⚠️ Il costruttore è sempre visibile: il trigger delle profondità deve
    // dire le stesse che sono appena partite, non «tutte le profondità».
    const prof = Array.from(el().querySelectorAll('app-multi-select')).find(
      (m) => m.textContent?.includes('Profondità'),
    )!;
    expect(prof.textContent).toContain('da 10 a 25 bb');
  });
});

// ── Storico troppo corto: la voce resta, spenta, col motivo ─────────────────

describe('DrillConfigComponent — «situazioni peggiori» senza materiale', () => {
  const META = { formats: [{ format: 'spin', depths: ['10'] }], depths: [] };

  const monta = async (stats: Record<string, unknown>) => {
    await TestBed.configureTestingModule({
      imports: [DrillConfigComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'allenamento/sessione', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DrillConfigComponent);
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'qa@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(`${API}/preflop/meta`).flush(META);
    http.expectOne(`${API}/drills/options`).flush({ combos: [] });
    http.expectOne(`${API}/drills/presets`).flush([]);
    http.expectOne(`${API}/drills/stats`).flush(stats);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, http, el: fixture.nativeElement as HTMLElement };
  };

  const vuoto = {
    totalAnswered: 0,
    totalCorrect: 0,
    accuracyPct: 0,
    avgEvLoss: 0,
    totalEvLoss: 0,
    sessionsCompleted: 0,
    buckets: [],
    worstBuckets: [],
  };

  it('⚠️ chi non si è ancora allenato vede la voce SPENTA col motivo, non un buco', async () => {
    // Una voce che compare e scompare a seconda di quanto hai giocato fa
    // cercare un guasto; il motivo dice che cosa fare per accenderla.
    const { http, el } = await monta(vuoto);
    const riga = Array.from(el.querySelectorAll('.dc__riga')).find((r) =>
      r.textContent?.includes('Le tue situazioni peggiori'),
    )!;
    expect(riga).toBeDefined();
    expect(riga.classList).toContain('is-vuoto');
    expect(riga.textContent).toContain('almeno 30 risposte');
    expect(
      riga.querySelector<HTMLButtonElement>('.dc__riga-azione')!.disabled,
    ).toBe(true);
    http.verify();
  });

  it('con abbastanza risposte ma nessun bucket utile lo dice, invece di tacere', async () => {
    const { http, el } = await monta({ ...vuoto, totalAnswered: 120 });
    const riga = Array.from(el.querySelectorAll('.dc__riga')).find((r) =>
      r.textContent?.includes('Le tue situazioni peggiori'),
    )!;
    expect(riga.textContent).toContain('Non abbiamo ancora abbastanza risposte');
    // ⚠️ e NON anche il messaggio generico: sarebbe un secondo motivo, pure falso
    expect(riga.textContent).not.toContain('Nessuna situazione di questo tipo');
    http.verify();
  });

  it('⚠️ se lo storico non arriva la pagina funziona lo stesso', async () => {
    // Best-effort: senza, la pagina perderebbe un percorso, non la config.
    await TestBed.configureTestingModule({
      imports: [DrillConfigComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'allenamento/sessione', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(DrillConfigComponent);
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'qa@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(`${API}/preflop/meta`).flush(META);
    http.expectOne(`${API}/drills/options`).flush({ combos: [] });
    http.expectOne(`${API}/drills/presets`).flush([]);
    http
      .expectOne(`${API}/drills/stats`)
      .flush('boom', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // il costruttore c'è comunque: lo storico alimenta un percorso, non la config
    expect(el.querySelectorAll('app-multi-select').length).toBe(4);
    expect(el.textContent).toContain('Le tue situazioni peggiori');
    http.verify();
  });
});

// ── I preset: le configurazioni salvate dallo studente ──────────────────────

describe('DrillConfigComponent — preset', () => {
  let fixture: ComponentFixture<DrillConfigComponent>;
  let http: HttpTestingController;

  const META = {
    formats: [{ format: 'spin', depths: ['5', '10', '25'] }],
    depths: [],
  };
  const COMBOS = {
    combos: [
      { format: 'spin', depth: '5', position: 'BTN', spotType: 'OPEN' },
      { format: 'spin', depth: '10', position: 'BB', spotType: 'VS_OPEN' },
    ],
  };
  const VUOTO = {
    totalAnswered: 0,
    totalCorrect: 0,
    accuracyPct: 0,
    avgEvLoss: 0,
    totalEvLoss: 0,
    sessionsCompleted: 0,
    buckets: [],
    worstBuckets: [],
  };
  const PRESET = [
    {
      id: 'p1',
      nome: 'Spin & Go da 5 a 10 bb',
      formats: ['spin'],
      depths: ['5', '10'],
      positions: ['BB'],
      spotTypes: [],
      difficulty: 'MARGINAL',
      questionsPerSession: 50,
    },
  ];

  const monta = async (preset: unknown[]) => {
    await TestBed.configureTestingModule({
      imports: [DrillConfigComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'allenamento/sessione', children: [] }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DrillConfigComponent);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).user.set({
      id: 'u1',
      email: 'qa@bestfishforever.it',
      role: 'USER',
      verified: true,
    });
    fixture.detectChanges();
    http.expectOne(`${API}/preflop/meta`).flush(META);
    http.expectOne(`${API}/drills/options`).flush(COMBOS);
    http.expectOne(`${API}/drills/presets`).flush(preset);
    http.expectOne(`${API}/drills/stats`).flush(VUOTO);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  afterEach(() => http.verify());

  const perTesto = (el: HTMLElement, testo: string, dentro?: Element) =>
    Array.from((dentro ?? el).querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === testo,
    )!;

  it('⚠️ senza preset la sezione NON compare: una lista vuota sarebbe rumore', async () => {
    // ...e lo sarebbe proprio per chi apre la pagina la prima volta, cioè per
    // chi ha meno bisogno di rumore. Le scorciatoie fisse restano per lui.
    const el = await monta([]);
    expect(el.textContent).not.toContain('I tuoi allenamenti salvati');
    expect(el.textContent).toContain('Oppure parti da qui');
  });

  it('con almeno un preset compare la sezione, INSIEME alle scorciatoie fisse', async () => {
    // ⚠️ Le due sezioni CONVIVONO (decisione owner): chi ha i suoi preset vede
    // entrambe, chi non ne ha vede solo le scorciatoie.
    const el = await monta(PRESET);
    expect(el.textContent).toContain('I tuoi allenamenti salvati');
    expect(el.textContent).toContain('Spin & Go da 5 a 10 bb');
    expect(el.textContent).toContain('Oppure parti da qui');
  });

  it('⚠️ «Carica» scrive il costruttore e NON fa partire la sessione', async () => {
    const el = await monta(PRESET);
    const riga = Array.from(el.querySelectorAll('.dc__riga')).find((r) =>
      r.textContent?.includes('da 5 a 10 bb'),
    )!;
    perTesto(el, 'Carica', riga).click();
    fixture.detectChanges();

    // Un preset è la TUA configurazione: rivederla, o ritoccarne un asse,
    // prima di cominciare è il caso normale.
    http.expectNone(`${API}/drills/sessions`);
    // ...e il costruttore la mostra davvero: le profondità grezze ritradotte
    // nei valori mostrati, non «tutte le profondità».
    const prof = Array.from(el.querySelectorAll('app-multi-select')).find((m) =>
      m.textContent?.includes('Profondità'),
    )!;
    expect(prof.textContent).toContain('da 5 a 10 bb');
    expect(el.textContent).toContain('Solo i mix al fotofinish');
  });

  it('salvare manda la configurazione corrente e ridisegna con la risposta', async () => {
    const el = await monta([]);
    perTesto(el, 'Salva questa configurazione').click();
    fixture.detectChanges();

    const campo = el.querySelector<HTMLInputElement>('#dc-nome-preset')!;
    // ⚠️ Il nome arriva PROPOSTO: un campo vuoto su un telefono fa chiudere e
    // riaprire il modulo.
    expect(campo.value.length).toBeGreaterThan(0);
    campo.value = 'Il mio allenamento';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    perTesto(el, 'Salva').click();
    const req = http.expectOne(`${API}/drills/presets`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as { nome: string; formats: string[] };
    expect(body.nome).toBe('Il mio allenamento');
    expect(body.formats).toEqual(['spin']);
    req.flush(PRESET);
    fixture.detectChanges();
    expect(el.textContent).toContain('I tuoi allenamenti salvati');
  });

  it('⚠️ un errore di salvataggio si VEDE: è da lì che arriva il tetto', async () => {
    const el = await monta([]);
    perTesto(el, 'Salva questa configurazione').click();
    fixture.detectChanges();
    perTesto(el, 'Salva').click();
    http.expectOne(`${API}/drills/presets`).flush(
      {
        message:
          'Hai già salvato 12 configurazioni: cancellane una per farne spazio.',
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    // Un salvataggio che non fa niente in silenzio è il pulsante che si ripreme
    // per sempre.
    expect(el.textContent).toContain('cancellane una');
  });

  it('la cancellazione chiede conferma in linea, senza confirm() nativo', async () => {
    const el = await monta(PRESET);
    const riga = () =>
      Array.from(el.querySelectorAll('.dc__riga')).find((r) =>
        r.textContent?.includes('da 5 a 10 bb'),
      )!;
    perTesto(el, '✕', riga()).click();
    fixture.detectChanges();
    expect(riga().textContent).toContain('Cancella');

    perTesto(el, 'Cancella', riga()).click();
    const req = http.expectOne(`${API}/drills/presets/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush([]);
    fixture.detectChanges();
    expect(el.textContent).not.toContain('I tuoi allenamenti salvati');
  });
});
