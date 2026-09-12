import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ElencoStakings, StakingRow } from '../../../core/models/api.models';
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


  describe('la tasca del movimento', () => {
    /** Cambia l'asse e lascia ricalcolare. */
    const scegliAsse = async (v: string) => {
      const sel = fixture.nativeElement.querySelector(
        '#stk-tipo',
      ) as HTMLSelectElement;
      sel.value = v;
      sel.dispatchEvent(new Event('change'));
      await stabilizza();
    };

    const cassa = () =>
      fixture.nativeElement.querySelector('#stk-cassa') as HTMLSelectElement | null;

    it('la chiede sui FONDI e la nasconde sugli altri due assi', async () => {
      // ⚠️⚠️ Non è cosmesi: il server RIFIUTA con un 400 una cassa su «EV» o su
      // «Capitale perso», perché quei due non spostano un centesimo da nessuna
      // tasca. Un campo che resta visibile manda al server proprio la coppia
      // che lui non ammette.
      await rispondi(pagina([riga()]));
      await apri();

      expect(cassa())
        .withContext('sui fondi la tasca si chiede')
        .toBeTruthy();

      await scegliAsse('EV');
      expect(cassa())
        .withContext('su EV sparisce')
        .toBeNull();

      await scegliAsse('PERDITA');
      expect(cassa())
        .withContext('e su una perdita pure')
        .toBeNull();

      await scegliAsse('FONDI');
      expect(cassa())
        .withContext('tornando ai fondi ricompare')
        .toBeTruthy();
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
      req.flush({ riga: r, movimento: { id: 'm1', tipo: 'FONDI', importoCent: 25_000, causale: 'roll di settembre', cassa: 'PIETRO', saldoFondiDopoCent: 25_000, saldoEvDopoCent: 0 } });
      await stabilizza();
      await scaricaRilettura(pagina([r]));
    });

    it('su una PERDITA la chiave non parte affatto', async () => {
      // ⚠️ Omessa e non mandata vuota: `@IsIn` sul server rifiuta la stringa
      // vuota, quindi un `cassa: ''` darebbe 400 su un movimento legittimo.
      const r = riga();
      await rispondi(pagina([r]));
      await apri(r);

      await scegliAsse('PERDITA');
      await digitaImporto('-400');
      const causale = fixture.nativeElement.querySelector(
        '#stk-causale',
      ) as HTMLInputElement;
      causale.value = 'giocatore sparito';
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
      expect('cassa' in req.request.body).toBeFalse();
      expect(req.request.body.tipo).toBe('PERDITA');
      req.flush({ riga: r, movimento: { id: 'm2', tipo: 'PERDITA', importoCent: -40_000, causale: 'giocatore sparito', saldoFondiDopoCent: 0, saldoEvDopoCent: 0 } });
      await stabilizza();
      await scaricaRilettura(pagina([r]));
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
      const tipo = fixture.nativeElement.querySelector(
        '#stk-tipo',
      ) as HTMLSelectElement;
      tipo.value = 'EV';
      tipo.dispatchEvent(new Event('change'));
      await digitaImporto('400');
      expect(testo()).toContain('Puoi recuperare al massimo');
      expect(testo()).toContain('340,00');
    });

    it('⚠️ il vincolo «≤ 0» NON si applica ai fondi', async () => {
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
});
