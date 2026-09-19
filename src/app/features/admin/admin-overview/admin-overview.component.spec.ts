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
  // ⚠️ Valori DISTINTIVI, uno per campo: la spec cerca ogni numero DENTRO la
  // tessera trovata per etichetta, e con «2» e «5» un numero giusto poteva
  // venire dalla tessera sbagliata (o dai conteggi delle code, 7 · 5 · 3 · 2).
  scadenze: {
    entro7: { utenti: 6, valoreListinoEur: 250 },
    entro30: { utenti: 9, valoreListinoEur: 625 },
    perTier: [],
  },
  acquisizione: { serieMensile: [] },
  conversione: { registrazioniComplete: 200, paganti: 50, tasso: 0.25 },
  crescita: {
    attivi: { ultimi7: 9, ultimi30: 31, iscritti: 200 },
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
 * che la spec cerca, e non compare in nessun altro campo. ⚠️ Lo stesso per
 * `attesoDaAgenteCent` = 765,01 €: le commissioni di rakeback e il credito
 * presso l'agente valgono entrambi 765,67 €, e con lo stesso numero anche
 * sull'atteso la spec non poteva dire DA QUALE campo venisse la cifra.
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
  attesoDaAgenteCent: 76_501,
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

/** Otto voci, quante ne riserva lo scheletro: per la spec di geometria. */
const auditEntries8: AdminActionLogEntry[] = Array.from({ length: 8 }, (_, i) => ({
  id: `a${i}`,
  action: 'set-expiry',
  userEmail: 'utente@esempio.it',
  adminEmail: 'admin@esempio.it',
  createdAt: '2026-08-13T09:00:00.000Z',
}));

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
  // Quinta fonte: il video del canale YouTube in attesa di approvazione.
  // ⚠️ Va SCARICATA anche se la Panoramica non la mostra: `AdminPendingService`
  // la chiama per il badge della sidebar, e una richiesta non consumata fa
  // fallire `http.verify()` di TUTTE le prove di questo file.
  const isCanale = (r: { url: string }) =>
    r.url === `${API}/admin/canale/pending-count`;

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
  /**
   * La tessera di un blocco trovata per ETICHETTA: le asserzioni sui numeri
   * stanno dentro la tessera giusta, non nel testo dell'intero blocco — dove
   * un «9» può venire da una tessera qualunque. `textContent` conserva il
   * caso del sorgente («Atteso dall'agente»): l'uppercase è del CSS.
   */
  const tessera = (nome: string, etichetta: string) => {
    const t = Array.from(blocco(nome).querySelectorAll<HTMLElement>('.admin-kpi')).find(
      (k) => k.querySelector('.admin-kpi__etichetta')?.textContent?.includes(etichetta),
    );
    expect(t).withContext(`tessera «${etichetta}» in [data-blocco="${nome}"]`).toBeDefined();
    return t!;
  };
  const valoreTessera = (nome: string, etichetta: string) =>
    tessera(nome, etichetta).querySelector('.admin-kpi__valore')?.textContent?.trim();
  const notaTessera = (nome: string, etichetta: string) =>
    tessera(nome, etichetta).querySelector('.admin-kpi__nota')?.textContent ?? '';

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

    // Il badge del canale non ha una tessera nella Panoramica: qui si
    // consuma soltanto, con un valore neutro.
    http.expectOne(isCanale).flush({ inAttesa: 0 });

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

  it('fa OTTO richieste: cruscotto, stats senza `months`, log limit 8, richieste limit 1, quattro conteggi', async () => {
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
    // ⚠️ Ottava: il badge del canale. La Panoramica non lo mostra, ma
    // `AdminPendingService` lo chiede per la sidebar — e una richiesta non
    // consumata fa fallire `http.verify()`.
    http.expectOne(isCanale).flush({ inAttesa: 0 });
    await fixture.whenStable();
  });

  it('prima del flush riserva lo spazio con gli scheletri (≥ 6 tessere), mai con zeri', async () => {
    // ⚠️ La Panoramica era uno dei quattro elementi del sito misurati come
    // salto di layout (report Cloudflare 29-30/08/2026): le tessere nascevano
    // vuote e crescevano all'arrivo dell'API. Lo scheletro ha la stessa
    // altezza della tessera, e sta lì PRIMA che arrivi un byte.
    const tessere = el().querySelectorAll('.admin-kpi.is-scheletro');
    expect(tessere.length).toBeGreaterThanOrEqual(6);
    // ⚠️ TRE righe con le classi della tessera vera: due barre nude non sanno
    // quanto è alto il valore (una `clamp()` su `vw`) e atterravano 15px sotto.
    tessere.forEach((t) => {
      expect(t.querySelector(':scope > .admin-kpi__etichetta > .admin-scheletro')).not.toBeNull();
      expect(t.querySelector(':scope > .admin-kpi__valore > .admin-scheletro')).not.toBeNull();
      expect(t.querySelector(':scope > .admin-kpi__nota > .admin-scheletro')).not.toBeNull();
    });
    // le righe di elenco: `--voce` (61px) e `--azione` (22,5px), MAI `--riga`
    // (la riga di tabella a 44px: qui non c'è una tabella)
    expect(blocco('dafare').querySelectorAll('.admin-scheletro--voce').length).toBe(3);
    expect(blocco('azioni').querySelectorAll('.admin-scheletro--azione').length).toBe(8);
    expect(el().querySelector('.admin-scheletro--riga')).toBeNull();
    // la riga «Aggiornato: …» degli abbonati è riservata anche lei
    expect(blocco('abbonati').querySelector('.pan__nota-scheletro')).not.toBeNull();
    expect(text()).not.toContain('0,00\u00a0€');

    await flushAll();
    expect(el().querySelectorAll('.admin-kpi.is-scheletro').length).toBe(0);
    expect(el().querySelector('.pan__nota-scheletro')).toBeNull();
  });

  it('GEOMETRIA: ogni blocco è alto uguale PRIMA e DOPO i dati (±4px) — lo scheletro È la tessera', async () => {
    // ⚠️ È l'asserzione che trasforma «CLS zero» da obiettivo in guardia: chi
    // tocca il padding di una tessera, l'altezza di una riga o il numero di
    // scheletri senza toccare l'altra metà lo vede qui, non su Cloudflare.
    //
    // ⚠️ Il contenitore è LARGO (3600px) di proposito: la guardia misura la
    // STRUTTURA (conteggio degli scheletri, altezza delle righe, pavimento
    // delle tessere), non il contenuto che va a capo. A 800px un'etichetta su
    // due righe renderebbe rossa una tessera corretta — e il contenuto che va a
    // capo non è prevedibile da uno scheletro. L'host è un custom element,
    // cioè `inline` per default: senza `display: block` la larghezza è inerte.
    const host = el();
    host.style.display = 'block';
    host.style.width = '3600px';
    const misura = () =>
      Object.fromEntries(
        Array.from(host.querySelectorAll<HTMLElement>('[data-blocco]')).map((b) => [
          b.dataset['blocco'],
          b.getBoundingClientRect().height,
        ]),
      );

    const prima = misura();
    expect(Object.keys(prima)).toEqual(['code', 'dafare', 'mese', 'staking', 'abbonati', 'azioni']);

    // tanti dati quanti scheletri: 3 voci «da fare», 6 + 3 + 4 tessere, 8 azioni
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
          { tipo: 'MESE_APERTO_ARRETRATO', meseId: 'm-lug', etichetta: 'luglio 2026', conteggio: 1 },
        ],
      }),
      actions: auditEntries8,
    });
    const dopo = misura();

    for (const nome of Object.keys(prima)) {
      expect(Math.abs(dopo[nome] - prima[nome]))
        .withContext(`blocco «${nome}»: ${prima[nome].toFixed(1)}px prima → ${dopo[nome].toFixed(1)}px dopo`)
        .toBeLessThanOrEqual(4);
    }
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

  it('una voce SENZA importo stampa la sola etichetta, mai «· 0,00 €»', async () => {
    // ⚠️ `importoCent` è opzionale sul filo: un importo che manca è un importo
    // che manca, e il `?? 0` di prima lo stampava come «ticket da zero euro».
    await flushAll({
      cruscotto: cruscottoView({
        daFare: [
          { tipo: 'TICKET_NON_PAGATI', meseId: 'm-set', etichetta: 'settembre 2026', conteggio: 2 },
          { tipo: 'INCASSO_AGENTE', meseId: 'm-ago', etichetta: 'agosto 2026', conteggio: 1 },
        ],
      }),
    });
    const righe = Array.from(
      blocco('dafare').querySelectorAll('.admin-dafare__testo > span'),
    ).map((s) => s.textContent?.trim());
    expect(righe).toEqual(['settembre 2026', 'agosto 2026']);
    expect(testoBlocco('dafare')).not.toContain('0,00\u00a0€');
    expect(testoBlocco('dafare')).not.toContain('attesi');
    // e l'apostrofo è quello dritto, come in tutta la pagina
    expect(testoBlocco('dafare')).toContain("Incasso dell'agente non registrato");
  });

  it('i titoli dei blocchi sono `h2` (sotto l’`h1` della shell non c’è un altro livello)', async () => {
    await flushAll();
    const titoli = Array.from(el().querySelectorAll('.admin-blocco__titolo')).map(
      (t) => `${t.tagName.toLowerCase()}:${t.textContent?.trim()}`,
    );
    expect(titoli).toEqual([
      'h2:Da fare nei conteggi',
      'h2:Conteggi di settembre 2026',
      'h2:Registro staking',
      'h2:Abbonati',
      'h2:Ultime azioni admin',
    ]);
    expect(el().querySelector('h1, h3, h4')).toBeNull();
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
    // ⚠️ «Provvisorio» sta in `.pan__titolo`, che va a capo — MAI dentro il
    // titolo, e non in un flex `nowrap` (la trappola di «Congelato» sotto).
    expect(
      blocco('mese').querySelector('.pan__titolo > .admin-stato[data-tono="attesa"]'),
    ).not.toBeNull();

    // L'ultimo mese chiuso, per etichetta: il margine congelato e la data.
    const chiuso = tessera('mese', 'Ultimo mese chiuso · agosto 2026');
    expect(valoreTessera('mese', 'Ultimo mese chiuso')).toBe('987,65\u00a0€');
    expect(notaTessera('mese', 'Ultimo mese chiuso')).toContain('chiuso il 05 set 2026');
    // ⚠️ «Congelato» sta nella NOTA e MAI nell'etichetta: l'etichetta è un flex
    // che non va a capo e la pastiglia è `nowrap`, quindi lì dentro stringeva
    // l'etichetta su cinque righe e la tessera saliva a 224px, trascinando
    // l'intera riga della griglia (misurato a 1440 il 13/09/2026).
    const congelato = chiuso.querySelector('.admin-stato[data-tono="concluso"]');
    expect(congelato?.textContent).toContain('Congelato');
    expect(congelato?.closest('.admin-kpi__nota')).not.toBeNull();
    expect(chiuso.querySelector('.admin-kpi__etichetta .admin-stato')).toBeNull();

    // il credito dei soci e il prestito, per tessera
    expect(valoreTessera('mese', 'Credito non riscosso dei soci')).toMatch(/^4\.?567,89\u00a0€$/);
    expect(notaTessera('mese', 'Credito non riscosso dei soci')).toMatch(
      /di cui 765,67\u00a0€ presso l'agente, 17,97\u00a0€ dai giocatori/,
    );
    expect(valoreTessera('mese', 'Prestito ancora da rientrare')).toMatch(/^1\.?824,08\u00a0€$/);
    expect(notaTessera('mese', 'Prestito ancora da rientrare')).toContain(
      'sui 2 mesi chiusi del registro',
    );
    expect(valoreTessera('mese', 'Resta da dare ai giocatori')).toMatch(/^1\.?200,20\u00a0€$/);
    // il margine positivo non è «giù»
    expect(blocco('mese').querySelector('.admin-kpi__valore.is-giu')).toBeNull();
  });

  it('il prestito: «sul solo mese chiuso del registro» con UN mese chiuso, mai «sui 1 mesi»', async () => {
    await flushAll({
      cruscotto: cruscottoView({ soci: { ...cruscottoView().soci, mesiChiusi: 1 } }),
    });
    expect(notaTessera('mese', 'Prestito ancora da rientrare')).toContain(
      'sul solo mese chiuso del registro',
    );
    expect(testoBlocco('mese')).not.toContain('1 mesi');
  });

  it('il prestito: «nessun mese ancora chiuso» con zero, mai «sui 0 mesi»', async () => {
    await flushAll({
      cruscotto: cruscottoView({ soci: { ...cruscottoView().soci, mesiChiusi: 0 } }),
    });
    expect(notaTessera('mese', 'Prestito ancora da rientrare')).toContain('nessun mese ancora chiuso');
    expect(testoBlocco('mese')).not.toContain('0 mesi');
  });

  it('un credito NEGATIVO dai giocatori si legge «da rimborsare ai giocatori», mai «-17,97 €»', async () => {
    await flushAll({
      cruscotto: cruscottoView({
        soci: { ...cruscottoView().soci, daRiscuotereDaiGiocatoriCent: -1_797 },
      }),
    });
    const nota = notaTessera('mese', 'Credito non riscosso dei soci');
    expect(nota).toContain('17,97\u00a0€ da rimborsare ai giocatori');
    expect(nota).not.toContain('-17,97');
    expect(nota).not.toContain('dai giocatori');
  });

  it('un margine negativo si vede: `.is-giu` e il segno stampato', async () => {
    await flushAll({
      cruscotto: cruscottoView({ meseInCorso: meseCruscotto({ margineNettoCent: -12_345 }) }),
    });
    const giu = blocco('mese').querySelector('.admin-kpi__valore.is-giu');
    expect(giu?.textContent).toMatch(/-123,45\u00a0€/);
  });

  it("l'agente: sul mese APERTO «si incassa dopo la chiusura», sull'ultimo CHIUSO senza incasso «non ancora incassato» — ognuno nella SUA tessera, mai «0,00 €»", async () => {
    await flushAll({
      cruscotto: cruscottoView({
        ultimoChiuso: ultimoChiuso({ incassoAgente: null }),
      }),
    });

    // «Atteso dall'agente» è il MARGINE (`attesoDaAgenteCent`, 765,01 € nella
    // fixture — un numero che nessun altro campo porta), non lo spettante coi
    // ticket dei giocatori dentro; e sul mese aperto l'incasso è di là da venire
    const atteso = tessera('mese', "Atteso dall'agente (il margine)");
    expect(valoreTessera('mese', "Atteso dall'agente")).toBe('765,01\u00a0€');
    expect(notaTessera('mese', "Atteso dall'agente")).toContain('si incassa dopo la chiusura');
    expect(atteso.querySelector('.is-manca')).toBeNull();

    // sull'ultimo mese CHIUSO senza incasso: il rame «non ancora incassato»,
    // DENTRO quella tessera (`.is-manca` del foglio condiviso, non un `.pan__manca`)
    const chiuso = tessera('mese', 'Ultimo mese chiuso');
    const manca = chiuso.querySelector('.admin-kpi__nota .is-manca');
    expect(manca?.textContent).toContain('non ancora incassato');
    expect(chiuso.querySelector('.admin-kpi__nota')?.textContent).not.toContain('si incassa dopo');

    const mese = testoBlocco('mese');
    expect(mese).not.toContain('0,00\u00a0€');
    // e nel resto del blocco il rame non compare: è UN dato che manca, non un tono
    expect(blocco('mese').querySelectorAll('.is-manca').length).toBe(1);
  });

  it("sull'ultimo CHIUSO senza incasso e con NIENTE da attendere, nessun «non ancora incassato»", async () => {
    // un mese chiuso in cui l'agente non deve niente (margine zero) non ha un
    // bonifico da aspettare: il rame direbbe di aspettare un bonifico che non arriva
    await flushAll({
      cruscotto: cruscottoView({
        ultimoChiuso: ultimoChiuso({ incassoAgente: null, attesoDaAgenteCent: 0 }),
      }),
    });
    const chiuso = tessera('mese', 'Ultimo mese chiuso');
    expect(chiuso.textContent).not.toContain('non ancora incassato');
    expect(chiuso.querySelector('.is-manca')).toBeNull();
    expect(notaTessera('mese', 'Ultimo mese chiuso')).toContain('chiuso il 05 set 2026');
    // ma «Congelato» resta: è lo stato del mese, non dell'incasso
    expect(chiuso.querySelector('.admin-stato[data-tono="concluso"]')).not.toBeNull();
  });

  it("con l'incasso dell'agente registrato dice quanto e su quale cassa, e «non ancora incassato» sparisce", async () => {
    await flushAll({
      cruscotto: cruscottoView({
        meseInCorso: meseCruscotto({
          incassoAgente: { importoCent: 76_567, cassa: 'EXIVEZZZ' },
        }),
      }),
    });

    expect(notaTessera('mese', "Atteso dall'agente")).toContain('incassato 765,67\u00a0€ su Exivezzz');
    expect(notaTessera('mese', 'Ultimo mese chiuso')).toContain('incassato 765,67\u00a0€ su Pietro');
    const mese = testoBlocco('mese');
    expect(mese).not.toContain('non ancora incassato');
    expect(mese).not.toContain('si incassa dopo la chiusura');
    expect(blocco('mese').querySelector('.is-manca')).toBeNull();
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

  it("abbonati: in regola, attivi 30 giorni con la nota «7 giorni · su M iscritti», scadenze, incasso col delta e l'età — ogni numero nella SUA tessera", async () => {
    await flushAll();

    // ⚠️ «Abbonamenti in regola» e non «Abbonati attivi» (cambio consapevole,
    // 13/09/2026): «attivi» ora è la finestra degli iscritti con una sessione.
    expect(valoreTessera('abbonati', 'Abbonamenti in regola')).toBe('40');
    expect(notaTessera('abbonati', 'Abbonamenti in regola')).toMatch(/Passano il paywall ora:\s*42/);

    // ⚠️ Fixture DISTINTIVE (31 · 9 · 200): con «30» e «12» il numero poteva
    // venire da un'altra tessera o da un conteggio delle code.
    expect(valoreTessera('abbonati', 'Attivi negli ultimi 30 giorni')).toBe('31');
    expect(notaTessera('abbonati', 'Attivi negli ultimi 30 giorni')).toMatch(
      /7 giorni:\s*9\s*·\s*su 200 iscritti/,
    );

    expect(valoreTessera('abbonati', 'In scadenza entro 7 giorni')).toBe('6');
    expect(notaTessera('abbonati', 'In scadenza entro 7 giorni')).toMatch(/entro 30:\s*9/);

    // EURO float: 500 → «500 €», intero senza decimali
    expect(valoreTessera('abbonati', 'Incasso abbonamenti')).toBe('500\u00a0€');
    const incasso = notaTessera('abbonati', 'Incasso abbonamenti');
    expect(incasso).toContain('4 abbonamenti approvati');
    // DELTA con signDisplay: il segno È il senso della variazione
    expect(incasso).toContain('+12,5%');
    expect(
      tessera('abbonati', 'Incasso abbonamenti').querySelector('.admin-kpi__delta.is-su'),
    ).not.toBeNull();

    const ab = testoBlocco('abbonati');
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
