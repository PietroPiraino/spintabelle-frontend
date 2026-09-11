import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { computed, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ProspettoMese } from '../../core/models/api.models';
import { AccountComponent } from './account.component';

/**
 * ⚠️ Fino all'11/09/2026 questa pagina NON aveva alcuna spec, e ci è arrivata
 * sopra la prima superficie dei conteggi rivolta all'utente. Queste prove
 * guardano solo quella sezione: il resto della pagina resta scoperto, e
 * questa riga è qui perché non si legga il file come una copertura.
 */
describe('AccountComponent — i miei conteggi', () => {
  let fixture: ComponentFixture<AccountComponent>;
  let http: HttpTestingController;

  const utente = {
    id: 'u1',
    email: 'rossana@example.it',
    nickname: 'MadRoxKO',
    role: 'USER',
    points: 0,
    notifyNewLessons: true,
  };

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    const user = signal<unknown>(utente);
    await TestBed.configureTestingModule({
      imports: [AccountComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user,
            ready: signal(true),
            isAuthenticated: computed(() => user() !== null),
            // ⚠️ Il componente li LEGGE come proprietà (`= this.auth.isAdmin`)
            // e il template li chiama: devono essere signal, non funzioni.
            isAdmin: signal(false),
            points: signal(0),
            loadMe: () => undefined,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AccountComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Serve TUTTE le richieste dell'avvio, tranne il prospetto che ogni prova
   * decide da sé. ⚠️ Per predicato e non per URL esatta: questa spec guarda
   * una sezione, e non deve rompersi perché un'altra parte della pagina cambia
   * indirizzo.
   */
  const flushAltre = () => {
    for (const r of http.match((req) => !req.url.includes('mio-prospetto'))) {
      r.flush(req_isPunti(r.request.url) ? { balance: 0, ledger: [] } : []);
    }
  };
  const req_isPunti = (url: string) => /points/i.test(url);

  it('NON compare a chi non ha conteggi, che è quasi chiunque', async () => {
    await stabilizza();
    flushAltre();
    http.expectOne((r) => r.url.includes('mio-prospetto')).flush([]);
    await stabilizza();
    expect(fixture.nativeElement.textContent).not.toContain('I miei conteggi');
  });

  it('mostra i propri numeri, e dichiara il mese aperto come provvisorio', async () => {
    await stabilizza();
    flushAltre();
    const prospetto: ProspettoMese[] = [
      {
        meseId: 'm1',
        anno: 2026,
        mese: 9,
        etichetta: 'settembre 2026',
        provvisorio: true,
        rakeback: {
          username: 'MadRoxKO',
          backPlayerBp: 5000,
          scaglioneBaseBp: 4500,
          scaglionePassoCent: 2250,
          rakeGeneratoCent: 46_117,
          erogatoBonusCent: 20_250,
          spettanteAlPlayerCent: 2809,
          pagatoAlPlayerCent: 1000,
          residuoAlPlayerCent: 1809,
        },
      },
    ];
    http.expectOne((r) => r.url.includes('mio-prospetto')).flush(prospetto);
    await stabilizza();

    const testo = fixture.nativeElement.textContent as string;
    expect(testo).toContain('I miei conteggi');
    expect(testo).toContain('settembre 2026');
    expect(testo).toContain('461,17');
    expect(testo).toContain('28,09');
    expect(testo).toContain('18,09');
    // ⚠️ Il mese aperto si DICHIARA: i suoi numeri possono ancora cambiare.
    expect(testo).toContain('provvisorio');
  });

  it('un errore sul prospetto non rompe la pagina', async () => {
    // ⚠️ Best-effort come buoni e ordini: quasi nessuno ha un accordo di
    // rakeback, e un errore in rosso sulla pagina di tutti sarebbe rumore.
    await stabilizza();
    flushAltre();
    http
      .expectOne((r) => r.url.includes('mio-prospetto'))
      .flush({ message: 'giù' }, { status: 500, statusText: 'Server Error' });
    await stabilizza();
    expect(fixture.nativeElement.textContent).not.toContain('I miei conteggi');
  });
});
