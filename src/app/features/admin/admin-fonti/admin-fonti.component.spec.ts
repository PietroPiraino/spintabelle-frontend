import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  HealthStatus,
  NewsSource,
  NewsSourceSeed,
} from '../../../core/models/api.models';
import { AdminFontiComponent } from './admin-fonti.component';

const API = environment.API_URL;
const LISTA = `${API}/admin/news-sources`;
const SEED = `${API}/admin/news-sources/seed`;
const HEALTH = `${API}/health`;

const ORA = Date.now();
const MIN = 60_000;
const ORE = 60 * MIN;
const GIORNI = 24 * ORE;

/** Istante nel passato, in ISO — il pannello riceve stringhe, non `Date`. */
const fa = (ms: number) => new Date(ORA - ms).toISOString();
const fra = (ms: number) => new Date(ORA + ms).toISOString();

const fonteOf = (over: Partial<NewsSource> = {}): NewsSource => ({
  id: over.id ?? 'id-1',
  name: 'Assopoker',
  slug: 'assopoker',
  strategy: 'WP_REST',
  parserKey: 'WP_REST_GENERICO',
  endpointUrl: 'https://www.assopoker.com/wp-json/wp/v2/posts',
  excludeCategoryIds: [16586],
  lingua: 'it',
  pollMinutes: 30,
  enabled: false,
  healthState: 'SANA',
  consecutiveFailures: 0,
  ...over,
});

const seedOf = (over: Partial<NewsSourceSeed> = {}): NewsSourceSeed => ({
  name: 'Somuchpoker',
  slug: 'somuchpoker',
  strategy: 'RSS2',
  parserKey: 'RSS2_GENERICO',
  endpointUrl: 'https://www.somuchpoker.com/rss.xml',
  excludeCategoryIds: [],
  lingua: 'en',
  pollMinutes: 60,
  baselineItemsPerDay: 5.2,
  note: 'Forte su Asia/APT.',
  ...over,
});

const healthOf = (over: Partial<HealthStatus> = {}): HealthStatus => ({
  status: 'ok',
  db: 'up',
  sentry: 'on',
  deployHook: 'on',
  affiliations: 'on',
  newsIngest: 'on',
  newsPipeline: 'on',
  uptime: 1000,
  ...over,
});

describe('AdminFontiComponent', () => {
  let fixture: ComponentFixture<AdminFontiComponent>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const testo = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  const q = <T extends Element>(sel: string) => el().querySelector<T>(sel);
  const qa = (sel: string) => Array.from(el().querySelectorAll(sel));

  const stabile = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const clic = async (sel: string) => {
    const b = q<HTMLButtonElement>(sel);
    if (!b) throw new Error(`Comando assente nel DOM: ${sel}`);
    b.click();
    await stabile();
  };

  /**
   * Scrive in un campo come farebbe un dito: valore **e** evento `input`.
   * ⚠️ Mai i signal a mano — un binding staccato dal template passerebbe.
   */
  const scrivi = async (sel: string, valore: string) => {
    const campo = q<HTMLInputElement | HTMLTextAreaElement>(sel);
    if (!campo) throw new Error(`Campo assente nel DOM: ${sel}`);
    campo.value = valore;
    campo.dispatchEvent(new Event('input'));
    await stabile();
  };

  const scegli = async (sel: string, valore: string) => {
    const campo = q<HTMLSelectElement>(sel);
    if (!campo) throw new Error(`Selettore assente nel DOM: ${sel}`);
    campo.value = valore;
    campo.dispatchEvent(new Event('change'));
    await stabile();
  };

  /** Le tre chiamate d'avvio: elenco, censimento, interruttore generale. */
  const avvia = async (
    fonti: NewsSource[],
    opzioni: {
      seeds?: NewsSourceSeed[];
      salute?: HealthStatus | 'errore';
    } = {},
  ) => {
    http.expectOne(LISTA).flush(fonti);
    http.expectOne(SEED).flush(opzioni.seeds ?? []);
    const salute = opzioni.salute ?? healthOf();
    const req = http.expectOne(HEALTH);
    if (salute === 'errore') {
      req.error(new ProgressEvent('error'), { status: 0, statusText: '' });
    } else {
      req.flush(salute);
    }
    await stabile();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminFontiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminFontiComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it("all'avvio chiede elenco, censimento e stato dell'interruttore generale", async () => {
    await avvia([fonteOf()]);
    expect(testo()).toContain('Assopoker');
    expect(testo()).toContain('1 fonte configurata');
  });

  // ── Il cuore: «spenta» non è «accesa e ferma» ─────────────────────────────

  /**
   * ⚠️ Una sorgente spenta **non viene valutata affatto**: il suo `healthState`
   * è congelato all'ultima volta in cui era accesa e può restare «Morta» per
   * sempre senza che nulla sia rotto. Colorarla di rosso vorrebbe dire mandare
   * l'owner a cercare un guasto in una riga che nessuno sta interrogando.
   */
  it('fonte spenta con stato Morta: nessun allarme, e lo stato è dichiarato congelato', async () => {
    await avvia([
      fonteOf({
        enabled: false,
        healthState: 'MORTA',
        osservataDa: fa(30 * GIORNI),
        lastItemAt: fa(20 * GIORNI),
      }),
    ]);

    expect(q('.fnt-chip')?.getAttribute('data-tono')).toBe('spenta');
    expect(q('.fnt-row')?.getAttribute('data-tono')).toBe('spenta');
    expect(testo()).toContain('Spenta');
    expect(testo()).toContain('Ultima valutazione da accesa: Morta — congelata');
  });

  /**
   * ⚠️ Il caso peggiore del cruscotto, e quello che si confonde più facilmente
   * con «sana»: la fonte è accesa, risponde, e non ha **mai** portato un
   * articolo (endpoint sbagliato, parser che torna zero, filtro che esclude
   * tutto). Lo stato di salute lato server è ancora `SANA` — sotto il pavimento
   * delle 24 ore lo stallo non si giudica — quindi la distinzione la deve fare
   * la schermata.
   */
  it('fonte accesa che non ha ancora portato niente: «in attesa», non «sana»', async () => {
    await avvia([
      fonteOf({
        enabled: true,
        healthState: 'SANA',
        osservataDa: fa(3 * ORE),
        lastSuccessAt: fa(4 * MIN),
      }),
    ]);

    const chip = q('.fnt-chip');
    expect(chip?.getAttribute('data-tono')).toBe('attesa');
    expect(chip?.textContent).toContain('In attesa del primo articolo');
    // ⚠️ «Sotto osservazione», non «accesa»: `osservataDa` non si azzera
    // spegnendo e riaccendendo — vedi la prova dedicata in fondo al file.
    expect(testo()).toContain(
      'Sotto osservazione da 3 ore: non ha ancora portato niente',
    );
    // ⚠️ «in attesa» non deve leggersi come un guasto: non è né allarme né grave.
    expect(q('.fnt-row')?.getAttribute('data-tono')).not.toBe('allarme');
  });

  /**
   * ⚠️ «Mai» dove il dato non c'è ANCORA è una diagnosi inventata: una fonte
   * appena creata non ha un ultimo successo perché non ha ancora provato, ed è
   * un'altra cosa dall'aver provato senza riuscirci.
   */
  it('fonte mai accesa: «non ha ancora provato», non «mai»', async () => {
    await avvia([fonteOf({ enabled: false })]);

    const successo = q('[data-segnale="successo"] strong')?.textContent?.trim();
    const articolo = q('[data-segnale="articolo"] strong')?.textContent?.trim();
    expect(successo).toBe('Non ha ancora provato');
    expect(articolo).toBe('Non ha ancora raccolto');
  });

  /**
   * Il guasto più comune, e quello a cui Sentry è cieco: risponde (un 304
   * aggiorna `lastSuccessAt`) e non pubblica più. Le due date stanno una
   * accanto all'altra proprio perché è l'unico modo di vederlo.
   */
  it('risponde ma non pubblica: le due date e la ragione ricostruita', async () => {
    await avvia([
      fonteOf({
        id: 'piw',
        name: 'PokerItaliaWeb',
        slug: 'pokeritaliaweb',
        enabled: true,
        healthState: 'MORTA',
        healthChangedAt: fa(2 * GIORNI),
        lastSuccessAt: fa(2 * MIN),
        lastItemAt: fa(4 * GIORNI),
        medianGapMinutes: 120,
      }),
    ]);

    expect(q('[data-segnale="successo"] strong')?.textContent).toContain(
      '2 min fa',
    );
    expect(q('[data-segnale="articolo"] strong')?.textContent).toContain(
      '4 giorni fa',
    );
    expect(testo()).toContain('Morta');
    expect(testo()).toContain('Da 2 giorni.');

    await clic('#dettaglio-toggle-piw');
    const perche = qa('.fnt-row__perche li').map((li) => li.textContent ?? '');
    // soglia = max(24 h, 6 × 120 min) = 24 h; 4 giorni la superano di tre volte
    expect(perche.join(' ')).toContain('Nessun articolo nuovo da 4 giorni');
    expect(perche.join(' ')).toContain('(soglia 24 ore)');
    expect(perche.join(' ')).toContain('risponde, ma non pubblica');
  });

  /**
   * ⚠️ I motivi si **accumulano**: il backend fa vincere il peggiore per lo
   * stato, ma «12 fallimenti consecutivi» + «volume sotto il previsto» sulla
   * stessa riga dicono una cosa in più della somma. L'API non espone le sue
   * stringhe, quindi il pannello le ricostruisce — tutte e tre.
   */
  it('le ragioni si accumulano: trasporto e volume insieme', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'MORTA',
        consecutiveFailures: 12,
        lastItemAt: fa(30 * MIN),
        baselineItemsPerDay: 3.5,
        emaItemsPerDay: 0.5,
        osservataDa: fa(30 * GIORNI),
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    const perche = qa('.fnt-row__perche li').map((li) => li.textContent ?? '');
    expect(perche.length).toBe(2);
    expect(perche[0]).toContain('12 fallimenti consecutivi');
    expect(perche[1]).toContain('Volume sotto il previsto');
    expect(perche[1]).toContain('0,5/g contro 3,5/g attesi');
  });

  /**
   * ⚠️ Su una riga spenta l'orologio dello stallo continuerebbe a correre e
   * ogni fonte in archivio finirebbe per accusare uno stallo che **nessuno sta
   * misurando**. Il tick non valuta le righe spente: il pannello nemmeno.
   */
  it('fonte spenta: nessuna diagnosi ricostruita, ma la ragione del silenzio è scritta', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: false,
        healthState: 'DEGRADATA',
        lastItemAt: fa(90 * GIORNI),
        osservataDa: fa(120 * GIORNI),
        consecutiveFailures: 7,
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    expect(qa('.fnt-row__perche li').length).toBe(0);
    expect(testo()).toContain('Una fonte spenta non viene valutata');
  });

  /**
   * ⚠️ «Non lo so ancora» e «va male» sono due elenchi diversi: senza baseline
   * il rilevatore di volume è **inerte** e non darà mai un allarme — dirlo è
   * l'unico modo perché quel silenzio non venga scambiato per un via libera.
   */
  it('senza volume atteso lo dichiara inerte, e non lo trasforma in un allarme', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'SANA',
        lastItemAt: fa(20 * MIN),
        osservataDa: fa(40 * GIORNI),
        medianGapMinutes: 60,
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    expect(qa('.fnt-row__perche li').length).toBe(0);
    const avvisi = qa('.fnt-row__avvisi li').map((li) => li.textContent ?? '');
    expect(avvisi.join(' ')).toContain('Volume atteso non impostato');
    expect(avvisi.join(' ')).toContain('non darà mai un allarme');
    expect(q('.fnt-chip')?.getAttribute('data-tono')).toBe('ok');
  });

  /**
   * ⚠️ Senza questa riga l'owner vede «accesa» e non capisce perché per ore non
   * succede niente: il backoff è ciò che rallenta davvero una fonte rotta.
   */
  it('backoff in corso: lo dice in chiaro, con quanto manca', async () => {
    await avvia([
      fonteOf({
        enabled: true,
        consecutiveFailures: 4,
        backoffUntil: fra(35 * MIN),
        lastSuccessAt: fa(2 * ORE),
      }),
    ]);

    expect(q('.fnt-row__backoff')?.textContent).toContain(
      'Sospesa per altri 35 min',
    );
    expect(testo()).toContain('4 fallimenti di fila');
  });

  /**
   * ⚠️ Il testo dell'errore si **stampa**: su Atlas Flex i log del database non
   * si scaricano e su Render la ritenzione è corta — questa può essere l'ultima
   * copia del messaggio, e un tooltip non è una copia.
   */
  it("l'ultimo errore è stampato per esteso, non nascosto", async () => {
    const messaggio = 'HTTP 403 da www.esempio.it — Forbidden (Cloudflare)';
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'DEGRADATA',
        consecutiveFailures: 3,
        lastErrorAt: fa(12 * MIN),
        lastErrorMessage: messaggio,
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    expect(q('.fnt-row__errore')?.textContent).toContain(messaggio);
  });

  // ── Accendere: un gesto, non un interruttore ──────────────────────────────

  /**
   * ⚠️ Accendere fa partire richieste verso una redazione vera: il primo tocco
   * **non deve scrivere niente**. Niente `confirm()` nativo e niente modale —
   * conferma in linea, come in sala live.
   */
  it('il primo tocco su «Accendi» non accende: apre la conferma in linea', async () => {
    await avvia([fonteOf({ id: 'x', enabled: false })]);

    await clic('.fnt-row__accendi');
    http.expectNone(`${LISTA}/x`);
    expect(q('[data-conferma="accendi"]')).not.toBeNull();
    expect(testo()).toContain('Accendere «Assopoker»?');
  });

  it('il secondo tocco accende, e manda soltanto enabled', async () => {
    await avvia([fonteOf({ id: 'x', enabled: false, pollMinutes: 30 })]);
    await clic('.fnt-row__accendi');
    await clic('[data-conferma="accendi"] .btn--primary');

    const patch = http.expectOne(`${LISTA}/x`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ enabled: true });
    patch.flush(fonteOf({ id: 'x', enabled: true }));

    // ⚠️ Ricarica completa: la riga nuova non basta, il riepilogo e lo stato di
    // salute devono restare quelli che il server ha davvero.
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', enabled: true })]);
    await stabile();
    expect(q('.fnt-row__spegni')).not.toBeNull();
  });

  /**
   * ⚠️ Sono siti veri: accenderne cinque insieme significa non sapere quale si
   * comporta male. La schermata lo **dice** — e non lo vieta.
   */
  it("con una fonte già accesa, la conferma sconsiglia di accenderne un'altra", async () => {
    await avvia([
      fonteOf({ id: 'a', slug: 'assopoker', enabled: true, lastItemAt: fa(MIN) }),
      fonteOf({ id: 'b', name: 'Somuchpoker', slug: 'somuchpoker', enabled: false }),
    ]);

    await clic('.fnt-row__accendi');
    const conferma = q('[data-conferma="accendi"]')?.textContent ?? '';
    expect(conferma).toContain('Hai già 1 fonte accesa');
    expect(conferma).toContain('difficile capire quale si comporta male');
    // Il pulsante di conferma esiste: è un consiglio, non un divieto.
    expect(
      q<HTMLButtonElement>('[data-conferma="accendi"] .btn--primary')?.disabled,
    ).toBeFalse();
  });

  it('senza nessuna fonte accesa, la conferma dice che è la prima', async () => {
    await avvia([fonteOf({ id: 'x', enabled: false })]);
    await clic('.fnt-row__accendi');
    expect(q('[data-conferma="accendi"]')?.textContent).toContain(
      'Sarà la prima fonte accesa',
    );
  });

  /**
   * ⚠️ Doppia cintura: con l'interruttore generale spento, accendere una riga
   * non produce nulla. Se il pannello non lo dicesse **nella conferma**, l'owner
   * accenderebbe e aspetterebbe un tick che non arriverà mai.
   */
  it("interruttore generale spento: lo dice sopra, e di nuovo nella conferma", async () => {
    await avvia(
      [
        fonteOf({ id: 'a', enabled: true }),
        fonteOf({ id: 'b', slug: 'somuchpoker', name: 'Somuchpoker', enabled: false }),
      ],
      { salute: healthOf({ newsIngest: 'off' }) },
    );

    expect(q('[data-stato="off"]')).not.toBeNull();
    expect(testo()).toContain('La raccolta generale è spenta');
    expect(testo()).toContain('1 fonte accesa che non stanno raccogliendo niente');

    await clic('.fnt-row__accendi');
    expect(q('[data-conferma="accendi"]')?.textContent).toContain(
      "L'interruttore generale della raccolta è spento",
    );
  });

  /**
   * ⚠️ «Non lo so» è una risposta legittima: fingere un "acceso" quando la
   * sonda non risponde vorrebbe dire promettere una raccolta che potrebbe non
   * partire mai.
   */
  it("se /health non risponde, non inventa un interruttore acceso", async () => {
    await avvia([fonteOf()], { salute: 'errore' });

    expect(q('[data-stato="ignoto"]')).not.toBeNull();
    expect(q('[data-stato="on"]')).toBeNull();
    expect(q('[data-stato="off"]')).toBeNull();
  });

  it('la pausa della generazione è un interruttore diverso, e lo dichiara', async () => {
    await avvia([fonteOf()], {
      salute: healthOf({ newsPipeline: 'paused' }),
    });
    expect(q('[data-stato="pipeline-paused"]')?.textContent).toContain(
      'la raccolta continua',
    );
  });

  // ── Guasti e doppio tocco ─────────────────────────────────────────────────

  /**
   * ⚠️ Un guasto di rete non deve somigliare a «nessuna fonte configurata»: qui
   * quel vuoto vorrebbe dire «la redazione non ha rubinetti».
   */
  it('errore di rete: banda persistente e righe che restano in pagina', async () => {
    await avvia([fonteOf({ name: 'Assopoker' })]);

    await clic('.fnt-row__spegni ~ .fnt-row__toggle, .fnt-row__toggle');
    // Ricarica manuale che fallisce.
    fixture.componentInstance['riprova']();
    await stabile();
    http.expectOne(LISTA).error(new ProgressEvent('error'), { status: 0 });
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();

    expect(q('.fnt__errore')).not.toBeNull();
    expect(testo()).toContain('Impossibile raggiungere il server');
    // La lista precedente è ancora lì: nessun empty-state.
    expect(testo()).toContain('Assopoker');
    expect(q('.empty-state')).toBeNull();
  });

  /**
   * ⚠️ Un comando che resta attivo mentre la chiamata è in volo è un doppio
   * tocco che parte: qui vorrebbe dire due mutazioni sulla stessa riga.
   */
  it('mentre una chiamata è in volo i comandi sono spenti, e il secondo tocco non parte', async () => {
    await avvia([
      fonteOf({ id: 'a', enabled: true }),
      fonteOf({ id: 'b', slug: 'somuchpoker', name: 'Somuchpoker', enabled: true }),
    ]);

    await clic('.fnt-row__spegni');
    const patch = http.expectOne(`${LISTA}/a`);

    const spegni = qa('.fnt-row__spegni') as HTMLButtonElement[];
    expect(spegni[0].disabled).toBeTrue();
    expect(spegni[0].textContent).toContain('Spengo…');
    // ⚠️ La riga accanto si spegne anche lei: la mutazione è una alla volta in
    // tutta la pagina, perché finisce con una ricarica completa dell'elenco.
    expect(spegni[1].disabled).toBeTrue();
    expect(spegni[1].textContent).not.toContain('Spengo…');

    spegni[0].click();
    await stabile();
    http.expectNone(`${LISTA}/a`);

    patch.flush(fonteOf({ id: 'a', enabled: false }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'a', enabled: false })]);
    await stabile();
    expect(q('.fnt-row__accendi')).not.toBeNull();
  });

  // ── Form ──────────────────────────────────────────────────────────────────

  /**
   * ⚠️ Una fonte nasce **spenta** e si accende dall'elenco, con la conferma: un
   * interruttore anche nel form sarebbe un secondo modo di accendere, senza
   * nessuno degli avvisi che rendono quel gesto una decisione.
   */
  it('la creazione non manda enabled: la fonte nasce spenta', async () => {
    await avvia([]);
    await clic('.fnt__nuova');

    await scrivi('#fonte-nome', 'Italiapokerclub');
    await scrivi('#fonte-slug', 'italiapokerclub');
    await scrivi(
      '#fonte-endpoint',
      'https://www.italiapokerclub.com/wp-json/wp/v2/posts',
    );
    await clic('.fnt__form .btn--primary');

    const post = http.expectOne(LISTA);
    expect(post.request.method).toBe('POST');
    const body = post.request.body as Record<string, unknown>;
    expect('enabled' in body).toBeFalse();
    expect(body['slug']).toBe('italiapokerclub');
    expect(body['parserKey']).toBe('WP_REST_GENERICO');
    expect(body['excludeCategoryIds']).toEqual([]);
    post.flush(fonteOf({ id: 'n', slug: 'italiapokerclub' }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'n', slug: 'italiapokerclub' })]);
    await stabile();
  });

  /**
   * ⚠️ Il 400 che nessuno si aspetta: passando da WP REST a un'altra strategia
   * il server confronta con il valore **già salvato** (`dto ?? prima`) e
   * rifiuterebbe le categorie rimaste sulla riga — su un campo che il form non
   * mostra nemmeno più. Per questo l'array viaggia sempre, vuoto compreso.
   */
  it('cambiando strategia le categorie viaggiano vuote, non omesse', async () => {
    await avvia([
      fonteOf({ id: 'x', excludeCategoryIds: [16586], strategy: 'WP_REST' }),
    ]);
    await clic('#dettaglio-toggle-x');
    await clic('.fnt-row__modifica');

    expect(q<HTMLInputElement>('#fonte-categorie')?.value).toBe('16586');
    await scegli('#fonte-strategia', 'RSS2');
    // Il campo sparisce: su una fonte non-WordPress non filtrerebbe niente.
    expect(q('#fonte-categorie')).toBeNull();
    await scrivi('#fonte-endpoint', 'https://www.assopoker.com/feed');
    await clic('.fnt__form .btn--primary');

    const patch = http.expectOne(`${LISTA}/x`);
    expect(patch.request.method).toBe('PATCH');
    const body = patch.request.body as Record<string, unknown>;
    expect(body['excludeCategoryIds']).toEqual([]);
    expect(body['parserKey']).toBe('RSS2_GENERICO');
    patch.flush(fonteOf({ id: 'x', strategy: 'RSS2' }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', strategy: 'RSS2' })]);
    await stabile();
  });

  /**
   * ⚠️ L'effetto collaterale detto PRIMA del salvataggio: cambiare la domanda
   * azzera i fallimenti e butta i segnaposto della risposta precedente. Un
   * contatore che torna a zero da solo, senza preavviso, sembra un bug.
   */
  it("avvisa che cambiare l'indirizzo azzera fallimenti e sospensione", async () => {
    await avvia([
      fonteOf({ id: 'x', consecutiveFailures: 5, endpointUrl: 'https://a.it/feed' }),
    ]);
    await clic('#dettaglio-toggle-x');
    await clic('.fnt-row__modifica');

    expect(q('.fnt__form-effetto')).toBeNull();

    await scrivi('#fonte-note', 'una nota qualsiasi');
    expect(q('.fnt__form-effetto')).toBeNull();

    await scrivi('#fonte-endpoint', 'https://a.it/wp-json/wp/v2/posts');
    const avviso = q('.fnt__form-effetto')?.textContent ?? '';
    expect(avviso).toContain('i fallimenti consecutivi tornano a zero');
    expect(avviso).toContain('5 fallimenti');
  });

  /**
   * ⚠️ `ATOM` e `HTML` esistono nell'enum ma non hanno parser: sceglierli è un
   * 400 dal service. Offrirli come opzioni normali significa far scoprire il
   * limite con un errore; nasconderli, far credere che non esistano.
   */
  it('le strategie senza lettore si vedono ma non si scelgono', async () => {
    await avvia([]);
    await clic('.fnt__nuova');

    const opzioni = qa('#fonte-strategia option') as HTMLOptionElement[];
    const atom = opzioni.find((o) => o.value === 'ATOM');
    const wp = opzioni.find((o) => o.value === 'WP_REST');
    expect(atom?.disabled).toBeTrue();
    expect(atom?.textContent).toContain('nessun lettore disponibile');
    expect(wp?.disabled).toBeFalse();
  });

  /** Specchio dei vincoli del DTO: si evita il viaggio, non si decide. */
  it('lo slug fuori formato blocca il salvataggio prima della chiamata', async () => {
    await avvia([]);
    await clic('.fnt__nuova');
    await scrivi('#fonte-nome', 'Assopoker');
    await scrivi('#fonte-slug', 'Asso Poker!');
    await scrivi('#fonte-endpoint', 'https://www.assopoker.com/feed');

    expect(testo()).toContain(
      'Lo slug ammette solo minuscole, cifre e trattini',
    );
    expect(q<HTMLButtonElement>('.fnt__form .btn--primary')?.disabled).toBeTrue();
  });

  /**
   * ⚠️ I volumi del censimento sono decimali (3,51 — 0,71 — 7,6): con
   * `step="1"` il browser rifiuterebbe il valore prima ancora di partire.
   */
  it('il volume atteso accetta i decimali', async () => {
    await avvia([]);
    await clic('.fnt__nuova');
    expect(q<HTMLInputElement>('#fonte-baseline')?.step).toBe('any');

    await scrivi('#fonte-nome', 'Assopoker');
    await scrivi('#fonte-slug', 'assopoker');
    await scrivi('#fonte-endpoint', 'https://www.assopoker.com/wp-json/wp/v2/posts');
    await scrivi('#fonte-baseline', '3.51');
    await clic('.fnt__form .btn--primary');

    const post = http.expectOne(LISTA);
    expect((post.request.body as Record<string, unknown>)['baselineItemsPerDay']).toBe(3.51);
    post.flush(fonteOf({ id: 'n' }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'n' })]);
    await stabile();
  });

  /** L'errore del server resta nel form, accanto ai campi che l'hanno causato. */
  it('un 409 sullo slug si legge dentro il form, non solo in un toast', async () => {
    await avvia([]);
    await clic('.fnt__nuova');
    await scrivi('#fonte-nome', 'Assopoker');
    await scrivi('#fonte-slug', 'assopoker');
    await scrivi('#fonte-endpoint', 'https://www.assopoker.com/wp-json/wp/v2/posts');
    await clic('.fnt__form .btn--primary');

    http
      .expectOne(LISTA)
      .flush(
        { message: 'Esiste già una sorgente con lo slug "assopoker".' },
        { status: 409, statusText: 'Conflict' },
      );
    await stabile();

    expect(q('.fnt__form .form-feedback.is-error')?.textContent).toContain(
      'Esiste già una sorgente con lo slug',
    );
    expect(q('.fnt__form')).not.toBeNull();
  });

  // ── Censimento ────────────────────────────────────────────────────────────

  /**
   * ⚠️ Il censimento **precompila**, non semina: gli hostname non sono mai stati
   * provati contro i siti veri, quindi fra il pulsante e il database deve
   * esserci una conferma umana.
   */
  it('il censimento riempie il form e non scrive niente', async () => {
    await avvia([], { seeds: [seedOf()] });

    expect(testo()).toContain('Comincia da qui');
    expect(testo()).toContain('Forte su Asia/APT.');

    await clic('.fnt-seed__usa');
    http.expectNone(LISTA);

    expect(q<HTMLInputElement>('#fonte-nome')?.value).toBe('Somuchpoker');
    expect(q<HTMLInputElement>('#fonte-endpoint')?.value).toBe(
      'https://www.somuchpoker.com/rss.xml',
    );
    expect(q<HTMLInputElement>('#fonte-baseline')?.value).toBe('5.2');
  });

  it('le righe del censimento già configurate non si ripropongono', async () => {
    await avvia([fonteOf({ slug: 'somuchpoker' })], { seeds: [seedOf()] });
    expect(q('.fnt-seed__usa')).toBeNull();
  });

  /** Il censimento è un accessorio: se manca, non ruba la banda errore. */
  it('censimento non raggiungibile: nessuna banda di errore', async () => {
    http.expectOne(LISTA).flush([fonteOf()]);
    http.expectOne(SEED).error(new ProgressEvent('error'), { status: 500 });
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();

    expect(q('.fnt__errore')).toBeNull();
    expect(testo()).toContain('Assopoker');
  });

  // ── Forma delle date ──────────────────────────────────────────────────────

  /**
   * ⚠️ Render gira in UTC e la scuola è a Roma: una data resa in ISO (o peggio,
   * in UTC) sarebbe sbagliata di due ore proprio nelle ore in cui si guarda un
   * cruscotto. In riga si legge il tempo trascorso; l'istante esatto sta
   * nell'attributo, formattato in italiano.
   */
  it('nessuna data ISO in pagina: si legge il tempo trascorso', async () => {
    await avvia([
      fonteOf({
        enabled: true,
        lastItemAt: fa(3 * ORE),
        lastSuccessAt: fa(90 * MIN),
        osservataDa: fa(10 * GIORNI),
      }),
    ]);

    expect(testo()).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(q('[data-segnale="articolo"] strong')?.textContent).toContain(
      '3 ore fa',
    );
    const esatto = q('[data-segnale="articolo"] strong')?.getAttribute('title');
    expect(esatto).toMatch(/^\d{2}\/\d{2}, \d{2}:\d{2}$/);
  });

  it('la sintesi conta solo le voci che esistono', async () => {
    await avvia([
      fonteOf({ id: 'a', enabled: true, healthState: 'SANA', lastItemAt: fa(MIN) }),
      fonteOf({ id: 'b', slug: 'b', enabled: false }),
      fonteOf({ id: 'c', slug: 'c', enabled: false }),
    ]);

    expect(q('[data-voce="ok"]')?.textContent).toContain('1');
    expect(q('[data-voce="spenta"]')?.textContent).toContain('2');
    // Nessuna degradata, nessuna morta: le voci a zero non compaiono.
    expect(q('[data-voce="allarme"]')).toBeNull();
    expect(q('[data-voce="grave"]')).toBeNull();
  });

  // ── Nessun modale, nessun confirm() nativo ────────────────────────────────

  /**
   * ⚠️ Regola di casa, e qui non è una preferenza estetica: un `confirm()`
   * nativo blocca il thread, non si legge insieme alla riga che sta dietro e
   * soprattutto **non può contenere gli avvisi** che rendono l'accensione una
   * decisione (quante fonti sono già accese, l'interruttore generale,
   * l'indirizzo che verrà interrogato). La spia copre tutte e tre le mutazioni.
   */
  it('nessun confirm() nativo: né per accendere, né per spegnere, né per eliminare', async () => {
    const nativo = spyOn(window, 'confirm').and.returnValue(true);
    await avvia([fonteOf({ id: 'x', enabled: false })]);

    // Accendere: due tocchi, entrambi dentro la pagina.
    await clic('.fnt-row__accendi');
    expect(q('[data-conferma="accendi"]')).not.toBeNull();
    await clic('[data-conferma="accendi"] .btn--primary');
    http.expectOne(`${LISTA}/x`).flush(fonteOf({ id: 'x', enabled: true }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', enabled: true })]);
    await stabile();

    // Spegnere: riduce l'attività, quindi un tocco solo — e comunque nessun modale.
    await clic('.fnt-row__spegni');
    http.expectOne(`${LISTA}/x`).flush(fonteOf({ id: 'x', enabled: false }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', enabled: false })]);
    await stabile();

    // Eliminare: conferma in linea, dentro il dettaglio.
    await clic('#dettaglio-toggle-x');
    await clic('.fnt-row__elimina');
    expect(q('[data-conferma="elimina"]')).not.toBeNull();
    await clic('[data-conferma="elimina"] .btn--danger-solid');
    http.expectOne(`${LISTA}/x`).flush({ eliminata: true, slug: 'assopoker' });
    http.expectOne(LISTA).flush([]);
    await stabile();

    expect(nativo).not.toHaveBeenCalled();
    expect(q('dialog')).toBeNull();
  });

  /**
   * ⚠️ Il comando che accende deve spegnersi **mentre la chiamata è in volo**:
   * un secondo tocco qui non è un doppio salvataggio innocuo, è una seconda
   * PATCH su una riga che sta già cambiando stato — e con essa una seconda
   * ricarica che può arrivare fuori ordine.
   */
  it("mentre l'accensione è in volo il comando è inerte, e lo dichiara", async () => {
    await avvia([fonteOf({ id: 'x', enabled: false })]);
    await clic('.fnt-row__accendi');
    await clic('[data-conferma="accendi"] .btn--primary');
    const patch = http.expectOne(`${LISTA}/x`);

    const si = q<HTMLButtonElement>('[data-conferma="accendi"] .btn--primary');
    expect(si?.disabled).toBeTrue();
    expect(si?.textContent).toContain('Accendo…');
    // ⚠️ Non solo il bottone premuto: la pagina intera è inerte, perché la
    // mutazione finisce con una ricarica completa dell'elenco.
    expect(q<HTMLButtonElement>('.fnt__nuova')?.disabled).toBeTrue();

    si?.click();
    await stabile();
    http.expectNone(`${LISTA}/x`);

    patch.flush(fonteOf({ id: 'x', enabled: true }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', enabled: true })]);
    await stabile();
    // La conferma si chiude da sola: lasciarla aperta su una riga già accesa
    // offrirebbe di accendere una cosa accesa.
    expect(q('[data-conferma="accendi"]')).toBeNull();
    expect(q<HTMLButtonElement>('.fnt__nuova')?.disabled).toBeFalse();
  });

  // ── Il primo caricamento, quello che decide la prima impressione ──────────

  /**
   * ⚠️ Il caso peggiore dell'errore di rete è **il primo**: qui non c'è una
   * lista vecchia da tenere in pagina, e un elenco vuoto direbbe «la redazione
   * non ha rubinetti» invece di «non ho potuto chiedere». Sono due frasi
   * diverse e portano a due gesti diversi.
   */
  it('se il primo caricamento fallisce: banda con «Riprova», mai «nessuna fonte configurata»', async () => {
    http.expectOne(LISTA).error(new ProgressEvent('error'), { status: 0 });
    http.expectOne(SEED).flush([]);
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();

    expect(q('.fnt__errore')).not.toBeNull();
    expect(testo()).toContain('Impossibile raggiungere il server');
    expect(q('.empty-state')).toBeNull();
    expect(testo()).not.toContain('Nessuna fonte configurata');

    // La riprova è un comando in pagina, non un ricaricamento del browser.
    await clic('.fnt__errore .btn');
    http.expectOne(LISTA).flush([fonteOf()]);
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();

    expect(q('.fnt__errore')).toBeNull();
    expect(testo()).toContain('Assopoker');
  });

  // ── Censimento: cinque righe, e nessuna che si accenda da sola ────────────

  /**
   * ⚠️ La schermata da cui si accende la **prima** fonte: a elenco vuoto il
   * censimento è l'unica cosa che dice da dove si comincia. E ogni riga
   * precompila e basta — un «usa tutte» scriverebbe cinque configurazioni mai
   * verificate contro i siti veri, che è l'opposto di accenderne una per volta.
   */
  it('elenco vuoto: propone tutte le fonti del censimento, una riga per fonte', async () => {
    const cinque = [
      'assopoker',
      'italiapokerclub',
      'pokeritaliaweb',
      'somuchpoker',
      'pokernews',
    ].map((slug, i) => seedOf({ slug, name: `Fonte ${i + 1}` }));
    await avvia([], { seeds: cinque });

    expect(qa('.fnt-seed__riga').length).toBe(5);
    expect(qa('.fnt-seed__usa').length).toBe(5);
    expect(testo()).toContain('5 fonti studiate');
    // Nessun interruttore nel censimento: si accende solo dall'elenco.
    expect(qa('.fnt-seed .fnt-row__accendi').length).toBe(0);
  });

  /** ⚠️ E ciò che si crea nasce spento: lo dice il pulsante, prima del clic. */
  it('il form precompilato dal censimento crea una fonte spenta, e lo scrive sul pulsante', async () => {
    await avvia([], { seeds: [seedOf()] });
    await clic('.fnt-seed__usa');

    expect(q('.fnt__form .btn--primary')?.textContent).toContain(
      'Crea la fonte (spenta)',
    );
    expect(testo()).toContain('Una fonte nuova nasce');
  });

  // ── Date: assenti, illeggibili, e mai il 1970 ─────────────────────────────

  /**
   * ⚠️ Le due trappole della stessa riga di codice. Un campo assente reso come
   * data dà **il 1° gennaio 1970** (l'epoca), che su un cruscotto si legge come
   * un guasto vecchio di cinquant'anni; una data illeggibile dà `NaN`, che
   * stampato è un guasto della pagina travestito da guasto della fonte. Nessuna
   * delle due deve poter uscire.
   */
  it('date assenti o illeggibili: né 1970, né NaN, né una diagnosi inventata', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'DEGRADATA',
        consecutiveFailures: 3,
        lastErrorAt: 'non-una-data',
        lastErrorMessage: 'ECONNRESET',
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    const t = testo();
    expect(t).not.toContain('1970');
    expect(t).not.toContain('NaN');
    expect(t).not.toContain('Invalid Date');

    // I due segnali dicono che non è ancora successo, non che non succederà.
    expect(q('[data-segnale="articolo"] strong')?.textContent?.trim()).toBe(
      'Non ha ancora raccolto',
    );
    expect(q('[data-segnale="successo"] strong')?.textContent?.trim()).toBe(
      'Non ha ancora provato',
    );
    // Nessun istante esatto da mostrare ⇒ nessun `title`, non un title vuoto.
    expect(
      q('[data-segnale="articolo"] strong')?.getAttribute('title'),
    ).toBeNull();

    // L'errore si stampa comunque: è la sua data a non essere leggibile.
    expect(qa('.fnt-blocco__h').map((h) => h.textContent).join(' ')).toContain(
      'Ultimo errore · data non leggibile',
    );
    expect(q('.fnt-row__errore')?.textContent).toContain('ECONNRESET');
  });

  /**
   * ⚠️ La forma italiana per intero: giorno/mese e orologio a 24 ore. Un
   * `toLocaleString()` senza locale, o peggio un `toISOString()`, passerebbero
   * ogni altro controllo di questa pagina e si vedrebbero solo a schermo.
   */
  it("l'istante esatto è scritto in italiano, a 24 ore", async () => {
    const quando = new Date(ORA - 5 * ORE);
    await avvia([fonteOf({ enabled: true, lastItemAt: quando.toISOString() })]);

    const title = q('[data-segnale="articolo"] strong')?.getAttribute('title');
    expect(title).toBe(
      new Intl.DateTimeFormat('it-IT', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(quando),
    );
    expect(title).not.toMatch(/AM|PM/i);
  });

  // ── I selettori mostrano il valore che hanno, non la prima opzione ─────────

  /**
   * ⚠️ Un `[value]` su un `<select>` le cui `<option>` nascono da un `@for`
   * figlio **non funziona**: Angular esegue il property binding del select
   * PRIMA del repeater, e assegnare `value` a un select ancora vuoto è un
   * no-op (`value` resta `''`). All'inserimento delle option il browser
   * seleziona la **prima abilitata**, e al giro dopo il binding non riscrive
   * più niente perché il valore non è cambiato: il selettore resta bloccato
   * sulla prima voce mentre il signal dice un'altra cosa.
   *
   * Qui il danno è concreto e silenzioso: si precompila Somuchpoker (RSS 2.0,
   * inglese), il form mostra «WordPress REST» e «Italiano», e ciò che parte al
   * salvataggio è RSS2/en — cioè il pannello racconta una configurazione
   * diversa da quella che sta per scrivere.
   */
  it('il form precompilato mostra la strategia e la lingua che salverà, non la prima opzione', async () => {
    await avvia([], { seeds: [seedOf()] });
    await clic('.fnt-seed__usa');

    expect(q<HTMLSelectElement>('#fonte-strategia')?.value).toBe('RSS2');
    expect(q<HTMLSelectElement>('#fonte-lingua')?.value).toBe('en');
    // E il campo categorie non c'è: non è WordPress. Le due cose devono
    // raccontare la stessa fonte.
    expect(q('#fonte-categorie')).toBeNull();
  });

  it('aprendo in modifica una fonte RSS il selettore non torna su WordPress REST', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        strategy: 'SITEMAP_NEWS',
        parserKey: 'SITEMAP_NEWS_GENERICO',
        excludeCategoryIds: [],
        lingua: 'en',
      }),
    ]);
    await clic('#dettaglio-toggle-x');
    await clic('.fnt-row__modifica');

    expect(q<HTMLSelectElement>('#fonte-strategia')?.value).toBe(
      'SITEMAP_NEWS',
    );
    expect(q<HTMLSelectElement>('#fonte-lingua')?.value).toBe('en');
    expect(testo()).toContain('SITEMAP_NEWS_GENERICO');
  });

  // ── Il cruscotto si aggiorna: è la ragione per cui esiste ─────────────────

  /**
   * Scarta la fixture del `beforeEach` (con le sue tre chiamate) e ne crea una
   * con `setInterval` spiato, così il battito periodico si può far scattare
   * senza aspettare un minuto vero.
   */
  const conBattito = async (
    fonti: NewsSource[],
  ): Promise<(() => void)[]> => {
    http.expectOne(LISTA).flush([]);
    http.expectOne(SEED).flush([]);
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();
    fixture.destroy();

    const battiti: (() => void)[] = [];
    spyOn(window, 'setInterval').and.callFake(((cb: () => void) => {
      battiti.push(cb);
      return 0;
    }) as unknown as typeof window.setInterval);

    fixture = TestBed.createComponent(AdminFontiComponent);
    await avvia(fonti);
    return battiti;
  };

  /**
   * ⚠️ **È il criterio di accettazione della schermata.** L'owner accende la
   * prima fonte e poi «la guarda lavorare»: se la pagina resta all'istantanea
   * del primo caricamento, dopo dieci minuti mostra ancora «Non ha ancora
   * raccolto» su una fonte che ha già ingerito venti articoli — e nulla in
   * pagina lo suggerisce, perché l'orologio interno fa invecchiare le etichette
   * e dà l'impressione che sia viva.
   */
  it('il battito periodico rilegge elenco e interruttore generale', async () => {
    const battiti = await conBattito([
      fonteOf({ id: 'x', enabled: true, lastSuccessAt: fa(2 * MIN) }),
    ]);
    expect(q('[data-segnale="articolo"] strong')?.textContent?.trim()).toBe(
      'Non ha ancora raccolto',
    );
    expect(battiti.length).toBeGreaterThan(0);

    battiti.forEach((b) => b());
    await stabile();

    http
      .expectOne(LISTA)
      .flush([
        fonteOf({
          id: 'x',
          enabled: true,
          lastItemAt: fa(3 * MIN),
          lastSuccessAt: fa(MIN),
        }),
      ]);
    http.expectOne(HEALTH).flush(healthOf({ newsIngest: 'off' }));
    await stabile();

    expect(q('[data-segnale="articolo"] strong')?.textContent).toContain(
      '3 min fa',
    );
    // L'interruttore generale si rilegge insieme all'elenco: spegnerlo su
    // Render deve vedersi qui senza un F5.
    expect(q('[data-stato="off"]')).not.toBeNull();
  });

  /**
   * ⚠️ Il battito non deve passare **sopra** una mutazione in volo: `carica()`
   * spegne `azione` alla risposta, e un ricaricamento di sfondo riaccenderebbe
   * i comandi mentre la PATCH è ancora per aria.
   */
  it('il battito salta mentre una mutazione è in volo', async () => {
    const battiti = await conBattito([fonteOf({ id: 'x', enabled: true })]);
    // ⚠️ Senza questa riga la prova sarebbe vacua: dove il battito non esiste,
    // «non parte una GET di sfondo» è vero e non dimostra niente.
    expect(battiti.length).toBeGreaterThan(0);

    await clic('.fnt-row__spegni');
    const patch = http.expectOne(`${LISTA}/x`);

    battiti.forEach((b) => b());
    await stabile();
    // Nessuna GET di sfondo: la pagina sta già cambiando stato.
    http.expectNone(LISTA);
    expect(q<HTMLButtonElement>('.fnt-row__spegni')?.disabled).toBeTrue();

    patch.flush(fonteOf({ id: 'x', enabled: false }));
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', enabled: false })]);
    await stabile();
  });

  /**
   * ⚠️ Il comando di aggiornamento deve esistere **sul percorso felice**, non
   * solo dentro la banda d'errore: quello lì si vede unicamente quando la GET è
   * già fallita.
   */
  it('il comando «Aggiorna» c\'è anche quando tutto funziona, e dice da quando sono i dati', async () => {
    await avvia([fonteOf({ id: 'x', enabled: true, lastItemAt: fa(MIN) })]);

    expect(q('.fnt__aggiorna')).not.toBeNull();
    expect(testo()).toContain('Aggiornato');

    await clic('.fnt__aggiorna');
    http.expectOne(LISTA).flush([fonteOf({ id: 'x', enabled: true })]);
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();
  });

  // ── L'errore che i contatori non mostrano ─────────────────────────────────

  /**
   * ⚠️ Il ramo `ILLEGGIBILE` del tick — formato dichiarato ≠ formato servito,
   * cioè l'errore di configurazione **più probabile alla prima accensione** —
   * scrive `lastSuccessAt`, `lastErrorAt` e `lastErrorMessage` ma di proposito
   * **non** incrementa `consecutiveFailures` e **non** mette backoff. Senza una
   * spia sulla riga chiusa quella fonte mostra solo segnali positivi («ultimo
   * successo: 2 min fa») e il messaggio che dice cosa è andato storto resta
   * dietro «Dettagli», dove nessuno va a cercarlo: la diagnosi arriverebbe solo
   * dal rilevatore di stallo, cioè dopo 24 ore.
   */
  it('errore registrato senza fallimenti di fila: la riga chiusa lo dice comunque', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'SANA',
        consecutiveFailures: 0,
        lastSuccessAt: fa(2 * MIN),
        lastErrorAt: fa(2 * MIN),
        lastErrorMessage: 'Corpo non leggibile: atteso RSS 2.0, ricevuto HTML',
        osservataDa: fa(20 * MIN),
      }),
    ]);

    expect(q('[data-spia="errore"]')).not.toBeNull();
    expect(q('[data-spia="errore"]')?.textContent).toContain('Errore');
    // ⚠️ Chiusa. Non dentro il disclosure.
    expect(q('.fnt-row__detail')).toBeNull();
  });

  /**
   * ⚠️ E il contrario: un errore **già rientrato** (l'ultima risposta riuscita
   * è più recente) non è la situazione di adesso. Una spia che resta accesa su
   * un guasto passato è la stessa cosa di una spia sempre accesa.
   */
  it('errore più vecchio dell ultimo successo: nessuna spia sulla riga chiusa', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        consecutiveFailures: 0,
        lastErrorAt: fa(3 * ORE),
        lastErrorMessage: 'HTTP 502',
        lastSuccessAt: fa(4 * MIN),
        lastItemAt: fa(30 * MIN),
      }),
    ]);

    expect(q('[data-spia="errore"]')).toBeNull();
  });

  // ── Volume: nessuna ragione che il server rifiuta di affermare ────────────

  /**
   * ⚠️ Il rilevatore di volume lato server è **inerte** finché l'EMA non ha
   * visto `EMA_CAMPIONI_MINIMI` (7) giorni, e `emaCampioni` **non è esposto**
   * da `NewsSourceView`: il pannello non può replicare la guardia, quindi la
   * approssima con l'età dell'osservazione. Senza, il blocco «Perché» — che
   * dichiara di elencare *le ragioni dello stato* — afferma «Volume sotto il
   * previsto» sotto una pastiglia «Sana», su una fonte accesa da due giorni.
   * È il primo allarme falso, cioè quello che decide se il secondo verrà letto.
   */
  it('volume in riscaldamento: il numero si mostra, ma non come ragione dello stato', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'SANA',
        osservataDa: fa(2 * GIORNI),
        lastItemAt: fa(2 * ORE),
        medianGapMinutes: 120,
        baselineItemsPerDay: 3.51,
        emaItemsPerDay: 1,
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    expect(qa('.fnt-row__perche li').length).toBe(0);
    const avvisi = qa('.fnt-row__avvisi li').map((li) => li.textContent ?? '');
    expect(avvisi.join(' ')).toContain('riscaldamento');
    expect(avvisi.join(' ')).toContain('1/g');
    expect(avvisi.join(' ')).toContain('3,51/g');
  });

  /** Passati i sette giorni la stessa riga diventa una ragione, come sul server. */
  it('volume fuori riscaldamento: torna a essere una ragione dello stato', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'DEGRADATA',
        osservataDa: fa(20 * GIORNI),
        lastItemAt: fa(2 * ORE),
        medianGapMinutes: 120,
        baselineItemsPerDay: 3.51,
        emaItemsPerDay: 1,
      }),
    ]);
    await clic('#dettaglio-toggle-x');

    const perche = qa('.fnt-row__perche li').map((li) => li.textContent ?? '');
    expect(perche.join(' ')).toContain('Volume sotto il previsto');
    expect(perche.join(' ')).toContain('1/g contro 3,51/g attesi');
  });

  // ── Numeri: un solo separatore decimale in tutta la pagina ────────────────

  /**
   * ⚠️ La pagina è in italiano: `{{ s.baselineItemsPerDay }}` stampa «3.51» col
   * punto a due centimetri dal «3,51» che il formattatore produce, sulla stessa
   * grandezza e nella stessa schermata.
   */
  it('nessun numero decimale col punto: censimento, volume atteso e cadenza misurata', async () => {
    await avvia(
      [
        fonteOf({
          id: 'x',
          enabled: true,
          baselineItemsPerDay: 3.51,
          medianGapMinutes: 137.25,
          lastItemAt: fa(30 * MIN),
          osservataDa: fa(30 * GIORNI),
        }),
      ],
      { seeds: [seedOf({ baselineItemsPerDay: 0.71 })] },
    );
    await clic('#dettaglio-toggle-x');

    const t = testo();
    expect(t).toContain('3,51');
    expect(t).toContain('0,71');
    expect(t).toContain('137,25');
    // Nessun numero decimale col punto in tutta la pagina. ⚠️ «RSS 2.0» è
    // un'etichetta di formato, non una grandezza: si toglie prima di cercare,
    // altrimenti la prova fallirebbe su una pagina corretta — cioè sarebbe un
    // falso allarme, il modo più rapido per far spegnere una guardia.
    expect(t.replace(/RSS 2\.0/g, 'RSS2')).not.toMatch(/\d+\.\d/);
  });

  // ── Il primo giro: quanto aspettare davvero ───────────────────────────────

  /**
   * ⚠️ `sorgenteDovuta()` contiene `if (!s.lastSuccessAt) return true`: una
   * fonte che non ha **mai** risposto è dovuta subito, quindi viene interrogata
   * al tick successivo — entro 5 minuti — qualunque sia la sua cadenza.
   * Annunciare «entro 60 minuti» manda l'owner via proprio nel momento in cui
   * questa schermata serve.
   */
  it('prima accensione: annuncia il primo giro al tick, non alla cadenza', async () => {
    await avvia([fonteOf({ id: 'x', enabled: false, pollMinutes: 60 })]);
    await clic('.fnt-row__accendi');

    const conferma = q('[data-conferma="accendi"]')?.textContent ?? '';
    expect(conferma).toContain('entro 5 minuti');
    expect(conferma).not.toContain('entro 60 minuti');
    // La cadenza resta detta: è ciò che succede DOPO il primo giro.
    expect(conferma).toContain('ogni 60 minuti');
  });

  /** Una fonte che ha già risposto in passato riparte invece dalla sua cadenza. */
  it('riaccensione di una fonte che ha già risposto: la cadenza è quella vera', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: false,
        pollMinutes: 30,
        lastSuccessAt: fa(3 * GIORNI),
      }),
    ]);
    await clic('.fnt-row__accendi');

    const conferma = q('[data-conferma="accendi"]')?.textContent ?? '';
    expect(conferma).toContain('30 minuti');
    expect(conferma).not.toContain('entro 5 minuti');
  });

  // ── Fuoco: le conferme in linea non lo lasciano cadere sul <body> ─────────

  /**
   * ⚠️ Il bottone che apre la conferma **esce dal DOM** (`@else if
   * (!isConfirming(...))`): senza spostare il fuoco, chi arriva da tastiera lo
   * perde sul `<body>` e deve ri-tabbare da capo per raggiungere «Sì, accendi».
   * Lo stesso file lo gestisce già per la disclosure (`toggleDettaglio`): qui è
   * un'incoerenza interna, non una svista di dominio.
   */
  it('la conferma in linea prende il fuoco, e Annulla lo restituisce', async () => {
    await avvia([fonteOf({ id: 'x', enabled: false })]);

    await clic('.fnt-row__accendi');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement?.id).toBe('conferma-si-accendi:x');
    expect(q('[data-conferma="accendi"]')?.getAttribute('role')).toBe('group');

    await clic('[data-conferma="accendi"] .btn--ghost');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement?.id).toBe('cmd-accendi:x');
  });

  it('anche la conferma di eliminazione prende il fuoco', async () => {
    await avvia([fonteOf({ id: 'x', enabled: false })]);
    await clic('#dettaglio-toggle-x');
    await clic('.fnt-row__elimina');
    await new Promise((r) => setTimeout(r, 0));

    expect(document.activeElement?.id).toBe('conferma-si-elimina:x');
  });

  // ── Censimento: «non ho potuto chiedere» non è «non c'è niente» ───────────

  /**
   * ⚠️ La stessa confusione che il blocco lista evita di proposito, spostata di
   * due sezioni: con la GET dell'elenco fallita, `seedMancanti()` non sa che
   * cosa è già configurato e proporrebbe tutte e cinque le fonti sotto il
   * titolo «Comincia da qui» — dritto sotto la banda rossa. L'owner clicca su
   * una fonte che esiste già e lo scopre con un 409 al salvataggio.
   */
  it('elenco non caricato: il censimento non propone niente', async () => {
    http.expectOne(LISTA).error(new ProgressEvent('error'), { status: 0 });
    http.expectOne(SEED).flush([seedOf()]);
    http.expectOne(HEALTH).flush(healthOf());
    await stabile();

    expect(q('.fnt__errore')).not.toBeNull();
    expect(q('.fnt-seed__usa')).toBeNull();
    expect(testo()).not.toContain('Comincia da qui');
  });

  // ── L'orologio dell'osservazione non si azzera riaccendendo ───────────────

  /**
   * ⚠️ `osservataDa` lo scrive il server **una volta sola** (`updateOne`
   * guardata su `$exists:false`) e non lo azzera mai: né allo spegnimento, né
   * alla riaccensione, né in `update()`. «Accesa da 5 mesi» su una fonte
   * riaccesa due minuti fa è una storia che non è avvenuta — il calcolo è
   * fedele al rilevatore del server, è l'etichetta a mentire.
   */
  it('dice «sotto osservazione», non «accesa da», e spiega che l orologio non si azzera', async () => {
    await avvia([
      fonteOf({
        id: 'x',
        enabled: true,
        healthState: 'SANA',
        osservataDa: fa(150 * GIORNI),
        lastSuccessAt: fa(2 * MIN),
      }),
    ]);

    const t = testo();
    expect(t).toContain('Sotto osservazione da');
    expect(t).not.toContain('Accesa da');

    await clic('#dettaglio-toggle-x');
    expect(qa('.fnt-row__avvisi li').map((li) => li.textContent).join(' ')).toContain(
      'non si azzera',
    );
  });
});
