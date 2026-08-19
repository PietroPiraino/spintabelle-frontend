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
  AdminActionLogEntry,
  AdminStatsView,
} from '../../../core/models/api.models';
import { AdminOverviewComponent } from './admin-overview.component';

const API = environment.API_URL;

// Come in admin-stats.component.spec.ts: il locale `it` è quello vero dell'app.
registerLocaleData(localeIt);

const statsView = (over: Partial<AdminStatsView> = {}): AdminStatsView => ({
  generatoIl: '2026-08-14T10:00:00.000Z',
  aggiornatoOgniMinuti: 5,
  finestraMesi: 12,
  abbonati: {
    conAbbonamentoValido: 40,
    hannoAccessoOra: 42,
    perTier: [
      {
        tier: 'SQUALO',
        conAbbonamentoValido: 25,
        hannoAccessoOra: 26,
        senzaScadenza: 1,
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
    serieMensile: [],
    senzaCassaMensile: [],
  },
  rinnovi: {
    ultimoMeseChiuso: {
      mese: '2026-07',
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
  limiti: [],
  ...over,
});

const auditEntries: AdminActionLogEntry[] = [
  {
    id: 'a1',
    action: 'set-expiry',
    userEmail: 'utente@esempio.it',
    adminEmail: 'admin@esempio.it',
    createdAt: '2026-08-13T09:00:00.000Z',
  },
  {
    id: 'a2',
    action: 'azione-sconosciuta',
    createdAt: '2026-08-12T09:00:00.000Z',
  },
];

describe('AdminOverviewComponent (Panoramica)', () => {
  let fixture: ComponentFixture<AdminOverviewComponent>;
  let http: HttpTestingController;

  const isStats = (r: { url: string }) => r.url === `${API}/admin/stats`;
  const isAudit = (r: { url: string }) => r.url === `${API}/admin/audit`;
  const isRichieste = (r: { url: string }) =>
    r.url === `${API}/admin/subscription-requests`;
  const isAffiliazioni = (r: { url: string }) =>
    r.url === `${API}/admin/affiliations/pending-count`;
  // ⚠️ Terza fonte di `AdminPendingService` (coda redazione): la Panoramica non
  // la mostra, ma la chiamata parte lo stesso — senza flush, http.verify() cade.
  const isRedazione = (r: { url: string }) =>
    r.url === `${API}/admin/news/pending-count`;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';

  /** Risponde alle CINQUE chiamate del costruttore (stats, audit, 3 conteggi). */
  const flushAll = async ({
    stats = statsView() as AdminStatsView | null,
    actions = auditEntries as AdminActionLogEntry[] | null,
    richieste = 5 as number | null,
    inVerifica = 3 as number | null,
  } = {}) => {
    const reqStats = http.expectOne(isStats);
    if (stats === null) {
      reqStats.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqStats.flush(stats);
    }

    const reqAudit = http.expectOne(isAudit);
    if (actions === null) {
      reqAudit.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqAudit.flush({
        items: actions,
        total: actions.length,
        page: 1,
        limit: 8,
        totalPages: 1,
      });
    }

    const reqRichieste = http.expectOne(isRichieste);
    if (richieste === null) {
      reqRichieste.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqRichieste.flush({
        items: [],
        total: richieste,
        page: 1,
        limit: 1,
        totalPages: richieste,
      });
    }

    const reqAff = http.expectOne(isAffiliazioni);
    if (inVerifica === null) {
      reqAff.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqAff.flush({ inVerifica });
    }

    http.expectOne(isRedazione).flush({ inCoda: 0 });

    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOverviewComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'it' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminOverviewComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('chiede il log con limit 8 e le richieste con limit 1 (solo il total)', async () => {
    const audit = http.expectOne(isAudit);
    expect(audit.request.params.get('page')).toBe('1');
    expect(audit.request.params.get('limit')).toBe('8');

    const richieste = http.expectOne(isRichieste);
    expect(richieste.request.params.get('status')).toBe('pending');
    expect(richieste.request.params.get('limit')).toBe('1');

    audit.flush({ items: [], total: 0, page: 1, limit: 8, totalPages: 0 });
    richieste.flush({ items: [], total: 0, page: 1, limit: 1, totalPages: 0 });
    http.expectOne(isStats).flush(statsView());
    http.expectOne(isAffiliazioni).flush({ inVerifica: 0 });
    http.expectOne(isRedazione).flush({ inCoda: 0 });
    await fixture.whenStable();
  });

  it('mostra KPI, delta col segno, età del calcolo e conteggi in attesa', async () => {
    await flushAll();

    expect(text()).toContain('Abbonati attivi');
    expect(text()).toContain('40');
    expect(text()).toContain('con accesso ora: 42');
    expect(text()).toContain('Incasso abbonamenti');
    // DELTA con signDisplay: il segno È il senso della variazione
    expect(text()).toContain('+12,5%');
    expect(text()).toContain('Aggiornato:');
    // card "in attesa": conteggi ancorati al loro elemento, non al testo pagina
    expect(text()).toContain('Richieste in attesa');
    expect(text()).toContain('Affiliazioni in verifica');
    const counts = Array.from(
      el().querySelectorAll('.overview__pending-count'),
    ).map((c) => c.textContent?.trim());
    expect(counts).toEqual(['5', '3']);
  });

  it('la striscia azioni usa la mappa etichette condivisa, slug grezzo in fallback', async () => {
    await flushAll();

    expect(text()).toContain('Scadenza modificata');
    expect(text()).toContain('su utente@esempio.it');
    // un'azione non mappata mostra lo slug, non sparisce
    expect(text()).toContain('azione-sconosciuta');
  });

  it('un errore delle statistiche NON spegne azioni e conteggi (e viceversa)', async () => {
    await flushAll({ stats: null });

    expect(text()).toContain('Caricamento statistiche non riuscito.');
    expect(text()).toContain('Riprova');
    // le altre due fonti vivono
    expect(text()).toContain('Scadenza modificata');
    expect(text()).toContain('Richieste in attesa');
  });

  it('un conteggio in errore mostra "—", mai uno zero inventato', async () => {
    await flushAll({ inVerifica: null });

    const counts = Array.from(
      el().querySelectorAll('.overview__pending-count'),
    ).map((c) => c.textContent?.trim());
    expect(counts).toEqual(['5', '—']);
  });

  it('"Riprova" delle statistiche rifà solo quella chiamata', async () => {
    await flushAll({ stats: null });

    const buttons = Array.from(el().querySelectorAll<HTMLButtonElement>('button'));
    const retry = buttons.find((b) => b.textContent?.includes('Riprova'))!;
    retry.click();
    await fixture.whenStable();

    http.expectOne(isStats).flush(statsView());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('Abbonati attivi');
    // niente nuova chiamata ad audit/conteggi: http.verify() in afterEach
  });

  it('le card "in attesa" e il link del log puntano alle rotte figlie', async () => {
    await flushAll();

    const hrefs = Array.from(el().querySelectorAll<HTMLAnchorElement>('a')).map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain('/admin/richieste');
    expect(hrefs).toContain('/admin/affiliazioni');
    expect(hrefs).toContain('/admin/log');
  });
});
