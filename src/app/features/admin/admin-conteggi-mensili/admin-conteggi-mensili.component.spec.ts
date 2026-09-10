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
        nonAttribuitoCent: 0,
      },
      gadgetCent: 0,
      commissioniRakebackCent: 30_290,
      stakingCent: 0,
      altreCent: 0,
      totaleCent: 55_290,
    },
    uscite: { speseCent: 36_000, totaleCent: 36_000 },
    margineNettoCent: 19_290,
    ripartizione: {
      titolareCent: 12_539,
      socioCent: 6751,
      quotaTitolareBp: 6500,
    },
    marginePersonaleCent: 0,
    cassaGiocatori: {
      attesoDaAgenteCent: 91_881,
      pagatoAiGiocatoriCent: 0,
      residuoDovutoCent: 61_591,
    },
    abbonamentiStimati: 0,
  },
  troncato: false,
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

  /** Le quattro chiamate del costruttore: mesi, conti, ricorrenti, dettaglio. */
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
    if (d) {
      await stabilizza();
      http.expectOne(`${API}/admin/conteggi/mesi/${d.mese.id}`).flush(d);
    }
    await stabilizza();
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

  it('le cinque sezioni sono SCHEDE, con un pannello raggiungibile', async () => {
    await avvia();
    const schede = fixture.nativeElement.querySelectorAll(
      'button[role="tab"]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(schede.length).toBe(5);
    // ⚠️ L'ordine è quello del conto economico: prima il riepilogo, poi le tre
    // fonti di denaro, infine le anagrafiche che non appartengono a un mese.
    expect([...schede].map((b) => b.textContent?.trim().split(/\s+/)[0])).toEqual([
      'Riepilogo',
      'Rakeback',
      'Abbonamenti',
      'Spese',
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

  it('tutte e cinque le modali portano il wrapper `.admin-modale`', async () => {
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
