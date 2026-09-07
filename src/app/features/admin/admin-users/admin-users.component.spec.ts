import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  AdminUser,
  AdminUsersPage,
  AffiliazioneCompatta,
  Role,
} from '../../../core/models/api.models';
import { AdminUsersComponent } from './admin-users.component';

const API = environment.API_URL;

const utente = (over: Partial<AdminUser> = {}): AdminUser => ({
  id: 'u1',
  email: 'mario@bff.it',
  nickname: 'Mario',
  role: 'USER',
  verified: true,
  points: 1200,
  createdAt: '2026-01-10T10:00:00.000Z',
  ...over,
});

const pagina = (
  items: AdminUser[],
  sale: Record<string, AffiliazioneCompatta[]> = {},
): AdminUsersPage => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
  affiliazioniPerUtente: Object.fromEntries(
    items.map((u) => [u.id, sale[u.id] ?? []]),
  ),
});

describe('AdminUsersComponent', () => {
  let fixture: ComponentFixture<AdminUsersComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  /** Risponde alla GET dell'elenco e stabilizza. */
  const rispondi = async (p: AdminUsersPage) => {
    const req = http.expectOne((r) => r.url === `${API}/admin/users`);
    req.flush(p);
    await stabilizza();
  };

  /** Le cinque GET che l'apertura della modale lancia insieme. */
  const rispondiModale = async (id = 'u1', sale: unknown[] = []) => {
    for (const rotta of [
      'subscription-requests',
      'audit',
      'live-attendance',
      'lesson-views',
      'affiliations',
    ]) {
      http
        .expectOne((r) => r.url === `${API}/admin/users/${id}/${rotta}`)
        .flush([]);
    }
    http
      .expectOne((r) => r.url.startsWith(`${API}/admin/discounts`))
      .flush({ items: [], total: 0, page: 1, limit: 100, totalPages: 1 });
    // Le sale, per il recupero di un'affiliazione preesistente.
    http
      .expectOne((r) => r.url === `${API}/admin/affiliations/rooms`)
      .flush({ items: sale, total: sale.length, page: 1, limit: 100, totalPages: 1 });
    await stabilizza();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminUsersComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    document.documentElement.classList.remove('is-modale');
  });

  describe('la tabella', () => {
    it('elenca ogni ruolo nel filtro, i due nuovi compresi', async () => {
      await rispondi(pagina([utente()]));
      // ⚠️ Il difetto che questo test previene è MUTO: l'elenco dei ruoli era
      // un array letterale tipizzato `Role[]`, quindi allargare il tipo `Role`
      // lo lasciava valido — build verde, Karma verde — e la tendina mostrava
      // quattro voci su sei, cioè i ruoli nuovi non erano assegnabili da
      // nessuna parte del sito.
      const opzioni = [
        ...fixture.nativeElement.querySelectorAll('select option'),
      ].map((o: HTMLOptionElement) => o.value);
      for (const r of [
        'USER',
        'PESCE_ROSSO',
        'SQUALO',
        'STAKATO',
        'COACH',
        'ADMIN',
      ] as Role[]) {
        expect(opzioni).toContain(r);
      }
    });

    describe('la colonna Scadenza distingue TRE cose', () => {
      /**
       * ⚠️ Si legge la CELLA e non il testo di tutta la pagina: «Nessuna»
       * compare legittimamente anche nella colonna Sale, quindi un'asserzione
       * sul testo globale passerebbe (o fallirebbe) per il motivo sbagliato.
       * Ordine delle celle: Stato · Sale · Scadenza · Punti · Azioni.
       */
      const cellaScadenza = () =>
        (
          fixture.nativeElement.querySelectorAll('tbody tr td')[2] as HTMLElement
        ).textContent?.trim() ?? '';

      it('«Mai» per un ruolo che non scade', async () => {
        // ⚠️ Non una cella vuota: il vuoto si legge come «dato mancante» e
        // manda a cercare un guasto che non c'è.
        await rispondi(pagina([utente({ role: 'STAKATO' })]));
        expect(cellaScadenza()).toBe('Mai');
      });

      it('«Nessuna» per un tier a tempo che la scadenza non ce l’ha', async () => {
        await rispondi(pagina([utente({ role: 'SQUALO' })]));
        expect(cellaScadenza()).toBe('Nessuna');
      });

      it('la data quando c’è', async () => {
        await rispondi(
          pagina([
            utente({
              role: 'SQUALO',
              subscriptionExpiresAt: '2026-12-24T22:59:59.000Z',
            }),
          ]),
        );
        // Il nome del mese dipende dal locale registrato, che nel TestBed non
        // è quello dell'applicazione: si asserisce su ciò che il locale non
        // cambia.
        expect(cellaScadenza()).toContain('24');
        expect(cellaScadenza()).toContain('2026');
        expect(cellaScadenza()).not.toContain('Nessuna');
        expect(cellaScadenza()).not.toContain('Mai');
      });
    });

    describe('la colonna Sale', () => {
      it('dice «Nessuna» invece di restare vuota', async () => {
        await rispondi(pagina([utente()]));
        expect(testo()).toContain('Nessuna');
      });

      it('stampa sala e username dichiarato', async () => {
        await rispondi(
          pagina([utente()], {
            u1: [
              {
                roomId: 'r1',
                roomName: 'Sala Uno',
                roomUsername: 'FishKiller91',
                daVerificare: false,
              },
            ],
          }),
        );
        expect(testo()).toContain('Sala Uno');
        expect(testo()).toContain('FishKiller91');
      });

      it('marca come «da verificare» un username che nessuno ha ancora confermato', async () => {
        // ⚠️ Senza questa distinzione la cella mostrerebbe un nome non
        // controllato con lo stesso aspetto di uno approvato, e su questa
        // colonna la differenza è tutto il significato. Il segnale non può
        // essere il solo colore: c'è anche il testo per lo screen reader.
        await rispondi(
          pagina([utente()], {
            u1: [
              {
                roomId: 'r1',
                roomName: 'Sala Uno',
                roomUsername: 'FishKiller91',
                daVerificare: true,
              },
            ],
          }),
        );
        expect(
          fixture.nativeElement.querySelector('.admin-table__chip.is-attesa'),
        ).toBeTruthy();
        expect(testo()).toContain('da verificare');
      });
    });

    it('lo stato vuoto è un messaggio, non una tabella con la sola intestazione', async () => {
      await rispondi(pagina([]));
      expect(testo()).toContain('Nessun iscritto trovato');
    });
  });

  /**
   * ⚠️ Il comando di riga si cerca per NOME ACCESSIBILE e non per classe, ed è
   * una scelta contro la corrente: dal 07/09/2026 quel pulsante è solo-icona,
   * quindi `textContent` è vuoto e il vecchio `find` per testo schiantava con
   * un TypeError che non nomina la causa. La riparazione naturale sarebbe
   * `querySelector('.admin-table__ico')` — e da lì in poi nel repo non
   * resterebbe UNA SOLA riga che nomina l'etichetta del comando principale di
   * questa tabella. Cercandolo per `aria-label` il test resta una rete: se il
   * nome sparisce, il rosso torna.
   */
  const comandoRiga = (i = 0): HTMLButtonElement =>
    [...fixture.nativeElement.querySelectorAll('button')].filter(
      (b: HTMLButtonElement) =>
        b.getAttribute('aria-label')?.startsWith('Gestisci '),
    )[i] as HTMLButtonElement;

  describe('il comando di riga', () => {
    it('⚠️ è solo-icona, quindi il suo nome accessibile NOMINA la riga', async () => {
      // Prima erano 25 pulsanti che annunciavano tutti «Gestisci»: il difetto
      // c'era già, e togliendo la parola sarebbe diventato totale — `app-icon`
      // porta `aria-hidden` sull'host, quindi un bottone senza etichetta è
      // anonimo e basta. Nessun'altra spec del pannello admin guarda un nome
      // accessibile: questa è l'unica rete.
      await rispondi(
        pagina([
          utente(),
          utente({ id: 'u2', email: 'lucia@bff.it', nickname: 'Lucia' }),
        ]),
      );
      const a = comandoRiga(0).getAttribute('aria-label');
      const b = comandoRiga(1).getAttribute('aria-label');
      expect(a).toBe('Gestisci Mario');
      expect(b).toBe('Gestisci Lucia');
      // Il punto non è che l'etichetta esista: è che due righe si distinguano.
      expect(a).not.toBe(b);
      // E che non ci sia testo visibile a sostituirla.
      expect(comandoRiga(0).textContent?.trim()).toBe('');
    });

    it('dichiara che apre un dialog, non un menu', async () => {
      // ⚠️ I tre puntini in giro per il mondo aprono un MENU. Qui si apre una
      // scheda modale: senza `aria-haspopup="dialog"` la promessa dell'icona e
      // quello che succede davvero non coincidono.
      await rispondi(pagina([utente()]));
      expect(comandoRiga(0).getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('senza nickname ripiega sull’email, mai su un nome vuoto', async () => {
      await rispondi(pagina([utente({ nickname: undefined })]));
      expect(comandoRiga(0).getAttribute('aria-label')).toBe(
        'Gestisci mario@bff.it',
      );
    });
  });

  describe('la modale', () => {
    const apri = async () => {
      comandoRiga().click();
      await rispondiModale();
    };

    it('si apre come dialog modale sull’iscritto scelto', async () => {
      await rispondi(pagina([utente()]));
      await apri();
      const d = fixture.nativeElement.querySelector(
        'dialog',
      ) as HTMLDialogElement;
      expect(d.matches(':modal')).toBe(true);
      expect(testo()).toContain('mario@bff.it');
    });

    it('Pesce Rosso e Squalo non sono assegnabili dalla tendina del ruolo', async () => {
      // ⚠️ Il server risponde 400 rimandando a «Concedi abbonamento»: questa
      // scrittura non chiede una data e produrrebbe un abbonamento senza
      // scadenza — l'anomalia che la tab Statistiche esiste per segnalare. Il
      // pannello lo dice PRIMA, invece di lasciarlo spiegare a un errore.
      await rispondi(pagina([utente()]));
      await apri();
      const select = fixture.nativeElement.querySelector(
        '#mod-ruolo',
      ) as HTMLSelectElement;
      const spente = [...select.options]
        .filter((o) => o.disabled)
        .map((o) => o.value);
      expect(spente).toContain('PESCE_ROSSO');
      expect(spente).toContain('SQUALO');
      expect(spente).not.toContain('STAKATO');
      expect(spente).not.toContain('COACH');
    });

    it('digitare sporca il form: Escape chiede conferma invece di buttare via', async () => {
      // ⚠️ È la trappola che questo lotto ha dovuto evitare due volte: un
      // `computed()` costruito su `FormControl.value` non si ricalcola mai
      // (un FormGroup non è un signal), quindi `sporco` resterebbe falso per
      // sempre e la conferma non comparirebbe MAI. Il test digita davvero.
      await rispondi(pagina([utente()]));
      await apri();

      const motivo = fixture.nativeElement.querySelector(
        '#mod-motivo',
      ) as HTMLInputElement;
      motivo.value = 'bonus di benvenuto';
      motivo.dispatchEvent(new Event('input'));
      await stabilizza();

      const d = fixture.nativeElement.querySelector(
        'dialog',
      ) as HTMLDialogElement;
      const ev = new Event('cancel', { cancelable: true });
      d.dispatchEvent(ev);
      await stabilizza();

      expect(ev.defaultPrevented).toBe(true);
      expect(testo()).toContain('modifiche non salvate');
    });

    it('sul proprio account i comandi che modificano sono spenti', async () => {
      // `isSelf` non nasconde più i comandi: la modale si apre e dice perché
      // sono spenti. Un comando che sparisce fa cercare dove sia finito.
      const auth = TestBed.inject(
        (await import('../../../core/services/auth.service')).AuthService,
      );
      (auth as unknown as { user: { set: (v: unknown) => void } }).user.set({
        id: 'u1',
        email: 'mario@bff.it',
        role: 'ADMIN',
      });
      await rispondi(pagina([utente({ role: 'ADMIN' })]));
      await apri();
      expect(testo()).toContain('Questo è il tuo account');
      const elimina = [
        ...fixture.nativeElement.querySelectorAll('button'),
      ].find((b: HTMLButtonElement) =>
        b.textContent?.includes('Elimina definitivamente'),
      ) as HTMLButtonElement;
      expect(elimina.disabled).toBe(true);
    });

    describe("recupero di un'affiliazione preesistente", () => {
      const sala = (over: Record<string, unknown> = {}) => ({
        id: 'r1',
        name: 'Sala Uno',
        slug: 'sala-uno',
        ordine: 100,
        active: true,
        identifierLabel: 'Username di login',
        identifierMinLen: 3,
        identifierMaxLen: 40,
        identifierFormat: 'LIBERO',
        identifierCaseSensitive: false,
        richiedeSecondoId: false,
        consenteAccountEsistenti: false,
        affiliateUrlTemplate: 'https://esempio.it',
        supportaCodice: false,
        ...over,
      });

      const apriConSale = async (sale: unknown[]) => {
        comandoRiga().click();
        await rispondiModale('u1', sale);
      };

      it('offre anche le sale NON in vetrina, dicendolo', async () => {
        // ⚠️ `active` governa l'emissione di un link affiliato, e qui non se ne
        // emette nessuno: una sala tolta dalla vetrina può avere giocatori
        // storici da registrare. Ma va detto quale lo è, o si sceglie alla
        // cieca.
        await rispondi(pagina([utente()]));
        await apriConSale([sala({ active: false })]);
        const opzioni = [
          ...fixture.nativeElement.querySelectorAll('#aff-sala option'),
        ].map((o: HTMLOptionElement) => o.textContent?.trim());
        expect(opzioni.some((t) => t?.includes('non in vetrina'))).toBe(true);
      });

      it('⚠️ dichiara che le due dichiarazioni dell’utente NON sono state date', async () => {
        // È il vincolo GDPR della funzione, e l'unico posto in cui chi la usa lo
        // può leggere. Senza questa riga il pannello lascerebbe credere che la
        // pratica sia equivalente a una aperta dall'iscritto.
        await rispondi(pagina([utente()]));
        await apriConSale([sala()]);
        expect(testo()).toContain('non ha accettato i termini');
        expect(testo()).toContain('Non parte alcuna email');
      });

      it('manda username e sala, e NON manda dichiarazioni', async () => {
        await rispondi(pagina([utente()]));
        await apriConSale([sala()]);

        const sel = fixture.nativeElement.querySelector(
          '#aff-sala',
        ) as HTMLSelectElement;
        sel.value = 'r1';
        sel.dispatchEvent(new Event('change'));
        const inp = fixture.nativeElement.querySelector(
          '#aff-user',
        ) as HTMLInputElement;
        inp.value = 'FishKiller91';
        inp.dispatchEvent(new Event('input'));
        await stabilizza();

        (
          [...fixture.nativeElement.querySelectorAll('button')].find(
            (b: HTMLButtonElement) =>
              b.textContent?.includes('Registra affiliazione'),
          ) as HTMLButtonElement
        ).click();

        const req = http.expectOne(
          (r) => r.url === `${API}/admin/affiliations/manuale`,
        );
        const body = req.request.body as Record<string, unknown>;
        expect(body['roomId']).toBe('r1');
        expect(body['roomUsername']).toBe('FishKiller91');
        // ⚠️ Nessuna dichiarazione nel corpo: il server le rifiuterebbe, ma il
        // client non deve nemmeno provarci — è il punto in cui un domani
        // qualcuno le aggiungerebbe «per far passare la validazione».
        expect(body['dichiaraProprieta']).toBeUndefined();
        expect(body['accettaTermini']).toBeUndefined();
        req.flush({
          id: 'a1',
          roomId: 'r1',
          roomName: 'Sala Uno',
          roomAttiva: true,
          refCode: 'AFF-ABCD2345',
          status: 'APPROVATO',
          statusLabel: 'Tracciato',
          roomUsername: 'FishKiller91',
          origine: 'ADMIN',
          accountEsistente: true,
          dichiaraProprieta: false,
          accettaTermini: false,
          riaperture: 0,
          userId: 'u1',
          userEmail: 'mario@bff.it',
        });
        await stabilizza();

        // Compare subito nell'elenco, marcata per quello che è.
        expect(testo()).toContain('Registrata da te');
      });
    });

    it('si chiude da sola se l’iscritto sparisce dall’elenco', async () => {
      // ⚠️ È il caso «Elimina»: la modale resterebbe aperta su un account che
      // non esiste più, e ogni suo comando risponderebbe 404.
      await rispondi(pagina([utente()]));
      await apri();
      expect(fixture.nativeElement.querySelector('dialog')).toBeTruthy();

      fixture.componentInstance['page'].set(pagina([]));
      await stabilizza();

      expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
      expect(document.documentElement.classList.contains('is-modale')).toBe(
        false,
      );
    });
  });

  afterEach(() => {
    http.verify();
  });
});
