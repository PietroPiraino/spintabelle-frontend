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
  CruscottoConteggi,
  MeseCruscotto,
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
    accessoNonAbbonato: [],
  },
  incassoAbbonamenti: {
    ultimi30Eur: 500,
    ordini30: 4,
    precedenti30Eur: 400,
    deltaPct: 12.5,
    attivazioniSenzaCassa30: 2,
    puntiEur30: 0,
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
  crescita: {
    attivi: { ultimi7: 12, ultimi30: 30, iscritti: 200 },
    registrazioniMensili: [],
    abbonatiFineMese: [],
  },
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

/**
 * Un mese del cruscotto, in CENTESIMI interi come sul filo. I numeri sono
 * scelti per essere riconoscibili a schermo: il margine 1.250,50 € è quello
 * che la spec cerca, e non compare in nessun altro campo.
 */
const meseCruscotto = (over: Partial<MeseCruscotto> = {}): MeseCruscotto => ({
  id: 'm-set',
  anno: 2026,
  mese: 9,
  chiave: '2026-09',
  etichetta: 'settembre 2026',
  stato: 'APERTO',
  provvisorio: true,
  entrate: {
    abbonamentiCent: 80_000,
    gadgetCent: 0,
    commissioniRakebackCent: 76_567,
    stakingCent: 0,
    altreCent: 0,
    totaleCent: 156_567,
  },
  uscite: { speseCent: 31_517, perditeStakingCent: 0, totaleCent: 31_517 },
  conguaglioGiocatoriCent: 0,
  margineNettoCent: 125_050,
  marginePersonaleCent: 0,
  ripartizione: { titolareCent: 81_283, socioCent: 43_767, quotaTitolareBp: 6500 },
  restaDaDareCent: 120_020,
  attesoDaAgenteCent: 76_567,
  incassoAgente: null,
  ...over,
});

/** L'ultimo mese chiuso, congelato, con l'incasso dell'agente registrato. */
const ultimoChiuso = (over: Partial<MeseCruscotto> = {}): MeseCruscotto =>
  meseCruscotto({
    id: 'm-ago',
    mese: 8,
    chiave: '2026-08',
    etichetta: 'agosto 2026',
    stato: 'CHIUSO',
    provvisorio: false,
    chiusoAt: '2026-09-05T10:00:00.000Z',
    margineNettoCent: 98_765,
    attesoDaAgenteCent: 76_567,
    incassoAgente: {
      importoCent: 76_567,
      cassa: 'PIETRO',
      dataAt: '2026-09-10T10:00:00.000Z',
    },
    ...over,
  });

const cruscottoView = (
  over: Partial<CruscottoConteggi> = {},
): CruscottoConteggi => ({
  generatoIl: '2026-09-13T10:00:00.000Z',
  meseInCorso: meseCruscotto(),
  ultimoChiuso: ultimoChiuso(),
  daFare: [
    {
      tipo: 'SPESE_FISSE',
      meseId: 'm-set',
      etichetta: 'settembre 2026',
      conteggio: 3,
    },
  ],
  soci: {
    creditoNonRiscossoCent: 456_789,
    pressoAgenteCent: 76_567,
    daRiscuotereDaiGiocatoriCent: 1_797,
    prestitoResiduoCent: 182_408,
    mesiChiusi: 2,
  },
  staking: { inCorso: 3, fondiFuoriCent: 279_900, evDaRecuperareCent: -34_000 },
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

  const isCruscotto = (r: { url: string }) =>
    r.url === `${API}/admin/conteggi/cruscotto`;
  const isStats = (r: { url: string }) => r.url === `${API}/admin/stats`;
  const isAudit = (r: { url: string }) => r.url === `${API}/admin/audit`;
  const isRichieste = (r: { url: string }) =>
    r.url === `${API}/admin/subscription-requests`;
  const isAffiliazioni = (r: { url: string }) =>
    r.url === `${API}/admin/affiliations/pending-count`;
  // Terza fonte di `AdminPendingService`: la coda della redazione.
  const isRedazione = (r: { url: string }) =>
    r.url === `${API}/admin/news/pending-count`;
  // Quarta fonte: le segnalazioni sulle mani del Replayer.
  const isSegnalazioni = (r: { url: string }) =>
    r.url === `${API}/admin/hands/reports/pending-count`;

  const el = () => fixture.nativeElement as HTMLElement;
  // ⚠️ `textContent` e mai `innerText`: il secondo restituisce il testo COME
  // LO DIPINGE IL CSS, e qui le etichette KPI sono in `text-transform:
  // uppercase` — un confronto con `innerText` darebbe falsi rossi.
  // ⚠️ E gli importi si confrontano con ` €`: `Intl` it-IT mette uno
  // spazio INDIVISIBILE prima del simbolo, e uno spazio normale nella spec
  // fallirebbe su una formattazione corretta. Il separatore delle migliaia è
  // facoltativo (`1\.?250,50`): il Chrome di Karma non lo rende.
  const text = () => el().textContent ?? '';
  const blocco = (nome: string) =>
    el().querySelector<HTMLElement>(`[data-blocco="${nome}"]`)!;
  const testoBlocco = (nome: string) => blocco(nome).textContent ?? '';
  const hrefs = () =>
    Array.from(el().querySelectorAll<HTMLAnchorElement>('a')).map((a) =>
      a.getAttribute('href'),
    );
  /** I quattro conteggi delle code, nell'ordine in cui la pagina li rende. */
  const conteggiCode = () =>
    Array.from(el().querySelectorAll('[data-coda] .admin-kpi__valore')).map(
      (c) => c.textContent?.trim(),
    );
  const bottoneRiprova = (nome: string) =>
    Array.from(blocco(nome).querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.includes('Riprova'),
    )!;

  /** Risponde alle SETTE chiamate del costruttore (cruscotto, stats, audit, 4 conteggi). */
  const flushAll = async ({
    cruscotto = cruscottoView() as CruscottoConteggi | null,
    stats = statsView() as AdminStatsView | null,
    actions = auditEntries as AdminActionLogEntry[] | null,
    richieste = 5 as number | null,
    inVerifica = 3 as number | null,
    inCoda = 7 as number | null,
    segnalazioni = 2 as number | null,
  } = {}) => {
    const reqCruscotto = http.expectOne(isCruscotto);
    if (cruscotto === null) {
      reqCruscotto.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqCruscotto.flush(cruscotto);
    }

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

    const reqRed = http.expectOne(isRedazione);
    if (inCoda === null) {
      reqRed.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqRed.flush({ inCoda });
    }

    const reqSegn = http.expectOne(isSegnalazioni);
    if (segnalazioni === null) {
      reqSegn.flush(null, { status: 500, statusText: 'Server Error' });
    } else {
      reqSegn.flush({ count: segnalazioni });
    }

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

  // ── Le sette richieste e gli scheletri ─────────────────────────────────────

  it('fa SETTE richieste: cruscotto, stats senza `months`, log limit 8, richieste limit 1, tre conteggi', async () => {
    const cruscotto = http.expectOne(isCruscotto);
    expect(cruscotto.request.params.keys().length).toBe(0);

    const stats = http.expectOne(isStats);
    // ⚠️ Senza `months`: la Panoramica non sceglie una finestra, legge la cache.
    expect(stats.request.params.has('months')).toBeFalse();

    const audit = http.expectOne(isAudit);
    expect(audit.request.params.get('page')).toBe('1');
    expect(audit.request.params.get('limit')).toBe('8');

    const richieste = http.expectOne(isRichieste);
    expect(richieste.request.params.get('status')).toBe('pending');
    expect(richieste.request.params.get('limit')).toBe('1');

    cruscotto.flush(cruscottoView());
    stats.flush(statsView());
    audit.flush({ items: [], total: 0, page: 1, limit: 8, totalPages: 0 });
    richieste.flush({ items: [], total: 0, page: 1, limit: 1, totalPages: 0 });
    http.expectOne(isAffiliazioni).flush({ inVerifica: 0 });
    http.expectOne(isRedazione).flush({ inCoda: 0 });
    http.expectOne(isSegnalazioni).flush({ count: 0 });
    await fixture.whenStable();
  });

  it('prima del flush riserva lo spazio con gli scheletri (≥ 6 tessere), mai con zeri', async () => {
    // ⚠️ La Panoramica era uno dei quattro elementi del sito misurati come
    // salto di layout (report Cloudflare 29-30/08/2026): le tessere nascevano
    // vuote e crescevano all'arrivo dell'API. Lo scheletro ha la stessa
    // altezza della tessera, e sta lì PRIMA che arrivi un byte.
    expect(el().querySelectorAll('.admin-kpi.is-scheletro').length).toBeGreaterThanOrEqual(6);
    expect(el().querySelectorAll('.admin-scheletro--riga').length).toBeGreaterThanOrEqual(3);
    expect(text()).not.toContain('0,00\u00a0€');

    await flushAll();
    expect(el().querySelectorAll('.admin-kpi.is-scheletro').length).toBe(0);
  });

  // ── Code di lavoro ─────────────────────────────────────────────────────────

  it('rende le QUATTRO code nell’ordine redazione · richieste · affiliazioni · mani segnalate', async () => {
    await flushAll();

    expect(text()).toContain('Articoli da rivedere');
    expect(text()).toContain('Richieste in attesa');
    expect(text()).toContain('Affiliazioni in verifica');
    expect(text()).toContain('Mani segnalate');
    // ⚠️ L'ordine È l'asserzione: la coda della redazione sta per PRIMA perché
    // è quella che si svuota 3-5 volte al giorno, non quando capita. La quarta
    // (le segnalazioni sul Replayer) è la coda che fino al 13/09/2026 la
    // Panoramica non mostrava affatto.
    expect(conteggiCode()).toEqual(['7', '5', '3', '2']);
    // la coda con dentro qualcosa si vede da lontano
    expect(
      el().querySelector('[data-coda="redazione"]')?.classList.contains('is-attivo'),
    ).toBeTrue();
  });

  it('un conteggio in errore mostra "—", mai uno zero inventato', async () => {
    await flushAll({ inVerifica: null });
    expect(conteggiCode()).toEqual(['7', '5', '—', '2']);
  });

  it('anche la coda redazione e le segnalazioni in errore mostrano "—"', async () => {
    await flushAll({ inCoda: null, segnalazioni: null });
    expect(conteggiCode()).toEqual(['—', '5', '3', '—']);
    // una coda a «—» non è «attiva»: non c'è niente da annunciare
    expect(
      el().querySelector('[data-coda="redazione"]')?.classList.contains('is-attivo'),
    ).toBeFalse();
  });

  // ── Da fare nei conteggi ───────────────────────────────────────────────────

  it('ogni voce «da fare» è un link alla SCHEDA dei Conteggi giusta (?mese=&vista=)', async () => {
    await flushAll({
      cruscotto: cruscottoView({
        daFare: [
          { tipo: 'SPESE_FISSE', meseId: 'm-set', etichetta: 'settembre 2026', conteggio: 3 },
          {
            tipo: 'TICKET_NON_PAGATI',
            meseId: 'm-set',
            etichetta: 'settembre 2026',
            conteggio: 2,
            importoCent: 120_020,
          },
          { tipo: 'STAKATI_DA_REGISTRARE', meseId: 'm-set', etichetta: 'settembre 2026', conteggio: 1 },
          {
            tipo: 'INCASSO_AGENTE',
            meseId: 'm-ago',
            etichetta: 'agosto 2026',
            conteggio: 1,
            importoCent: 76_567,
          },
          { tipo: 'MESE_APERTO_ARRETRATO', meseId: 'm-lug', etichetta: 'luglio 2026', conteggio: 1 },
          { tipo: 'MESE_CORRENTE_NON_APERTO', meseId: null, etichetta: 'ottobre 2026', conteggio: 1 },
        ],
      }),
    });

    const voci = Array.from(
      blocco('dafare').querySelectorAll<HTMLAnchorElement>('a.admin-dafare__voce'),
    );
    expect(voci.length).toBe(6);
    expect(voci.map((a) => a.getAttribute('href'))).toEqual([
      '/admin/conteggi-mensili?mese=m-set&vista=voci',
      '/admin/conteggi-mensili?mese=m-set&vista=rakeback',
      '/admin/conteggi-mensili?mese=m-set&vista=stakati',
      '/admin/conteggi-mensili?mese=m-ago&vista=rakeback',
      '/admin/conteggi-mensili?mese=m-lug&vista=riepilogo',
      // ⚠️ senza `mese`: quel mese non esiste ancora e non ha un id
      '/admin/conteggi-mensili?vista=riepilogo',
    ]);

    const testo = testoBlocco('dafare');
    expect(testo).toContain('Spese fisse da registrare');
    expect(testo).toMatch(/Ticket non pagati[\s\S]*settembre 2026 · 1\.?200,20\u00a0€/);
    expect(testo).toContain('Conteggi stakati da portare sul registro');
    expect(testo).toMatch(/attesi 765,67\u00a0€/);
    expect(testo).toContain('luglio 2026 è ancora aperto');
    expect(testo).toContain('ottobre 2026 non è ancora aperto');
    // i conteggi stanno sulle tre voci che ne hanno uno
    const n = Array.from(blocco('dafare').querySelectorAll('.admin-dafare__n'))
      .map((s) => s.textContent?.trim())
      .filter((s) => s);
    expect(n).toEqual(['3', '2', '1']);
  });

  it('con la coda vuota dice «Niente in sospeso», senza una lista vuota', async () => {
    await flushAll({ cruscotto: cruscottoView({ daFare: [] }) });

    expect(testoBlocco('dafare')).toContain('Niente in sospeso nei conteggi.');
    expect(blocco('dafare').querySelector('.admin-dafare')).toBeNull();
    expect(blocco('dafare').querySelector('.admin-avviso--ok')).not.toBeNull();
  });

  // ── Il mese contabile ──────────────────────────────────────────────────────

  it('mostra il mese aperto «Provvisorio» e l’ultimo chiuso «Congelato» con le pastiglie di stato', async () => {
    await flushAll();

    const mese = testoBlocco('mese');
    expect(mese).toContain('Conteggi di settembre 2026');
    // ⚠️ separatore delle migliaia FACOLTATIVO: il Chrome di Karma rende
    // «1250,50 €» dove un browser vero scrive «1.250,50 €».
    expect(mese).toMatch(/1\.?250,50\u00a0€/);
    expect(mese).toMatch(/entrate 1\.?565,67\u00a0€ · uscite 315,17\u00a0€/);
    // lo STATO è una pastiglia `.admin-stato` col suo tono, non un badge
    expect(
      blocco('mese').querySelector('.admin-stato[data-tono="attesa"]')?.textContent,
    ).toContain('Provvisorio');
    expect(
      blocco('mese').querySelector('.admin-stato[data-tono="concluso"]')?.textContent,
    ).toContain('Congelato');
    expect(mese).toContain('Ultimo mese chiuso · agosto 2026');
    expect(mese).toContain('987,65\u00a0€');
    expect(mese).toContain('chiuso il 05 set 2026');
    // il credito dei soci e il prestito, dal cruscotto
    expect(mese).toMatch(/4\.?567,89\u00a0€/);
    expect(mese).toMatch(/di cui 765,67\u00a0€ presso l’agente, 17,97\u00a0€ dai giocatori/);
    expect(mese).toMatch(/1\.?824,08\u00a0€/);
    expect(mese).toMatch(/1\.?200,20\u00a0€/);
    // il margine positivo non è «giù»
    expect(blocco('mese').querySelector('.admin-kpi__valore.is-giu')).toBeNull();
  });

  it('un margine negativo si vede: `.is-giu` e il segno stampato', async () => {
    await flushAll({
      cruscotto: cruscottoView({ meseInCorso: meseCruscotto({ margineNettoCent: -12_345 }) }),
    });
    const giu = blocco('mese').querySelector('.admin-kpi__valore.is-giu');
    expect(giu?.textContent).toMatch(/-123,45\u00a0€/);
  });

  it('l’agente: sul mese APERTO «si incassa dopo la chiusura», sull’ultimo CHIUSO senza incasso «non ancora incassato» — mai «0,00 €»', async () => {
    await flushAll({
      cruscotto: cruscottoView({
        ultimoChiuso: ultimoChiuso({ incassoAgente: null }),
      }),
    });

    const mese = testoBlocco('mese');
    expect(mese).toContain('si incassa dopo la chiusura');
    expect(mese).toContain('non ancora incassato');
    expect(blocco('mese').querySelector('.pan__manca')?.textContent).toContain(
      'non ancora incassato',
    );
    expect(mese).not.toContain('0,00\u00a0€');
    // e «Atteso dall'agente» è il MARGINE, non lo spettante coi ticket
    expect(mese).toContain("Atteso dall'agente (il margine)");
    expect(mese).toContain('765,67\u00a0€');
  });

  it('con l’incasso dell’agente registrato dice quanto e su quale cassa, e «non ancora incassato» sparisce', async () => {
    await flushAll({
      cruscotto: cruscottoView({
        meseInCorso: meseCruscotto({
          incassoAgente: { importoCent: 76_567, cassa: 'EXIVEZZZ' },
        }),
      }),
    });

    const mese = testoBlocco('mese');
    expect(mese).toContain('incassato 765,67\u00a0€ su Exivezzz');
    expect(mese).toContain('incassato 765,67\u00a0€ su Pietro');
    expect(mese).not.toContain('non ancora incassato');
    expect(mese).not.toContain('si incassa dopo la chiusura');
  });

  it('senza un mese aperto mostra l’avviso con il link, e nessuno zero', async () => {
    await flushAll({ cruscotto: cruscottoView({ meseInCorso: null }) });

    const mese = testoBlocco('mese');
    expect(mese).toContain('Nessun mese aperto');
    expect(blocco('mese').querySelector('.admin-avviso--attenzione')).not.toBeNull();
    expect(blocco('mese').querySelector('.admin-kpi')).toBeNull();
    expect(mese).not.toContain('0,00\u00a0€');
    expect(mese).not.toContain('Provvisorio');
  });

  it('senza un mese chiuso la tessera è muta («Nessun mese chiuso»), non un margine a zero', async () => {
    await flushAll({ cruscotto: cruscottoView({ ultimoChiuso: null }) });

    const mese = testoBlocco('mese');
    expect(mese).toContain('Nessun mese chiuso');
    expect(mese).not.toContain('Congelato');
    expect(blocco('mese').querySelector('.admin-kpi__valore.is-muto')).not.toBeNull();
  });

  it('le tessere del mese portano ai Conteggi con ?mese=<id>&vista=…', async () => {
    await flushAll();

    const h = hrefs();
    expect(h).toContain('/admin/conteggi-mensili?mese=m-set&vista=riepilogo');
    expect(h).toContain('/admin/conteggi-mensili?mese=m-ago&vista=riepilogo');
    expect(h).toContain('/admin/conteggi-mensili?mese=m-set&vista=rakeback');
    expect(h).toContain('/admin/conteggi-mensili?mese=m-set&vista=soci');
    expect(h).toContain('/admin/conteggi-mensili');
  });

  // ── Registro staking ───────────────────────────────────────────────────────

  it('il registro staking: in corso, fondi fuori e «Registro EV» col debito da recuperare', async () => {
    await flushAll();

    const st = testoBlocco('staking');
    expect(st).toContain('Registro staking');
    expect(st).toContain('In corso');
    expect(st).toContain('3');
    expect(st).toMatch(/2\.?799,00\u00a0€/);
    expect(st).toContain('Registro EV');
    // ⚠️ `testoEv`: il debito come quantità positiva con la parola, mai «−340,00 €»
    expect(st).toContain('340,00\u00a0€ da recuperare');
    expect(st).not.toContain('-340,00');
    expect(hrefs()).toContain('/admin/stakings');
  });

  it('EV a zero si legge «In pari», non una cella vuota né «0,00 €»', async () => {
    await flushAll({
      cruscotto: cruscottoView({
        staking: { inCorso: 0, fondiFuoriCent: 0, evDaRecuperareCent: 0 },
      }),
    });
    const st = testoBlocco('staking');
    expect(st).toContain('In pari');
    expect(st).not.toContain('da recuperare');
  });

  // ── Abbonati (da /admin/stats) ─────────────────────────────────────────────

  it('abbonati: in regola, attivi 30 giorni con la nota «7 giorni · su M iscritti», scadenze, incasso col delta e l’età', async () => {
    await flushAll();

    const ab = testoBlocco('abbonati');
    // ⚠️ «Abbonamenti in regola» e non «Abbonati attivi» (cambio consapevole,
    // 13/09/2026): «attivi» ora è la finestra degli iscritti con una sessione.
    expect(ab).toContain('Abbonamenti in regola');
    expect(ab).toContain('40');
    expect(ab).toContain('Passano il paywall ora:');
    expect(ab).toContain('42');
    expect(ab).toContain('Attivi negli ultimi 30 giorni');
    expect(ab).toContain('30');
    expect(ab).toMatch(/7 giorni:\s*12\s*·\s*su 200 iscritti/);
    expect(ab).toContain('In scadenza entro 7 giorni');
    expect(ab).toContain('entro 30:');
    expect(ab).toContain('Incasso abbonamenti');
    // EURO float: 500 → «500 €», intero senza decimali
    expect(ab).toContain('500\u00a0€');
    expect(ab).toContain('4 abbonamenti approvati');
    // DELTA con signDisplay: il segno È il senso della variazione
    expect(ab).toContain('+12,5%');
    expect(blocco('abbonati').querySelector('.admin-kpi__delta.is-su')).not.toBeNull();
    expect(ab).toContain('Aggiornato:');
    expect(ab).toContain('ricalcolo ogni 5 min');
    // le tessere per tier sono sparite: il dettaglio vive in Statistiche
    expect(ab).not.toContain('Squalo');
  });

  it('senza confronto (deltaPct null) non stampa un delta', async () => {
    await flushAll({
      stats: statsView({
        incassoAbbonamenti: {
          ...statsView().incassoAbbonamenti,
          deltaPct: null,
        },
      }),
    });
    expect(blocco('abbonati').querySelector('.admin-kpi__delta')).toBeNull();
    expect(testoBlocco('abbonati')).not.toContain('%');
  });

  // ── Ultime azioni ──────────────────────────────────────────────────────────

  it('la striscia azioni usa la mappa etichette condivisa, slug grezzo in fallback', async () => {
    await flushAll();

    const az = testoBlocco('azioni');
    expect(az).toContain('Scadenza modificata');
    expect(az).toContain('su utente@esempio.it');
    // un'azione non mappata mostra lo slug, non sparisce
    expect(az).toContain('azione-sconosciuta');
    expect(hrefs()).toContain('/admin/log');
  });

  // ── Le quattro fonti sono indipendenti ─────────────────────────────────────

  it('un errore delle statistiche NON spegne conteggi, azioni e code', async () => {
    await flushAll({ stats: null });

    expect(testoBlocco('abbonati')).toContain('Caricamento statistiche non riuscito.');
    expect(bottoneRiprova('abbonati')).toBeDefined();
    // le altre fonti vivono
    expect(testoBlocco('mese')).toMatch(/1\.?250,50\u00a0€/);
    expect(testoBlocco('azioni')).toContain('Scadenza modificata');
    expect(conteggiCode()).toEqual(['7', '5', '3', '2']);
  });

  it('un errore del cruscotto NON spegne stats, azioni e code — e i blocchi del mese e dello staking non rendono zeri', async () => {
    await flushAll({ cruscotto: null });

    expect(testoBlocco('dafare')).toContain('Lettura dei conteggi non riuscita.');
    expect(bottoneRiprova('dafare')).toBeDefined();
    // ⚠️ La banda con «Riprova» vive UNA volta, nel primo blocco; gli altri due
    // leggono la stessa busta e rimandano lì invece di stampare «0,00 €».
    expect(blocco('mese').querySelector('.admin-kpi')).toBeNull();
    expect(blocco('staking').querySelector('.admin-kpi')).toBeNull();
    expect(testoBlocco('mese')).not.toContain('0,00\u00a0€');
    expect(testoBlocco('staking')).not.toContain('In pari');
    expect(testoBlocco('mese')).toContain('Riprova');
    // le altre fonti vivono
    expect(testoBlocco('abbonati')).toContain('Abbonamenti in regola');
    expect(testoBlocco('azioni')).toContain('Scadenza modificata');
    expect(conteggiCode()).toEqual(['7', '5', '3', '2']);
  });

  it('«Riprova» delle statistiche rifà SOLO /admin/stats', async () => {
    await flushAll({ stats: null });

    bottoneRiprova('abbonati').click();
    await fixture.whenStable();

    http.expectOne(isStats).flush(statsView());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(testoBlocco('abbonati')).toContain('Abbonamenti in regola');
    // niente nuova chiamata a cruscotto/audit/conteggi: http.verify() in afterEach
  });

  it('«Riprova» del cruscotto rifà SOLO /admin/conteggi/cruscotto', async () => {
    await flushAll({ cruscotto: null });

    bottoneRiprova('dafare').click();
    await fixture.whenStable();

    http.expectOne(isCruscotto).flush(cruscottoView());
    await fixture.whenStable();
    fixture.detectChanges();
    expect(testoBlocco('mese')).toMatch(/1\.?250,50\u00a0€/);
    expect(testoBlocco('staking')).toContain('340,00\u00a0€ da recuperare');
    expect(testoBlocco('dafare')).not.toContain('Riprova');
    // niente nuova chiamata a stats/audit/conteggi: http.verify() in afterEach
  });

  // ── Dove portano le tessere ────────────────────────────────────────────────

  it('le code, le tessere e i link «Apri» puntano alle rotte figlie giuste', async () => {
    await flushAll();

    const h = hrefs();
    expect(h).toContain('/admin/redazione');
    expect(h).toContain('/admin/richieste');
    expect(h).toContain('/admin/affiliazioni');
    expect(h).toContain('/admin/replayer');
    expect(h).toContain('/admin/log');
    expect(h).toContain('/admin/stakings');
    expect(h).toContain('/admin/iscritti');
    expect(h).toContain('/admin/statistiche');
    expect(h).toContain('/admin/statistiche?vista=abbonati');
    expect(h).toContain('/admin/statistiche?vista=incassi');
    expect(h.some((x) => x?.startsWith('/admin/conteggi-mensili?'))).toBeTrue();
    // ⚠️ mai `/admin/stats/video` da qui: dietro c'è Bunny
    http.expectNone((r) => r.url === `${API}/admin/stats/video`);
  });
});
