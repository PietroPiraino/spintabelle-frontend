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
  AdminSitoRicercaView,
  AdminSitoTrafficoView,
  AdminStatsView,
  AdminVideoStatsView,
  AndamentoConteggi,
  RigaAndamento,
  RigaUrlChiave,
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

/**
 * La metà Cloudflare della scheda Sito: due giorni, il 13 esatto e il 14
 * campionato (1 pagina su 10), una pagina con l'URL lungo, una provenienza
 * VUOTA (il traffico diretto), un Paese in ISO-2, un dispositivo con la
 * chiave grezza di Cloudflare, i tre vitali in tre stati diversi.
 */
const trafficoView = (
  over: Partial<AdminSitoTrafficoView> = {},
): AdminSitoTrafficoView => ({
  generatoIl: GENERATO_IL,
  aggiornatoOgniMinuti: 15,
  disponibile: true,
  periodo: { giorni: 30, dal: '2026-06-16', al: '2026-07-15' },
  totali: { visite: 120, pagineViste: 340, paginePerVisita: 2.8, visiteAlGiorno: 4 },
  andamento: {
    serie: [
      { giorno: '2026-07-13', visite: 10, pagineViste: 25, campione: 1 },
      { giorno: '2026-07-14', visite: 30, pagineViste: 60, campione: 10 },
    ],
  },
  pagine: [
    {
      chiave: '/guide/come-si-gioca-uno-spin-and-go-dal-primo-livello-alla-fine/',
      visite: 40,
      pagineViste: 90,
      quota: 0.333,
    },
  ],
  provenienze: [{ chiave: '', visite: 70, pagineViste: 200, quota: 0.583 }],
  paesi: [{ chiave: 'IT', visite: 100, pagineViste: 300, quota: 0.833 }],
  dispositivi: [{ chiave: 'mobile', visite: 80, pagineViste: 210, quota: 0.667 }],
  browser: [{ chiave: 'Chrome', visite: 90, pagineViste: 250, quota: 0.75 }],
  vitali: {
    dal: '2026-07-09',
    al: '2026-07-15',
    eventi: 400,
    lcp: { p75: 2100, giudizio: 'buono', distribuzione: null },
    inp: { p75: 250, giudizio: 'daMigliorare', distribuzione: null },
    cls: { p75: null, giudizio: null, distribuzione: null },
  },
  qualitaDati: {
    giorniStimati: 1,
    campioneMassimo: 10,
    elencoTroncato: false,
    finestreInterrogate: 1,
    finestreFallite: 0,
  },
  limiti: ['Un limite del traffico dichiarato dal backend.'],
  ...over,
});

/**
 * La metà Google: totali calcolati da Google, due giorni pubblicati (Google è
 * indietro di tre), una parola cercata, una pagina con l'URL completo, una
 * sitemap letta e due pagine chiave con esiti diversi.
 */
const ricercaView = (
  over: Partial<AdminSitoRicercaView> = {},
): AdminSitoRicercaView => ({
  generatoIl: GENERATO_IL,
  aggiornatoOgniMinuti: 60,
  disponibile: true,
  periodo: { giorni: 30, dal: '2026-06-16', al: '2026-07-15' },
  totali: { clic: 45, impressioni: 1400, ctr: 0.032, posizioneMedia: 12.4 },
  andamento: {
    serie: [
      { giorno: '2026-07-13', clic: 5, impressioni: 150, ctr: 0.033, posizioneMedia: 14.2 },
      { giorno: '2026-07-14', clic: 8, impressioni: 250, ctr: 0.032, posizioneMedia: 11.8 },
    ],
  },
  query: [
    { chiave: 'tabelle push fold', clic: 12, impressioni: 375, ctr: 0.032, posizioneMedia: 12.4 },
  ],
  pagine: [
    {
      chiave: 'https://bestfishforever.it/guide/push-fold/',
      clic: 20,
      impressioni: 600,
      ctr: null,
      posizioneMedia: null,
    },
  ],
  copertura: {
    sitemap: [
      {
        url: 'https://bestfishforever.it/sitemap.xml',
        stato: 'letta',
        inviataIl: '2026-07-01T00:00:00.000Z',
        ultimaLettura: '2026-07-14T03:00:00.000Z',
        urlInviati: 27,
        errori: 0,
        avvisi: 0,
      },
    ],
    urlChiave: [
      {
        url: 'https://bestfishforever.it/',
        esito: 'indicizzata',
        copertura: 'Inviato e indicizzato',
        ultimaScansione: '2026-07-12T00:00:00.000Z',
        indicizzabile: true,
        canonicaCoincide: true,
        link: null,
        ispezionatoIl: GENERATO_IL,
      },
      {
        url: 'https://bestfishforever.it/tabelle/',
        esito: 'esclusa',
        copertura: 'Rilevata, attualmente non indicizzata',
        ultimaScansione: null,
        indicizzabile: null,
        canonicaCoincide: null,
        link: null,
        ispezionatoIl: GENERATO_IL,
      },
    ],
  },
  qualitaDati: {
    ultimoGiornoConDati: '2026-07-14',
    giorniSenzaDati: 3,
    clicSenzaQuery: 2,
    righeTroncate: false,
    ispezioniFallite: 0,
  },
  limiti: ['Un limite della ricerca dichiarato dal backend.'],
  ...over,
});

describe('AdminStatsComponent', () => {
  let fixture: ComponentFixture<AdminStatsComponent>;
  let http: HttpTestingController;

  const isStats = (r: { url: string }) => r.url === `${API}/admin/stats`;
  const isVideo = (r: { url: string }) => r.url === `${API}/admin/stats/video`;
  const isAndamento = (r: { url: string }) =>
    r.url === `${API}/admin/conteggi/andamento`;
  const isTraffico = (r: { url: string }) =>
    r.url === `${API}/admin/stats/sito/traffico`;
  const isRicerca = (r: { url: string }) =>
    r.url === `${API}/admin/stats/sito/ricerca`;
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
   * Le due metà di Sito partono INSIEME al primo ingresso: ogni test che apre
   * la scheda deve rispondere a entrambe, o `http.verify()` in afterEach
   * fallisce — ed è voluto, una richiesta lasciata in volo è un test che non
   * ha guardato metà pagina.
   */
  const flushTraffico = async (t: AdminSitoTrafficoView = trafficoView()) => {
    http.expectOne(isTraffico).flush(t);
    await stabilizza();
  };

  const flushRicerca = async (r: AdminSitoRicercaView = ricercaView()) => {
    http.expectOne(isRicerca).flush(r);
    await stabilizza();
  };

  const flushSito = async (
    t: AdminSitoTrafficoView = trafficoView(),
    r: AdminSitoRicercaView = ricercaView(),
  ) => {
    await flushTraffico(t);
    await flushRicerca(r);
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

    // Video, andamento e le due metà di Sito sono PIGRI: chi apre la pagina a
    // leggere gli abbonati non paga una chiamata a Bunny, un ricalcolo dei
    // mesi aperti, né due chiamate a Cloudflare e Google.
    http.expectNone(isVideo);
    http.expectNone(isAndamento);
    http.expectNone(isTraffico);
    http.expectNone(isRicerca);

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
    // E nella colonna Tasso della coorte densificata (zero scadenze): un
    // trattino, mai «0%».
    const tassi = Array.from(el().querySelectorAll('td[data-etichetta="Tasso"]')).map(
      (td) => td.textContent?.trim(),
    );
    expect(tassi.length).toBeGreaterThan(0);
    expect(tassi.every((v) => v === '—')).toBeTrue();
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

  it('crescita: una fotografia a fine mese fuori dalla finestra non sparisce mai', async () => {
    // La densificazione può solo AGGIUNGERE mesi a zero, mai togliere una riga
    // vera — e vale per OGNI serie che entra nella tabella, non solo per le
    // registrazioni: un «abbonati a fine mese» del gennaio 2025 senza una
    // registrazione in quel mese deve restare in tabella col suo valore.
    const s = statsView();
    s.crescita.abbonatiFineMese.push({ mese: '2025-01', attivi: 7 });
    await flushStats(s);
    const riga = Array.from(
      el().querySelectorAll<HTMLTableRowElement>('table.admin-table tbody tr'),
    ).find(
      (tr) =>
        tr.querySelector('[data-etichetta="Abbonati a fine mese"]') &&
        tr.querySelector('th')?.textContent?.trim() === 'gen 2025',
    );
    expect(riga).withContext('la riga di gennaio 2025').toBeTruthy();
    expect(
      riga!.querySelector('[data-etichetta="Abbonati a fine mese"]')?.textContent?.trim(),
    ).toBe('7');
    expect(riga!.querySelector('[data-etichetta="Registrati"]')?.textContent?.trim()).toBe('0');
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

  it('andamento: lo stato si chiava su `provvisorio` e MAI su `stato`; i mesi chiusi li conta il server', async () => {
    await flushStats();
    await apriScheda('Andamento');
    // Un mese CHIUSO il cui riepilogo non si è salvato alla chiusura si
    // ricalcola a ogni lettura: è provvisorio a tutti gli effetti, e il server
    // lo tiene fuori dai totali. Chiavando su `stato` direbbe «Chiuso».
    await flushAndamento(
      andamentoView({
        mesi: [
          rigaAndamento({
            id: 'm-2026-08',
            mese: 8,
            chiave: '2026-08',
            etichetta: 'agosto 2026',
            stato: 'CHIUSO',
            provvisorio: false,
            chiusoAt: '2026-09-02T10:00:00.000Z',
          }),
          rigaAndamento({ stato: 'CHIUSO', provvisorio: true }),
        ],
        // ⚠️ Un solo mese non provvisorio nella risposta, ma il server ne
        // dichiara TRE: la striscia stampa il numero del server, mai un
        // conteggio fatto qui sulle righe (la finestra dei totali è sua).
        totaliChiusi: {
          mesi: 3,
          entrateCent: 300_000,
          usciteCent: 90_000,
          margineNettoCent: 210_000,
        },
      }),
    );

    const rigaSettembre = Array.from(
      el().querySelectorAll<HTMLTableRowElement>('table.admin-table tbody tr'),
    ).find((tr) => tr.querySelector('th')?.textContent?.trim() === 'set 2026');
    expect(rigaSettembre).toBeTruthy();
    const pill = rigaSettembre!.querySelector('.admin-stato');
    expect(pill?.getAttribute('data-tono')).toBe('attesa');
    expect(pill?.textContent?.trim()).toBe('Provvisorio');
    // La tessera del mese aperto lo prende, benché lo `stato` dica CHIUSO.
    expect(tessera('Margine di settembre 2026')!.textContent).toContain('Provvisorio');

    expect(el().querySelector('.admin-totali__ambito')?.textContent).toContain(
      'sui 3 mesi chiusi della finestra',
    );

    // E il sottotitolo della modale: «Provvisorio», non «Congelato».
    comando('Conto economico di settembre 2026')!.click();
    await stabilizza();
    const d = dialogo();
    expect(d?.textContent).toContain('Provvisorio');
    expect(d?.textContent).not.toContain('Congelato');
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
    // ⚠️ Nessuna striscia dei totali: tre «0,00 €» sopra «sui 0 mesi chiusi»
    // sono zeri inventati — non c'è niente che sia stato sommato. Al suo
    // posto, la nota che dice perché.
    expect(el().querySelector('.admin-totali')).toBeNull();
    expect(text()).not.toContain('sui 0 mesi');
    expect(text()).toContain(
      'Nessun mese chiuso nella finestra: i totali si mostrano solo sui mesi chiusi e congelati.',
    );
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

  // ── Grafici e modali ─────────────────────────────────────────────────────

  /** Il `<figure class="grafico">` col titolo dato. */
  const grafico = (titolo: string): HTMLElement => {
    const fig = Array.from(el().querySelectorAll<HTMLElement>('figure.grafico')).find(
      (f) => f.querySelector('.grafico__titolo')?.textContent?.trim() === titolo,
    );
    expect(fig).withContext(`grafico «${titolo}»`).toBeTruthy();
    return fig!;
  };
  const lenteDi = (titolo: string) =>
    grafico(titolo).querySelector<HTMLButtonElement>('button.grafico__lente')!;
  const readoutDi = (titolo: string) =>
    grafico(titolo).querySelector<HTMLElement>('[aria-live="polite"]')!.textContent ?? '';
  const tasto = (key: string) => new KeyboardEvent('keydown', { key, bubbles: true });
  /** Invio/Spazio sulla lente: il bottone li traduce in un clic con `detail: 0`. */
  const invio = () => new MouseEvent('click', { bubbles: true, detail: 0 });
  const dialogo = () => el().querySelector<HTMLDialogElement>('dialog[open]');
  // ⚠️ Per `aria-label`, mai per classe: è l'unica riga del repo che nomina
  // l'etichetta del comando di riga, e resta una rete solo se il test la cerca.
  const comando = (etichetta: string) =>
    el().querySelector<HTMLButtonElement>(`button[aria-label="${etichetta}"]`);
  /**
   * Le barre di un grafico, nell'ordine in cui il primitivo le emette: per
   * ogni colonna, una barra per serie. Con due serie, la colonna `i` è la
   * coppia `[2i, 2i+1]`.
   *
   * ⚠️ La GEOMETRIA e non il solo conteggio: `n × m` barre escono uguali sia
   * affiancate sia impilate, quindi un `length` non distingue i due modi — e
   * il modo È la scelta portante di questi grafici (una pila di «incasso +
   * coperti dai punti» sarebbe una somma che il backend vieta).
   */
  const barreDi = (titolo: string) =>
    Array.from(grafico(titolo).querySelectorAll<SVGRectElement>('rect.grafico__barra'));
  const attr = (e: Element, nome: string) => Number(e.getAttribute(nome));

  it('crescita: il grafico impila verificate e non verificate, e la linea si ferma al mese chiuso', async () => {
    await flushStats();
    const fig = grafico('Registrazioni e abbonati per mese');
    // Tre mesi × due serie: la pila è il totale delle registrazioni.
    const barre = barreDi('Registrazioni e abbonati per mese');
    expect(barre.length).toBe(6);
    // IMPILATE: giugno (colonna 1) ha 9 verificate e 3 no. Le due barre hanno
    // la stessa `x`, e la seconda POGGIA sulla prima — il suo piede è la
    // testa della prima. Affiancate, le `x` sarebbero diverse.
    const [prima, seconda] = barre.slice(2, 4);
    expect(attr(seconda, 'x')).toBe(attr(prima, 'x'));
    expect(attr(seconda, 'width')).toBe(attr(prima, 'width'));
    expect(attr(seconda, 'y') + attr(seconda, 'height')).toBeCloseTo(attr(prima, 'y'), 6);
    // La linea c'è (maggio e giugno hanno una fotografia a fine mese).
    expect(fig.querySelector('polyline.grafico__linea')).toBeTruthy();

    // Il fuoco sceglie l'ULTIMA colonna, luglio: nel readout ci sono i testi
    // già formattati, il dettaglio delle registrazioni, e NIENTE linea — il
    // mese corrente non ha una fotografia a fine mese.
    lenteDi('Registrazioni e abbonati per mese').dispatchEvent(new Event('focus'));
    await stabilizza();
    let detto = readoutDi('Registrazioni e abbonati per mese');
    expect(detto).toContain('luglio 2026');
    expect(detto).toContain('Verificate 4');
    expect(detto).toContain('Non verificate 1');
    expect(detto).toContain('5 registrazioni');
    expect(detto).not.toContain('Abbonati a fine mese');

    // ArrowLeft: giugno, che è chiuso e porta la linea.
    lenteDi('Registrazioni e abbonati per mese').dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    detto = readoutDi('Registrazioni e abbonati per mese');
    expect(detto).toContain('giugno 2026');
    expect(detto).toContain('Verificate 9');
    expect(detto).toContain('Non verificate 3');
    expect(detto).toContain('Abbonati a fine mese 35');
    expect(detto).toContain('12 registrazioni');
  });

  it('«Dettaglio» di Nuovi, rinnovi e ritorni apre la modale con la tabella a sette colonne', async () => {
    await flushStats();
    expect(dialogo()).toBeNull();
    // La tabella NON è in pagina: vive nella modale.
    expect(el().querySelector('td[data-etichetta="Paganti · nuovi"]')).toBeNull();

    const bottone = Array.from(
      el().querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]'),
    ).find((b) => b.textContent?.trim() === 'Dettaglio');
    expect(bottone).toBeTruthy();
    bottone!.click();
    await stabilizza();

    const d = dialogo();
    expect(d).toBeTruthy();
    expect(d!.textContent).toContain('Nuovi, rinnovi e ritorni per mese');
    expect(d!.querySelectorAll('table.admin-table--etichettata .st__colonne th').length).toBe(7);
    expect(
      d!.querySelector('td[data-etichetta="Paganti · nuovi"]')?.textContent?.trim(),
    ).toBe('3');
    expect(
      d!.querySelector('td[data-etichetta="Non paganti · nuovi"]')?.textContent?.trim(),
    ).toBe('1');
  });

  it('un Invio sulla lente di «Clienti paganti per mese» apre la stessa modale', async () => {
    await flushStats();
    const lente = lenteDi('Clienti paganti per mese');
    lente.dispatchEvent(new Event('focus'));
    lente.dispatchEvent(invio());
    await stabilizza();
    expect(dialogo()?.textContent).toContain('Nuovi, rinnovi e ritorni per mese');
  });

  it('il ⋮ «Dettaglio dell\'incasso di lug 2026» apre la modale coi metodi, e la colonna «Metodi» non è più in tabella', async () => {
    await flushStats();
    await apriScheda('Incassi');
    const th = Array.from(el().querySelectorAll('table.admin-table thead th')).map(
      (h) => h.textContent?.trim(),
    );
    expect(th).not.toContain('Metodi');
    // Nessuna cella porta il metodo: sta nella scheda del mese.
    const celle = Array.from(el().querySelectorAll('table.admin-table td')).map(
      (td) => td.textContent ?? '',
    );
    expect(celle.some((t) => t.includes('PayPal'))).toBeFalse();

    const c = comando("Dettaglio dell'incasso di lug 2026");
    expect(c).toBeTruthy();
    expect(c!.getAttribute('aria-haspopup')).toBe('dialog');
    c!.click();
    await stabilizza();

    const d = dialogo();
    expect(d).toBeTruthy();
    expect(d!.textContent).toContain('Incasso di lug 2026');
    expect(d!.textContent).toContain('PayPal');
    expect(d!.textContent).toMatch(/500\s?€/);
    expect(d!.textContent).toContain('Omaggi');
  });

  it('la modale dell\'incasso segue la CHIAVE: dopo una ricarica mostra il valore nuovo, e si chiude se il mese sparisce', async () => {
    await flushStats();
    await apriScheda('Incassi');
    comando("Dettaglio dell'incasso di lug 2026")!.click();
    await stabilizza();
    expect(dialogo()?.textContent).toMatch(/500\s?€/);

    // «Ricarica» rifà /admin/stats e luglio torna con un altro incasso: la
    // modale tiene la chiave del mese, non l'oggetto della riga vecchia — che
    // continuerebbe a dire 500 sopra una tabella che dice 750.
    const ricarica = () => el().querySelector<HTMLButtonElement>('button.st__ricarica')!;
    ricarica().click();
    const s = statsView();
    s.incassoAbbonamenti.serieMensile[0].incassoEur = 750;
    s.incassoAbbonamenti.serieMensile[0].perMetodo = [
      { metodo: 'paypal', incassoEur: 750, ordini: 4 },
    ];
    http.expectOne(isStats).flush(s);
    await stabilizza();
    const d = dialogo();
    expect(d).withContext('la modale resta aperta sulla riga nuova').toBeTruthy();
    expect(d!.textContent).toMatch(/750\s?€/);
    expect(d!.textContent).not.toMatch(/500\s?€/);

    // E se la finestra si sposta e luglio non c'è più, la chiave non risolve
    // niente: la modale si chiude, invece di restare aperta su un mese che
    // la tabella non ha.
    ricarica().click();
    const s2 = statsView({ generatoIl: '2026-03-15T10:00:00.000Z' });
    s2.incassoAbbonamenti.serieMensile = [];
    http.expectOne(isStats).flush(s2);
    await stabilizza();
    expect(dialogo()).toBeNull();
  });

  it('il grafico dell\'incasso è affiancato, e un Invio sulla colonna apre il mese', async () => {
    await flushStats();
    await apriScheda('Incassi');
    grafico('Incasso per mese');
    // Tre mesi × due serie affiancate, mai una pila: quegli euro non si sommano.
    const barre = barreDi('Incasso per mese');
    expect(barre.length).toBe(6);
    // AFFIANCATE: luglio (colonna 2) ha incasso 500 e 12,50 coperti dai punti.
    // Le due barre hanno `x` DIVERSE, e la seconda comincia dove finisce la
    // prima: una accanto all'altra, mai una sopra l'altra.
    const [incasso, punti] = barre.slice(4, 6);
    expect(attr(punti, 'x')).not.toBe(attr(incasso, 'x'));
    expect(attr(punti, 'x')).toBeCloseTo(attr(incasso, 'x') + attr(incasso, 'width'), 6);

    const lente = lenteDi('Incasso per mese');
    lente.dispatchEvent(new Event('focus'));
    await stabilizza();
    const detto = readoutDi('Incasso per mese');
    expect(detto).toContain('luglio 2026');
    expect(detto).toMatch(/Incasso 500\s?€/);
    expect(detto).toMatch(/Coperti dai punti 12,50\s?€/);
    expect(detto).toContain('4 abbonamenti');

    lente.dispatchEvent(invio());
    await stabilizza();
    expect(dialogo()?.textContent).toContain('Incasso di lug 2026');
  });

  it('andamento: il ⋮ «Conto economico di settembre 2026» apre il conto economico', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento();

    const c = comando('Conto economico di settembre 2026');
    expect(c).toBeTruthy();
    c!.click();
    await stabilizza();

    const d = dialogo();
    expect(d).toBeTruthy();
    expect(d!.querySelector('dl.admin-conto')).toBeTruthy();
    expect(d!.textContent).toContain('Margine netto della scuola');
    expect(d!.textContent).toMatch(/950,50\s?€/);
    // Il sottotitolo si chiava su `provvisorio`.
    expect(d!.textContent).toContain('Provvisorio');
    // Le quote in punti base, il piede che porta ai Conteggi col deep-link.
    expect(d!.textContent).toMatch(/Quota titolare \(65\s?%\)/);
    expect(d!.textContent).toMatch(/Quota socio \(35\s?%\)/);
    const link = d!.querySelector<HTMLAnchorElement>('a.btn');
    expect(link?.textContent).toContain('Apri nei Conteggi');
    expect(link?.getAttribute('href')).toContain('mese=m-2026-09');
    expect(link?.getAttribute('href')).toContain('vista=riepilogo');
  });

  it('andamento: un mese congelato dice quando, e il conguaglio porta il segno', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento();
    comando('Conto economico di agosto 2026')!.click();
    await stabilizza();
    const d = dialogo()!;
    expect(d.textContent).toContain('Congelato il 02/09/2026');
    expect(d.textContent).toMatch(/\+348,29\s?€/);
  });

  it('andamento: il grafico tratteggia il mese aperto e dice il conguaglio nel readout', async () => {
    await flushStats();
    await apriScheda('Andamento');
    await flushAndamento();
    const fig = grafico('Entrate e uscite per mese');
    // Settembre è aperto: le sue due barre sono provvisorie, quelle di agosto no.
    expect(fig.querySelectorAll('rect.is-provvisoria').length).toBe(2);
    const barre = barreDi('Entrate e uscite per mese');
    expect(barre.length).toBe(4);
    // AFFIANCATE: entrate e uscite di agosto (colonna 0) stanno una accanto
    // all'altra — impilate, l'altezza direbbe «entrate + uscite», una somma
    // che non significa niente.
    const [entrate, uscite] = barre.slice(0, 2);
    expect(attr(uscite, 'x')).not.toBe(attr(entrate, 'x'));
    expect(attr(uscite, 'x')).toBeCloseTo(attr(entrate, 'x') + attr(entrate, 'width'), 6);
    expect(fig.querySelector('polyline.grafico__linea')).toBeTruthy();

    const lente = lenteDi('Entrate e uscite per mese');
    lente.dispatchEvent(new Event('focus'));
    await stabilizza();
    expect(readoutDi('Entrate e uscite per mese')).toContain('settembre 2026, provvisorio');
    // Agosto: il conguaglio nel dettaglio, o la linea del margine sembra
    // sbagliata di quel termine.
    lente.dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    const detto = readoutDi('Entrate e uscite per mese');
    expect(detto).toContain('agosto 2026');
    expect(detto).toMatch(/Margine netto 1\.?298,79\s?€/);
    expect(detto).toMatch(/Conguaglio coi giocatori \+348,29\s?€/);

    // E Invio apre il conto economico del mese selezionato.
    lente.dispatchEvent(invio());
    await stabilizza();
    expect(dialogo()?.textContent).toContain('Conto economico di agosto 2026');
  });

  it('video: il grafico giornaliero è alto 120px, dichiarati', async () => {
    await flushStats();
    await apriScheda('Video');
    await flushVideo();
    const fig = grafico('Riproduzioni al giorno');
    expect(fig.style.getPropertyValue('--grafico-h')).toBe('120px');
    expect(fig.querySelectorAll('rect.grafico__barra').length).toBe(2);
  });

  it('video: le riproduzioni giorno per giorno stanno anche in tabella, tutti i giorni della finestra', async () => {
    // Ogni grafico della pagina è accompagnato dai suoi numeri esatti: il
    // disegno riassume, non sostituisce. Quello giornaliero era l'unico senza.
    await flushStats();
    await apriScheda('Video');
    await flushVideo();
    const piega = Array.from(el().querySelectorAll<HTMLDetailsElement>('details.admin-piega')).find(
      (d) => d.querySelector('summary')?.textContent?.includes('Riproduzioni giorno per giorno'),
    );
    expect(piega).withContext('il collassabile «Riproduzioni giorno per giorno»').toBeTruthy();
    // Chiuso di default: 90 righe non devono occupare lo schermo di chi non le cerca.
    expect(piega!.open).toBeFalse();
    const righe = Array.from(piega!.querySelectorAll('table.admin-table tbody tr'));
    expect(righe.length).toBe(2);
    // Il più recente in cima, come in ogni tabella della pagina.
    expect(righe.map((tr) => tr.querySelector('th')?.textContent?.trim())).toEqual([
      '14 lug',
      '13 lug',
    ]);
    expect(
      righe.map((tr) => tr.querySelector('td[data-etichetta="Riproduzioni"]')?.textContent?.trim()),
    ).toEqual(['30', '10']);
  });

  // ── Sito (Cloudflare + Google Search Console) ────────────────────────────

  /** La tabella `.admin-table` con la `<caption>` data. */
  const tabella = (caption: string): HTMLTableElement => {
    const t = Array.from(el().querySelectorAll<HTMLTableElement>('table.admin-table')).find(
      (x) => x.querySelector('caption')?.textContent?.trim() === caption,
    );
    expect(t).withContext(`tabella «${caption}»`).toBeTruthy();
    return t!;
  };
  /** Il collassabile `details.admin-piega` il cui summary contiene `testo`. */
  const piega = (testo: string): HTMLDetailsElement => {
    const d = Array.from(el().querySelectorAll<HTMLDetailsElement>('details.admin-piega')).find(
      (x) => x.querySelector('summary')?.textContent?.includes(testo),
    );
    expect(d).withContext(`collassabile «${testo}»`).toBeTruthy();
    return d!;
  };
  /** La voce del filtro (radio) col testo dato: ce n'è UN filtro solo per scheda. */
  const voceFiltro = (testo: string): HTMLButtonElement => {
    const b = Array.from(el().querySelectorAll<HTMLButtonElement>('button[role="radio"]')).find(
      (x) => x.textContent?.trim() === testo,
    );
    expect(b).withContext(`voce «${testo}»`).toBeTruthy();
    return b!;
  };
  /** Le pastiglie `.admin-stato` dentro `radice`, come coppie [tono, testo]. */
  const pastiglie = (radice: ParentNode) =>
    Array.from(radice.querySelectorAll<HTMLElement>('.admin-stato')).map((s) => [
      s.dataset['tono'],
      s.textContent?.trim(),
    ]);

  it('la scheda Sito chiede traffico E ricerca con `giorni=30` al primo ingresso, una volta sola', async () => {
    await flushStats();
    await apriScheda('Sito');

    const traffico = http.expectOne(isTraffico);
    const ricerca = http.expectOne(isRicerca);
    // Stesso nome di parametro di /video, e mai `days`: con
    // forbidNonWhitelisted un nome sbagliato è un 400 sull'intera chiamata.
    expect(traffico.request.params.get('giorni')).toBe('30');
    expect(traffico.request.params.get('days')).toBeNull();
    expect(ricerca.request.params.get('giorni')).toBe('30');
    expect(ricerca.request.params.get('days')).toBeNull();
    traffico.flush(trafficoView());
    ricerca.flush(ricercaView());
    await stabilizza();

    // Andata e ritorno: nessuna seconda chiamata su nessuna delle due.
    await apriScheda('Abbonati');
    await apriScheda('Sito');
    expect(text()).toContain('Visite');
    expect(text()).toContain('Clic');
  });

  it('`?vista=sito` apre la scheda e fa partire ENTRAMBE le richieste', async () => {
    fixture.componentRef.setInput('vista', 'sito');
    await stabilizza();

    const attiva = el().querySelector('button[role="tab"][aria-selected="true"]');
    expect(attiva?.textContent?.trim()).toBe('Sito');
    http.expectOne(isStats).flush(statsView());
    http.expectOne(isTraffico).flush(trafficoView());
    http.expectOne(isRicerca).flush(ricercaView());
    await stabilizza();
    expect(valoreTessera('Visite')).toBe('120');
    expect(valoreTessera('Clic')).toBe('45');
  });

  it('traffico non configurato: pastiglia spenta, motivo, nessuna tessera, la ricerca resta', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito(
      trafficoView({
        disponibile: false,
        causa: 'configurazione',
        motivo: 'Mancano CLOUDFLARE_ANALYTICS_API_TOKEN e CLOUDFLARE_ACCOUNT_TAG su Render.',
        totali: null,
        andamento: null,
        vitali: null,
        pagine: [],
        provenienze: [],
        paesi: [],
        dispositivi: [],
        browser: [],
      }),
    );
    const avviso = Array.from(el().querySelectorAll<HTMLElement>('.admin-avviso')).find((a) =>
      a.textContent?.includes('Traffico non configurato'),
    );
    expect(avviso).withContext("l'avviso del traffico").toBeTruthy();
    // «Da configurare» è la pastiglia SPENTA: è uno stato, non un guasto.
    expect(pastiglie(avviso!)).toEqual([['spento', 'Traffico non configurato']]);
    expect(avviso!.textContent).toContain('CLOUDFLARE_ANALYTICS_API_TOKEN');
    // Nessun bottone dentro l'avviso: un `.btn--sm` lì sta a 38px, e
    // «Ricarica» nella barra basta.
    expect(avviso!.querySelector('button')).toBeNull();
    // Nessuna tessera del traffico: uno zero si leggerebbe «nessuno visita».
    expect(tessera('Visite')).toBeNull();
    expect(text()).not.toContain('Pagine per visita');
    // L'altra metà non passa da Cloudflare e resta piena.
    expect(valoreTessera('Clic')).toBe('45');
  });

  it('Cloudflare non ha risposto: pastiglia in allarme', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito(
      trafficoView({
        disponibile: false,
        causa: 'fornitore',
        motivo: 'Cloudflare ha risposto HTTP 502.',
        totali: null,
        andamento: null,
        vitali: null,
      }),
    );
    const avviso = Array.from(el().querySelectorAll<HTMLElement>('.admin-avviso')).find((a) =>
      a.textContent?.includes('Cloudflare non ha risposto'),
    );
    expect(avviso).toBeTruthy();
    expect(pastiglie(avviso!)).toEqual([['allarme', 'Cloudflare non ha risposto']]);
    expect(avviso!.textContent).toContain('HTTP 502');
    expect(avviso!.querySelector('button')).toBeNull();
  });

  it('ricerca non configurata: a specchio, e il traffico resta', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito(
      trafficoView(),
      ricercaView({
        disponibile: false,
        causa: 'configurazione',
        motivo: 'Manca GSC_SERVICE_ACCOUNT_EMAIL su Render.',
        totali: null,
        andamento: null,
        query: [],
        pagine: [],
        copertura: null,
      }),
    );
    const avviso = Array.from(el().querySelectorAll<HTMLElement>('.admin-avviso')).find((a) =>
      a.textContent?.includes('Ricerca Google non configurata'),
    );
    expect(avviso).toBeTruthy();
    expect(pastiglie(avviso!)).toEqual([['spento', 'Ricerca Google non configurata']]);
    expect(avviso!.querySelector('button')).toBeNull();
    expect(tessera('Clic')).toBeNull();
    expect(text()).not.toContain("Copertura dell'indice");
    expect(valoreTessera('Visite')).toBe('120');
  });

  it('500 su traffico: banda propria con «Riprova» che rifà SOLO il traffico, i numeri di ricerca restano', async () => {
    await flushStats();
    await apriScheda('Sito');
    http.expectOne(isTraffico).flush(null, { status: 500, statusText: 'Server Error' });
    await flushRicerca();

    expect(text()).toContain('Caricamento del traffico non riuscito.');
    expect(valoreTessera('Clic')).toBe('45');
    // La banda è quella DENTRO il pannello, non quella unica in cima: ce n'è
    // una sola, e il suo «Riprova» rifà la sola rotta di Cloudflare.
    const bande = el().querySelectorAll<HTMLElement>('.st__errore');
    expect(bande.length).toBe(1);
    bande[0].querySelector('button')!.click();
    await stabilizza();
    const req = http.expectOne(isTraffico);
    http.expectNone(isRicerca);
    http.expectNone(isStats);
    http.expectNone(isVideo);
    req.flush(trafficoView());
    await stabilizza();
    expect(text()).not.toContain('Caricamento del traffico non riuscito.');
    expect(valoreTessera('Visite')).toBe('120');
    expect(valoreTessera('Clic')).toBe('45');
  });

  it('500 su ricerca: a specchio, «Riprova» rifà SOLO la ricerca', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushTraffico();
    http.expectOne(isRicerca).flush(null, { status: 500, statusText: 'Server Error' });
    await stabilizza();

    expect(text()).toContain('Caricamento dei dati di ricerca non riuscito.');
    expect(valoreTessera('Visite')).toBe('120');
    const bande = el().querySelectorAll<HTMLElement>('.st__errore');
    expect(bande.length).toBe(1);
    bande[0].querySelector('button')!.click();
    await stabilizza();
    const req = http.expectOne(isRicerca);
    http.expectNone(isTraffico);
    http.expectNone(isStats);
    req.flush(ricercaView());
    await stabilizza();
    expect(valoreTessera('Clic')).toBe('45');
  });

  it('cambiare finestra rifà entrambe con `giorni=7` e nient\'altro', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    voceFiltro('7 giorni').click();
    await stabilizza();
    const traffico = http.expectOne(isTraffico);
    const ricerca = http.expectOne(isRicerca);
    expect(traffico.request.params.get('giorni')).toBe('7');
    expect(ricerca.request.params.get('giorni')).toBe('7');
    http.expectNone(isVideo);
    http.expectNone(isStats);
    traffico.flush(trafficoView({ periodo: { giorni: 7, dal: '2026-07-09', al: '2026-07-15' } }));
    ricerca.flush(ricercaView({ periodo: { giorni: 7, dal: '2026-07-09', al: '2026-07-15' } }));
    await stabilizza();

    // La stessa voce di nuovo: nessuna richiesta (la verifica in afterEach
    // fallirebbe su una richiesta non risposta).
    voceFiltro('7 giorni').click();
    await stabilizza();
  });

  it('«Ricarica» della barra rifà entrambe le metà', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    http.expectOne(isTraffico).flush(trafficoView());
    http.expectOne(isRicerca).flush(ricercaView());
    http.expectNone(isStats);
    await stabilizza();
  });

  it('la barra mostra il filtro dei giorni di Sito e NON quello dei mesi, e la nota d\'età di stats non trapela', async () => {
    // La guardia contro il `@default` dei due `@switch` della barra: senza il
    // `@case ('sito')` la scheda mostrerebbe il filtro dei mesi di /admin/stats
    // e la SUA età («si aggiornano ogni 5 minuti») sopra numeri che non sono
    // suoi.
    await flushStats();
    await apriScheda('Sito');
    await flushSito();
    // L'etichetta del filtro è l'`aria-label` del radiogroup, non testo: ce
    // n'è uno solo per scheda, e dice di quale scheda è.
    const filtri = Array.from(el().querySelectorAll('[role="radiogroup"]')).map((g) =>
      g.getAttribute('aria-label'),
    );
    expect(filtri).toEqual(['Finestra del traffico e della ricerca']);
    expect(filtri).not.toContain('Profondità della serie mensile');
    expect(text()).not.toContain('si aggiornano ogni 5 minuti');
    // Ogni metà stampa la propria età, col proprio orologio.
    expect(text()).toContain('Letto da Cloudflare il 15 lug 2026');
    expect(text()).toContain('si aggiorna ogni 15 minuti');
    expect(text()).toContain('Letto da Google Search Console il 15 lug 2026');
    expect(text()).toContain('si aggiorna ogni 60 minuti');
    expect(text()).toContain('Google ha pubblicato fino al 14 lug');
    expect(text()).toContain('gli ultimi 3 giorni mancano');
  });

  it('ricerca senza righe: niente «fino al nessun giorno», Clic e Impressioni mute; a ritardo zero «tutti i giorni»', async () => {
    // Il backend con `rows` assente manda totali a zero, serie vuota,
    // `ultimoGiornoConDati: null` e `giorniSenzaDati === giorni`. La prima
    // stesura ripiegava DENTRO la frase («fino al nessun giorno») e stampava
    // «Clic 0» sotto una nota che diceva di non leggerli come zeri.
    // La frase attraversa più blocchi di controllo, quindi più nodi di testo:
    // si confronta a spazi normalizzati.
    const frase = () => text().replace(/\s+/g, ' ');
    await flushStats();
    await apriScheda('Sito');
    await flushSito(
      trafficoView(),
      ricercaView({
        totali: { clic: 0, impressioni: 0, ctr: null, posizioneMedia: null },
        andamento: { serie: [] },
        qualitaDati: {
          ...ricercaView().qualitaDati,
          ultimoGiornoConDati: null,
          giorniSenzaDati: 30,
        },
      }),
    );
    expect(text()).not.toContain('nessun giorno:');
    expect(text()).not.toContain('fino al nessun');
    expect(text()).toContain('Google non ha ancora pubblicato nessun giorno di questa finestra');
    expect(text()).not.toContain('gli ultimi 30 giorni mancano');
    expect(valoreTessera('Clic')).toBe('—');
    expect(valoreTessera('Impressioni')).toBe('—');
    expect(tessera('Clic')!.querySelector('.admin-kpi__valore')!.classList).toContain('is-muto');
    expect(tessera('Clic')!.textContent).toContain('Non ancora pubblicato');
    // Il traffico non ne risente.
    expect(valoreTessera('Visite')).toBe('120');

    // Ritardo zero: nessun «gli ultimi 0 giorni mancano».
    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    http.expectOne(isTraffico).flush(trafficoView());
    http.expectOne(isRicerca).flush(
      ricercaView({
        qualitaDati: {
          ...ricercaView().qualitaDati,
          ultimoGiornoConDati: '2026-07-15',
          giorniSenzaDati: 0,
        },
      }),
    );
    await stabilizza();
    expect(text()).toContain('Google ha pubblicato tutti i giorni della finestra');
    expect(text()).not.toContain('0 giorni mancano');
    expect(text()).not.toContain('non ha ancora pubblicato');
    expect(valoreTessera('Clic')).toBe('45');

    // Un solo giorno di ritardo: singolare, non «gli ultimi 1 giorni».
    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    http.expectOne(isTraffico).flush(trafficoView());
    http.expectOne(isRicerca).flush(
      ricercaView({
        qualitaDati: {
          ...ricercaView().qualitaDati,
          ultimoGiornoConDati: '2026-07-14',
          giorniSenzaDati: 1,
        },
      }),
    );
    await stabilizza();
    expect(frase()).toContain("fino al 14 lug: l'ultimo giorno manca per il suo ritardo");
    expect(frase()).not.toContain('ultimi 1 giorni');
  });

  it('grafico del traffico: 120px, visite e pagine viste AFFIANCATE, un giorno stimato non è «provvisorio»', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();
    const fig = grafico('Visite e pagine viste al giorno');
    expect(fig.style.getPropertyValue('--grafico-h')).toBe('120px');
    // Due giorni × due serie, una accanto all'altra: una pila direbbe
    // «visite + pagine viste», una somma senza senso.
    const barre = barreDi('Visite e pagine viste al giorno');
    expect(barre.length).toBe(4);
    const [visite, pagine] = barre.slice(0, 2);
    expect(attr(pagine, 'x')).not.toBe(attr(visite, 'x'));
    expect(attr(pagine, 'x')).toBeCloseTo(attr(visite, 'x') + attr(visite, 'width'), 6);
    // Il 14 è una STIMA, non un mese aperto: niente tratteggio, niente
    // «provvisorio» — quella parola direbbe che il numero cambierà.
    expect(fig.querySelectorAll('rect.is-provvisoria').length).toBe(0);

    const lente = lenteDi('Visite e pagine viste al giorno');
    lente.dispatchEvent(new Event('focus'));
    await stabilizza();
    lente.dispatchEvent(tasto('ArrowRight'));
    await stabilizza();
    const detto = readoutDi('Visite e pagine viste al giorno');
    expect(detto).toContain('14 lug');
    expect(detto).toContain('Visite 30');
    expect(detto).toContain('Pagine viste 60');
    expect(detto).toContain('Stima');
    expect(detto).not.toContain('provvisorio');
    lente.dispatchEvent(tasto('ArrowLeft'));
    await stabilizza();
    expect(readoutDi('Visite e pagine viste al giorno')).toContain('Dati esatti');
  });

  it('grafico della ricerca: una serie sola, impressioni CTR e posizione nel readout', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();
    const fig = grafico('Clic al giorno');
    expect(fig.style.getPropertyValue('--grafico-h')).toBe('120px');
    // UNA serie: le impressioni sono ×30 e sullo stesso asse i clic sparirebbero.
    expect(barreDi('Clic al giorno').length).toBe(2);
    const lente = lenteDi('Clic al giorno');
    lente.dispatchEvent(new Event('focus'));
    await stabilizza();
    const detto = readoutDi('Clic al giorno');
    expect(detto).toContain('14 lug');
    expect(detto).toContain('Clic 8');
    expect(detto).toContain('250 impressioni');
    expect(detto).toContain('CTR 3,2%');
    expect(detto).toContain('posizione 11,8');
  });

  it('le tabelle giornaliere sono chiuse, col più recente in cima, e «Dati» è una pastiglia stima/esatti', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    const traffico = piega('Traffico giorno per giorno');
    expect(traffico.open).toBeFalse();
    const righe = Array.from(traffico.querySelectorAll('table.admin-table tbody tr'));
    expect(righe.map((tr) => tr.querySelector('th')?.textContent?.trim())).toEqual([
      '14 lug',
      '13 lug',
    ]);
    expect(
      righe.map((tr) => tr.querySelector('td[data-etichetta="Visite"]')?.textContent?.trim()),
    ).toEqual(['30', '10']);
    // `.admin-stato` e non `.badge`: un giorno esatto DIVENTA stima dopo sette
    // giorni, è uno stato che cambia da sé.
    expect(righe.map((tr) => pastiglie(tr)[0])).toEqual([
      ['attesa', 'stima'],
      ['ok', 'esatti'],
    ]);

    const ricerca = piega('Ricerca giorno per giorno');
    expect(ricerca.open).toBeFalse();
    const righeR = Array.from(ricerca.querySelectorAll('table.admin-table tbody tr'));
    expect(
      righeR.map((tr) => tr.querySelector('td[data-etichetta="Clic"]')?.textContent?.trim()),
    ).toEqual(['8', '5']);
  });

  it('tabelle top: URL nel title, «Diretto o sconosciuto», «Italia», «Telefono», e il sistema operativo SOLO nella nota', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    // Identità a UNA riga: l'URL lungo sta nello `strong` con il `title`
    // uguale al testo, per leggere ciò che l'ellissi taglia.
    const pagine = tabella('Pagine più viste');
    expect(pagine.classList.contains('st__sito')).toBeTrue();
    const forte = pagine.querySelector<HTMLElement>('.admin-table__ident strong')!;
    expect(forte.textContent).toBe(
      '/guide/come-si-gioca-uno-spin-and-go-dal-primo-livello-alla-fine/',
    );
    expect(forte.getAttribute('title')).toBe(forte.textContent);
    expect(pagine.querySelector('.admin-table__sub')).toBeNull();

    // La provenienza vuota è il traffico diretto, non un buco.
    const prov = tabella('Provenienza delle visite');
    expect(prov.querySelector('tbody th')?.textContent?.trim()).toBe('Diretto o sconosciuto');
    // ISO-2 → nome in italiano; la chiave grezza resta nel `title`.
    const paesi = tabella('Visite per Paese');
    const th = paesi.querySelector('tbody th')!;
    expect(th.textContent?.trim()).toBe('Italia');
    expect(th.getAttribute('title')).toBe('IT');
    expect(tabella('Visite per dispositivo').querySelector('tbody th')?.textContent?.trim()).toBe(
      'Telefono',
    );
    expect(tabella('Visite per browser').querySelector('tbody th')?.textContent?.trim()).toBe(
      'Chrome',
    );

    // Il sistema operativo NON è una tabella: non è in cookie policy. Compare
    // SOLO nella nota che dice perché resta fuori (e nei limiti, se il
    // backend lo nomina).
    const occorrenze = text().match(/sistema operativo/g)?.length ?? 0;
    const nelleNote = Array.from(
      el().querySelectorAll<HTMLElement>('.admin-nota, details.st__limiti'),
    ).reduce((n, x) => n + (x.textContent?.match(/sistema operativo/g)?.length ?? 0), 0);
    expect(occorrenze).toBe(1);
    expect(nelleNote).toBe(occorrenze);
  });

  it('Core Web Vitals: «2,1 s» buono, «250 ms» da migliorare, CLS «Nessun dato»; senza vitali l\'avviso e il traffico resta', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    expect(valoreTessera('LCP')).toBe('2,1 s');
    expect(pastiglie(tessera('LCP')!)).toEqual([['ok', 'Buono']]);
    expect(valoreTessera('INP')).toBe('250 ms');
    expect(pastiglie(tessera('INP')!)).toEqual([['attesa', 'Da migliorare']]);
    // Un campo assente NON è uno zero: per un CWV sarebbe un voto perfetto.
    const cls = tessera('CLS')!;
    expect(valoreTessera('CLS')).toBe('Nessun dato');
    expect(cls.querySelector('.admin-kpi__valore')?.classList.contains('is-muto')).toBeTrue();
    expect(pastiglie(cls)).toEqual([]);
    expect(text()).toContain('400 aperture di pagina');

    // Vitali falliti: l'avviso col motivo, e le visite non ne dipendono.
    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    // Il motivo ha la forma che il backend produce davvero: comincia con
    // «Cloudflare» e finisce con la frase sul traffico. Il template non deve
    // ripeterla con parole sue.
    const motivo =
      'Cloudflare ha rifiutato la richiesta: campo sconosciuto. Il traffico qui sopra non ne risente.';
    http.expectOne(isTraffico).flush(trafficoView({ vitali: null, vitaliMotivo: motivo }));
    http.expectOne(isRicerca).flush(ricercaView());
    await stabilizza();
    expect(text()).toContain('Core Web Vitals non disponibili.');
    expect(text()).toContain(motivo);
    expect(text().split('Il traffico qui sopra').length - 1).toBe(1);
    expect(tessera('LCP')).toBeNull();
    expect(valoreTessera('Visite')).toBe('120');
  });

  it('ricerca: CTR «3,2%», posizione «12,4», null → «—»; le pagine mostrano il percorso col title all\'URL', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    expect(valoreTessera('CTR')).toBe('3,2%');
    expect(valoreTessera('Posizione media')).toBe('12,4');

    const query = tabella('Parole cercate su Google');
    expect(query.classList.contains('st__sito')).toBeTrue();
    const riga = query.querySelector('tbody tr')!;
    expect(riga.querySelector('.admin-table__ident strong')?.textContent).toBe('tabelle push fold');
    expect(riga.querySelector('td[data-etichetta="CTR"]')?.textContent?.trim()).toBe('3,2%');
    expect(riga.querySelector('td[data-etichetta="Posizione"]')?.textContent?.trim()).toBe('12,4');

    const pagine = tabella('Pagine trovate su Google');
    const rigaP = pagine.querySelector('tbody tr')!;
    const forte = rigaP.querySelector<HTMLElement>('.admin-table__ident strong')!;
    expect(forte.textContent).toBe('/guide/push-fold/');
    expect(forte.getAttribute('title')).toBe('https://bestfishforever.it/guide/push-fold/');
    // Senza impressioni il CTR non esiste: un trattino, mai «0%».
    expect(rigaP.querySelector('td[data-etichetta="CTR"]')?.textContent?.trim()).toBe('—');
    expect(rigaP.querySelector('td[data-etichetta="Posizione"]')?.textContent?.trim()).toBe('—');

    // Totali senza impressioni: la tessera dice «—», non «0%».
    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    http.expectOne(isTraffico).flush(trafficoView());
    http.expectOne(isRicerca).flush(
      ricercaView({ totali: { clic: 0, impressioni: 0, ctr: null, posizioneMedia: null } }),
    );
    await stabilizza();
    expect(valoreTessera('CTR')).toBe('—');
    expect(valoreTessera('Posizione media')).toBe('—');
  });

  it('copertura: sitemap «Letta» con 27 inviati, pagine chiave con esito a pastiglia, e le sitemap fallite non spengono le pagine', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();

    const sitemap = tabella('Sitemap conosciute da Google');
    const rigaS = sitemap.querySelector('tbody tr')!;
    expect(rigaS.querySelector('.admin-table__ident strong')?.textContent).toBe('/sitemap.xml');
    expect(pastiglie(rigaS)).toEqual([['ok', 'Letta']]);
    expect(rigaS.querySelector('td[data-etichetta="Inviati"]')?.textContent?.trim()).toBe('27');

    const chiave = tabella('Pagine chiave ispezionate');
    const righe = Array.from(chiave.querySelectorAll('tbody tr'));
    // «Esclusa» in `attesa` e non `neutro`: su una pagina chiave — prerenderizzata,
    // in sitemap, senza noindex — il verdetto NEUTRAL di Google è una notizia.
    expect(righe.map((tr) => pastiglie(tr)[0])).toEqual([
      ['ok', 'Indicizzata'],
      ['attesa', 'Esclusa'],
    ]);
    // Il `coverageState` di Google si stampa nel sotto-testo, mai si ramifica.
    expect(righe[1].querySelector('.admin-table__sub')?.textContent?.trim()).toBe(
      'Rilevata, attualmente non indicizzata',
    );
    expect(righe[1].querySelector('td[data-etichetta="Indicizzabile"]')?.textContent?.trim()).toBe('—');
    expect(righe[0].querySelector('td[data-etichetta="Canonica"]')?.textContent?.trim()).toBe('coincide');
    // Ispezionate insieme (stesso istante) → una data sola; l'ora sta anche nel title della pastiglia.
    expect(text()).toContain('Ispezionate il 15 lug 2026');
    expect(text()).not.toContain('Ispezionate fra il');
    expect(righe[0].querySelector('.admin-stato')?.getAttribute('title')).toMatch(
      /^Ispezionata il 15\/07\/2026 \d{2}:\d{2}$/,
    );
    expect(text()).not.toContain('Sitemap non lette.');
    // E la pagina esclusa entra fra i motivi per non fidarsi: il blocco «pulito» non compare.
    expect(text()).toContain('1 pagina chiave non risulta nell\'indice di Google');
    expect(text()).not.toContain('Tutti i clic sono attribuiti a una parola');
    // Una nota-mobile PER TABELLA: le due nascondono colonne diverse.
    const noteMobile = Array.from(
      el().querySelectorAll('.admin-table__nota-mobile'),
    ).map((n) => n.textContent?.trim());
    expect(noteMobile).toContain('Su schermi stretti restano solo il nome, lo stato e gli inviati.');
    expect(noteMobile).toContain('Su schermi stretti restano solo la pagina e l\'esito.');

    // Le sitemap non lette: avviso col motivo, e le pagine chiave restano.
    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    const base = ricercaView();
    http.expectOne(isTraffico).flush(trafficoView());
    http.expectOne(isRicerca).flush(
      ricercaView({
        copertura: {
          sitemap: [],
          sitemapMotivo: 'Google ha risposto HTTP 403.',
          urlChiave: base.copertura!.urlChiave,
        },
      }),
    );
    await stabilizza();
    expect(text()).toContain('Sitemap non lette.');
    expect(text()).toContain('HTTP 403');
    expect(tabella('Sitemap conosciute da Google').querySelector('.admin-table__vuota')).toBeTruthy();
    expect(tabella('Pagine chiave ispezionate').querySelectorAll('tbody tr').length).toBe(2);
    // ...e il motivo compare anche fra i motivi per non fidarsi dei dati di ricerca.
    expect(text()).toContain('Le sitemap non sono state lette: Google ha risposto HTTP 403.');
    expect(text()).not.toContain('Tutti i clic sono attribuiti a una parola');
  });

  it('copertura: `sitemapMotivo` da solo spegne il «tutto a posto», anche a qualità pulita e pagine tutte indicizzate', async () => {
    await flushStats();
    await apriScheda('Sito');
    const base = ricercaView();
    const indicizzata = base.copertura!.urlChiave[0];
    await flushSito(
      trafficoView(),
      ricercaView({
        copertura: {
          sitemap: [],
          sitemapMotivo: 'Google ha risposto HTTP 500.',
          urlChiave: [indicizzata, { ...indicizzata, url: 'https://bestfishforever.it/guide/' }],
        },
        qualitaDati: {
          ultimoGiornoConDati: '2026-07-14',
          giorniSenzaDati: 3,
          clicSenzaQuery: 0,
          righeTroncate: false,
          ispezioniFallite: 0,
        },
      }),
    );
    expect(text()).not.toContain('Tutti i clic sono attribuiti a una parola');
    expect(text()).toContain('Le sitemap non sono state lette: Google ha risposto HTTP 500.');
    expect(text()).not.toContain('pagina chiave non risulta');
  });

  it('copertura: ispezioni con orologi diversi → «Ispezionate fra il … e il …», e la nota dei fallimenti rimanda al motivo di riga', async () => {
    await flushStats();
    await apriScheda('Sito');
    const base = ricercaView();
    const [indicizzata, esclusa] = base.copertura!.urlChiave;
    await flushSito(
      trafficoView(),
      ricercaView({
        copertura: {
          sitemap: base.copertura!.sitemap,
          urlChiave: [
            indicizzata,
            { ...esclusa, esito: 'nonIndicizzata', copertura: 'Pagina con reindirizzamento' },
            {
              url: 'https://bestfishforever.it/lezioni/',
              esito: 'ignoto',
              copertura: null,
              ultimaScansione: null,
              indicizzabile: null,
              canonicaCoincide: null,
              link: null,
              // Riprovata un'ora dopo il lotto: un orologio diverso dalle altre due.
              ispezionatoIl: '2026-07-15T11:00:00.000Z',
              errore: 'Google ha risposto HTTP 403: permessi insufficienti.',
            },
          ],
        },
        qualitaDati: { ...base.qualitaDati, ispezioniFallite: 1 },
      }),
    );
    expect(text()).toMatch(/Ispezionate fra il 15 lug 2026 alle \d{2}:\d{2} e il 15 lug 2026 alle \d{2}:\d{2}\./);
    expect(text()).not.toContain('Ispezionate il 15 lug');
    // Singolare, e la causa NON è attribuita d'ufficio: rimanda al sotto-testo della riga.
    expect(text()).toContain(
      '1 controllo non riuscito: il motivo è sotto il nome della pagina (di solito l\'account di servizio senza permessi sulla proprietà); si riprova fra un\'ora.',
    );
    expect(text()).toContain('1 ispezione non riuscita: quella pagina risulta «Non verificata», non esclusa dall\'indice.');
    // «Non indicizzata» conta fra le pagine fuori dall'indice; «Non verificata» NO.
    expect(text()).toContain('1 pagina chiave non risulta nell\'indice di Google');
    const righe = Array.from(tabella('Pagine chiave ispezionate').querySelectorAll('tbody tr'));
    expect(righe.map((tr) => pastiglie(tr)[0])).toEqual([
      ['ok', 'Indicizzata'],
      ['allarme', 'Non indicizzata'],
      ['ignoto', 'Non verificata'],
    ]);
  });

  it('qualità: «2 clic non sono attribuiti» e «una pagina su 10»', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();
    expect(text()).toContain('2 clic non sono attribuiti a nessuna parola');
    // Un giorno solo: singolare, in ENTRAMBE le frasi (sotto le tessere e nel blocco qualità).
    expect(text()).toContain('1 giorno su 2 è una stima: Cloudflare tiene un campione delle pagine viste');
    expect(text()).toContain('1 giorno è una stima: Cloudflare ha tenuto circa una pagina su 10');
    expect(text()).not.toContain('1 giorni');
    // Nessuna tranche fallita: la tessera Visite parla dei giorni chiesti.
    expect(tessera('Visite')?.querySelector('.admin-kpi__nota')?.textContent?.trim()).toBe(
      'Negli ultimi 30 giorni',
    );

    // Con tutto pulito, lo dice: una sezione muta sembra rotta. Pulito vuol dire
    // anche sitemap lette e pagine chiave tutte nell'indice (la fixture ne ha una esclusa).
    el().querySelector<HTMLButtonElement>('button.st__ricarica')!.click();
    await stabilizza();
    http.expectOne(isTraffico).flush(
      trafficoView({
        qualitaDati: {
          giorniStimati: 0,
          campioneMassimo: 1,
          elencoTroncato: false,
          finestreInterrogate: 1,
          finestreFallite: 0,
        },
      }),
    );
    const base = ricercaView();
    http.expectOne(isRicerca).flush(
      ricercaView({
        copertura: {
          sitemap: base.copertura!.sitemap,
          urlChiave: [base.copertura!.urlChiave[0]],
        },
        qualitaDati: {
          ultimoGiornoConDati: '2026-07-14',
          giorniSenzaDati: 3,
          clicSenzaQuery: 0,
          righeTroncate: false,
          ispezioniFallite: 0,
        },
      }),
    );
    await stabilizza();
    expect(text()).toContain('Tutti i giorni della finestra sono conteggi esatti');
    expect(text()).toContain('Tutti i clic sono attribuiti a una parola');
  });

  it('qualità al plurale: «2 giorni sono stime», «2 clic non sono attribuiti», «2 ispezioni non riuscite», «2 controlli non riusciti»', async () => {
    await flushStats();
    await apriScheda('Sito');
    const base = ricercaView();
    const [indicizzata] = base.copertura!.urlChiave;
    const fallita = (url: string): RigaUrlChiave => ({
      url,
      esito: 'ignoto',
      copertura: null,
      ultimaScansione: null,
      indicizzabile: null,
      canonicaCoincide: null,
      link: null,
      ispezionatoIl: GENERATO_IL,
      errore: 'Google ha risposto HTTP 403.',
    });
    await flushSito(
      trafficoView({
        andamento: {
          serie: [
            { giorno: '2026-07-13', visite: 10, pagineViste: 25, campione: 10 },
            { giorno: '2026-07-14', visite: 30, pagineViste: 60, campione: 10 },
          ],
        },
        qualitaDati: { ...trafficoView().qualitaDati, giorniStimati: 2 },
      }),
      ricercaView({
        copertura: {
          sitemap: base.copertura!.sitemap,
          urlChiave: [
            indicizzata,
            fallita('https://bestfishforever.it/guide/'),
            fallita('https://bestfishforever.it/lezioni/'),
          ],
        },
        qualitaDati: { ...base.qualitaDati, ispezioniFallite: 2 },
      }),
    );
    expect(text()).toContain('2 giorni su 2 sono stime');
    expect(text()).toContain('2 giorni sono stime: Cloudflare ha tenuto');
    expect(text()).toContain('2 clic non sono attribuiti a nessuna parola');
    expect(text()).toContain('2 ispezioni non riuscite: quelle pagine risultano «Non verificata», non escluse');
    expect(text()).toContain('2 controlli non riusciti: il motivo è sotto il nome della pagina');
    expect(text()).toContain('si riprovano fra un\'ora.');
    // Le «Non verificata» non sono «fuori dall'indice»: nessuna pagina esclusa in questa fixture.
    expect(text()).not.toContain('pagina chiave non risulta');
    expect(text()).not.toContain('pagine chiave non risultano');
  });

  it('qualità al singolare: «1 clic non è attribuito»', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito(
      trafficoView(),
      ricercaView({ qualitaDati: { ...ricercaView().qualitaDati, clicSenzaQuery: 1 } }),
    );
    expect(text()).toContain('1 clic non è attribuito a nessuna parola');
    expect(text()).not.toContain('1 clic non sono');
  });

  it('una tranche fallita: la tessera Visite nomina la finestra EFFETTIVA («Dal …»), non «negli ultimi 30 giorni»', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito(
      trafficoView({
        // Cloudflare ha risposto solo per la tranche recente: `dal` è posticipato.
        periodo: { giorni: 30, dal: '2026-07-06', al: '2026-07-15' },
        qualitaDati: {
          giorniStimati: 1,
          campioneMassimo: 10,
          elencoTroncato: false,
          finestreInterrogate: 1,
          finestreFallite: 1,
        },
      }),
      ricercaView(),
    );
    const nota = tessera('Visite')?.querySelector('.admin-kpi__nota')?.textContent?.trim();
    expect(nota).toBe('Dal 6 lug, finestra accorciata');
    expect(text()).not.toContain('Negli ultimi 30 giorni');
    // Lo stesso `dal` nel blocco qualità, così le due frasi non possono dissentire.
    expect(text()).toContain('i numeri partono dal 6 lug');
  });

  it('i limiti delle due metà sono resi verbatim, in due collassabili chiusi', async () => {
    await flushStats();
    await apriScheda('Sito');
    await flushSito();
    const limiti = Array.from(el().querySelectorAll<HTMLDetailsElement>('details.st__limiti'));
    expect(limiti.length).toBe(2);
    expect(limiti.every((d) => !d.open)).toBeTrue();
    expect(limiti[0].textContent).toContain('Un limite del traffico dichiarato dal backend.');
    expect(limiti[1].textContent).toContain('Un limite della ricerca dichiarato dal backend.');
  });

  it('lo scheletro di Sito si rende DUE volte, uno per metà in volo, con quattro tessere e 120px', async () => {
    const scheletri = () =>
      Array.from(el().querySelectorAll<HTMLElement>('section.card.admin-blocco[role="status"]'));
    await flushStats();
    await apriScheda('Sito');
    expect(scheletri().length).toBe(2);
    expect(scheletri()[0].querySelectorAll('.admin-kpi.is-scheletro').length).toBe(4);
    expect(
      scheletri()[0]
        .querySelector<HTMLElement>('.admin-scheletro--grafico')
        ?.style.getPropertyValue('--grafico-h'),
    ).toBe('120px');
    // Ogni metà toglie il SUO scheletro quando arriva.
    await flushTraffico();
    expect(scheletri().length).toBe(1);
    await flushRicerca();
    expect(scheletri().length).toBe(0);
  });

  // ── Lo scheletro ─────────────────────────────────────────────────────────

  it('lo scheletro è per scheda: Video ha quattro tessere e un grafico da 120px, Abbonati tre e 180', async () => {
    // Uno scheletro che non ha la forma di ciò che sostituisce riserva lo
    // spazio sbagliato: il dato atterra e sposta tutto. Ogni scheda ha il
    // proprio, con le tessere del suo PRIMO blocco e l'altezza del suo primo
    // grafico, dentro lo stesso `section.admin-blocco` del blocco vero.
    const scheletro = () =>
      el().querySelector<HTMLElement>('section.card.admin-blocco[role="status"]');
    const tessereScheletro = () =>
      scheletro()?.querySelectorAll('.admin-kpi.is-scheletro').length ?? -1;
    const graficoH = () =>
      scheletro()
        ?.querySelector<HTMLElement>('.admin-scheletro--grafico')
        ?.style.getPropertyValue('--grafico-h');

    // Abbonati, con /admin/stats in volo: tre tessere («Crescita») e 180px.
    fixture.detectChanges();
    expect(scheletro()).withContext('scheletro di Abbonati').toBeTruthy();
    expect(tessereScheletro()).toBe(3);
    expect(graficoH()).toBe('180px');
    await flushStats();
    expect(scheletro()).toBeNull();

    // Video, con /admin/stats/video in volo: quattro tessere («Libreria») e
    // il grafico giornaliero, che è alto 120.
    await apriScheda('Video');
    expect(scheletro()).withContext('scheletro di Video').toBeTruthy();
    expect(tessereScheletro()).toBe(4);
    expect(graficoH()).toBe('120px');
    await flushVideo();
    expect(scheletro()).toBeNull();
  });
});
