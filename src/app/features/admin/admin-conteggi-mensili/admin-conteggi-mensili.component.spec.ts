import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  ContoRakeback,
  DettaglioMese,
  MeseContabile,
  RigaRakeback,
  SpesaRicorrente,
  RigaStakato,
  Stakato,
  AdminUser,
  AnteprimaPunti,
  SaldiSoci,
} from '../../../core/models/api.models';
import { AdminConteggiMensiliComponent } from './admin-conteggi-mensili.component';

const API = environment.API_URL;

const mese = (over: Partial<MeseContabile> = {}): MeseContabile => ({
  id: 'm1',
  anno: 2026,
  mese: 9,
  etichetta: 'settembre 2026',
  stato: 'APERTO',
  quotaTitolareBp: 6500,
  riepilogoCongelato: false,
  ...over,
});

const riga = (over: Partial<RigaRakeback> = {}): RigaRakeback => ({
  id: 'r1',
  contoId: 'c1',
  username: 'Santotti88',
  nomeReale: 'Mario Rossi',
  backAgenteBp: 5700,
  backPlayerBp: 5300,
  scaglioneBaseBp: 4500,
  scaglionePassoCent: 2250,
  destinazione: 'SCUOLA',
  ordine: 100,
  rakeGeneratoCent: 757_248,
  pagatoAlPlayerCent: 0,
  scaglioni: 151,
  erogatoBonusCent: 339_750,
  spettanteDaAgenteCent: 91_881,
  spettanteAlPlayerCent: 61_591,
  profittoAgenteCent: 30_290,
  nettoCassaCent: 91_881,
  residuoAlPlayerCent: 61_591,
  stakato: false,
  ...over,
});

/**
 * ⚠️ I totali NON si ricavano dalle righe: arrivano dal SERVER sull'envelope.
 * Il default qui li somma solo per comodità, ma un test apposta ne manda di
 * DIVERSI — è proprio quel caso a distinguere «la tabella legge l'envelope» da
 * «la tabella somma le righe che vede».
 */
const dettaglio = (
  righe: RigaRakeback[] = [riga()],
  over: Partial<DettaglioMese> = {},
): DettaglioMese => ({
  mese: mese(),
  voci: [],
  righe,
  abbonamenti: [],
  stakati: [],
  speseFisseDaRegistrare: [],
  // ⚠️ Dal vivo come `speseFisseDaRegistrare`: l'agente bonifica dopo la
  // chiusura, quindi questo blocco non entra nello snapshot.
  incassoAgente: { attesoCent: 76_567 },
  totaliRakeback: {
    rakeGeneratoCent: righe.reduce((t, r) => t + r.rakeGeneratoCent, 0),
    erogatoBonusCent: righe.reduce((t, r) => t + r.erogatoBonusCent, 0),
    spettanteDaAgenteCent: righe.reduce(
      (t, r) => t + r.spettanteDaAgenteCent,
      0,
    ),
    spettanteAlPlayerCent: righe.reduce(
      (t, r) => t + r.spettanteAlPlayerCent,
      0,
    ),
    profittoAgenteCent: righe.reduce((t, r) => t + r.profittoAgenteCent, 0),
    pagatoAlPlayerCent: righe.reduce((t, r) => t + r.pagatoAlPlayerCent, 0),
    nettoCassaCent: righe.reduce((t, r) => t + r.nettoCassaCent, 0),
  },
  riepilogo: {
    entrate: {
      abbonamentiCent: 25_000,
      abbonamentiPerDestinazione: {
        pietroCent: 25_000,
        exivezzzCent: 0,
        onlineCent: 0,
        paypalCent: 0,
        skrillCent: 0,
        nonAttribuitoCent: 0,
      },
      gadgetCent: 0,
      commissioniRakebackCent: 30_290,
      stakingCent: 0,
      stakingDaConteggiCent: 0,
      altreCent: 0,
      totaleCent: 55_290,
    },
    uscite: {
      speseCent: 36_000,
      // ⚠️ Zero: la fixture non ha capitale di roll perso, e un numero
      // inventato qui romperebbe `totaleCent = speseCent + perditeStakingCent`.
      perditeStakingCent: 0,
      // ⚠️ Le quattro voci sommano `speseCent`: la fixture rispetta
      // l'invariante che il pannello mostra, o la spec verificherebbe una
      // schermata che in produzione non può esistere.
      perCassa: {
        pietroCent: 4_820,
        exivezzzCent: 8_900,
        comuneCent: 21_000,
        nonAttribuitoCent: 1_280,
      },
      totaleCent: 36_000,
    },
    conguaglioGiocatoriCent: 0,
    margineNettoCent: 19_290,
    ripartizione: {
      titolareCent: 12_539,
      socioCent: 6751,
      quotaTitolareBp: 6500,
    },
    marginePersonaleCent: 0,
    // Il conguaglio: maturato = ripartizione, cassa = contanti − spese anticipate.
    soci: {
      pietro: { maturatoCent: 12_539, cassaCent: 20_180 },
      exivezzz: { maturatoCent: 6751, cassaCent: -8_900 },
      incassiNonAttribuitiCent: 0,
      speseNonAttribuiteCent: 1_280,
      attesoDaAgenteCent: 76_567,
      attesoDaiGiocatoriCent: 0,
    },
    cassaGiocatori: {
      attesoDaAgenteCent: 91_881,
      pagatoAiGiocatoriCent: 0,
      residuoDovutoCent: 61_591,
      righeSenzaPagamento: 0,
      senzaPagamentoCent: 0,
    },
    abbonamentiStimati: 0,
  },
  troncato: false,
  ...over,
});

/** Il conguaglio fra soci dal vivo: Pietro a credito, Exivezzz a debito. */
const saldi = (over: Partial<SaldiSoci> = {}): SaldiSoci => ({
  mesiChiusi: 2,
  pietro: {
    maturatoCent: 50_000,
    cassaCent: 5_000,
    daAgenteCent: 0,
    daiGiocatoriCent: 0,
    capitaleAnticipatoCent: 0,
    capitaleRientratoCent: 0,
    capitaleResiduoCent: 0,
    ricevutiCent: 30_000,
    datiCent: 0,
    saldoCent: 15_000,
    compensoNonRitiratoCent: 15_000,
  },
  // ⚠️ L'identità `saldoP + saldoE = credito` vale anche nella fixture:
  // 15.000 + 0 = 15.000. Un numero inventato qui verificherebbe una
  // schermata che il server non può produrre.
  exivezzz: {
    maturatoCent: 20_000,
    cassaCent: 20_000,
    daAgenteCent: 0,
    daiGiocatoriCent: 0,
    capitaleAnticipatoCent: 0,
    capitaleRientratoCent: 0,
    capitaleResiduoCent: 0,
    ricevutiCent: 0,
    datiCent: 0,
    saldoCent: 0,
    compensoNonRitiratoCent: 0,
  },
  creditoNonRiscossoCent: 15_000,
  capitalePressoIGiocatoriCent: 0,
  capitaleNonAttribuitoCent: 0,
  // ⚠️ La scomposizione per origine: `pressoAgente + daiGiocatori` non deve
  // superare il credito, o la fixture verificherebbe una schermata che il
  // server non può produrre.
  pressoAgenteCent: 0,
  daRiscuotereDaiGiocatoriCent: 0,
  incassiNonAttribuitiCent: 0,
  speseNonAttribuiteCent: 0,
  provvisorio: {
    etichetta: 'settembre 2026',
    soci: dettaglio().riepilogo.soci,
  },
  versamenti: [
    {
      id: 'v1',
      data: '2026-09-05T12:00:00.000Z',
      da: 'ESTERNO',
      a: 'PIETRO',
      importoCent: 30_000,
      nota: 'bonifico agente',
    },
  ],
  ...over,
});

describe('AdminConteggiMensiliComponent', () => {
  let fixture: ComponentFixture<AdminConteggiMensiliComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /**
   * Le CINQUE chiamate del costruttore: mesi, conti, ricorrenti, stakati,
   * dettaglio. ⚠️ `HttpTestingController.verify()` fallisce su una richiesta
   * non consumata, quindi chi aggiunge un caricamento all'avvio deve venire
   * qui — il sintomo è «Expected no open requests» su spec che con quella
   * chiamata non c'entrano nulla.
   */
  const avvia = async (
    d: DettaglioMese | null = dettaglio(),
    conti: ContoRakeback[] = [],
    ricorrenti: SpesaRicorrente[] = [],
  ) => {
    await stabilizza();
    http
      .expectOne(`${API}/admin/conteggi/mesi`)
      .flush(d ? [d.mese] : []);
    http.expectOne(`${API}/admin/conteggi/conti`).flush(conti);
    http.expectOne(`${API}/admin/conteggi/ricorrenti`).flush(ricorrenti);
    http.expectOne(`${API}/admin/conteggi/stakati`).flush([]);
    if (d) {
      await stabilizza();
      http.expectOne(`${API}/admin/conteggi/mesi/${d.mese.id}`).flush(d);
    }
    await stabilizza();
  };

  /**
   * ⚠️ Ogni salvataggio di anagrafica RICARICA i tre elenchi: senza
   * consumarli, `http.verify()` in `afterEach` fallisce con «Expected no open
   * requests» — un messaggio che accusa il test successivo invece di quello
   * che ha lasciato le richieste aperte.
   */
  const flushAnagrafiche = () => {
    http.expectOne(`${API}/admin/conteggi/conti`).flush([]);
    http.expectOne(`${API}/admin/conteggi/ricorrenti`).flush([]);
    http.expectOne(`${API}/admin/conteggi/stakati`).flush([]);
  };

  const scheda = (etichetta: string): HTMLButtonElement =>
    [...fixture.nativeElement.querySelectorAll('button[role="tab"]')].find(
      (b: HTMLButtonElement) => b.textContent?.includes(etichetta),
    ) as HTMLButtonElement;

  const vaiA = async (etichetta: string) => {
    scheda(etichetta).click();
    await stabilizza();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AdminConteggiMensiliComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(AdminConteggiMensiliComponent);
    http = TestBed.inject(HttpTestingController);
  });

  // ── Il libro cassa: il denaro che arriva DOPO la chiusura ────────────────

  /** Una riga di stakato per le prove sui bonifici. */
  const rigaStakato = (over: Partial<RigaStakato> = {}): RigaStakato => ({
    id: 'rs1',
    stakatoId: 'st1',
    nome: 'Rossana',
    fonteBack: 'CONTO',
    dealScuolaBp: 3500,
    backCent: 23_059,
    trattenutoCent: 2_809,
    poolEvCent: -6800,
    diffCent: -700,
    feeCent: -2500,
    altroCent: 100,
    debitoEvCent: 0,
    totaleCent: 13_159,
    quotaScuolaCent: 4_606,
    risultatoCent: 1_797,
    aRecuperoCent: 0,
    daRegolareCent: 1_797,
    registrato: false,
    disallineato: false,
    ...over,
  });

  it('mostra «Incassato dall’agente» anche a mese CHIUSO, ed è il caso normale', async () => {
    // ⚠️⚠️ È la regola portante del lotto: l'agente bonifica il rakeback di
    // agosto a settembre. Se il blocco seguisse le spese fisse — che a mese
    // chiuso spariscono perché registrarle darebbe 409 — quel denaro non si
    // potrebbe registrare mai, e il credito non scenderebbe.
    await avvia(
      dettaglio([riga()], {
        mese: mese({ stato: 'CHIUSO', riepilogoCongelato: true }),
      }),
    );
    await vaiA('Rakeback');

    expect(testo()).toContain("Incassato dall'agente");
    const registra = [
      ...fixture.nativeElement.querySelectorAll('button'),
    ].find((b: HTMLButtonElement) =>
      b.textContent?.includes("Registra l'incasso"),
    ) as HTMLButtonElement;
    expect(registra).withContext("il comando c’è a mese chiuso").toBeTruthy();
    expect(registra.disabled).toBeFalse();
  });

  it('l’atteso è un SUGGERIMENTO accanto al campo, mai il valore precompilato', async () => {
    // ⚠️⚠️ Precompilando con l'atteso la quadratura tornerebbe SEMPRE, cioè il
    // controllo per cui questo blocco esiste non controllerebbe più niente. È
    // la stessa regola di «l'ultima volta» sulle spese fisse.
    await avvia();
    await vaiA('Rakeback');
    (
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.includes("Registra l'incasso"),
      ) as HTMLButtonElement
    ).click();
    await stabilizza();

    const campo = fixture.nativeElement.querySelector(
      '#cm-in-importo',
    ) as HTMLInputElement;
    expect(campo.value).withContext('il campo nasce VUOTO').toBe('');
    expect(testo()).toContain('Atteso per questo mese');
    expect(testo()).toContain('765,67');
  });

  it('registra l’incasso con la cassa e la data a mezzogiorno UTC', async () => {
    await avvia();
    await vaiA('Rakeback');
    (
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.includes("Registra l'incasso"),
      ) as HTMLButtonElement
    ).click();
    await stabilizza();

    const scrivi = (sel: string, v: string) => {
      const el = fixture.nativeElement.querySelector(sel) as HTMLInputElement;
      el.value = v;
      el.dispatchEvent(new Event('input'));
    };
    scrivi('#cm-in-importo', '765,67');
    const cassa = fixture.nativeElement.querySelector(
      '#cm-in-cassa',
    ) as HTMLSelectElement;
    cassa.value = 'EXIVEZZZ';
    cassa.dispatchEvent(new Event('change'));
    scrivi('#cm-in-data', '2026-10-05');
    await stabilizza();

    (
      fixture.nativeElement.querySelector(
        'button[form="cm-form-incasso"]',
      ) as HTMLButtonElement
    ).click();
    await stabilizza();

    const req = http.expectOne(`${API}/admin/conteggi/mesi/m1/incasso-agente`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.importoCent).toBe(76_567);
    expect(req.request.body.cassa).toBe('EXIVEZZZ');
    // ⚠️ Mezzogiorno UTC: una data-solo a mezzanotte di Roma è il giorno prima
    // in UTC per metà dell'anno, e il registro ordina per data.
    expect(req.request.body.dataAt).toBe('2026-10-05T12:00:00.000Z');
    req.flush(dettaglio());
    await stabilizza();
  });

  it('su un rimborso la cifra si scrive POSITIVA: il segno lo mette il client', async () => {
    // ⚠️⚠️ Chiedere un meno su un bonifico in uscita è il modo più rapido per
    // registrare il verso sbagliato di un movimento di denaro. Il verso è già
    // scritto nel dovuto che la riga mostra accanto.
    await avvia(
      dettaglio([], {
        stakati: [rigaStakato({ daRegolareCent: -338, risultatoCent: -338 })],
      }),
    );
    await vaiA('Stakati');

    expect(testo()).toContain('Movimenti coi giocatori');
    const importo = fixture.nativeElement.querySelector(
      '#reg-rs1',
    ) as HTMLInputElement;
    importo.value = '3,38';
    importo.dispatchEvent(new Event('input'));
    const cassa = fixture.nativeElement.querySelector(
      '#regc-rs1',
    ) as HTMLSelectElement;
    cassa.value = 'EXIVEZZZ';
    cassa.dispatchEvent(new Event('change'));
    await stabilizza();

    (
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) =>
          b.textContent?.includes('Registra il movimento'),
      ) as HTMLButtonElement
    ).click();
    await stabilizza();

    const req = http.expectOne(`${API}/admin/conteggi/mesi/m1/regolazioni`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.righe[0].regolatoCent).toBe(-338);
    expect(req.request.body.righe[0].regolatoCassa).toBe('EXIVEZZZ');
    req.flush(dettaglio());
    await stabilizza();
  });

  it('senza la cassa NON parte alcuna chiamata, e l’errore NOMINA la riga', async () => {
    // ⚠️ Un importo senza tasca non abbassa il saldo di nessuno dei due: si
    // chiede subito, invece di scrivere una riga che non serve a niente.
    await avvia(dettaglio([], { stakati: [rigaStakato()] }));
    await vaiA('Stakati');

    const importo = fixture.nativeElement.querySelector(
      '#reg-rs1',
    ) as HTMLInputElement;
    importo.value = '17,97';
    importo.dispatchEvent(new Event('input'));
    await stabilizza();

    (
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) =>
          b.textContent?.includes('Registra il movimento'),
      ) as HTMLButtonElement
    ).click();
    await stabilizza();

    http.expectNone(`${API}/admin/conteggi/mesi/m1/regolazioni`);
    expect(testo()).toContain('Rossana');
    expect(testo()).toContain('Manca l’importo o la cassa');
  });

  it('una riga già regolata esce dalla coda e porta il badge con la tasca', async () => {
    await avvia(
      dettaglio([], {
        stakati: [
          rigaStakato({ regolatoCent: 1_797, regolatoCassa: 'PIETRO' }),
        ],
      }),
    );
    await vaiA('Stakati');

    // ⚠️ Nessuna COLONNA nuova: con dieci colonne questa tabella sfonda già a
    // 1100px. Il fatto sta fra i badge, la cifra nel sotto-testo.
    expect(testo()).toContain('Incassato');
    expect(testo()).toContain('17,97');
    expect(testo()).not.toContain('Movimenti coi giocatori');
    expect(testo()).toContain('Movimenti registrati');
  });

  it('il credito non riscosso si SPEZZA per origine, e un negativo si chiama rimborso', async () => {
    // ⚠️ Una cifra che non dice da CHI la si aspetta è una cifra che non si
    // puo' andare a incassare (richiesta dell'owner).
    await avvia();
    await vaiA('Soci');
    http.expectOne(`${API}/admin/conteggi/soci`).flush(
      saldi({
        pressoAgenteCent: 76_567,
        daRiscuotereDaiGiocatoriCent: -338,
      }),
    );
    await stabilizza();

    expect(testo()).toContain("Presso l'agente");
    expect(testo()).toContain('765,67');
    // ⚠️ Negativo NON è un credito: è un rimborso che la scuola deve ancora
    // mandare, e «da riscuotere» direbbe il contrario esatto.
    expect(testo()).toContain('Da rimborsare ai giocatori');
    expect(testo()).not.toContain('−3,38');
  });

  afterEach(() => {
    http.verify();
    // ⚠️ La modale mette una classe su <html> e i test non smontano il DOM del
    // documento: senza questa riga il test successivo parte con lo scorrimento
    // bloccato, e fallisce per un motivo che non nomina la causa.
    document.documentElement.classList.remove('is-modale');
  });

  it('mostra il mese scelto e il suo stato', async () => {
    await avvia();
    expect(testo()).toContain('settembre 2026');
    const pastiglia = fixture.nativeElement.querySelector('.admin-stato');
    expect(pastiglia?.textContent?.trim()).toBe('Aperto');
  });

  it('le sette sezioni sono SCHEDE, con un pannello raggiungibile', async () => {
    await avvia();
    const schede = fixture.nativeElement.querySelectorAll(
      'button[role="tab"]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(schede.length).toBe(7);
    // ⚠️ L'ordine è quello del conto economico: prima il riepilogo, poi le
    // QUATTRO fonti di denaro, poi il conguaglio fra soci — che legge i mesi
    // CHIUSI, quindi viene dopo tutto ciò che li compone —, infine le
    // anagrafiche, che non appartengono a un mese. ⚠️ Gli stakati stanno DOPO
    // gli abbonamenti e prima delle spese: il loro conteggio legge dalla
    // tabella del rakeback, quindi si compila dopo quella — l'ordine delle
    // schede è l'ordine in cui si lavora.
    expect([...schede].map((b) => b.textContent?.trim().split(/\s+/)[0])).toEqual([
      'Riepilogo',
      'Rakeback',
      'Abbonamenti',
      'Stakati',
      'Spese',
      'Soci',
      'Anagrafiche',
    ]);

    // ⚠️ `aria-selected` e non `aria-pressed`: la grammatica di una scelta
    // esclusiva. `aria-pressed` annuncerebbe «N interruttori, uno premuto».
    expect(schede[0].getAttribute('aria-selected')).toBe('true');
    expect(schede[0].hasAttribute('aria-pressed')).toBeFalse();

    // ⚠️ Una scheda PROMETTE un pannello raggiungibile da tastiera: senza
    // `tabindex="0"` sul `role="tabpanel"` la promessa non è mantenuta.
    const pannello = fixture.nativeElement.querySelector(
      '[role="tabpanel"]',
    ) as HTMLElement;
    expect(pannello).toBeTruthy();
    expect(pannello.getAttribute('tabindex')).toBe('0');
    expect(pannello.id).toBe(schede[0].getAttribute('aria-controls') ?? '');
  });

  it('i totali del rakeback arrivano dall’ENVELOPE, non dalla somma delle righe', async () => {
    // Totali deliberatamente DIVERSI dalla somma delle due righe: se la
    // schermata li ricalcolasse, stamperebbe la somma e non questi.
    const d = dettaglio([riga(), riga({ id: 'r2', contoId: 'c2', username: 'Tibuco' })], {
      totaliRakeback: {
        rakeGeneratoCent: 1_945_772,
        erogatoBonusCent: 859_500,
        spettanteDaAgenteCent: 247_396,
        spettanteAlPlayerCent: 170_829,
        profittoAgenteCent: 76_567,
        pagatoAlPlayerCent: 0,
        nettoCassaCent: 247_396,
      },
    });
    await avvia(d);
    await vaiA('Rakeback');
    // ⚠️ `.admin-totali` e non più `<tfoot>`: nel modello a bordi separati —
    // che questa tabella usa per scelta esplicita — un `border-top` su un `<tr>`
    // è IGNORATO, quindi il piede non si distingueva; e sotto i 720px le sue
    // celle non portavano `data-etichetta`, cioè la riga più importante era
    // l'unica illeggibile.
    const striscia =
      fixture.nativeElement.querySelector('.admin-totali')?.textContent ?? '';
    // 19.457,72 € — il totale del foglio reale, non la somma delle due righe.
    expect(striscia).toContain('19.457,72');
    expect(striscia).toContain('765,67');
    expect(fixture.nativeElement.querySelector('tfoot')).toBeNull();
    // ⚠️ Un totale che non nomina il proprio insieme si legge come «tutto».
    expect(
      fixture.nativeElement.querySelector('.admin-totali__ambito')?.textContent,
    ).toContain('2 conti');
  });

  it('le tre righe «di cui anticipate» sommano la riga Spese', async () => {
    await avvia(dettaglio(), [], []);
    const testo = fixture.nativeElement.textContent as string;
    // ⚠️ `textContent` e mai `innerText`: questo pannello e' pieno di
    // `text-transform: uppercase`, e `innerText` restituisce il testo COME LO
    // DIPINGE IL CSS — falsi rossi su una pagina corretta.
    expect(testo).toContain('di cui anticipate da Pietro');
    expect(testo).toContain('di cui anticipate da Exivezzz');
    expect(testo).toContain('di cui dal conto comune');
    // La quarta compare solo quando c'e' qualcosa da attribuire, ed e' il caso
    // della fixture: e' una coda di lavoro, non uno stato normale.
    expect(testo).toContain('di cui da attribuire');

    const r = dettaglio().riepilogo.uscite;
    expect(
      r.perCassa.pietroCent +
        r.perCassa.exivezzzCent +
        r.perCassa.comuneCent +
        r.perCassa.nonAttribuitoCent,
    ).toBe(r.speseCent);
  });

  it('«da attribuire» sparisce quando non c e niente da attribuire', async () => {
    const d = dettaglio();
    d.riepilogo.uscite.perCassa = {
      pietroCent: 4_820,
      exivezzzCent: 8_900,
      comuneCent: 22_280,
      nonAttribuitoCent: 0,
    };
    await avvia(d, [], []);
    // ⚠️ Il verso che nega: una riga sempre a zero smette di essere letta
    // proprio quando conta qualcosa. Idioma di «senza incassante».
    expect(fixture.nativeElement.textContent).not.toContain(
      'di cui da attribuire',
    );
  });

  it('una voce senza cassa mostra un trattino, non «Cassa comune»', async () => {
    await avvia(dettaglio(), [], []);
    const d = dettaglio([], {
      voci: [
        {
          id: 'v1',
          verso: 'USCITA',
          categoria: 'INFRASTRUTTURA',
          descrizione: 'LiveKit',
          importoCent: 4_820,
          cassa: 'PIETRO',
        },
        {
          id: 'v2',
          verso: 'USCITA',
          categoria: 'ALTRO',
          descrizione: 'Spesa vecchia',
          importoCent: 1_280,
        },
      ],
    });
    fixture.componentInstance['dett'].set(d);
    fixture.componentInstance['vista'].set('voci');
    await stabilizza();

    const righeTab = [
      ...fixture.nativeElement.querySelectorAll('tbody tr'),
    ] as HTMLElement[];
    const conCassa = righeTab.find((r) =>
      r.textContent?.includes('LiveKit'),
    );
    const senza = righeTab.find((r) => r.textContent?.includes('Spesa vecchia'));
    expect(conCassa?.textContent).toContain('Pietro');
    // ⚠️⚠️ L'asserzione che conta: «non lo so» e «l'ha pagata il conto comune»
    // sono due cose diverse. Indovinare la seconda falserebbe il conguaglio
    // fra i soci di quell'importo esatto, e senza lasciare un segno.
    expect(senza?.textContent).not.toContain('Cassa comune');
    expect(senza?.textContent).toContain('—');
  });

  it('il comando di riga si trova per NOME ACCESSIBILE, e due righe hanno etichette diverse', async () => {
    await avvia(dettaglio(), [], []);
    await vaiA('Anagrafiche');
    // Nessun conto: si prova sulle voci, che è l'altra tabella con un comando.
    const d = dettaglio([], {
      voci: [
        {
          id: 'v1',
          verso: 'USCITA',
          categoria: 'COACH',
          descrizione: 'Compenso bastogne',
          importoCent: 30_000,
        },
        {
          id: 'v2',
          verso: 'USCITA',
          categoria: 'INFRASTRUTTURA',
          descrizione: 'LiveKit',
          importoCent: 6000,
        },
      ],
    });
    fixture.componentInstance['dett'].set(d);
    fixture.componentInstance['vista'].set('voci');
    await stabilizza();

    // ⚠️ Per NOME ACCESSIBILE e mai per classe: il comando è solo-icona, quindi
    // `textContent` è vuoto e un selettore di classe rimetterebbe il verde
    // lasciando ZERO righe nel repo che nominano l'etichetta.
    const etichette = [
      ...fixture.nativeElement.querySelectorAll('button.admin-ico'),
    ]
      .map((b: HTMLButtonElement) => b.getAttribute('aria-label'))
      .filter((l): l is string => !!l && l.startsWith('Modifica '));
    expect(etichette.length).toBe(2);
    // Due pulsanti che annunciano la stessa parola sono due pulsanti anonimi.
    expect(new Set(etichette).size).toBe(2);
    expect(etichette).toContain('Modifica Compenso bastogne');
  });

  it('un mese vuoto non stampa NaN e spiega da dove arrivano le righe', async () => {
    const vuoto = dettaglio([], {
      voci: [],
      totaliRakeback: {
        rakeGeneratoCent: 0,
        erogatoBonusCent: 0,
        spettanteDaAgenteCent: 0,
        spettanteAlPlayerCent: 0,
        profittoAgenteCent: 0,
        pagatoAlPlayerCent: 0,
        nettoCassaCent: 0,
      },
    });
    await avvia(vuoto);
    expect(testo()).not.toContain('NaN');
    await vaiA('Rakeback');
    expect(testo()).not.toContain('NaN');
    // ⚠️ Lo stato vuoto DEVE dire da dove arrivano le righe: senza, si legge
    // come «non c'è niente» quando la causa vera è un'altra.
    expect(testo()).toContain('Anagrafiche');
  });

  it('su un mese CHIUSO non esiste alcun campo: i valori si stampano', async () => {
    const chiuso = dettaglio([riga({ rakeGeneratoCent: 3000, pagatoAlPlayerCent: 1000 })], {
      mese: mese({ stato: 'CHIUSO', riepilogoCongelato: true }),
    });
    await avvia(chiuso);
    await vaiA('Rakeback');
    // ⚠️⚠️ Questa asserzione è il ROVESCIO di quella che c'era prima, e il
    // cambio è deliberato: i campi erano resi con `[disabled]`, cioè trenta
    // controlli disegnati dal foglio del BROWSER — il progetto non ha alcuno
    // stile `:disabled` per `.input`, e non va inventato qui. Non rendendoli
    // affatto, la tabella torna di sola lettura come le altre tredici del
    // pannello e che il mese sia chiuso si legge dalla FORMA, non da un grigio.
    expect(
      fixture.nativeElement.querySelectorAll('input.cm__cella').length,
    ).toBe(0);
    // …ma i due valori devono restare leggibili, o la chiusura li nasconde.
    const corpo =
      fixture.nativeElement.querySelector('tbody')?.textContent ?? '';
    expect(corpo).toContain('30,00');
    expect(corpo).toContain('10,00');
    expect(testo()).not.toContain('Salva la colonna');
  });

  it('un importo negativo in tabella porta ANCHE `is-perdita`, e la regola che lo colora esiste', async () => {
    await avvia(dettaglio([riga({ profittoAgenteCent: -1234 })]));
    await vaiA('Rakeback');

    const cella = fixture.nativeElement.querySelector(
      'tbody td.cm__esito',
    ) as HTMLElement;
    expect(cella.classList).toContain('is-perdita');

    // ⚠️⚠️ La classe da sola non basta, ed è il punto di questo test: con
    // l'incapsulamento di Angular `.cm__rakeback .cm__calcolata` vale (0,4,0)
    // contro lo (0,2,0) di `.is-perdita`, quindi il grigio VINCEVA sul rosso e
    // un importo negativo non diventava mai rosso. Il colore calcolato non è
    // asseribile in Karma (i token vivono nel foglio globale, che qui non è
    // caricato), ma la regola composta sì: se qualcuno la scioglie, questo
    // fallisce.
    const selettori: string[] = [];
    for (const foglio of [...document.styleSheets]) {
      let regole: CSSRuleList | null = null;
      try {
        regole = foglio.cssRules;
      } catch {
        continue; // foglio di altra origine: non è dei nostri
      }
      for (const regola of [...regole]) {
        if (regola instanceof CSSStyleRule) selettori.push(regola.selectorText);
      }
    }
    expect(
      selettori.some((s) => /\.cm__calcolata[^\s,{]*\.is-perdita/.test(s)),
    ).toBeTrue();
  });

  it('«Salva la colonna» resta spento finché non cambia un IMPORTO, non una stringa', async () => {
    await avvia(dettaglio([riga({ rakeGeneratoCent: 3000 })]));
    await vaiA('Rakeback');
    const salva = () =>
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.includes('Salva la colonna'),
      ) as HTMLButtonElement;
    expect(salva().disabled).toBeTrue();

    // ⚠️ «30,00» e «30» sono lo STESSO importo: un pulsante che si accende
    // perché qualcuno ha tolto due zeri insegna a premerlo senza motivo.
    fixture.componentInstance['scriviRake']('c1', '30');
    await stabilizza();
    expect(salva().disabled).toBeTrue();

    fixture.componentInstance['scriviRake']('c1', '31');
    await stabilizza();
    expect(salva().disabled).toBeFalse();
  });

  it('ogni riga di rakeback ha un comando che NOMINA la riga', async () => {
    await avvia(
      dettaglio([riga(), riga({ id: 'r2', contoId: 'c2', username: 'Tibuco' })]),
    );
    await vaiA('Rakeback');
    // ⚠️ Per NOME ACCESSIBILE e mai per classe: il comando è solo-icona, quindi
    // `textContent` è vuoto e un selettore di classe rimetterebbe il verde
    // lasciando ZERO righe nel repo che nominano l'etichetta.
    const etichette = [
      ...fixture.nativeElement.querySelectorAll('tbody button.admin-ico'),
    ]
      .map((b: HTMLButtonElement) => b.getAttribute('aria-label'))
      .filter((l): l is string => !!l);
    expect(etichette.length).toBe(2);
    // Due pulsanti che annunciano la stessa parola sono due pulsanti anonimi.
    expect(new Set(etichette).size).toBe(2);
    expect(etichette).toContain('Apri la scheda di Santotti88');
  });

  it('la scheda di riga porta il dettaglio del calcolo e la forma di pagamento', async () => {
    await avvia(dettaglio());
    await vaiA('Rakeback');
    const apri = [
      ...fixture.nativeElement.querySelectorAll('tbody button.admin-ico'),
    ].find((b: HTMLButtonElement) =>
      b.getAttribute('aria-label')?.startsWith('Apri la scheda'),
    ) as HTMLButtonElement;
    apri.click();
    await stabilizza();

    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeTruthy();
    const t = dialog.textContent as string;
    // ⚠️ Percentuali, scaglioni e netto di cassa sono usciti DALLA TABELLA per
    // una misura (undici colonne sfondavano di 182px a 1024): devono essere
    // qui, o quel dato è semplicemente sparito.
    expect(t).toContain('151');
    expect(t).toContain('scaglioni');
    expect(t).toContain('Forma del pagamento');
    // ⚠️ Nessun secondo salvataggio: la scheda scrive nella stessa bozza della
    // colonna, e a persistere è «Salva la colonna».
    expect(t).toContain('Salva la colonna');
  });

  it('dichiara quante righe di abbonamento sono STIMATE', async () => {
    const d = dettaglio();
    d.riepilogo.abbonamentiStimati = 3;
    await avvia(d);
    expect(testo()).toContain('3');
    expect(testo()).toContain('È una stima.');
  });

  it('la cassa verso i giocatori è dichiarata come partita di giro', async () => {
    await avvia();
    // ⚠️ Il rakeback entra nel margine per COMPETENZA e non per cassa: senza
    // questa frase i due numeri si leggono come due versioni dello stesso.
    expect(testo()).toContain('partite di giro');
  });

  it('lo staking ha una riga PROPRIA, distinta da «Altre entrate»', async () => {
    const d = dettaglio();
    d.riepilogo.entrate.stakingCent = 12_345;
    d.riepilogo.entrate.altreCent = 5000;
    await avvia(d);

    const conto =
      fixture.nativeElement.querySelector('.cm__conto')?.textContent ?? '';
    // ⚠️ La riga esiste E porta il suo numero: senza, lo staking sarebbe
    // invisibile dentro «Altre entrate», che è il difetto che questa riga
    // esiste per chiudere.
    expect(conto).toContain('Staking');
    expect(conto).toContain('123,45');
    // ⚠️ E «Altre entrate» resta una riga a sé col PROPRIO valore: se il server
    // contasse lo staking due volte, qui si leggerebbe 173,45.
    expect(conto).toContain('Altre entrate');
    expect(conto).toContain('50,00');
  });

  it('uno snapshot vecchio SENZA `stakingCent` non stampa NaN', async () => {
    // ⚠️ Il caso reale di un mese chiuso prima che la categoria esistesse. Il
    // server lo riempie a 0 (`snapshotCompleto`), ma questo test copre l'altra
    // metà: il `?? 0` di `eur()`, che finora non era coperto da niente e che è
    // l'unica difesa se le due parti dovessero mai disallinearsi.
    const d = dettaglio();
    delete (d.riepilogo.entrate as Partial<DettaglioMese['riepilogo']['entrate']>)
      .stakingCent;
    await avvia(d);

    expect(testo()).not.toContain('NaN');
    const conto =
      fixture.nativeElement.querySelector('.cm__conto')?.textContent ?? '';
    expect(conto).toContain('Staking');
    expect(conto).toContain('0,00');
  });

  it('«Staking» si sceglie solo su un’ENTRATA, ed è penultima', async () => {
    await avvia();
    const c = fixture.componentInstance as unknown as {
      apriVoce: (v: unknown) => void;
      formVoce: { patchValue: (v: Record<string, unknown>) => void };
    };
    c.apriVoce('nuova');
    await stabilizza();

    const opzioni = () =>
      [
        ...fixture.nativeElement.querySelectorAll('#cm-cat option'),
      ].map((o: HTMLOptionElement) => o.textContent?.trim());

    c.formVoce.patchValue({ verso: 'ENTRATA' });
    await stabilizza();
    const entrata = opzioni();
    expect(entrata).toContain('Staking');
    // ⚠️ `Altro` è il ripiego e resta ULTIMO: in mezzo si legge come una
    // categoria fra le altre.
    expect(entrata[entrata.length - 1]).toBe('Altro');

    // ⚠️ L'esempio della descrizione segue il verso: «LiveKit» è una spesa, e
    // proporlo su un'entrata suggerisce di registrare un incasso come un costo.
    const segnaposto = () =>
      (
        fixture.nativeElement.querySelector('#cm-desc') as HTMLInputElement
      ).getAttribute('placeholder');
    expect(segnaposto()).toBe('es. Commissione Grinderlab');

    c.formVoce.patchValue({ verso: 'USCITA' });
    await stabilizza();
    expect(segnaposto()).toBe('es. LiveKit');
    const uscita = opzioni();
    // ⚠️ Il verso anti-test-vacuo, e non è pedanteria: se la modale si
    // chiudesse, `opzioni()` tornerebbe `[]` e il `not.toContain` qui sotto
    // passerebbe senza aver guardato niente. Prima si prova che l'elenco c'è.
    expect(uscita).toContain('Compensi ai coach');
    // ⚠️ Solo entrata: i fondi versati e le perdite vivono nel registro
    // staking, e annotarli anche qui li conterebbe due volte.
    expect(uscita).not.toContain('Staking');
  });

  it('l’etichetta della cassa segue il verso: «pagato» su una spesa, «incassato» su un’entrata', async () => {
    // ⚠️ Difetto uscito in PRODUZIONE il 10/09/2026 e segnalato dall'owner
    // mentre provava: il campo diceva «Chi ha pagato» anche su un'ENTRATA,
    // dove chi ha pagato è l'abbonato — non il socio che ha incassato. È lo
    // stesso difetto del segnaposto «es. LiveKit», sul campo successivo, e per
    // questo la spec sta di seguito a quella.
    await avvia();
    const c = fixture.componentInstance as unknown as {
      apriVoce: (v: unknown) => void;
      formVoce: { patchValue: (v: Record<string, unknown>) => void };
    };
    c.apriVoce('nuova');
    await stabilizza();

    const etichetta = () =>
      fixture.nativeElement
        .querySelector('label[for="cm-cassa"]')
        ?.textContent?.trim();

    // Una voce nasce come SPESA.
    expect(etichetta()).toBe('Chi ha pagato');

    c.formVoce.patchValue({ verso: 'ENTRATA' });
    await stabilizza();
    expect(etichetta()).toBe('Chi ha incassato');

    // ⚠️ E il verso di ritorno: senza, un `computed` che si aggiorna una volta
    // sola passerebbe lo stesso.
    c.formVoce.patchValue({ verso: 'USCITA' });
    await stabilizza();
    expect(etichetta()).toBe('Chi ha pagato');
  });

  it('lo stakato mostra recupero e bonifico come DUE cifre, e registra solo se serve', async () => {
    const riga = (over: Partial<RigaStakato> = {}): RigaStakato => ({
      id: 'rs1',
      stakatoId: 'st1',
      nome: 'Rossana',
      fonteBack: 'CONTO',
      dealScuolaBp: 3500,
      backCent: 23_059,
      trattenutoCent: 2809,
      poolEvCent: -6800,
      diffCent: -700,
      feeCent: -2500,
      altroCent: 100,
      debitoEvCent: 0,
      totaleCent: 13_159,
      quotaScuolaCent: 4606,
      risultatoCent: 1797,
      aRecuperoCent: 0,
      daRegolareCent: 1797,
      registrato: false,
      disallineato: false,
      ...over,
    });

    await avvia(dettaglio([], { stakati: [riga()] }));
    fixture.componentInstance['vista'].set('stakati');
    await stabilizza();

    const testo = () => fixture.nativeElement.textContent as string;
    expect(testo()).toContain('Rossana');
    // Il risultato del mese, la cifra che deve bonificare.
    expect(testo()).toContain('17,97');
    // ⚠️ Senza debito EV non c'è niente da portare sul registro: il comando NON
    // compare. Un pulsante che risponde 400 e' peggio di un pulsante assente.
    const comando = () =>
      [...fixture.nativeElement.querySelectorAll('button.admin-ico')].find(
        (b: HTMLButtonElement) =>
          b.getAttribute('aria-label')?.includes('registro staking'),
      );
    expect(comando()).toBeUndefined();

    // Con un debito, le due cifre sono SEPARATE e il comando compare.
    fixture.componentInstance['dett'].set(
      dettaglio([], {
        stakati: [
          riga({
            debitoEvCent: -700,
            aRecuperoCent: 700,
            daRegolareCent: 1097,
          }),
        ],
      }),
    );
    await stabilizza();
    // ⚠️⚠️ Due numeri e non uno: il registro staking rifiuta un movimento che
    // porti l'EV sopra zero, quindi «7,00 a recupero + 10,97 da bonificare» e'
    // il fatto, non una scomposizione estetica.
    expect(testo()).toContain('7,00');
    expect(testo()).toContain('10,97');
    expect(comando()).toBeDefined();
    // ⚠️ E il comando NOMINA la riga: con un'etichetta fissa sarebbero N
    // pulsanti che annunciano tutti la stessa parola.
    expect(comando()?.getAttribute('aria-label')).toContain('Rossana');
  });

  it('un rimborso al player si vede come tale: pastiglia, rame, e un totale SEPARATO', async () => {
    // ⚠️ Domanda dell'owner (11/09/2026): «puo capitare che sia io a dover
    // mandare soldi al player?». Si — e finche' la cifra usciva col meno in
    // una colonna chiamata «Da bonificare», si leggeva come un refuso.
    const riga = (over: Partial<RigaStakato>): RigaStakato => ({
      id: 'rs1',
      stakatoId: 'st1',
      nome: 'Rossana',
      fonteBack: 'CONTO',
      dealScuolaBp: 3500,
      backCent: 23_059,
      trattenutoCent: 2809,
      poolEvCent: -16_000,
      diffCent: 0,
      feeCent: 0,
      altroCent: 0,
      debitoEvCent: -200,
      totaleCent: 7059,
      quotaScuolaCent: 2471,
      risultatoCent: -338,
      aRecuperoCent: 200,
      daRegolareCent: -138,
      registrato: false,
      disallineato: false,
      ...over,
    });
    await avvia(
      dettaglio([], {
        stakati: [
          riga({}),
          riga({ id: 'rs2', stakatoId: 'st2', nome: 'Altro', poolEvCent: -6800, risultatoCent: 1727, aRecuperoCent: 0, daRegolareCent: 1727 }),
        ],
      }),
    );
    fixture.componentInstance['vista'].set('stakati');
    await stabilizza();

    const el = fixture.nativeElement as HTMLElement;
    const righe = [...el.querySelectorAll('.cm__stakati tbody tr')] as HTMLElement[];
    expect(righe[0].textContent).toContain('Rimborso');
    expect(righe[0].querySelector('.cm__rimborso')?.textContent).toContain('-1,38');
    expect(righe[1].textContent).not.toContain('Rimborso');
    expect(righe[1].querySelector('.cm__rimborso')).toBeNull();

    // ⚠️ Due totali, mai una somma: 17,27 da incassare e 1,38 da restituire
    // sono due bonifici in direzioni opposte, non «15,89 da bonificare».
    const striscia = el.querySelector('.admin-totali')?.textContent ?? '';
    expect(striscia).toContain('Da incassare');
    expect(striscia).toContain('17,27');
    expect(striscia).toContain('Da rimborsare');
    expect(striscia).toContain('1,38');
    expect(striscia).not.toContain('15,89');
    // La compensazione sul registro (+2,00) si registra come ogni movimento.
    expect(
      el.querySelector('button[aria-label="Porta il conteggio di Rossana sul registro staking"]'),
    ).toBeTruthy();
  });

  it('le spese fisse si compilano in blocco: un campo per riga, un solo salvataggio', async () => {
    // ⚠️⚠️ Ha preso il posto della generazione automatica (11/09/2026):
    // l'anagrafica pretendeva un «importo di listino» obbligatorio, ma quello
    // vero cambia ogni mese col cambio del dollaro — quindi il catalogo era
    // inutilizzabile e in produzione era rimasto VUOTO, mentre le stesse
    // cinque spese venivano riscritte a mano una per una.
    const d = dettaglio();
    d.speseFisseDaRegistrare = [
      {
        ricorrenteId: 'r1',
        descrizione: 'GtoWizard',
        categoria: 'INFRASTRUTTURA',
        cassa: 'PIETRO',
        metodo: 'BONIFICO',
        ultimoImportoCent: 13_162,
        ultimoMese: 'agosto 2026',
      },
      {
        ricorrenteId: 'r2',
        descrizione: 'Anthropic',
        categoria: 'INFRASTRUTTURA',
      },
    ];
    await avvia(d);
    fixture.componentInstance['vista'].set('voci');
    await stabilizza();

    const el = fixture.nativeElement as HTMLElement;
    const righe = [...el.querySelectorAll('.cm__fisse tbody tr')] as HTMLElement[];
    expect(righe.length).toBe(2);
    // ⚠️ Il suggerimento è un FATTO — quanto è uscito l'ultima volta — e sta
    // ACCANTO al campo, mai dentro: un importo precompilato si salva senza che
    // nessuno lo guardi.
    expect(righe[0].textContent).toContain('131,62');
    expect(righe[0].textContent).toContain('agosto 2026');
    const campo = righe[0].querySelector('input') as HTMLInputElement;
    expect(campo.value).toBe('');
    // Chi non ha precedenti non ha un numero inventato.
    expect(righe[1].textContent).toContain('—');

    const bottone = () =>
      [...el.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Registra'),
      ) as HTMLButtonElement;
    // Senza niente scritto non si salva niente.
    expect(bottone().disabled).toBeTrue();

    const c = fixture.componentInstance as unknown as {
      scriviFissa: (id: string, v: string) => void;
    };
    c.scriviFissa('r1', '140,05');
    await stabilizza();
    expect(bottone().disabled).toBeFalse();

    bottone().click();
    const req = http.expectOne(`${API}/admin/conteggi/mesi/${d.mese.id}/spese-fisse`);
    expect(req.request.method).toBe('POST');
    // ⚠️ Si mandano SOLO le righe compilate: quella lasciata vuota resta in
    // coda, non diventa una riga da zero euro nel conto economico.
    expect(req.request.body).toEqual({
      righe: [{ ricorrenteId: 'r1', importoCent: 14_005 }],
    });
    const dopo = dettaglio();
    dopo.speseFisseDaRegistrare = [d.speseFisseDaRegistrare[1]];
    req.flush(dopo);
    await stabilizza();
    // Registrata, esce dalla coda.
    expect(el.querySelectorAll('.cm__fisse tbody tr').length).toBe(1);
  });

  it('un importo illeggibile fra le spese fisse NOMINA la riga e non parte', async () => {
    const d = dettaglio();
    d.speseFisseDaRegistrare = [
      { ricorrenteId: 'r1', descrizione: 'GtoWizard', categoria: 'INFRASTRUTTURA' },
    ];
    await avvia(d);
    fixture.componentInstance['vista'].set('voci');
    await stabilizza();

    const c = fixture.componentInstance as unknown as {
      scriviFissa: (id: string, v: string) => void;
      registraSpeseFisse: () => void;
    };
    c.scriviFissa('r1', 'cento euro');
    await stabilizza();
    c.registraSpeseFisse();
    http.expectNone(`${API}/admin/conteggi/mesi/${d.mese.id}/spese-fisse`);
    // ⚠️ In zoneless il DOM non si aggiorna da sé dopo una chiamata diretta.
    await stabilizza();
    const banda = (fixture.nativeElement as HTMLElement).querySelector(
      '.form-feedback.is-error',
    );
    // ⚠️ Nomina la riga rotta, e sta ACCANTO al pulsante: la banda di `error()`
    // offre «Riprova», che ricaricherebbe buttando via tutto il digitato.
    expect(banda?.textContent).toContain('GtoWizard');
  });

  it('la chiusura NOMINA le spese fisse non registrate, e non blocca', async () => {
    const d = dettaglio();
    d.speseFisseDaRegistrare = [
      { ricorrenteId: 'r1', descrizione: 'GtoWizard', categoria: 'INFRASTRUTTURA' },
      { ricorrenteId: 'r2', descrizione: 'bunny.net', categoria: 'INFRASTRUTTURA' },
    ];
    await avvia(d);
    await stabilizza();
    const testo = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(testo).toContain('2 spese fisse non sono ancora');
    expect(testo).toContain('GtoWizard, bunny.net');
    // ⚠️ Avviso e non blocco: il pulsante di chiusura resta premibile.
    const chiudi = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ].find((b) => b.textContent?.includes('Chiudi il mese')) as HTMLButtonElement;
    expect(chiudi?.disabled).toBeFalsy();
  });

  it('«A chi» segue il VERSO: fornitore su una spesa, «da chi» su un’entrata', async () => {
    // ⚠️ Rilievo dell'owner (11/09/2026): «non so a cosa si riferisce». È la
    // terza volta che in questa modale una parola fissa risulta falsa su metà
    // dei casi, dopo il segnaposto della descrizione e l'etichetta della cassa.
    await avvia();
    const c = fixture.componentInstance as unknown as {
      apriVoce: (v: unknown) => void;
      formVoce: { patchValue: (v: Record<string, unknown>) => void };
    };
    c.apriVoce('nuova');
    await stabilizza();
    const etichetta = () =>
      (fixture.nativeElement as HTMLElement)
        .querySelector('label[for="cm-contro"]')
        ?.textContent?.trim();
    expect(etichetta()).toBe('Fornitore');

    c.formVoce.patchValue({ verso: 'ENTRATA' });
    await stabilizza();
    expect(etichetta()).toBe('Da chi');
  });

  it('«di cui dai conteggi» compare solo quando c’è', async () => {
    await avvia();
    // ⚠️ La riga Staking somma DUE strade: i conteggi e le voci a mano. Vederle
    // separate e' l'unico modo di accorgersi di una cifra inserita due volte.
    expect(fixture.nativeElement.textContent).not.toContain(
      'di cui dai conteggi',
    );

    const d = dettaglio();
    d.riepilogo.entrate.stakingDaConteggiCent = 1797;
    d.riepilogo.entrate.stakingCent = 1797;
    fixture.componentInstance['dett'].set(d);
    await stabilizza();
    expect(fixture.nativeElement.textContent).toContain('di cui dai conteggi');
  });

  it('il conguaglio coi giocatori sta nel conto economico, col segno', async () => {
    // ⚠️ Fino all'11/09/2026 la differenza fra quello che si doveva e quello
    // che si è pagato non compariva in NESSUNA riga: né costo, né margine, né
    // partita di giro. Misurati ~6,64 €/mese sul foglio reale.
    const d = dettaglio();
    d.riepilogo.conguaglioGiocatoriCent = -664;
    await avvia(d);

    const testo = fixture.nativeElement.textContent as string;
    expect(testo).toContain('Conguaglio coi giocatori');
    expect(testo).toContain('6,64');

    // ⚠️ Si mostra ANCHE a zero: è una riga del conto economico, non una coda
    // di lavoro. Una voce che compare solo quando è diversa da zero fa sembrare
    // nuovo un meccanismo che c'è sempre stato.
    const z = dettaglio();
    z.riepilogo.conguaglioGiocatoriCent = 0;
    fixture.componentInstance['dett'].set(z);
    await stabilizza();
    expect(fixture.nativeElement.textContent).toContain(
      'Conguaglio coi giocatori',
    );
  });

  it('la scheda Soci carica il saldo ENTRANDO, e un versamento lo ricarica', async () => {
    await avvia();
    // ⚠️ Nessuna lettura finché non si entra nella scheda: chi apre il pannello
    // per scrivere il rake non paga il calcolo su tutti i mesi chiusi.
    http.expectNone(`${API}/admin/conteggi/soci`);

    // La scheda NON porta un conteggio: un saldo a oggi non è un elenco.
    expect(scheda('Soci').textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Soci',
    );

    await vaiA('Soci');
    http.expectOne(`${API}/admin/conteggi/soci`).flush(
      saldi({
        exivezzz: {
          maturatoCent: 20_000,
          cassaCent: 35_000,
          daAgenteCent: 0,
          daiGiocatoriCent: 0,
          capitaleAnticipatoCent: 0,
          capitaleRientratoCent: 0,
          capitaleResiduoCent: 0,
          ricevutiCent: 0,
          datiCent: 0,
          saldoCent: -15_000,
          compensoNonRitiratoCent: -15_000,
        },
        creditoNonRiscossoCent: 0,
      }),
    );
    await stabilizza();

    const el = fixture.nativeElement as HTMLElement;
    const testo = el.textContent ?? '';
    expect(testo).toContain('Credito non riscosso');
    // 15.000 + (−15.000): la scuola non deve niente ai due INSIEME — il
    // denaro è passato dalla tasca sbagliata, e il conguaglio è fra loro.
    expect(testo).toContain('0,00');
    // ⚠️ Solo i mesi CHIUSI entrano nel saldo, e la striscia lo dice.
    expect(testo).toContain('su 2 mesi chiusi');

    const righe = [...el.querySelectorAll('.cm__soci tbody tr')] as HTMLElement[];
    expect(righe.length).toBe(2);
    expect(righe[0].textContent).toContain('Pietro');
    expect(righe[0].querySelector('.is-perdita')).toBeNull();
    // Il saldo NEGATIVO (ha in mano più di quanto gli spetti) si vede.
    expect(righe[1].textContent).toContain('Exivezzz');
    expect(righe[1].querySelector('.is-perdita')?.textContent).toContain(
      '-150,00',
    );

    // Il mese aperto è provvisorio e FUORI dal saldo.
    expect(testo).toContain('provvisorio, fuori dal saldo');
    // Il registro elenca il versamento con le due tasche.
    const vers = el.querySelector('.cm__versamenti tbody tr') as HTMLElement;
    expect(vers.textContent).toContain('Fuori');
    expect(vers.textContent).toContain('Pietro');
    expect(vers.textContent).toContain('300,00');

    // ── Un versamento nuovo ─────────────────────────────────────────────
    const c = fixture.componentInstance;
    c['apriVersamento']();
    await stabilizza();
    expect(el.querySelector('dialog .admin-modale')).toBeTruthy();
    // ⚠️ Appena aperta NON è sporca: Escape non deve chiedere conferma.
    expect(c['versamentoSporco']()).toBeFalse();
    // Precompilata con OGGI (iOS: un date vuoto è un rettangolino muto).
    expect(c['formVersamento'].getRawValue().data).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    c['formVersamento'].patchValue({
      data: '2026-09-20',
      da: 'PIETRO',
      a: 'EXIVEZZZ',
      importo: '120,50',
      nota: ' conguaglio agosto ',
    });
    await stabilizza();
    expect(c['versamentoSporco']()).toBeTrue();

    c['salvaVersamento']();
    const req = http.expectOne(`${API}/admin/conteggi/versamenti`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      // ⚠️ Mezzogiorno UTC: una data-solo a mezzanotte di Roma è il giorno
      // prima in UTC per metà dell'anno, e il registro ordina per data.
      data: '2026-09-20T12:00:00.000Z',
      da: 'PIETRO',
      a: 'EXIVEZZZ',
      importoCent: 12_050,
      nota: 'conguaglio agosto',
    });
    req.flush({
      id: 'v2',
      data: '2026-09-20T12:00:00.000Z',
      da: 'PIETRO',
      a: 'EXIVEZZZ',
      importoCent: 12_050,
      nota: 'conguaglio agosto',
    });
    await stabilizza();
    // La modale si chiude e il saldo si RILEGGE: righe e saldi da una lettura sola.
    expect(el.querySelector('dialog')).toBeNull();
    http.expectOne(`${API}/admin/conteggi/soci`).flush(saldi());
    await stabilizza();
  });

  it('il prestito e il compenso sono DUE voci, e la restituzione non finisce sul compenso', async () => {
    // ⚠️⚠️ LA REGRESSIONE CHE QUESTO CASO SORVEGLIA, vista in produzione il
    // 12/09/2026: `compensoNonRitiratoCent` si misurava sull'anticipato LORDO,
    // quindi un socio già ripagato in parte leggeva «2.799,00 di roll prestati
    // · −974,92 di compenso non ritirato». Il totale tornava e la riga era
    // incomprensibile: la restituzione del prestito era stampata come un
    // compenso NEGATIVO, cioè su una riga che parla d'altro.
    await avvia();
    await vaiA('Soci');
    http.expectOne(`${API}/admin/conteggi/soci`).flush(
      saldi({
        pietro: {
          maturatoCent: 0,
          // Il capitale sta DENTRO la cassa, col segno meno.
          cassaCent: -279_900,
          daAgenteCent: 0,
          daiGiocatoriCent: 0,
          capitaleAnticipatoCent: 279_900,
          capitaleRientratoCent: 97_492,
          capitaleResiduoCent: 182_408,
          ricevutiCent: 97_492,
          datiCent: 0,
          saldoCent: 182_408,
          // ⚠️ ZERO, non −974,92: non ha maturato compenso, gli è rientrato
          // del prestito. Col difetto questo campo valeva −97_492.
          compensoNonRitiratoCent: 0,
        },
        creditoNonRiscossoCent: 182_408,
        capitalePressoIGiocatoriCent: 279_900,
        versamenti: [
          {
            id: 'v1',
            data: '2026-07-31T12:00:00.000Z',
            da: 'ESTERNO',
            a: 'PIETRO',
            importoCent: 97_492,
            restituzioneCapitale: true,
            nota: 'rientro dai profitti dei mesi precedenti',
          },
        ],
      }),
    );
    await stabilizza();

    const el = fixture.nativeElement as HTMLElement;
    const prospetto = el.querySelector('.cm__credito') as HTMLElement;
    expect(prospetto).withContext('il prospetto del credito esiste').toBeTruthy();
    const righe = prospetto.textContent?.replace(/\s+/g, ' ') ?? '';

    // Le tre voci del prestito, ognuna con la propria etichetta in chiaro.
    expect(righe).toContain('Roll anticipati di tasca sua');
    // ⚠️ Il separatore delle migliaia è FACOLTATIVO nell'asserzione: il Chrome
    // di Karma rende «2799,00 €» dove un browser vero scrive «2.799,00 €»
    // (dati ICU ridotti), e pinnare il punto farebbe fallire qui una
    // formattazione corretta in produzione. Le cifre restano pinnate.
    expect(righe).toMatch(/2\.?799,00/);
    expect(righe).toContain('di cui già restituiti');
    // ⚠️ Col SEGNO: è una sottrazione, e senza il meno le tre cifre non
    // tornano a occhio — che è l'unica cosa per cui un prospetto si guarda.
    expect(righe).toContain('-974,92');
    expect(righe).toContain('Prestito ancora da rientrare');
    expect(righe).toMatch(/1\.?824,08/);
    expect(righe).toContain('Compenso maturato e non ancora ritirato');

    // ⚠️⚠️ L'ASSERZIONE CHE CONTA: nel prospetto non c'è un solo numero in
    // rosso. Col difetto la riga del compenso portava `-974,92` e `.is-perdita`.
    expect(prospetto.querySelector('.is-perdita'))
      .withContext('ripagare un prestito non è una perdita')
      .toBeNull();

    // E la vecchia riga criptica non è tornata nella cella della tabella.
    const rigaTabella = el.querySelector('.cm__soci tbody tr') as HTMLElement;
    expect(rigaTabella.textContent).not.toContain('di roll prestati');

    // Il registro DICE quali versamenti scalano il prestito: due bonifici
    // identici si distinguono solo da lì.
    const vers = el.querySelector('.cm__versamenti tbody tr') as HTMLElement;
    expect(vers.textContent).toContain('restituisce capitale');

    // E la schermata spiega come rientra, distinguendo le due strade.
    const tutto = el.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(tutto).toContain('Come rientra');
    expect(tutto).toContain('Il compenso rientra incassando');
    expect(tutto).toContain('Il prestito rientra in due modi');
  });

  it('la spunta «restituisce capitale» viaggia solo quando è accesa', async () => {
    // ⚠️ Omessa e non `false`: il DTO la dichiara facoltativa, e un `false`
    // scritto su ogni riga direbbe che qualcuno ha deciso.
    await avvia();
    await vaiA('Soci');
    http.expectOne(`${API}/admin/conteggi/soci`).flush(saldi());
    await stabilizza();

    const c = fixture.componentInstance;
    c['apriVersamento']();
    await stabilizza();
    c['formVersamento'].patchValue({
      data: '2026-07-31',
      da: 'ESTERNO',
      a: 'PIETRO',
      importo: '974,92',
      restituzioneCapitale: true,
    });
    await stabilizza();
    // ⚠️ La spunta SPORCA la modale: sta nel form, non in un signal a parte,
    // o Escape butterebbe via la scelta senza chiedere.
    expect(c['versamentoSporco']()).toBeTrue();

    c['salvaVersamento']();
    const req = http.expectOne(`${API}/admin/conteggi/versamenti`);
    expect(req.request.body.restituzioneCapitale).toBeTrue();
    req.flush({
      id: 'v9',
      data: '2026-07-31T12:00:00.000Z',
      da: 'ESTERNO',
      a: 'PIETRO',
      importoCent: 97_492,
      restituzioneCapitale: true,
    });
    await stabilizza();
    http.expectOne(`${API}/admin/conteggi/soci`).flush(saldi());
    await stabilizza();

    // Senza spunta la chiave non parte affatto.
    c['apriVersamento']();
    await stabilizza();
    c['formVersamento'].patchValue({
      data: '2026-08-01',
      da: 'ESTERNO',
      a: 'PIETRO',
      importo: '50',
    });
    c['salvaVersamento']();
    const req2 = http.expectOne(`${API}/admin/conteggi/versamenti`);
    expect('restituzioneCapitale' in req2.request.body).toBeFalse();
    req2.flush({
      id: 'v10',
      data: '2026-08-01T12:00:00.000Z',
      da: 'ESTERNO',
      a: 'PIETRO',
      importoCent: 5_000,
    });
    await stabilizza();
    http.expectOne(`${API}/admin/conteggi/soci`).flush(saldi());
    await stabilizza();
  });

  it('partenza e arrivo uguali NON partono, e la rimozione passa dalla conferma in linea', async () => {
    await avvia();
    await vaiA('Soci');
    http.expectOne(`${API}/admin/conteggi/soci`).flush(saldi());
    await stabilizza();

    const c = fixture.componentInstance;
    c['apriVersamento']();
    await stabilizza();
    c['formVersamento'].patchValue({ da: 'PIETRO', a: 'PIETRO', importo: '10' });
    c['salvaVersamento']();
    http.expectNone(`${API}/admin/conteggi/versamenti`);
    expect(c['erroreModale']()).toContain('coincidono');
    c['versamentoAperto'].set(false);
    await stabilizza();

    // ⚠️ L'unica azione irreversibile della scheda: mai al primo tocco.
    const el = fixture.nativeElement as HTMLElement;
    const rimuovi = el.querySelector(
      'button[aria-label^="Rimuovi il versamento"]',
    ) as HTMLButtonElement;
    expect(rimuovi).toBeTruthy();
    rimuovi.click();
    await stabilizza();
    http.expectNone(`${API}/admin/conteggi/versamenti/v1`);
    const conferma = [...el.querySelectorAll('.cm__versamenti button')].find(
      (b) => b.textContent?.trim() === 'Rimuovi',
    ) as HTMLButtonElement;
    expect(conferma).toBeTruthy();
    conferma.click();
    const del = http.expectOne(`${API}/admin/conteggi/versamenti/v1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
    await stabilizza();
    http.expectOne(`${API}/admin/conteggi/soci`).flush(saldi({ versamenti: [] }));
    await stabilizza();
    expect(el.textContent).toContain('Nessun versamento registrato');
  });

  it('la chiusura AVVISA se restano righe senza pagamento, e non blocca', async () => {
    const d = dettaglio();
    d.riepilogo.cassaGiocatori.righeSenzaPagamento = 2;
    d.riepilogo.cassaGiocatori.senzaPagamentoCent = 81_240;
    await avvia(d);

    const testo = () => fixture.nativeElement.textContent as string;
    // ⚠️ NOMINA la cifra: il conguaglio conta quelle righe come trattenute,
    // quindi chiudere adesso gonfia il margine di esattamente quel numero.
    expect(testo()).toContain('812,40');
    // ⚠️ E il pulsante resta premibile: è un avviso, non un blocco.
    const chiudi = [
      ...fixture.nativeElement.querySelectorAll('button'),
    ].find((b: HTMLButtonElement) => b.textContent?.includes('Chiudi il mese'));
    expect(chiudi).toBeDefined();
    expect((chiudi as HTMLButtonElement).disabled).toBeFalse();
  });

  it('una riga «dal conto» mostra il rake LETTO, e a zero lo segnala', async () => {
    // ⚠️ Qui si stampava solo «dal conto» e nessuna cifra: con la scheda
    // Rakeback del mese vuota la back usciva 0,00 € e non c'era modo di capire
    // perché. Rilevato dall'owner in produzione su agosto 2026.
    const st = (over: Partial<RigaStakato> = {}): RigaStakato => ({
      id: 'rs1',
      stakatoId: 'st1',
      nome: 'Rossana',
      fonteBack: 'CONTO',
      dealScuolaBp: 3500,
      backCent: 0,
      trattenutoCent: 0,
      poolEvCent: -6800,
      diffCent: -700,
      feeCent: -2500,
      altroCent: 100,
      debitoEvCent: 0,
      totaleCent: -10_100,
      quotaScuolaCent: -3535,
      risultatoCent: -3535,
      aRecuperoCent: -3535,
      daRegolareCent: 0,
      registrato: false,
      disallineato: false,
      ...over,
    });

    const testo = () => fixture.nativeElement.textContent as string;

    // (1) Rake letto davvero: la cifra si vede, il conto è NOMINATO, e non
    // c'è alcun avviso.
    await avvia(
      dettaglio([], {
        stakati: [st({ rakeLettoCent: 46_117, contoUsername: 'MadRoxKO' })],
      }),
    );
    fixture.componentInstance['vista'].set('stakati');
    await stabilizza();
    expect(testo()).toContain('461,17');
    expect(testo()).toContain('dal conto MadRoxKO');
    expect(testo()).not.toContain('il rake letto dalla scheda Rakeback');
    expect(testo()).not.toContain('la back non si può leggere');

    // (2) Rake a zero: si corregge SCRIVENDO il rake.
    fixture.componentInstance['dett'].set(
      dettaglio([], { stakati: [st({ rakeLettoCent: 0 })] }),
    );
    await stabilizza();
    expect(testo()).toContain('il rake letto dalla scheda Rakeback');
    expect(testo()).toContain('Rossana');
    expect(testo()).not.toContain('la back non si può leggere');

    // ⚠️⚠️ (3) e (4) sono cause DIVERSE con rimedi diversi, e l'avviso deve
    // essere l'altro: qui non c'è niente da scrivere nella scheda Rakeback.
    // Confonderli manda a fare la cosa sbagliata due volte su tre.
    for (const caso of [{ contoFuoriMese: true }, { contoNonCollegato: true }]) {
      fixture.componentInstance['dett'].set(
        dettaglio([], { stakati: [st(caso)] }),
      );
      await stabilizza();
      expect(testo()).toContain('la back non si può leggere');
      expect(testo()).not.toContain('il rake letto dalla scheda Rakeback');
    }
  });

  it('lo stakato in anagrafica si RIMUOVE, e il 409 resta nella modale', async () => {
    // ⚠️ Era l'unica delle cinque anagrafiche del modulo senza rimozione:
    // voci, ricorrenti e conti ce l'hanno da sempre, e uno stakato creato per
    // prova restava in elenco per sempre.
    await avvia();
    const st: Stakato = {
      id: 'st1',
      nome: 'Prova',
      userId: null,
      dealScuolaBp: 3500,
      fonteBack: 'CONTO',
      contoId: 'c1',
      attivo: true,
      ordine: 100,
      anonimizzato: false,
    };
    fixture.componentInstance['stakatoAperto'].set(st);
    await stabilizza();

    const bottone = (t: string) =>
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim() === t,
      ) as HTMLButtonElement | undefined;

    // ⚠️ Passa da una conferma in linea: è l'unica azione irreversibile
    // dell'anagrafica, e il `confirm()` nativo qui non si usa.
    expect(bottone('Rimuovi davvero')).toBeUndefined();
    bottone('Rimuovi questo giocatore')!.click();
    await stabilizza();
    bottone('Rimuovi davvero')!.click();
    await stabilizza();

    const req = http.expectOne(`${API}/admin/conteggi/stakati/st1`);
    expect(req.request.method).toBe('DELETE');

    // ⚠️⚠️ Il 409 del server NOMINA i mesi in cui il giocatore compare, ed è
    // l'informazione che serve: deve restare LEGGIBILE. Con una modale aperta
    // un toast dipinge dietro il fondale e non lo vede nessuno.
    req.flush(
      { message: 'Questo giocatore compare in 2 mesi già registrati.' },
      { status: 409, statusText: 'Conflict' },
    );
    await stabilizza();
    expect(fixture.nativeElement.textContent).toContain('compare in 2 mesi');
    // ⚠️ La modale resta APERTA (è lì che si legge il motivo) ma la conferma si
    // DISARMA: quel 409 non cambia riprovando, e lasciare «Rimuovi davvero»
    // sotto il dito invita una pressione che non può che fallire.
    expect(bottone('Rimuovi questo giocatore')).toBeDefined();
    expect(bottone('Rimuovi davvero')).toBeUndefined();
  });

  it('la modale di un nuovo stakato NON offre la rimozione', async () => {
    // ⚠️ Un «Rimuovi» su una riga che non esiste ancora è un comando che non
    // può funzionare: stessa regola già scritta per il conto.
    await avvia();
    fixture.componentInstance['stakatoAperto'].set('nuovo');
    await stabilizza();
    expect(fixture.nativeElement.textContent).not.toContain(
      'Rimuovi questo giocatore',
    );
  });

  it('«i ticket li paga l’agente»: la spunta arriva al server e la riga non chiede un pagato', async () => {
    // ⚠️ Il caso di TroviComodo (11/09/2026): 1% sul rake, ticket sbrigati
    // dall'agente. Senza il flag il ticket finiva fra i «non pagati» e
    // gonfiava il margine personale; qui si pinna che la riga non abbia il
    // campo «Pagato» e che «Da incassare» sia il solo margine.
    const conto: ContoRakeback = {
      id: 'c1',
      agente: 'LOTTOMATICA',
      username: 'TroviComodo',
      userId: null,
      backAgenteBp: 5600,
      backPlayerBp: 5500,
      scaglioneBaseBp: 4500,
      scaglionePassoCent: 2250,
      destinazione: 'PERSONALE',
      stakato: false,
      attivo: true,
      ordine: 100,
      anonimizzato: false,
    };
    await avvia(
      dettaglio([
        riga({
          contoId: 'c1',
          username: 'TroviComodo',
          ticketDallAgente: true,
          spettanteDaAgenteCent: 25_799,
          spettanteAlPlayerCent: 23_531,
          profittoAgenteCent: 2268,
        }),
      ]),
      [conto],
    );
    fixture.componentInstance['vista'].set('rakeback');
    await stabilizza();
    const el = fixture.nativeElement as HTMLElement;
    const r = el.querySelector('.cm__rakeback tbody tr') as HTMLElement;
    expect(r.textContent).toContain('Ticket dall\'agente');
    // Niente campo «Pagato» sulla riga, e da incassare il solo margine.
    expect(r.querySelector('input[id^="pag-"]')).toBeNull();
    expect(r.querySelector('[data-etichetta="Da incassare"]')?.textContent).toContain('22,68');

    fixture.componentInstance['apriConto'](conto);
    await stabilizza();
    fixture.componentInstance['formConto'].controls.ticketDallAgente.setValue(true);
    fixture.componentInstance['salvaConto']();
    await stabilizza();
    const req = http.expectOne(`${API}/admin/conteggi/conti/c1`);
    expect(req.request.body.ticketDallAgente).toBeTrue();
    req.flush({ ...conto, ticketDallAgente: true });
    await stabilizza();
    flushAnagrafiche();
  });

  it('la spunta «Stakato» del conto arriva DAVVERO al server', async () => {
    // ⚠️⚠️ Il flag esisteva su schema e DTO dal 10/09/2026 e nel form NO: dal
    // pannello nessun conto poteva essere marcato stakato, quindi il conto
    // economico perdeva il ticket trattenuto su ognuno di loro. Stessa forma
    // del difetto dei contanti — completo lato server, muto lato interfaccia.
    const conto: ContoRakeback = {
      id: 'c1',
      agente: 'LOTTOMATICA',
      username: 'MadRoxKO',
      userId: null,
      backAgenteBp: 5700,
      backPlayerBp: 5000,
      scaglioneBaseBp: 4500,
      scaglionePassoCent: 2250,
      destinazione: 'SCUOLA',
      stakato: false,
      attivo: true,
      ordine: 100,
      anonimizzato: false,
    };
    await avvia(dettaglio(), [conto]);
    fixture.componentInstance['apriConto'](conto);
    await stabilizza();

    fixture.componentInstance['formConto'].controls.stakato.setValue(true);
    fixture.componentInstance['salvaConto']();
    await stabilizza();

    const req = http.expectOne(`${API}/admin/conteggi/conti/c1`);
    expect(req.request.body.stakato).toBeTrue();
    req.flush({ ...conto, stakato: true });
    await stabilizza();
    flushAnagrafiche();
  });

  it('collegare un account lo mostra e lo manda, scollegarlo lo toglie', async () => {
    const conto: ContoRakeback = {
      id: 'c1',
      agente: 'LOTTOMATICA',
      username: 'MadRoxKO',
      userId: null,
      backAgenteBp: 5700,
      backPlayerBp: 5000,
      scaglioneBaseBp: 4500,
      scaglionePassoCent: 2250,
      destinazione: 'SCUOLA',
      stakato: false,
      attivo: true,
      ordine: 100,
      anonimizzato: false,
    };
    await avvia(dettaglio(), [conto]);
    fixture.componentInstance['apriConto'](conto);
    await stabilizza();

    fixture.componentInstance['collegaUtente']({
      id: 'u1',
      nickname: 'MadRoxKO',
      email: 'rossana@example.it',
    } as AdminUser);
    await stabilizza();
    // L'etichetta nomina la persona: nickname se c'è, email sempre.
    expect(fixture.nativeElement.textContent).toContain('rossana@example.it');

    fixture.componentInstance['salvaConto']();
    await stabilizza();
    let req = http.expectOne(`${API}/admin/conteggi/conti/c1`);
    expect(req.request.body.userId).toBe('u1');
    req.flush(conto);
    await stabilizza();
    flushAnagrafiche();
    await stabilizza();

    // ⚠️ Scollegare OMETTE la chiave, non manda la stringa vuota: il DTO ha
    // `@IsMongoId()` e '' sarebbe un 400 sull'INTERA chiamata.
    fixture.componentInstance['apriConto'](conto);
    await stabilizza();
    fixture.componentInstance['collegaUtente']({
      id: 'u1',
      nickname: 'MadRoxKO',
      email: 'rossana@example.it',
    } as AdminUser);
    fixture.componentInstance['scollegaUtente']();
    fixture.componentInstance['salvaConto']();
    await stabilizza();
    req = http.expectOne(`${API}/admin/conteggi/conti/c1`);
    expect('userId' in req.request.body).toBeFalse();
    req.flush(conto);
    await stabilizza();
    flushAnagrafiche();
  });

  it('collegare un account SPORCA la modale', async () => {
    // ⚠️ `sporco` si costruisce da `valueChanges`, quindi il collegamento deve
    // stare NEL form: tenuto in un signal a parte, Escape butterebbe via il
    // collegamento senza chiedere niente — il difetto che quell'input esiste
    // per prevenire.
    const conto: ContoRakeback = {
      id: 'c1',
      agente: 'LOTTOMATICA',
      username: 'MadRoxKO',
      userId: null,
      backAgenteBp: 5700,
      backPlayerBp: 5000,
      scaglioneBaseBp: 4500,
      scaglionePassoCent: 2250,
      destinazione: 'SCUOLA',
      stakato: false,
      attivo: true,
      ordine: 100,
      anonimizzato: false,
    };
    await avvia(dettaglio(), [conto]);
    fixture.componentInstance['apriConto'](conto);
    await stabilizza();
    expect(fixture.componentInstance['contoSporco']()).toBeFalse();

    fixture.componentInstance['collegaUtente']({
      id: 'u1',
      email: 'rossana@example.it',
    } as AdminUser);
    await stabilizza();
    expect(fixture.componentInstance['contoSporco']()).toBeTrue();
  });

  it('i punti: anteprima PRIMA della conferma, esclusi visibili, e un solo accredito', async () => {
    await avvia();
    fixture.componentInstance['apriPunti']();
    await stabilizza();

    const anteprima: AnteprimaPunti = {
      righe: [
        {
          contoId: 'c1',
          username: 'MadRoxKO',
          utente: { id: 'u1', nickname: 'MadRoxKO', email: 'r@x.it' },
          margineCent: 3228,
          punti: 16_140,
          disallineato: false,
        },
        {
          contoId: 'c2',
          username: 'Senza',
          margineCent: 3228,
          punti: 16_140,
          disallineato: false,
          motivoEsclusione:
            'Non collegato a un account del sito: collegalo da Anagrafiche.',
        },
      ],
      totalePunti: 16_140,
      daAccreditare: 1,
      provvisorio: true,
    };
    http
      .expectOne(`${API}/admin/conteggi/mesi/m1/punti`)
      .flush(anteprima);
    await stabilizza();

    const testo = () => fixture.nativeElement.textContent as string;
    // ⚠️ La formula è scritta per esteso PRIMA di poter confermare: è una
    // garanzia del test di compatibilità dell'art. 6.4, non una didascalia.
    expect(testo()).toContain('1.000 punti ogni 2');
    expect(testo()).toContain('16.140');
    // ⚠️ La riga esclusa RESTA, col motivo: una che sparisce fa cercare un guasto.
    expect(testo()).toContain('Senza');
    expect(testo()).toContain('collegalo da Anagrafiche');
    // ⚠️ Il mese aperto è dichiarato.
    expect(testo()).toContain('ancora');

    const bottone = (t: string) =>
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim().startsWith(t),
      ) as HTMLButtonElement | undefined;

    // ⚠️ Passa da una conferma: i punti, una volta dati, non si tolgono da qui.
    expect(bottone('Accredita davvero')).toBeUndefined();
    bottone('Accredita 16.140')!.click();
    await stabilizza();
    bottone('Accredita davvero')!.click();
    await stabilizza();

    const req = http.expectOne(`${API}/admin/conteggi/mesi/m1/punti`);
    expect(req.request.method).toBe('POST');
    req.flush({
      ...anteprima,
      righe: [
        { ...anteprima.righe[0], giaAccreditati: 16_140 },
        anteprima.righe[1],
      ],
      totalePunti: 0,
      daAccreditare: 0,
    });
    await stabilizza();

    // ⚠️ La modale RESTA aperta: l'esito è la tabella che c'è dentro, e un
    // toast con un `<dialog>` aperto dipinge dietro il fondale.
    expect(testo()).toContain('già accreditati');
    expect(testo()).toContain('Niente da accreditare');
    expect(bottone('Accredita davvero')).toBeUndefined();
  });

  it('il mese scelto SOPRAVVIVE al cambio di scheda', async () => {
    // ⚠️⚠️ Difetto trovato dall'owner in produzione l'11/09/2026: scelto agosto
    // dalla tendina e cambiata scheda, tornando indietro il selettore diceva
    // «settembre» mentre i dati mostrati erano ancora quelli di agosto — la
    // tendina MENTIVA sul mese che si stava guardando.
    //
    // La causa: `[value]` su un `<select>` le cui `<option>` nascono da un
    // `@for`. Il binding si applica quando le opzioni NON ESISTONO ANCORA, il
    // browser ripiega sulla prima e la scelta si perde. È invisibile finché il
    // mese scelto È il primo dell'elenco, cioè nello stato predefinito: per
    // questo la sezione è stata in produzione un giorno senza che si vedesse.
    const settembre = mese();
    const agosto = mese({ id: 'm0', mese: 8, etichetta: 'agosto 2026' });

    await stabilizza();
    // L'elenco ha il più recente PER PRIMO, come in produzione.
    http
      .expectOne(`${API}/admin/conteggi/mesi`)
      .flush([settembre, agosto]);
    http.expectOne(`${API}/admin/conteggi/conti`).flush([]);
    http.expectOne(`${API}/admin/conteggi/ricorrenti`).flush([]);
    http.expectOne(`${API}/admin/conteggi/stakati`).flush([]);
    await stabilizza();
    http
      .expectOne(`${API}/admin/conteggi/mesi/${settembre.id}`)
      .flush(dettaglio());
    await stabilizza();

    // Si sceglie AGOSTO, cioè il secondo dell'elenco.
    fixture.componentInstance['scegliMese']('m0');
    await stabilizza();
    http
      .expectOne(`${API}/admin/conteggi/mesi/m0`)
      .flush(dettaglio([], { mese: agosto }));
    await stabilizza();

    const tendina = () =>
      fixture.nativeElement.querySelector(
        'select[aria-label="Mese contabile"]',
      ) as HTMLSelectElement;
    expect(tendina().value).toBe('m0');

    // ⚠️ Si passa da ANAGRAFICHE, e il percorso non è indifferente: la barra
    // del mese vive sotto `@if (vista() !== 'anagrafiche')`, quindi fra le
    // quattro schede legate al mese NON viene ricreata e il difetto non si
    // vede. È l'unica scheda che la distrugge — e provando con «rakeback» in
    // mezzo questa spec passava su un difetto vivo.
    fixture.componentInstance['vista'].set('anagrafiche');
    await stabilizza();
    fixture.componentInstance['vista'].set('riepilogo');
    await stabilizza();

    expect(fixture.componentInstance['mese']()?.id).toBe('m0');
    // ⚠️ L'asserzione che coglie il difetto: il DOM, non il signal. Il signal
    // era GIÀ giusto — a mentire era la tendina.
    expect(tendina().value).toBe('m0');
    expect(tendina().selectedOptions[0]?.textContent?.trim()).toBe(
      'agosto 2026',
    );
  });

  it('un conto dell’anagrafica fuori dal mese si vede ANCHE con la tabella piena', async () => {
    // ⚠️⚠️ L'owner e' rimasto bloccato su questo (11/09/2026): aveva creato i
    // conti in Anagrafiche e la schermata Rakeback non gli diceva in alcun modo
    // come portarli nel mese, perche' quell'istruzione viveva SOLO nel ramo
    // «tabella vuota» — e la sua tabella una riga ce l'aveva.
    const conto = (id: string, username: string): ContoRakeback => ({
      id,
      agente: 'LOTTOMATICA',
      username,
      userId: null,
      backAgenteBp: 5700,
      backPlayerBp: 3000,
      scaglioneBaseBp: 4500,
      scaglionePassoCent: 2250,
      destinazione: 'SCUOLA',
      stakato: false,
      attivo: true,
      ordine: 100,
      anonimizzato: false,
    });

    // `riga()` ha `contoId: 'c1'`: c2 e c3 sono in anagrafica e NON nel mese.
    await avvia(dettaglio(), [
      conto('c1', 'Santotti88'),
      conto('c2', 'Kondom91'),
      conto('c3', '306Win'),
      { ...conto('c4', 'Dismesso'), attivo: false },
    ]);
    fixture.componentInstance['vista'].set('rakeback');
    await stabilizza();

    const testo = fixture.nativeElement.textContent as string;
    // La tabella NON e' vuota: e' il caso in cui l'avviso mancava del tutto.
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length)
      .toBeGreaterThan(0);
    expect(testo).toContain('2 conti dell');
    // ⚠️ Nomina CHI: «sincronizza» da solo non dice che cosa entrera'.
    expect(testo).toContain('Kondom91');
    expect(testo).toContain('306Win');
    // ⚠️ Un conto DISATTIVATO non va proposto: la sincronizzazione non lo
    // porterebbe comunque, e offrirlo e' promettere un'azione che non avviene.
    expect(testo).not.toContain('Dismesso');
  });

  it('a mese CHIUSO l’avviso non compare: non c’è niente da sincronizzare', async () => {
    // ⚠️ Il verso che nega: `sincronizzaMese` passa da `caricaMeseAperto`,
    // quindi su un mese chiuso il comando risponderebbe 409. Offrirlo sarebbe
    // un pulsante che porta a un errore.
    await avvia(dettaglio([], { mese: mese({ stato: 'CHIUSO' }) }), [
      {
        id: 'c2',
        agente: 'LOTTOMATICA',
        username: 'Kondom91',
        userId: null,
        backAgenteBp: 5700,
        backPlayerBp: 3000,
        scaglioneBaseBp: 4500,
        scaglionePassoCent: 2250,
        destinazione: 'SCUOLA',
        stakato: false,
        attivo: true,
        ordine: 100,
        anonimizzato: false,
      },
    ]);
    fixture.componentInstance['vista'].set('rakeback');
    await stabilizza();
    expect(fixture.nativeElement.textContent).not.toContain(
      "conti dell'anagrafica",
    );
  });

  it('l’intestazione di colonna NON segue il verso, perché la tabella li mescola', async () => {
    // ⚠️ Il verso che nega: una tabella con entrate e uscite insieme non può
    // avere un'intestazione che segue il verso, e «Chi ha pagato» sopra una
    // colonna che contiene anche incassi nomina l'esatto contrario di quello
    // che la cella mostra. Deve restare neutra.
    await avvia();
    fixture.componentInstance['vista'].set('voci');
    await stabilizza();
    const intestazioni = [
      ...fixture.nativeElement.querySelectorAll('thead th'),
    ].map((t: HTMLElement) => t.textContent?.trim());
    expect(intestazioni).toContain('Portafoglio');
    expect(intestazioni).not.toContain('Chi ha pagato');
  });

  it('cambiando verso, una categoria dell’altro verso torna ad «Altro»', async () => {
    await avvia();
    const c = fixture.componentInstance as unknown as {
      apriVoce: (v: unknown) => void;
      formVoce: {
        patchValue: (v: Record<string, unknown>) => void;
        getRawValue: () => Record<string, unknown>;
      };
    };
    c.apriVoce('nuova');
    await stabilizza();

    c.formVoce.patchValue({ verso: 'USCITA', categoria: 'COACH' });
    await stabilizza();
    expect(c.formVoce.getRawValue()['categoria']).toBe('COACH');

    // ⚠️⚠️ Il difetto che questo test copre è MUTO in pagina: il `<select>` non
    // ha più un'`<option>` con quel valore, quindi si mostra vuoto — «non ho
    // ancora scelto» — mentre il `FormControl` conserva «COACH», e il
    // salvataggio prende un 400 su una cosa che a schermo non c'era.
    c.formVoce.patchValue({ verso: 'ENTRATA' });
    await stabilizza();
    expect(c.formVoce.getRawValue()['categoria']).toBe('ALTRO');

    // …e il select mostra davvero qualcosa, invece di restare vuoto.
    const sel = fixture.nativeElement.querySelector(
      '#cm-cat',
    ) as HTMLSelectElement;
    expect(sel.selectedOptions.length).toBe(1);
    expect(sel.selectedOptions[0].textContent?.trim()).toBe('Altro');
  });

  it('aprendo una voce esistente la categoria NON viene azzerata', async () => {
    // ⚠️ Il verso opposto dell'effetto: su una coppia già coerente non deve
    // toccare niente, o modificare una spesa la ributterebbe su «Altro» — e la
    // modale nascerebbe pure «sporca», chiedendo conferma all'Escape senza che
    // nessuno abbia digitato nulla.
    await avvia();
    const c = fixture.componentInstance as unknown as {
      apriVoce: (v: unknown) => void;
      formVoce: { getRawValue: () => Record<string, unknown> };
      voceSporca: () => boolean;
    };
    c.apriVoce({
      id: 'v9',
      verso: 'ENTRATA',
      categoria: 'STAKING',
      descrizione: 'Utile staking',
      importoCent: 45_000,
    });
    await stabilizza();

    expect(c.formVoce.getRawValue()['categoria']).toBe('STAKING');
    expect(c.voceSporca()).toBeFalse();
  });

  it('la scheda Abbonamenti mostra la destinazione, e il trattino su chi non è cassa', async () => {
    const d = dettaglio();
    d.riepilogo.entrate.abbonamentiCent = 13_000;
    d.riepilogo.entrate.abbonamentiPerDestinazione = {
      pietroCent: 8000,
      exivezzzCent: 5000,
      onlineCent: 0,
      paypalCent: 0,
      skrillCent: 0,
      nonAttribuitoCent: 0,
    };
    d.abbonamenti = [
      {
        id: 'a1',
        userEmail: 'cavia@bff.local',
        userNickname: 'Cavia',
        tier: 'SQUALO',
        metodo: 'contanti',
        incassatoDa: 'PIETRO',
        importoCent: 8000,
        portaCassa: true,
        stimato: false,
      },
      {
        id: 'a2',
        userEmail: 'marco@bff.local',
        tier: 'SQUALO',
        metodo: 'manuale',
        importoCent: 12_500,
        portaCassa: false,
        stimato: true,
      },
    ];
    await avvia(d);
    await vaiA('Abbonamenti');

    const t = testo();
    expect(t).toContain('Pietro');
    expect(t).toContain('Exivezzz');
    // ⚠️ La riga senza cassa porta il MOTIVO e non un importo: «concessione».
    expect(t).toContain('concessione');
    expect(t).toContain('stimato');

    const corpo =
      fixture.nativeElement.querySelector('tbody')?.textContent ?? '';
    expect(corpo).toContain('80,00');
    // ⚠️⚠️ E NON stampa i 125,00 della riga manuale: quel numero esiste sul
    // payload (l'espressione dell'incasso ricade sul listino) ma non è cassa, e
    // mostrarlo direbbe che sono entrati 125 € che non sono entrati.
    expect(corpo).not.toContain('125,00');
  });

  it('la striscia degli abbonamenti NOMINA quante righe non sono cassa', async () => {
    const d = dettaglio();
    d.abbonamenti = [
      {
        id: 'a1',
        userEmail: 'a@bff.local',
        tier: 'SQUALO',
        metodo: 'contanti',
        incassatoDa: 'PIETRO',
        importoCent: 8000,
        portaCassa: true,
        stimato: false,
      },
      {
        id: 'a2',
        userEmail: 'b@bff.local',
        tier: 'SQUALO',
        metodo: 'manuale',
        importoCent: 0,
        portaCassa: false,
        stimato: true,
      },
    ];
    await avvia(d);
    await vaiA('Abbonamenti');
    // ⚠️ Senza la seconda metà della frase, «2 abbonamenti» sopra un totale di
    // 80 € si legge come «due abbonamenti hanno fatto 80 €» — falso: uno solo.
    expect(
      fixture.nativeElement.querySelector('.admin-totali__ambito')?.textContent,
    ).toContain('1 senza cassa');
  });

  it('su un mese CHIUSO non si corregge, e si dice perché', async () => {
    const d = dettaglio([], {
      mese: mese({ stato: 'CHIUSO', riepilogoCongelato: true }),
    });
    d.abbonamenti = [
      {
        id: 'a1',
        userEmail: 'a@bff.local',
        tier: 'SQUALO',
        metodo: 'contanti',
        incassatoDa: 'PIETRO',
        importoCent: 8000,
        portaCassa: true,
        stimato: false,
      },
    ];
    await avvia(d);
    await vaiA('Abbonamenti');

    // ⚠️ Il comando sparisce invece di restare spento: su un mese chiuso il
    // totale è congelato, quindi una correzione non si vedrebbe da nessuna
    // parte — e un pulsante che non fa niente si legge come rotto.
    const comandi = [
      ...fixture.nativeElement.querySelectorAll('tbody button.admin-ico'),
    ];
    expect(comandi.length).toBe(0);
    expect(testo()).toContain('riapri il mese');
    // ⚠️ E si dichiara che elenco e totale possono divergere: le richieste
    // vengono cancellate alla chiusura di un account.
    expect(testo()).toContain('congelati alla chiusura');
  });

  it('dice che il conto col giocatore NON si trascina', async () => {
    await avvia();
    // ⚠️ Misurato: un ticket da 270 € contro 267,01 dovuti manda il residuo a
    // −2,99, e il mese dopo riparte da 267,01 — la differenza evapora. Poiché
    // il saldo non si trascina per decisione, l'etichetta deve dirlo invece di
    // lasciarlo dedurre.
    expect(testo()).toContain('Resta da dare (di questo mese)');
    expect(testo()).toContain('non si trascina');
  });

  it('le schede sono la navigazione PRIMARIA, non una pastiglia di stato', async () => {
    await avvia();
    // ⚠️ `[primarie]="true"` e mai l'attributo nudo `primarie`: un attributo
    // statico lega l'input alla stringa vuota, che è falsa, e la variante resta
    // INERTE — build verde, Karma verde, zero pixel cambiati. È successo
    // davvero sulle prime tre sezioni convertite.
    expect(
      fixture.nativeElement.querySelector('.schede--primarie'),
    ).toBeTruthy();
  });

  it('tutte le modali portano il wrapper `.admin-modale`', async () => {
    const d = dettaglio([riga()], {
      voci: [
        {
          id: 'v1',
          verso: 'USCITA',
          categoria: 'COACH',
          descrizione: 'Compenso bastogne',
          importoCent: 30_000,
        },
      ],
    });
    await avvia(d);

    // ⚠️ `app-modal` PROIETTA il contenuto e non aggiunge alcuna classe: i 44px
    // arrivano SOLO dal wrapper che il chiamante mette. Senza, pulsanti a
    // 38,1px e campi a 54,5px sulla stessa riga. Quattro modali su cinque ne
    // erano prive.
    const c = fixture.componentInstance as unknown as Record<
      string,
      { set: (v: unknown) => void }
    >;
    const casi: [string, () => void][] = [
      ['apri un mese', () => c['apriMeseAperto'].set(true)],
      ['voce', () => c['voceAperta'].set('nuova')],
      ['conto', () => c['contoAperto'].set('nuovo')],
      ['spesa ricorrente', () => c['ricorrenteAperta'].set('nuova')],
      ['scheda di riga', () => c['rigaAperta'].set('c1')],
      ['versamento', () => c['versamentoAperto'].set(true)],
    ];

    for (const [nome, apri] of casi) {
      apri();
      await stabilizza();
      const dialog = fixture.nativeElement.querySelector(
        'dialog',
      ) as HTMLElement | null;
      expect(dialog).withContext(nome).toBeTruthy();
      expect(dialog!.querySelector('.admin-modale'))
        .withContext(nome)
        .toBeTruthy();

      c['apriMeseAperto'].set(false);
      c['voceAperta'].set(null);
      c['contoAperto'].set(null);
      c['ricorrenteAperta'].set(null);
      c['rigaAperta'].set(null);
      c['versamentoAperto'].set(false);
      await stabilizza();
    }
  });

  it('la conferma distruttiva NON sopravvive all’apertura di un’altra riga', async () => {
    const voce = (id: string, descrizione: string) => ({
      id,
      verso: 'USCITA' as const,
      categoria: 'COACH' as const,
      descrizione,
      importoCent: 30_000,
    });
    await avvia(dettaglio([], { voci: [voce('v1', 'Uno'), voce('v2', 'Due')] }));
    const c = fixture.componentInstance as unknown as {
      apriVoce: (v: unknown) => void;
      chiedi: (k: string) => void;
      conferma: { (): string | null };
      dett: { (): DettaglioMese | null };
    };

    c.apriVoce(c.dett()!.voci[0]);
    await stabilizza();
    c.chiedi('voce');
    await stabilizza();
    expect(c.conferma()).toBe('voce');

    // ⚠️ Chi apre «Elimina», preme Escape e riapre un'ALTRA voce trovava la
    // sezione già in stato «Elimina davvero»: il passaggio di conferma saltato,
    // sull'unica azione irreversibile della sezione.
    c.apriVoce(c.dett()!.voci[1]);
    await stabilizza();
    expect(c.conferma()).toBeNull();
  });

  it('un importo illeggibile NON offre «Riprova», e nomina la riga', async () => {
    await avvia(dettaglio([riga()]));
    await vaiA('Rakeback');
    const c = fixture.componentInstance as unknown as {
      scriviRake: (id: string, v: string) => void;
      salvaRakeback: () => void;
      error: { (): string | null };
      erroreValidazione: { (): string | null };
    };

    c.scriviRake('c1', 'ciao');
    await stabilizza();
    c.salvaRakeback();
    await stabilizza();

    // ⚠️⚠️ Il messaggio va nel signal della VALIDAZIONE, non in quello di
    // caricamento: la banda di `error()` offre «Riprova», che ricarica il mese
    // e RISEMINA la bozza — chi digitava quindici righe e sbagliava un importo
    // le perdeva tutte premendo il pulsante offerto come la riparazione.
    expect(c.erroreValidazione()).toContain('Santotti88');
    expect(c.error()).toBeNull();
    const riprova = [
      ...fixture.nativeElement.querySelectorAll('button'),
    ].filter((b: HTMLButtonElement) => b.textContent?.includes('Riprova'));
    expect(riprova.length).toBe(0);
    // Nessuna chiamata di rete: il salvataggio si è fermato prima.
    http.expectNone(`${API}/admin/conteggi/mesi/m1/rakeback`);
  });
});
