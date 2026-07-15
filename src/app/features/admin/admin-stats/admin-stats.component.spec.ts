import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import localeIt from '@angular/common/locales/it';
import { LOCALE_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  AdminStatsView,
  AdminVideoStatsView,
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
  },
  incassoAbbonamenti: {
    ultimi30Eur: 500,
    ordini30: 4,
    precedenti30Eur: 400,
    deltaPct: 12.5,
    attivazioniSenzaCassa30: 2,
    serieMensile: [
      {
        mese: '2026-07',
        incassoEur: 500,
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
  acquisizione: { serieMensile: [] },
  conversione: { registrazioniComplete: 200, paganti: 50, tasso: 0.25 },
  qualitaDati: {
    senzaScadenzaTotale: 0,
    senzaScadenzaPerRuolo: [],
    daDeclassare: 0,
    stimati: 0,
    approvedSenzaDecidedAt: 0,
  },
  limiti: ['Un limite dichiarato dal backend.'],
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

describe('AdminStatsComponent', () => {
  let fixture: ComponentFixture<AdminStatsComponent>;
  let http: HttpTestingController;

  const isStats = (r: { url: string }) => r.url === `${API}/admin/stats`;
  const isVideo = (r: { url: string }) => r.url === `${API}/admin/stats/video`;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  /** Risponde a entrambe le chiamate del costruttore e rende il DOM. */
  const flushAll = async (
    stats: AdminStatsView = statsView(),
    video: AdminVideoStatsView = videoView(),
  ) => {
    http.expectOne(isStats).flush(stats);
    http.expectOne(isVideo).flush(video);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStatsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'it' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminStatsComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('chiede /admin/stats con `months` e /admin/stats/video con `giorni`', async () => {
    // I due param si chiamano DIVERSAMENTE lato backend, e con
    // forbidNonWhitelisted un nome sbagliato è un 400, non un default.
    const stats = http.expectOne(isStats);
    expect(stats.request.params.get('months')).toBe('12');
    expect(stats.request.params.get('days')).toBeNull();

    const video = http.expectOne(isVideo);
    expect(video.request.params.get('giorni')).toBe('30');
    expect(video.request.params.get('days')).toBeNull();

    stats.flush(statsView());
    video.flush(videoView());
    await fixture.whenStable();
  });

  it('mostra la data del calcolo e la cadenza: la pagina non finge di essere live', async () => {
    await flushAll();
    expect(text()).toContain('15 lug 2026');
    expect(text()).toContain('ogni 5 minuti');
  });

  it('tassoRinnovo null: "dati insufficienti" e la coorte grezza, MAI 0%', async () => {
    await flushAll();
    expect(text()).toContain('Dati insufficienti');
    expect(text()).toContain('2 su 3');
    expect(text()).not.toContain('0%');
  });

  it('deltaPct arriva già in punti percentuali: 12.5 → "+12,5%"', async () => {
    await flushAll();
    // Il bug da bloccare è formattarlo come frazione: darebbe "1.250%".
    expect(text()).toContain('+12,5%');
    expect(text()).not.toContain('1.250%');
  });

  it('deltaPct null: nessun confronto inventato', async () => {
    const s = statsView();
    s.incassoAbbonamenti.deltaPct = null;
    s.incassoAbbonamenti.precedenti30Eur = 0;
    await flushAll(s);
    expect(text()).toContain('Nessun confronto');
  });

  it('conversione.tasso è una frazione: 0.25 → "25%"', async () => {
    await flushAll();
    expect(text()).toContain('25%');
  });

  it('conversione.tasso null: i numeri grezzi, non un denominatore inventato', async () => {
    // Il backend risponde null sotto soglia (1 su 1 non è un "100%"). Qui si
    // blocca il testo VECCHIO: "Nessuna registrazione completata: non c'è un
    // denominatore" era falso proprio nel caso che accade — un pagante su un
    // iscritto. Gemello del test sulla coorte di rinnovo.
    const s = statsView();
    s.conversione = { registrazioniComplete: 1, paganti: 1, tasso: null };
    await flushAll(s);
    expect(text()).toContain('Dati insufficienti');
    expect(text()).toContain('1 su 1');
    expect(text()).not.toContain('Nessuna registrazione completata');
    expect(text()).not.toContain('100%');
  });

  it('conversione senza nemmeno un iscritto: nessun numero grezzo da mostrare', async () => {
    const s = statsView();
    s.conversione = { registrazioniComplete: 0, paganti: 0, tasso: null };
    await flushAll(s);
    expect(text()).toContain('Nessuno si è ancora iscritto');
  });

  it('conversione al singolare: "1 pagante su 25 registrazioni completate"', async () => {
    // Il caso REALE del singolare: sopra soglia il denominatore è per forza
    // grande, quindi è il numeratore a valere 1. Era l'unico punto della pagina
    // con la concordanza cablata, e capita accanto al numero più delicato.
    const s = statsView();
    s.conversione = { registrazioniComplete: 25, paganti: 1, tasso: 0.04 };
    await flushAll(s);
    expect(text()).toContain('1 pagante su 25 registrazioni completate');
    expect(text()).not.toContain('1 paganti');
  });

  it('quando i due numeri degli abbonati coincidono lo dice', async () => {
    await flushAll();
    expect(text()).toContain('I due numeri coincidono');
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
      },
    });
    await flushAll(s);
    // 43 - 40 = 3 = senzaScadenza(2) + daDeclassare(1): l'identità del backend.
    expect(text()).toContain('accessi dati a mano');
    expect(text()).toContain('senza scadenza');
    expect(text()).toContain('il cron non li ha ancora declassati');
    // Questo ramo si ACCENDE in produzione (l'owner usa le concessioni
    // manuali): è un avviso su cui deve agire, non un posto per una query
    // Mongo. Il perché tecnico sta nei commenti del backend.
    expect(text()).not.toContain('$lt');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.admin-stats__note code',
      ),
    ).toBeNull();
  });

  it('i limiti sono resi in pagina, non nascosti', async () => {
    await flushAll();
    expect(text()).toContain('Un limite dichiarato dal backend.');
    expect(text()).toContain('Un limite video dichiarato dal backend.');
  });

  it('serie sparsa: i mesi senza incasso restano in tabella come €0', async () => {
    await flushAll();
    // finestraMesi=3 da 2026-07 ⇒ mag, giu, lug: il backend ne manda solo uno.
    expect(text()).toContain('lug 2026');
    expect(text()).toContain('giu 2026');
    expect(text()).toContain('mag 2026');
  });

  it('una riga vera fuori dalla finestra calcolata non sparisce mai', async () => {
    // Se la finestra ricostruita qui e quella del backend divergessero, la
    // densificazione non deve mangiarsi un mese CON dati: si leggerebbe "quel
    // mese non è entrato nulla", che è falso.
    const s = statsView();
    s.incassoAbbonamenti.serieMensile.push({
      mese: '2025-01',
      incassoEur: 999,
      ordini: 9,
      stimati: 0,
      perMetodo: [],
    });
    await flushAll(s);
    expect(text()).toContain('gen 2025');
    expect(text()).toContain('999');
  });

  it('video non disponibile: mostra il motivo e nessuno zero', async () => {
    const v = videoView({
      disponibile: false,
      motivo: 'Bunny non risponde.',
      libreria: null,
      andamento: null,
    });
    await flushAll(statsView(), v);
    expect(text()).toContain('Statistiche video non disponibili');
    expect(text()).toContain('Bunny non risponde.');
    // Uno zero qui si leggerebbe "nessuno guarda i video".
    expect(text()).not.toContain('Riproduzioni totali');
    expect(text()).not.toContain('Video in libreria');
  });

  it('errore su /admin/stats/video: banner con retry, i numeri di business restano', async () => {
    http.expectOne(isStats).flush(statsView());
    http
      .expectOne(isVideo)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Caricamento statistiche video non riuscito.');
    expect(text()).toContain('Riprova');
    // Il guasto di Bunny non spegne le metriche Mongo, che con Bunny non
    // c'entrano nulla.
    expect(text()).toContain('Abbonati ora');
    expect(text()).toContain('Incasso abbonamenti');
  });

  it('cambiare finestra ricarica solo la sezione interessata', async () => {
    await flushAll();

    const comp = fixture.componentInstance as unknown as {
      setMesi(n: number): void;
    };
    comp.setMesi(24);

    const req = http.expectOne(isStats);
    expect(req.request.params.get('months')).toBe('24');
    req.flush(statsView({ finestraMesi: 24 }));
    await fixture.whenStable();
    // nessuna nuova chiamata a /admin/stats/video: la verifica in afterEach
    // fallirebbe se ne fosse partita una non risposta.
  });
});
