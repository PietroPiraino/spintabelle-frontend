import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  ElencoStakings,
  StakingMovimento,
  StakingRow,
} from '../../../core/models/api.models';
import { AdminStakingsComponent } from './admin-stakings.component';

const API = environment.API_URL;

const riga = (over: Partial<StakingRow> = {}): StakingRow => ({
  id: 's1',
  userId: 'u1',
  userEmail: 'mario@bff.it',
  userNickname: 'Mario',
  stato: 'APERTO',
  saldoFondiCent: 50_000,
  saldoEvCent: -34_000,
  anonimizzato: false,
  ...over,
});

/**
 * ⚠️ I totali arrivano SULL'ENVELOPE, calcolati dal server sull'intero insieme
 * filtrato. Qui il default li ricava dagli `items` solo per comodità — con una
 * pagina sola coincidono — ma un test apposta ne manda di diversi, perché è
 * proprio quel caso a distinguere «la striscia legge l'envelope» da «la
 * striscia somma le righe che vede».
 */
const pagina = (
  items: StakingRow[],
  over: Partial<ElencoStakings> = {},
): ElencoStakings => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
  totali: {
    fondiCent: items.reduce((t, r) => t + r.saldoFondiCent, 0),
    evCent: items.reduce((t, r) => t + r.saldoEvCent, 0),
  },
  ...over,
});

describe('AdminStakingsComponent', () => {
  let fixture: ComponentFixture<AdminStakingsComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rispondi = async (p: ElencoStakings) => {
    http.expectOne((r) => r.url === `${API}/admin/stakings`).flush(p);
    await stabilizza();
  };

  const apri = async (r = riga()) => {
    // ⚠️ Per NOME ACCESSIBILE e non per classe: dal 07/09/2026 il comando di
    // riga è solo-icona e `textContent` è vuoto. Un selettore di classe
    // rimetterebbe il test verde lasciando l'etichetta senza alcuna rete.
    const b = [...fixture.nativeElement.querySelectorAll('button')].find(
      (x: HTMLButtonElement) =>
        x.getAttribute('aria-label')?.startsWith('Apri la scheda di'),
    ) as HTMLButtonElement;
    b.click();
    http
      .expectOne((q) => q.url === `${API}/admin/stakings/${r.id}`)
      .flush({ riga: r, movimenti: [] });
    await stabilizza();
  };

  /**
   * Scarica la rilettura dell'elenco che parte dopo ogni mutazione.
   *
   * ⚠️ Il componente la fa perché righe e TOTALI tornino da una lettura sola:
   * senza consumarla qui, `http.verify()` in `afterEach` la troverebbe pendente
   * e ogni test di movimento fallirebbe con un messaggio che non nomina la
   * causa.
   */
  const scaricaRilettura = async (p = pagina([riga()])) => {
    http.expectOne((r) => r.url === `${API}/admin/stakings`).flush(p);
    await stabilizza();
  };

  /** Digita nel campo importo e lascia ricalcolare. */
  const digitaImporto = async (v: string) => {
    const i = fixture.nativeElement.querySelector(
      '#stk-importo',
    ) as HTMLInputElement;
    i.value = v;
    i.dispatchEvent(new Event('input'));
    await stabilizza();
  };

  /** Digita la causale e lascia ricalcolare. */
  const digitaCausale = async (v: string) => {
    const i = fixture.nativeElement.querySelector(
      '#stk-causale',
    ) as HTMLInputElement;
    i.value = v;
    i.dispatchEvent(new Event('input'));
    await stabilizza();
  };

  /**
   * Sceglie la VOCE di movimento (tipo + verso) e lascia ricalcolare.
   *
   * ⚠️ Dal 19/09/2026 il select è `#stk-movimento` con sei voci e non più
   * l'asse a tre: il verso lo porta la voce, e l'importo si scrive positivo.
   */
  const scegliMovimento = async (codice: string) => {
    const sel = fixture.nativeElement.querySelector(
      '#stk-movimento',
    ) as HTMLSelectElement;
    sel.value = codice;
    sel.dispatchEvent(new Event('change'));
    await stabilizza();
  };

  const bottoneRegistra = () =>
    [...fixture.nativeElement.querySelectorAll('button')].find(
      (b: HTMLButtonElement) => b.textContent?.includes('Registra movimento'),
    ) as HTMLButtonElement;

  /** Un movimento già in archivio, com'erano tutti prima del 12/09/2026. */
  const storico = (over: Partial<StakingMovimento> = {}): StakingMovimento => ({
    id: 'm-vecchio',
    tipo: 'FONDI',
    importoCent: 45_000,
    causale: 'Bankroll per Ipoker',
    saldoFondiDopoCent: 45_000,
    saldoEvDopoCent: 0,
    ...over,
  });

  /** Come `apri`, ma con uno storico già pieno. */
  const apriCon = async (movimenti: StakingMovimento[], r = riga()) => {
    const b = [...fixture.nativeElement.querySelectorAll('button')].find(
      (x: HTMLButtonElement) =>
        x.getAttribute('aria-label')?.startsWith('Apri la scheda di'),
    ) as HTMLButtonElement;
    b.click();
    http
      .expectOne((q) => q.url === `${API}/admin/stakings/${r.id}`)
      .flush({ riga: r, movimenti });
    await stabilizza();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminStakingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminStakingsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.classList.remove('is-modale');
    http.verify();
  });


  describe('la riga del movimento', () => {
    it('⚠️ i quattro campi stanno sulla STESSA riga e l’aiuto della causale prende la riga intera', async () => {
      // Trovato dall'owner in produzione due volte. Il 16/09/2026 l'aiuto «La
      // legge il giocatore nel suo account…» stava DENTRO la cella della
      // causale, che era più alta delle altre tre: con la riga allineata al
      // fondo il suo campo saliva di una riga. Il rimedio — allineare in alto —
      // ha lasciato l'aiuto largo quanto la sua colonna, su tre righe, con un
      // buco sotto le altre celle (19/09). La forma buona è l'aiuto FUORI dalla
      // cella, ultimo figlio della riga a piena larghezza. Si misura, perché
      // un allineamento sbagliato non fallisce niente: si vede e basta.
      await rispondi(pagina([riga()]));
      await apri();

      // la finestra di Karma è stretta e la riga andrebbe a capo: si allarga la
      // scatola della modale, così le quattro celle stanno davvero in una riga
      const box = document.querySelector('.mo__box') as HTMLElement;
      box.style.width = '1400px';
      box.style.maxWidth = 'none';

      const rect = (sel: string) =>
        (document.querySelector(sel) as HTMLElement).getBoundingClientRect();
      const riferimento = rect('#stk-movimento').top;
      for (const sel of ['#stk-cassa', '#stk-importo', '#stk-causale']) {
        expect(Math.abs(rect(sel).top - riferimento))
          .withContext(`${sel} è sulla riga di #stk-movimento`)
          .toBeLessThan(1);
      }
      // le celle sono alte uguali, quindi basta la base: niente modificatore
      const rigaCampi = document.querySelector('.admin-panel__row') as HTMLElement;
      expect(rigaCampi.classList).not.toContain('admin-panel__row--in-alto');
      expect(getComputedStyle(rigaCampi).alignItems).toBe('flex-end');
      // l'aiuto pende SOTTO il suo campo…
      const aiuto = rect('#stk-causale-aiuto');
      expect(aiuto.top).toBeGreaterThan(rect('#stk-causale').bottom);
      // …e prende la riga intera, non la colonna della causale
      const rigaRect = rigaCampi.getBoundingClientRect();
      expect(Math.abs(aiuto.left - rigaRect.left)).toBeLessThan(1);
      expect(Math.abs(aiuto.right - rigaRect.right)).toBeLessThan(1);
      // il legame col campo resta dichiarato
      expect(
        (document.querySelector('#stk-causale') as HTMLElement).getAttribute(
          'aria-describedby',
        ),
      ).toBe('stk-causale-aiuto');
    });
  });

  describe('la tasca del movimento', () => {
    const cassa = () =>
      fixture.nativeElement.querySelector('#stk-cassa') as HTMLSelectElement | null;

    it('la chiede sui FONDI nei due versi e la nasconde sulle altre quattro voci', async () => {
      // ⚠️⚠️ Non è cosmesi: il server RIFIUTA con un 400 una cassa su «EV» o su
      // «Capitale perso», perché quei due non spostano un centesimo da nessuna
      // tasca. Un campo che resta visibile manda al server proprio la coppia
      // che lui non ammette.
      await rispondi(pagina([riga()]));
      await apri();

      expect(cassa())
        .withContext('su un anticipo la tasca si chiede')
        .toBeTruthy();

      await scegliMovimento('RIENTRO');
      expect(cassa())
        .withContext('e su un rientro pure: il denaro RIENTRA in una tasca')
        .toBeTruthy();

      for (const voce of ['RECUPERO_EV', 'DEBITO_EV', 'PERDITA', 'STORNO_PERDITA']) {
        await scegliMovimento(voce);
        expect(cassa()).withContext(`su ${voce} sparisce`).toBeNull();
      }

      await scegliMovimento('ANTICIPO');
      expect(cassa())
        .withContext('tornando ai fondi ricompare')
        .toBeTruthy();
    });

    it('⚠️ l’etichetta della tasca segue il VERSO: «da quale» esce, «in quale» rientra', async () => {
      // Fino al 19/09/2026 diceva sempre «Da quale portafoglio», anche per un
      // roll che il giocatore RESTITUISCE: la parola sbagliata su metà dei
      // casi, e l'owner non ha trovato come registrare un rientro.
      await rispondi(pagina([riga()]));
      await apri();
      const etichetta = () =>
        (
          fixture.nativeElement.querySelector(
            'label[for="stk-cassa"]',
          ) as HTMLElement
        ).textContent?.trim();
      expect(etichetta()).toBe('Da quale portafoglio');
      await scegliMovimento('RIENTRO');
      expect(etichetta()).toBe('In quale portafoglio');
      await scegliMovimento('ANTICIPO');
      expect(etichetta()).toBe('Da quale portafoglio');
    });

    it('manda la cassa SOLO sui fondi', async () => {
      const r = riga();
      await rispondi(pagina([r]));
      await apri(r);

      await digitaImporto('250');
      const causale = fixture.nativeElement.querySelector(
        '#stk-causale',
      ) as HTMLInputElement;
      causale.value = 'roll di settembre';
      causale.dispatchEvent(new Event('input'));
      await stabilizza();

      const salva = [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.includes('Registra'),
      ) as HTMLButtonElement;
      salva.click();
      await stabilizza();

      const req = http.expectOne(
        (q) => q.url === `${API}/admin/stakings/${r.id}/movimenti`,
      );
      expect(req.request.body.cassa).toBe('PIETRO');
      // verso l'API parte l'ASSE con l'importo già firmato: il contratto col
      // server non è cambiato
      expect(req.request.body.tipo).toBe('FONDI');
      expect(req.request.body.importoCent).toBe(25_000);
      req.flush({ riga: r, movimento: { id: 'm1', tipo: 'FONDI', importoCent: 25_000, causale: 'roll di settembre', cassa: 'PIETRO', saldoFondiDopoCent: 25_000, saldoEvDopoCent: 0 } });
      await stabilizza();
      await scaricaRilettura(pagina([r]));
    });

    it('su una PERDITA la chiave non parte affatto, e il segno lo mette la voce', async () => {
      // ⚠️ Omessa e non mandata vuota: `@IsIn` sul server rifiuta la stringa
      // vuota, quindi un `cassa: ''` darebbe 400 su un movimento legittimo.
      // ⚠️ L'importo si digita POSITIVO («400») e parte negativo: è la voce a
      // dire che un capitale perso cala i fondi, non il meno di chi scrive.
      const r = riga();
      await rispondi(pagina([r]));
      await apri(r);

      await scegliMovimento('PERDITA');
      await digitaImporto('400');
      await digitaCausale('giocatore sparito');

      bottoneRegistra().click();
      await stabilizza();

      const req = http.expectOne(
        (q) => q.url === `${API}/admin/stakings/${r.id}/movimenti`,
      );
      expect('cassa' in req.request.body).toBeFalse();
      expect(req.request.body.tipo).toBe('PERDITA');
      expect(req.request.body.importoCent).toBe(-40_000);
      req.flush({ riga: r, movimento: { id: 'm2', tipo: 'PERDITA', importoCent: -40_000, causale: 'giocatore sparito', saldoFondiDopoCent: 10_000, saldoEvDopoCent: -34_000 } });
      await stabilizza();
      await scaricaRilettura(pagina([r]));
    });
  });

  describe('il verso del movimento lo porta la voce', () => {
    it('⚠️ il rientro del roll: importo positivo, verso l’API parte negativo, la tasca è quella che RICEVE', async () => {
      // La domanda dell'owner del 19/09/2026: «il giocatore ha mandato 750
      // euro di roll a me Pietro, come lo registro?». Fino a quel giorno la
      // risposta era «Fondi, Pietro, −750» e nessuna parola dello schermo la
      // diceva. Ora è una voce della tendina.
      const r = riga({ saldoFondiCent: 100_000 });
      await rispondi(pagina([r]));
      await apri(r);

      await scegliMovimento('RIENTRO');
      // la spiegazione dice che torna CAPITALE, e dove va il profitto
      expect(testo()).toContain('capitale, non');
      expect(testo()).toContain('Conteggi mensili');
      await digitaImporto('750');
      // l'anteprima mostra i fondi che scendono: 1.000 − 750
      expect(testo()).toContain('Dopo questo movimento');
      expect(testo()).toContain('250,00');
      await digitaCausale('rientro parziale del roll');

      bottoneRegistra().click();
      await stabilizza();
      const req = http.expectOne(
        (q) => q.url === `${API}/admin/stakings/${r.id}/movimenti`,
      );
      expect(req.request.body).toEqual({
        tipo: 'FONDI',
        importoCent: -75_000,
        causale: 'rientro parziale del roll',
        cassa: 'PIETRO',
      });
      const dopo = riga({ saldoFondiCent: 25_000 });
      req.flush({
        riga: dopo,
        movimento: {
          id: 'm3',
          tipo: 'FONDI',
          importoCent: -75_000,
          cassa: 'PIETRO',
          causale: 'rientro parziale del roll',
          saldoFondiDopoCent: 25_000,
          saldoEvDopoCent: -34_000,
        },
      });
      await stabilizza();
      await scaricaRilettura(pagina([dopo]));
      // e lo storico lo chiama col suo nome, non «Fondi −750,00 €»
      expect(testo()).toMatch(/Rientro\s*·\s*Pietro/);
    });

    it('⚠️ un meno digitato è un errore, non un verso', async () => {
      // «Anticipo» con «-750» partirebbe come un rientro che nessuno ha
      // scelto: il segno lo decide la voce, e il campo lo dice prima del clic.
      await rispondi(pagina([riga()]));
      await apri();
      await digitaImporto('-750');
      await digitaCausale('rientro del roll');
      expect(testo()).toContain('senza il meno');
      expect(testo()).not.toContain('Dopo questo movimento');
      expect(bottoneRegistra().disabled).toBe(true);
      // scritto positivo, tutto torna
      await digitaImporto('750');
      expect(testo()).not.toContain('senza il meno');
      expect(bottoneRegistra().disabled).toBe(false);
    });

    it('lo storico nomina il verso di ogni movimento dalla stessa tabella', async () => {
      // Prima diceva «Fondi · Pietro −750,00 €»: il verso andava dedotto dal
      // meno, cioè lo stesso difetto che il form aveva in scrittura.
      await rispondi(pagina([riga()]));
      await apriCon([
        storico({ id: 'm-r', importoCent: -75_000, cassa: 'PIETRO' }),
        storico({ id: 'm-a', importoCent: 45_000, cassa: 'PIETRO' }),
        storico({ id: 'm-e', tipo: 'EV', importoCent: -10_000 }),
        storico({ id: 'm-s', tipo: 'PERDITA', importoCent: 40_000 }),
      ]);
      const t = testo();
      expect(t).toMatch(/Rientro\s*·\s*Pietro/);
      expect(t).toMatch(/Anticipo\s*·\s*Pietro/);
      expect(t).toContain('Debito EV');
      expect(t).toContain('Storno perdita');
      // l'importo resta col suo segno: il badge aggiunge la parola, non la
      // toglie (⚠️ il meno di `Intl` può essere U+2212: si accettano entrambi)
      expect(t).toMatch(/[-−]750,00/);
      expect(t).toContain('+450,00');
      // ⚠️ e il rame segue il MOVIMENTO, non il segno: un rientro è negativo ma
      // non è una perdita, un debito EV sì
      const righe = [...fixture.nativeElement.querySelectorAll('.stk__mov li')] as HTMLElement[];
      const rientro = righe.find((li) => /Rientro/.test(li.textContent ?? ''))!;
      const debito = righe.find((li) => /Debito EV/.test(li.textContent ?? ''))!;
      expect(rientro.querySelector('strong')!.classList).not.toContain('is-debito');
      expect(debito.querySelector('strong')!.classList).toContain('is-debito');
    });

    it('la perdita rispecchia il tetto del server prima del clic', async () => {
      // Il server risponderebbe 400: qui lo si anticipa perché non arrivi a
      // sorpresa dopo il clic.
      await rispondi(pagina([riga()])); // fondi 500,00
      await apri();
      await scegliMovimento('PERDITA');
      await digitaImporto('600');
      expect(testo()).toContain('puoi dichiarare perso al massimo');
      expect(testo()).toContain('500,00');
      await digitaImporto('500');
      expect(testo()).not.toContain('puoi dichiarare perso al massimo');
      expect(testo()).toContain('0,00');
    });

    it('lo storno non supera le perdite dichiarate, e parte POSITIVO senza tasca', async () => {
      // Il registro è append-only: una perdita dichiarata per errore si
      // annulla solo con un movimento opposto, e quel movimento deve esistere
      // nell'interfaccia — ma non oltre quanto è stato dichiarato, o il conto
      // economico del mese recupererebbe un costo mai sostenuto.
      const r = riga({ saldoFondiCent: 10_000 });
      await rispondi(pagina([r]));
      await apriCon([storico({ id: 'm-perso', tipo: 'PERDITA', importoCent: -40_000 })], r);
      await scegliMovimento('STORNO_PERDITA');
      await digitaImporto('500');
      expect(testo()).toContain('puoi stornare al massimo');
      expect(testo()).toContain('400,00');

      await digitaImporto('400');
      expect(testo()).not.toContain('puoi stornare al massimo');
      await digitaCausale('storno della perdita del 12/09');
      bottoneRegistra().click();
      await stabilizza();
      const req = http.expectOne(
        (q) => q.url === `${API}/admin/stakings/${r.id}/movimenti`,
      );
      expect(req.request.body).toEqual({
        tipo: 'PERDITA',
        importoCent: 40_000,
        causale: 'storno della perdita del 12/09',
      });
      req.flush({
        riga: riga({ saldoFondiCent: 50_000 }),
        movimento: {
          id: 'm-st',
          tipo: 'PERDITA',
          importoCent: 40_000,
          causale: 'storno della perdita del 12/09',
          saldoFondiDopoCent: 50_000,
          saldoEvDopoCent: -34_000,
        },
      });
      await stabilizza();
      await scaricaRilettura(pagina([riga({ saldoFondiCent: 50_000 })]));
    });

    it('un nuovo debito EV parte negativo e l’anteprima lo somma al debito', async () => {
      await rispondi(pagina([riga()])); // EV −340,00
      await apri();
      await scegliMovimento('DEBITO_EV');
      await digitaImporto('100');
      expect(testo()).toContain('440,00');
      expect(testo()).toContain('da recuperare');
      await digitaCausale('passivo del conteggio di agosto');
      bottoneRegistra().click();
      await stabilizza();
      const req = http.expectOne(
        (q) => q.url === `${API}/admin/stakings/s1/movimenti`,
      );
      expect(req.request.body).toEqual({
        tipo: 'EV',
        importoCent: -10_000,
        causale: 'passivo del conteggio di agosto',
      });
      req.flush({
        riga: riga({ saldoEvCent: -44_000 }),
        movimento: {
          id: 'm-d',
          tipo: 'EV',
          importoCent: -10_000,
          causale: 'passivo del conteggio di agosto',
          saldoFondiDopoCent: 50_000,
          saldoEvDopoCent: -44_000,
        },
      });
      await stabilizza();
      await scaricaRilettura(pagina([riga({ saldoEvCent: -44_000 })]));
    });
  });

  describe("l'elenco", () => {
    it('mostra i due saldi in chiaro', async () => {
      await rispondi(pagina([riga()]));
      expect(testo()).toContain('500,00');
      expect(testo()).toContain('340,00');
      expect(testo()).toContain('da recuperare');
    });

    it('un EV a zero dice «In pari», non resta vuoto', async () => {
      // Il vuoto si legge come dato mancante e manda a cercare un guasto.
      await rispondi(pagina([riga({ saldoEvCent: 0 })]));
      expect(testo()).toContain('In pari');
    });

    it('il debito non è scritto col meno', async () => {
      // Un «−340,00 €» in una colonna di numeri si confonde con una perdita di
      // cassa: si mostra la quantità e la parola che la spiega.
      await rispondi(pagina([riga()]));
      const cella = (
        fixture.nativeElement.querySelector('.stk__ev') as HTMLElement
      ).textContent!;
      expect(cella).not.toContain('-');
      expect(cella).not.toContain('−');
    });

    it("lo stato vuoto spiega DA DOVE arrivano le righe", async () => {
      // ⚠️ È la bugia più costosa di questa schermata: un elenco vuoto senza
      // spiegazione si legge come «nessuno è in staking», mentre la causa più
      // probabile è che nessuno abbia ancora il ruolo.
      await rispondi(pagina([]));
      expect(testo()).toContain('ruolo «Stakato»');
    });

    it('cambiando filtro si torna a pagina 1', async () => {
      // Restando alla pagina 3 di un filtro con due pagine si otterrebbe un
      // elenco vuoto — cioè lo stato vuoto che mente.
      await rispondi({ ...pagina([riga()]), page: 3, totalPages: 3 });
      const chiusi = [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim() === 'Chiusi',
      ) as HTMLButtonElement;
      chiusi.click();
      const req = http.expectOne((r) => r.url === `${API}/admin/stakings`);
      expect(req.request.params.get('page')).toBe('1');
      expect(req.request.params.get('stato')).toBe('CHIUSO');
      req.flush(pagina([]));
      await stabilizza();
    });
  });

  describe('il movimento', () => {
    it("⚠️ l'anteprima reagisce a quello che si digita", async () => {
      // Il difetto che questo test previene: un `computed()` costruito su
      // `FormControl.value` non si ricalcola MAI (un FormGroup non è un
      // signal), quindi anteprima e pulsante resterebbero congelati al primo
      // valore — e nulla lo segnalerebbe.
      await rispondi(pagina([riga()]));
      await apri();
      await digitaImporto('250');
      expect(testo()).toContain('Dopo questo movimento');
      expect(testo()).toContain('750,00');
    });

    it("un recupero EV più grande del debito è bloccato PRIMA del clic", async () => {
      await rispondi(pagina([riga()]));
      await apri();
      await scegliMovimento('RECUPERO_EV');
      await digitaImporto('400');
      expect(testo()).toContain('Puoi recuperare al massimo');
      expect(testo()).toContain('340,00');
    });

    it('⚠️ il tetto dell’EV NON si applica ai fondi', async () => {
      // Applicandolo anche ai fondi, nessun bilancio sarebbe registrabile:
      // cioè metà della funzione sparirebbe, e il pulsante resterebbe spento
      // senza dire perché.
      await rispondi(pagina([riga()]));
      await apri();
      await digitaImporto('100000');
      const registra = [
        ...fixture.nativeElement.querySelectorAll('button'),
      ].find((b: HTMLButtonElement) =>
        b.textContent?.includes('Registra movimento'),
      ) as HTMLButtonElement;
      // manca ancora la causale: spento, ma non per il vincolo EV
      expect(testo()).not.toContain('Puoi recuperare al massimo');
      expect(registra.disabled).toBe(true);

      const causale = fixture.nativeElement.querySelector(
        '#stk-causale',
      ) as HTMLInputElement;
      causale.value = 'anticipo di maggio';
      causale.dispatchEvent(new Event('input'));
      await stabilizza();
      expect(registra.disabled).toBe(false);
    });

    it('dopo un movimento la RIGA della tabella si aggiorna', async () => {
      // ⚠️ Senza, dietro la modale resterebbero i soldi vecchi: si chiude e si
      // legge un saldo che non è più quello.
      await rispondi(pagina([riga()]));
      await apri();
      await digitaImporto('250');
      const causale = fixture.nativeElement.querySelector(
        '#stk-causale',
      ) as HTMLInputElement;
      causale.value = 'anticipo di maggio';
      causale.dispatchEvent(new Event('input'));
      await stabilizza();

      (
        [...fixture.nativeElement.querySelectorAll('button')].find(
          (b: HTMLButtonElement) =>
            b.textContent?.includes('Registra movimento'),
        ) as HTMLButtonElement
      ).click();
      http
        .expectOne((r) => r.url === `${API}/admin/stakings/s1/movimenti`)
        .flush({
          riga: riga({ saldoFondiCent: 75_000 }),
          movimento: {
            id: 'm1',
            tipo: 'FONDI',
            importoCent: 25_000,
            causale: 'anticipo di maggio',
            saldoFondiDopoCent: 75_000,
            saldoEvDopoCent: -34_000,
          },
        });
      await stabilizza();
      // La riga si aggiorna SUBITO (patch in locale); la rilettura che segue
      // porta i totali in pari e deve rispondere con la riga già aggiornata.
      await scaricaRilettura(pagina([riga({ saldoFondiCent: 75_000 })]));

      expect(testo()).toContain('750,00');
      // e lo storico mostra subito il movimento appena registrato
      expect(testo()).toContain('anticipo di maggio');
    });

    it('gli importi partono in CENTESIMI, non in euro', async () => {
      // ⚠️ Il fattore 100: con gli euro sul filo e i centesimi nello schema, i
      // due lati devono concordare, e 1.250,50 diventerebbe 125.050,00.
      await rispondi(pagina([riga()]));
      await apri();
      await digitaImporto('1.250,50');
      const causale = fixture.nativeElement.querySelector(
        '#stk-causale',
      ) as HTMLInputElement;
      causale.value = 'anticipo';
      causale.dispatchEvent(new Event('input'));
      await stabilizza();

      (
        [...fixture.nativeElement.querySelectorAll('button')].find(
          (b: HTMLButtonElement) =>
            b.textContent?.includes('Registra movimento'),
        ) as HTMLButtonElement
      ).click();
      const req = http.expectOne(
        (r) => r.url === `${API}/admin/stakings/s1/movimenti`,
      );
      expect((req.request.body as { importoCent: number }).importoCent).toBe(
        125_050,
      );
      req.flush({
        riga: riga(),
        movimento: {
          id: 'm1',
          tipo: 'FONDI',
          importoCent: 125_050,
          causale: 'anticipo',
          saldoFondiDopoCent: 175_050,
          saldoEvDopoCent: -34_000,
        },
      });
      await stabilizza();
      await scaricaRilettura();
    });

    it('su una riga chiusa il form non compare', async () => {
      const chiusa = riga({ stato: 'CHIUSO', chiusoAt: '2026-08-01T10:00:00Z' });
      await rispondi(pagina([chiusa]));
      await apri(chiusa);
      expect(testo()).toContain('riaprilo per registrare un movimento');
      expect(fixture.nativeElement.querySelector('#stk-importo')).toBeNull();
    });
  });

  describe('i totali di fondi ed EV', () => {
    const striscia = () =>
      (
        fixture.nativeElement.querySelector('.admin-totali') as HTMLElement | null
      )?.textContent ?? '';

    it('⚠️ stampa i totali dell’ENVELOPE, non la somma delle righe visibili', async () => {
      // Il test che conta. L'elenco è paginato: sommare gli `items` dà un
      // numero esatto finché i giocatori finanziati stanno in una pagina e
      // sbagliato dal 26° in poi — su una cifra di denaro e senza che niente si
      // rompa. Qui l'envelope dichiara di proposito totali che NON corrispondono
      // all'unica riga mostrata: se la striscia li sommasse in locale, si
      // leggerebbe «500,00» invece di «12.345,00».
      await rispondi(
        pagina([riga()], {
          total: 26,
          totali: { fondiCent: 1_234_500, evCent: -6_789_000 },
        }),
      );
      expect(striscia()).toContain('12.345,00');
      expect(striscia()).toContain('67.890,00');
      expect(striscia()).toContain('da recuperare');
      // I due negativi sono la metà che conta: «500,00» e «340,00» sono
      // esattamente i saldi dell'unica riga mostrata, cioè quello che si
      // leggerebbe se la striscia sommasse `items` invece di leggere l'envelope.
      expect(striscia()).not.toContain('500,00');
      expect(striscia()).not.toContain('340,00');
    });

    it('l’EV in pari lo dice, e non resta una cifra nuda', async () => {
      await rispondi(pagina([riga({ saldoEvCent: 0 })]));
      expect(striscia()).toContain('In pari');
    });

    it('⚠️ nomina l’insieme che sta sommando, e la frase segue il filtro', async () => {
      // Senza, la stessa cifra si legge come «tutto il registro» qualunque
      // filtro sia attivo — il precedente di /admin/partecipazione.
      await rispondi(pagina([riga(), riga({ id: 's2' })]));
      expect(striscia()).toContain('su 2 registri in corso');

      const chiusi = [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim() === 'Chiusi',
      ) as HTMLButtonElement;
      chiusi.click();
      http
        .expectOne((r) => r.url === `${API}/admin/stakings`)
        .flush(pagina([riga({ id: 's3', stato: 'CHIUSO' })]));
      await stabilizza();
      // ⚠️ «chiuso» concorda col singolare: un aggettivo appeso al plurale
      // darebbe «su 1 registro chiusi».
      expect(striscia()).toContain('su 1 registro chiuso');
    });

    it('a zero righe la striscia non compare', async () => {
      // Un «0,00 €» sopra un elenco vuoto è rumore: a spiegare la schermata
      // c'è già la cella di stato vuoto.
      await rispondi(pagina([]));
      expect(fixture.nativeElement.querySelector('.admin-totali')).toBeNull();
    });

    it('⚠️ dopo un movimento l’elenco viene RILETTO, o i totali restano indietro', async () => {
      // `patchRiga` aggiorna la riga in locale ma non può aggiornare un totale
      // calcolato dal server sull'intero insieme: senza la rilettura, la cifra
      // in testa e la colonna sotto direbbero due cose diverse sugli stessi
      // soldi. L'alternativa — applicare il delta anche al totale — metterebbe
      // la stessa aritmetica in due punti che devono concordare.
      await rispondi(pagina([riga()]));
      await apri();
      await digitaImporto('250');
      const causale = fixture.nativeElement.querySelector(
        '#stk-causale',
      ) as HTMLInputElement;
      causale.value = 'anticipo di maggio';
      causale.dispatchEvent(new Event('input'));
      await stabilizza();

      (
        [...fixture.nativeElement.querySelectorAll('button')].find(
          (b: HTMLButtonElement) =>
            b.textContent?.includes('Registra movimento'),
        ) as HTMLButtonElement
      ).click();
      http
        .expectOne((r) => r.url === `${API}/admin/stakings/s1/movimenti`)
        .flush({
          riga: riga({ saldoFondiCent: 75_000 }),
          movimento: {
            id: 'm1',
            tipo: 'FONDI',
            importoCent: 25_000,
            causale: 'anticipo di maggio',
            saldoFondiDopoCent: 75_000,
            saldoEvDopoCent: -34_000,
          },
        });
      await stabilizza();

      // È QUESTA la chiamata che il test pretende: senza, `http.verify()`
      // passerebbe e i totali resterebbero fermi al valore di prima.
      const rilettura = http.expectOne((r) => r.url === `${API}/admin/stakings`);
      expect(rilettura.request.params.get('stato')).toBe('APERTO');
      rilettura.flush(pagina([riga({ saldoFondiCent: 75_000 })]));
      await stabilizza();
      expect(striscia()).toContain('750,00');
    });
  });

  it('una riga anonimizzata si dichiara tale, non sembra rotta', async () => {
    // L'account è stato cancellato: senza un'etichetta, la riga senza nome
    // farebbe cercare un utente che non c'è più.
    await rispondi(
      pagina([
        riga({ userId: null, userEmail: undefined, userNickname: undefined, anonimizzato: true }),
      ]),
    );
    expect(testo()).toContain('Account cancellato');
    expect(testo()).toContain('Anonimizzato');
  });
  describe('la tasca dei movimenti storici', () => {
    /**
     * ⚠️⚠️ QUESTA SEZIONE ESISTE PERCHÉ IL COMANDO NON C'ERA. La rotta
     * `PATCH /admin/stakings/movimenti/:id/cassa` viveva sul server dal
     * 12/09/2026 e NESSUNA schermata la chiamava: dall'interfaccia i movimenti
     * storici non si potevano attribuire affatto, quindi 2.799 € di roll
     * restavano fuori dal credito dei soci — e il conguaglio lo diceva su
     * un'ALTRA schermata, con un avviso che non portava da nessuna parte.
     * Trovato leggendo i dati di produzione, non il codice. È la quarta volta
     * che questo modulo spedisce una funzione completa lato server e muta lato
     * interfaccia.
     *
     * `storico` e `apriCon` vivono in testa al file: dal 19/09/2026 li usa anche
     * il gruppo sul verso dei movimenti.
     */
    const bottone = () =>
      [...fixture.nativeElement.querySelectorAll('button')].find(
        (x: HTMLButtonElement) => x.textContent?.trim() === 'Attribuisci',
      ) as HTMLButtonElement | undefined;

    it('il comando c’è, NOMINA la coda e attribuisce la tasca scelta', async () => {
      await rispondi(pagina([riga()]));
      await apriCon([storico()]);

      // ⚠️ L'avviso dice QUANTI sono: è l'unica cosa che collega questa
      // schermata al credito dei soci, che vive altrove.
      expect(fixture.nativeElement.textContent).toContain(
        '1 movimento di fondi non dice',
      );

      const sel = fixture.nativeElement.querySelector(
        '#stk-cassa-m-vecchio',
      ) as HTMLSelectElement;
      expect(sel).withContext('il selettore della tasca esiste').toBeTruthy();
      // ⚠️ `[selected]` sull'opzione, non `[value]` sul select: con le opzioni
      // da `@for` il binding del select si applica prima che esistano e la
      // scelta si perde in silenzio.
      expect(sel.value).toBe('PIETRO');

      sel.value = 'EXIVEZZZ';
      sel.dispatchEvent(new Event('change'));
      await stabilizza();

      bottone()!.click();
      const req = http.expectOne(
        `${API}/admin/stakings/movimenti/m-vecchio/cassa`,
      );
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ cassa: 'EXIVEZZZ' });
      req.flush(storico({ cassa: 'EXIVEZZZ' }));
      await stabilizza();

      // ⚠️ Il movimento si aggiorna IN PLACE: nessuna rilettura dell'elenco,
      // o le scelte fatte sulle altre righe tornerebbero al primo valore.
      http.expectNone((q) => q.url === `${API}/admin/stakings`);
      expect(bottone()).withContext('attribuito una volta, sparisce').toBeUndefined();
      expect(fixture.nativeElement.textContent).toContain('Exivezzz');
    });

    it('non lo offre su EV, su una PERDITA, né su un movimento già attribuito', async () => {
      // ⚠️ Il server RIFIUTA la tasca sugli altri due assi con un 400: non
      // spostano un centesimo da nessun portafoglio. Un comando visibile lì
      // manderebbe proprio la coppia che lui non ammette.
      await rispondi(pagina([riga()]));
      await apriCon([
        storico({ id: 'm-ev', tipo: 'EV', importoCent: -5_000 }),
        storico({ id: 'm-perso', tipo: 'PERDITA', importoCent: -40_000 }),
        storico({ id: 'm-gia', cassa: 'PIETRO' }),
      ]);

      expect(bottone()).toBeUndefined();
      expect(fixture.nativeElement.querySelector('#stk-cassa-m-ev')).toBeNull();
      expect(fixture.nativeElement.querySelector('#stk-cassa-m-perso')).toBeNull();
      expect(fixture.nativeElement.querySelector('#stk-cassa-m-gia')).toBeNull();
      // E senza coda non c'è avviso: un «0 movimenti» sarebbe rumore.
      expect(fixture.nativeElement.textContent).not.toContain(
        'non dice da quale portafoglio',
      );
    });
  });
});
