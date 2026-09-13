import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import localeIt from '@angular/common/locales/it';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  AdminStatsView,
  AdminVideoStatsView,
  AndamentoConteggi,
  RigaAndamento,
} from '../../../core/models/api.models';
import { AdminStatsComponent } from './admin-stats.component';

const API = environment.API_URL;

// Il DatePipe legge LOCALE_ID: senza questo il TestBed userebbe en-US e le date
// uscirebbero in inglese ("15 Jul 2026"), che NON è ciò che fa l'app — il
// locale `it` è registrato in app.config.ts. Qui si replica quella config, così
// il test verifica il comportamento vero e non un artefatto dell'ambiente.
registerLocaleData(localeIt);

/** 15 luglio 2026, 12:00 a Roma: il mese corrente della finestra è 2026-07. */
const GENERATO_IL = '2026-07-15T10:00:00.000Z';

const statsView = (over: Partial<AdminStatsView> = {}): AdminStatsView => ({
  generatoIl: GENERATO_IL,
  aggiornatoOgniMinuti: 5,
  finestraMesi: 3,
  abbonati: {
    conAbbonamentoValido: 40,
    hannoAccessoOra: 40,
    perTier: [
      {
        tier: 'SQUALO',
        conAbbonamentoValido: 40,
        hannoAccessoOra: 40,
        senzaScadenza: 0,
        daDeclassare: 0,
      },
    ],
    accessoNonAbbonato: [],
  },
  incassoAbbonamenti: {
    ultimi30Eur: 500,
    ordini30: 4,
    precedenti30Eur: 400,
    deltaPct: 12.5,
    attivazioniSenzaCassa30: 2,
    puntiEur30: 37.5,
    serieMensile: [
      {
        mese: '2026-07',
        incassoEur: 500,
        puntiEur: 12.5,
        ordini: 4,
        stimati: 0,
        perMetodo: [{ metodo: 'paypal', incassoEur: 500, ordini: 4 }],
      },
    ],
    senzaCassaMensile: [],
  },
  rinnovi: {
    ultimoMeseChiuso: {
      mese: '2026-06',
      scaduti: 3,
      rinnovati: 2,
      tassoRinnovo: null,
    },
    serieMensile: [],
  },
  scadenze: {
    entro7: { utenti: 2, valoreListinoEur: 250 },
    entro30: { utenti: 5, valoreListinoEur: 625 },
    perTier: [],
  },
  acquisizione: {
    serieMensile: [
      {
        mese: '2026-07',
        paganti: { nuovi: 3, rinnovi: 1, ritorni: 0 },
        nonPaganti: { nuovi: 1, rinnovi: 0, ritorni: 0 },
      },
    ],
  },
  conversione: { registrazioniComplete: 200, paganti: 50, tasso: 0.25 },
  crescita: {
    attivi: { ultimi7: 12, ultimi30: 30, iscritti: 200 },
    registrazioniMensili: [
      { mese: '2026-06', registrati: 12, verificati: 9 },
      { mese: '2026-07', registrati: 5, verificati: 4 },
    ],
    // Solo mesi CHIUSI: luglio (il corrente) non c'è, di proposito.
    abbonatiFineMese: [
      { mese: '2026-05', attivi: 33 },
      { mese: '2026-06', attivi: 35 },
    ],
  },
  qualitaDati: {
    senzaScadenzaTotale: 0,
    senzaScadenzaPerRuolo: [],
    daDeclassare: 0,
    stimati: 0,
    approvedSenzaDecidedAt: 0,
  },
  limiti: [
    'Un limite dichiarato dal backend.',
    // Il limite VERO che promette la colonna: la pagina deve renderla.
    'Li trovi nella colonna «coperti dai punti», accanto all\'incasso e mai dentro.',
  ],
  ...over,
});

const videoView = (
  over: Partial<AdminVideoStatsView> = {},
): AdminVideoStatsView => ({
  generatoIl: GENERATO_IL,
  aggiornatoOgniMinuti: 15,
  disponibile: true,
  periodo: { giorni: 30, dal: '2026-06-15', al: '2026-07-15' },
  libreria: {
    video: 12,
    visualizzazioni: 3400,
    tempoVisioneSecondi: 720000,
    tempoVisioneOre: 200,
  },
  andamento: {
    visualizzazioniPeriodo: 900,
    serie: [
      { giorno: '2026-07-13', visualizzazioni: 10 },
      { giorno: '2026-07-14', visualizzazioni: 30 },
    ],
  },
  lezioni: [],
  saltate: {
    totale: 0,
    senzaEmbedValido: { totale: 0, esempi: [] },
    libreriaDiversa: { totale: 0, esempi: [] },
    senzaStatistiche: { totale: 0, esempi: [] },
  },
  videoNonAssociati: { totale: 0, esempi: [] },
  qualitaDati: { guidDuplicati: 0, paginaTroncata: false },
  limiti: ['Un limite video dichiarato dal backend.'],
  ...over,
});

/** Un mese dei Conteggi, in CENTESIMI interi come sul filo. */
const rigaAndamento = (over: Partial<RigaAndamento> = {}): RigaAndamento => ({
  id: 'm-2026-09',
  anno: 2026,
  mese: 9,
  chiave: '2026-09',
  etichetta: 'settembre 2026',
  stato: 'APERTO',
  provvisorio: true,
  entrate: {
    abbonamentiCent: 80_000,
    gadgetCent: 0,
    commissioniRakebackCent: 40_050,
    stakingCent: 5_000,
    altreCent: 0,
    totaleCent: 125_050,
  },
  uscite: { speseCent: 30_000, perditeStakingCent: 0, totaleCent: 30_000 },
  conguaglioGiocatoriCent: 0,
  margineNettoCent: 95_050,
  marginePersonaleCent: 0,
  ripartizione: { titolareCent: 61_783, socioCent: 33_267, quotaTitolareBp: 6500 },
  ...over,
});

const andamentoView = (
  over: Partial<AndamentoConteggi> = {},
): AndamentoConteggi => ({
  generatoIl: '2026-09-13T08:30:00.000Z',
  finestraMesi: 12,
  mesi: [
    rigaAndamento({
      id: 'm-2026-08',
      mese: 8,
      chiave: '2026-08',
      etichetta: 'agosto 2026',
      stato: 'CHIUSO',
      provvisorio: false,
      chiusoAt: '2026-09-02T10:00:00.000Z',
      conguaglioGiocatoriCent: 34_829,
      margineNettoCent: 129_879,
    }),
    rigaAndamento(),
  ],
  nonCalcolati: [],
  totaliChiusi: {
    mesi: 1,
    entrateCent: 125_050,
    usciteCent: 30_000,
    margineNettoCent: 129_879,
  },
  limiti: ['Un limite dei conteggi dichiarato dal backend.'],
  ...over,
});

describe('AdminStatsComponent', () => {
  let fixture: ComponentFixture<AdminStatsComponent>;
  let http: HttpTestingController;

  const isStats = (r: { url: string }) => r.url === `${API}/admin/stats`;
  const isVideo = (r: { url: string }) => r.url === `${API}/admin/stats/video`;
  const isAndamento = (r: { url: string }) =>
    r.url === `${API}/admin/conteggi/andamento`;
  const el = () => fixture.nativeElement as HTMLElement;
  // ⚠️ `textContent` e mai `innerText`: il secondo restituisce il testo come
  // lo dipinge il CSS, e su un pannello pieno di `text-transform: uppercase`
  // produce falsi rossi su una pagina corretta.
  const text = () => el().textContent ?? '';

  const stabilizza = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Risponde alla chiamata del costruttore e rende il DOM. */
  const flushStats = async (stats: AdminStatsView = statsView()) => {
    http.expectOne(isStats).flush(stats);
    await stabilizza();
  };

  const flushVideo = async (video: AdminVideoStatsView = videoView()) => {
    http.expectOne(isVideo).flush(video);
    await stabilizza();
  };

  const flushAndamento = async (a: AndamentoConteggi = andamentoView()) => {
    http.expectOne(isAndamento).flush(a);
    await stabilizza();
  };

  /**
   * Cambia scheda come una persona: clic sul `button[role=tab]` col testo.
   * ⚠️ Non `setInput('vista', …)`: quello è il valore INIZIALE del deep-link,
   * non lo stato — e un test che lo usasse per navigare non proverebbe che le
   * schede si aprono davvero.
   */
  const apriScheda = async (testo: string) => {
    const tab = Array.from(
      el().querySelectorAll<HTMLButtonElement>('button[role="tab"]'),
    ).find((b) => b.textContent?.trim() === testo);
    expect(tab).withContext(`scheda «${testo}»`).toBeTruthy();
    tab!.click();
    await stabilizza();
  };

  /** La tessera KPI la cui etichetta contiene `etichetta`. */
  const tessera = (etichetta: string): HTMLElement | null =>
    Array.from(el().querySelectorAll<HTMLElement>('.admin-kpi')).find((k) =>
      k.querySelector('.admin-kpi__etichetta')?.textContent?.includes(etichetta),
    ) ?? null;

  const valoreTessera = (etichetta: string): string => {
    const t = tessera(etichetta);
    expect(t).withContext(`tessera «${etichetta}»`).toBeTruthy();
    return t!.querySelector('.admin-kpi__valore')?.textContent?.trim() ?? '';
  };

  /** Le celle d'intestazione di riga (il mese, il tier) di tutte le tabelle. */
  const intestazioniRiga = () =>
    Array.from(el().querySelectorAll('table.admin-table tbody th')).map((th) =>
      th.textContent?.trim(),
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStatsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'it' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStatsComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ── Le tre fonti ─────────────────────────────────────────────────────────

  it('chiede /admin/stats con `months` e NON chiama video né andamento nel costruttore', async () => {
    // I param si chiamano DIVERSAMENTE lato backend, e con
    // forbidNonWhitelisted un nome sbagliato è un 400, non un default.
    const stats = http.expectOne(isStats);
    expect(stats.request.params.get('months')).toBe('12');
    expect(stats.request.params.get('days')).toBeNull();

    // Video e andamento sono PIGRI: chi apre la pagina a leggere gli abbonati
    // non paga una chiamata a Bunny né un ricalcolo dei mesi aperti.
    http.expectNone(isVideo);
    http.expectNone(isAndamento);

    stats.flush(statsView());
    await stabilizza();
  });

  it('la scheda Video chiede /admin/stats/video con `giorni` al primo ingresso, una volta sola', async () => {
    await flushStats();
    await apriScheda('Video');

    const video = http.expectOne(isVideo);
    expect(video.request.params.get('giorni')).toBe('30');
    expect(video.request.params.get('days')).toBeNull();
    video.flush(videoView());
    await stabilizza();

    // Andata e ritorno: nessuna seconda chiamata (la verifica in afterEach
    // fallirebbe su una richiesta non risposta).
    await apriScheda('Abbonati');
    await apriScheda('Video');
    expect(text()).toContain('Video in libreria');
  });

  it('`?vista=video` apre la scheda Video e fa partire la sua richiesta', async () => {
    fixture.componentRef.setInput('vista', 'video');
    await stabilizza();

    const attiva = el().querySelector('button[role="tab"][aria-selected="true"]');
    expect(attiva?.textContent?.trim()).toBe('Video');
    http.expectOne(isStats).flush(statsView());
    http.expectOne(isVideo).flush(videoView());
    await stabilizza();
    expect(text()).toContain('Video in libreria');
  });

  it('`?vista=tutto` non è una scheda: resta su Abbonati', async () => {
    fixture.componentRef.setInput('vista', 'tutto');
    await flushStats();
    const attiva = el().querySelector('button[role="tab"][aria-selected="true"]');
    expect(attiva?.textContent?.trim()).toBe('Abbonati');
  });

  it('la scheda Andamento chiede /admin/conteggi/andamento con `mesi` (e mai `months`)', async () => {
    await flushStats();
    await apriScheda('Andamento');

    const req = http.expectOne(isAndamento);
    expect(req.request.params.get('mesi')).toBe('12');
    expect(req.request.params.get('months')).toBeNull();
    req.flush(andamentoView());
    await stabilizza();
  });

  it('mostra la data del calcolo e la cadenza: la pagina non finge di essere live', async () => {
    await flushStats();
    expect(text()).toContain('15 lug 2026');
    expect(text()).toContain('ogni 5 minuti');
  });

  it('il titolo della barra nomina la scheda, non la sezione', async () => {
    await flushStats();
    const titolo = () => el().querySelector('.admin-barra__titolo')?.textContent?.trim();
    expect(titolo()).toBe('Abbonati e rinnovi');
    await apriScheda('Incassi');
    expect(titolo()).toBe('Incassi degli abbonamenti');
  });

  // ── Abbonati ─────────────────────────────────────────────────────────────

  it('tassoRinnovo null: "dati insufficienti" e la coorte grezza, MAI 0%', async () => {
    await flushStats();
    const t = tessera('Rinnovi');
    expect(t).toBeTruthy();
    expect(valoreTessera('Rinnovi')).toBe('Dati insufficienti');
    expect(t!.textContent).toContain('2 su 3');
    expect(t!.textContent).not.toContain('0%');
    // E nella colonna Tasso della coorte densificata: un trattino, mai «0%».
    expect(text()).not.toContain('0%');
  });

  it('conversione.tasso è una frazione: 0.25 → "25%"', async () => {
    await flushStats();
    expect(valoreTessera('Conversione')).toBe('25%');
  });

  it('conversione.tasso null: i numeri grezzi, non un denominatore inventato', async () => {
    // Il backend risponde null sotto soglia (1 su 1 non è un "100%"). Qui si
    // blocca il testo VECCHIO: "Nessuna registrazione completata: non c'è un
    // denominatore" era falso proprio nel caso che accade — un pagante su un
    // iscritto. Gemello del test sulla coorte di rinnovo.
    const s = statsView();
    s.conversione = { registrazioniComplete: 1, paganti: 1, tasso: null };
    await flushStats(s);
    const t = tessera('Conversione')!;
    expect(valoreTessera('Conversione')).toBe('Dati insufficienti');
    expect(t.textContent).toContain('1 su 1');
    expect(t.textContent).not.toContain('Nessuna registrazione completata');
    expect(text()).not.toContain('100%');
  });

  it('conversione senza nemmeno un iscritto: nessun numero grezzo da mostrare', async () => {
    const s = statsView();
    s.conversione = { registrazioniComplete: 0, paganti: 0, tasso: null };
    await flushStats(s);
    expect(tessera('Conversione')!.textContent).toContain('Nessuno si è ancora iscritto');
  });

  it('conversione al singolare: "1 pagante su 25 registrazioni completate"', async () => {
    // Il caso REALE del singolare: sopra soglia il denominatore è per forza
    // grande, quindi è il numeratore a valere 1. Era l'unico punto della pagina
    // con la concordanza cablata, e capita accanto al numero più delicato.
    const s = statsView();
    s.conversione = { registrazioniComplete: 25, paganti: 1, tasso: 0.04 };
    await flushStats(s);
    const nota = tessera('Conversione')!.textContent!.replace(/\s+/g, ' ');
    expect(nota).toContain('1 pagante su 25 registrazioni completate');
    expect(nota).not.toContain('1 paganti');
  });

  it('la nota della conversione dice chi è escluso: admin e coach', async () => {
    await flushStats();
    expect(text()).toContain('admin e i coach sono esclusi');
  });

  it('quando i due numeri degli abbonati coincidono lo dice', async () => {
    await flushStats();
    expect(el().querySelector('.admin-avviso--ok')?.textContent).toContain(
      'I due numeri coincidono',
    );
  });

  it('staking e coach: riga propria, mai sommata agli abbonati', async () => {
    // ⚠️ I `limiti[]` che la pagina stampa VERBATIM rimandano a questa riga
    // («lo trovi contato a parte, sotto»). Senza il blocco che la disegna,
    // l'owner leggerebbe un rimando a qualcosa che non esiste — e i due ruoli
    // sparirebbero da «chi sta usando la scuola» senza che nulla lo dica.
    const s = statsView({
      abbonati: {
        conAbbonamentoValido: 40,
        hannoAccessoOra: 40,
        perTier: [
          {
            tier: 'SQUALO',
            conAbbonamentoValido: 40,
            hannoAccessoOra: 40,
            senzaScadenza: 0,
            daDeclassare: 0,
          },
        ],
        accessoNonAbbonato: [
          { ruolo: 'STAKATO', utenti: 3 },
          { ruolo: 'COACH', utenti: 1 },
        ],
      },
    });
    await flushStats(s);
    expect(text()).toContain('Accesso senza abbonamento');
    expect(intestazioniRiga()).toContain('Stakato');
    expect(intestazioniRiga()).toContain('Coach');
    // Le due tessere di testa restano quelle degli abbonati veri: 40, non 44.
    expect(valoreTessera('Abbonamenti in regola')).toBe('40');
    expect(valoreTessera('Passano il paywall ora')).toBe('40');
  });

  it('senza staking né coach la riga non compare affatto', async () => {
    // Una tabella vuota intitolata «Accesso senza abbonamento» inviterebbe a
    // cercare un dato che non c'è: a zero non si mostra nulla.
    await flushStats(statsView());
    expect(text()).not.toContain('Accesso senza abbonamento');
  });

  it('accesso senza abbonamento: spiega che sono accessi dati a mano', async () => {
    const s = statsView({
      abbonati: {
        conAbbonamentoValido: 40,
        hannoAccessoOra: 43,
        perTier: [
          {
            tier: 'SQUALO',
            conAbbonamentoValido: 40,
            hannoAccessoOra: 43,
            senzaScadenza: 2,
            daDeclassare: 1,
          },
        ],
        accessoNonAbbonato: [],
      },
    });
    await flushStats(s);
    // 43 - 40 = 3 = senzaScadenza(2) + daDeclassare(1): l'identità del backend.
    const avviso = el().querySelector('.admin-avviso--attenzione');
    expect(avviso).toBeTruthy();
    expect(avviso!.textContent).toContain('accessi dati a mano');
    expect(avviso!.textContent).toContain('senza scadenza');
    expect(avviso!.textContent).toContain('il cron non li ha ancora declassati');
    // Questo ramo si ACCENDE in produzione (l'owner usa le concessioni
    // manuali): è un avviso su cui deve agire, non un posto per una query
    // Mongo. Il perché tecnico sta nei commenti del backend.
    expect(text()).not.toContain('$lt');
    expect(el().querySelector('.admin-avviso code')).toBeNull();
    // E le anomalie della tabella per tier portano il tono di lavoro.
    expect(el().querySelectorAll('td.st__anomalia').length).toBe(2);
  });

  it('la tessera «Abbonamenti in regola» porta agli iscritti', async () => {
    await flushStats();
    const href = Array.from(el().querySelectorAll('a')).map((a) =>
      a.getAttribute('href'),
    );
    expect(href).toContain('/admin/iscritti');
  });

  it('crescita: attivi negli ultimi 30 giorni su tutti gli iscritti, mai «registrazioni completate»', async () => {
    await flushStats();
    expect(valoreTessera('Attivi negli ultimi 30 giorni')).toBe('30');
    const nota = tessera('Attivi negli ultimi 30 giorni')!.textContent!.replace(/\s+/g, ' ');
    expect(nota).toContain('su 200 iscritti');
    expect(nota).not.toContain('registrazioni completate');
    expect(valoreTessera('Attivi negli ultimi 7 giorni')).toBe('12');
    expect(valoreTessera('Registrazioni nel mese')).toBe('5');
  });

  it('crescita: il mese corrente non ha «abbonati a fine mese» e stampa un trattino, mai 0', async () => {
    await flushStats();
    const righe = Array.from(
      el().querySelectorAll<HTMLTableRowElement>('table.admin-table tbody tr'),
    ).filter((tr) => tr.querySelector('[data-etichetta="Abbonati a fine mese"]'));
    const cella = (mese: string) =>
      righe
        .find((tr) => tr.querySelector('th')?.textContent?.trim() === mese)
        ?.querySelector('[data-etichetta="Abbonati a fine mese"]')
        ?.textContent?.trim();
    expect(cella('lug 2026')).toBe('—');
    expect(cella('giu 2026')).toBe('35');
    expect(cella('mag 2026')).toBe('33');
    // E la finestra è densa: maggio non ha registrazioni ma ha la riga.
    const registrati = righe
      .find((tr) => tr.querySelector('th')?.textContent?.trim() === 'mag 2026')
      ?.querySelector('[data-etichetta="Registrati"]')
      ?.textContent?.trim();
    expect(registrati).toBe('0');
  });

  it('i limiti sono resi in pagina, verbatim, dentro un collassabile', async () => {
    await flushStats();
    const limiti = el().querySelector('details.st__limiti');
    expect(limiti).toBeTruthy();
    expect(limiti!.textContent).toContain('Un limite dichiarato dal backend.');
    // Chiuso di default: il testo c'è (Ctrl+F lo trova), lo schermo no.
    expect((limiti as HTMLDetailsElement).open).toBeFalse();

    await apriScheda('Video');
    await flushVideo();
    expect(text()).toContain('Un limite video dichiarato dal backend.');
  });

  // ── Incassi ──────────────────────────────────────────────────────────────

  it('deltaPct arriva già in punti percentuali: 12.5 → "+12,5%"', async () => {
    await flushStats();
    await apriScheda('Incassi');
    // Il bug da bloccare è formattarlo come frazione: darebbe "1.250%".
    expect(valoreTessera('Rispetto ai 30 giorni prima')).toBe('+12,5%');
    expect(text()).not.toContain('1.250%');
  });

  it('deltaPct null: nessun confronto inventato', async () => {
    const s = statsView();
    s.incassoAbbonamenti.deltaPct = null;
    s.incassoAbbonamenti.precedenti30Eur = 0;
    await flushStats(s);
    await apriScheda('Incassi');
    expect(valoreTessera('Rispetto ai 30 giorni prima')).toBe('Nessun confronto');
  });

  it('«coperti dai punti»: la tessera, la colonna e il limite che la promette', async () => {
    await flushStats();
    await apriScheda('Incassi');
    // La tessera: euro float, formattati come euro (37,5 → «37,50 €»).
    expect(valoreTessera('Coperti dai punti (30 gg)')).toMatch(/37,50\s?€/);
    // La colonna: la promessa del limite e l'intestazione, insieme.
    const th = Array.from(el().querySelectorAll('table.admin-table thead th')).map(
      (h) => h.textContent?.trim(),
    );
    expect(th).toContain('Coperti dai punti');
    expect(el().querySelector('details.st__limiti')?.textContent).toContain(
      'coperti dai punti',
    );
    const cella = el().querySelector('td[data-etichetta="Coperti dai punti"]');
    expect(cella?.textContent).toMatch(/12,50\s?€/);
    // E la copia: contanti compresi.
    expect(text()).toContain('PayPal, Skrill o in contanti');
  });

  it('serie sparsa: i mesi senza incasso restano in tabella come €0', async () => {
    await flushStats();
    await apriScheda('Incassi');
    // finestraMesi=3 da 2026-07 ⇒ mag, giu, lug: il backend ne manda solo uno.
    const mesi = intestazioniRiga();
    expect(mesi).toContain('lug 2026');
    expect(mesi).toContain('giu 2026');
    expect(mesi).toContain('mag 2026');
  });

  it('una riga vera fuori dalla finestra calcolata non sparisce mai', async () => {
    // Se la finestra ricostruita qui e quella del backend divergessero, la
    // densificazione non deve mangiarsi un mese CON dati: si leggerebbe "quel
    // mese non è entrato nulla", che è falso.
    const s = statsView();
    s.incassoAbbonamenti.serieMensile.push({
      mese: '2025-01',
      incassoEur: 999,
      puntiEur: 0,
      ordini: 9,
      stimati: 0,
      perMetodo: [],
    });
    await flushStats(s);
    await apriScheda('Incassi');
    expect(intestazioniRiga()).toContain('gen 2025');
    expect(text()).toContain('999');
  });

  it('attivazioni senza cassa: la colonna «Omaggi», e la tabella solo se c\'è qualcosa', async () => {
    await flushStats();
    await apriScheda('Incassi');
    expect(text()).not.toContain('Attivazioni senza cassa (€0)');

    const s = statsView();
    s.incassoAbbonamenti.senzaCassaMensile = [
      { mese: '2026-07', punti: 0, manuale: 0, omaggio: 2 },
    ];
    fixture = TestBed.createComponent(AdminStatsComponent);
    await flushStats(s);
    await apriScheda('Incassi');
    expect(text()).toContain('Attivazioni senza cassa (€0)');
    const th = Array.from(el().querySelectorAll('table.admin-table thead th')).map(
      (h) => h.textContent?.trim(),
    );
    expect(th).toContain('Omaggi');
    expect(el().querySelector('td[data-etichetta="Omaggi"]')?.textContent?.trim()).toBe('2');
  });

  // ── Andamento ────────────────────────────────────────────────────────────

  it('andamento: centesimi stampati come euro, stato per «provvisorio», totali con l\'ambito', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento();

    // 125_050 centesimi → «1.250,50 €» (il separatore delle migliaia è
    // facoltativo: il Chrome di Karma può non renderlo).
    expect(text()).toMatch(/1\.?250,50\s?€/);
    const stati = Array.from(
      el().querySelectorAll('table.admin-table .admin-stato[data-tono]'),
    ).map((s) => `${s.getAttribute('data-tono')}:${s.textContent?.trim()}`);
    expect(stati).toContain('attesa:Provvisorio');
    expect(stati).toContain('concluso:Chiuso');
    // Il più recente in cima.
    expect(intestazioniRiga()[0]).toBe('set 2026');

    const ambito = el().querySelector('.admin-totali__ambito');
    expect(ambito?.textContent).toContain("sull'unico mese chiuso della finestra");
    // Le due tessere: il mese aperto «Provvisorio», l'ultimo chiuso «Congelato».
    expect(tessera('Margine di settembre 2026')!.textContent).toContain('Provvisorio');
    expect(tessera('Margine di agosto 2026')!.textContent).toContain('Congelato');
    // I limiti dei conteggi, verbatim.
    expect(text()).toContain('Un limite dei conteggi dichiarato dal backend.');
  });

  it('andamento: i mesi non calcolati si dicono, e nessun NaN', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento(
      andamentoView({
        nonCalcolati: [
          { id: 'm-2026-05', etichetta: 'maggio 2026' },
          { id: 'm-2026-06', etichetta: 'giugno 2026' },
        ],
      }),
    );
    const avviso = el().querySelector('.admin-avviso--attenzione');
    expect(avviso?.textContent).toContain('maggio 2026, giugno 2026');
    expect(avviso?.textContent).toContain('non sono calcolati');
    expect(text()).not.toContain('NaN');
  });

  it('andamento: nessun mese → la riga vuota, senza zeri inventati', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento(
      andamentoView({
        mesi: [],
        totaliChiusi: { mesi: 0, entrateCent: 0, usciteCent: 0, margineNettoCent: 0 },
      }),
    );
    expect(el().querySelector('.admin-table__vuota')?.textContent).toContain(
      'Nessun mese contabile',
    );
    expect(text()).not.toContain('NaN');
  });

  it('errore su /andamento: banda con «Riprova» che rifà SOLO quella rotta', async () => {
    await flushStats();
    await apriScheda('Andamento');
    http
      .expectOne(isAndamento)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await stabilizza();

    const banda = el().querySelector('.form-feedback.is-error');
    expect(banda?.textContent).toContain('Caricamento dei conteggi non riuscito.');
    banda!.querySelector('button')!.click();
    await stabilizza();
    http.expectOne(isAndamento).flush(andamentoView());
    http.expectNone(isStats);
    http.expectNone(isVideo);
    await stabilizza();
    expect(text()).toContain('set 2026');
  });

  it('cambiare la finestra dei mesi contabili ricarica solo /andamento', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento();

    const comp = fixture.componentInstance as unknown as {
      setMesiAndamento(n: number): void;
    };
    comp.setMesiAndamento(24);
    const req = http.expectOne(isAndamento);
    expect(req.request.params.get('mesi')).toBe('24');
    req.flush(andamentoView({ finestraMesi: 24 }));
    await stabilizza();
  });

  // ── Video ────────────────────────────────────────────────────────────────

  it('video non disponibile: mostra il motivo e nessuno zero', async () => {
    await flushStats();
    await apriScheda('Video');
    await flushVideo(
      videoView({
        disponibile: false,
        motivo: 'Bunny non risponde.',
        libreria: null,
        andamento: null,
      }),
    );
    expect(text()).toContain('Statistiche video non disponibili');
    expect(text()).toContain('Bunny non risponde.');
    // Uno zero qui si leggerebbe "nessuno guarda i video".
    expect(text()).not.toContain('Riproduzioni totali');
    expect(text()).not.toContain('Video in libreria');
  });

  it('errore su /admin/stats/video: banda con retry, i numeri di business restano', async () => {
    await flushStats();
    await apriScheda('Video');
    http
      .expectOne(isVideo)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await stabilizza();

    expect(text()).toContain('Caricamento statistiche video non riuscito.');
    expect(text()).toContain('Riprova');
    // Il guasto di Bunny non spegne le metriche Mongo, che con Bunny non
    // c'entrano nulla: tornando su Abbonati la pagina è intera.
    await apriScheda('Abbonati');
    expect(text()).not.toContain('Caricamento statistiche video non riuscito.');
    expect(valoreTessera('Abbonamenti in regola')).toBe('40');
  });

  it('la tabella delle lezioni: identità a due righe con la visibilità come fatto', async () => {
    await flushStats();
    await apriScheda('Video');
    await flushVideo(
      videoView({
        lezioni: [
          {
            lezioneId: 'l1',
            titolo: 'Difesa del big blind',
            guid: 'abc-123',
            visibility: 'SQUALO',
            stakes: 'HIGH',
            videoDate: '2026-07-12T00:00:00.000Z',
            visualizzazioni: 120,
            tempoVisioneSecondi: 3600,
            tempoMedioSecondi: 30,
            durataSecondi: 100,
            percentualeVisione: 0.3,
          },
        ],
      }),
    );
    const ident = el().querySelector('table.st__lezioni .admin-table__ident');
    expect(ident).toBeTruthy();
    expect(ident!.querySelector('strong')?.textContent).toBe('Difesa del big blind');
    expect(ident!.querySelector('.badge')?.textContent?.trim()).toBe('Squalo');
    const sub = ident!.querySelector('.admin-table__sub');
    expect(sub?.textContent).toContain('High · 12/07/2026 · abc-123');
    expect(sub?.getAttribute('title')).toBe(sub?.textContent?.trim());
    expect(text()).toContain('30%');
  });

  it('cambiare finestra ricarica solo la sezione interessata', async () => {
    await flushStats();

    const comp = fixture.componentInstance as unknown as {
      setMesi(n: number): void;
    };
    comp.setMesi(24);

    const req = http.expectOne(isStats);
    expect(req.request.params.get('months')).toBe('24');
    req.flush(statsView({ finestraMesi: 24 }));
    await stabilizza();
    // nessuna nuova chiamata a /admin/stats/video né a /andamento: la
    // verifica in afterEach fallirebbe se ne fosse partita una non risposta.
  });
});
