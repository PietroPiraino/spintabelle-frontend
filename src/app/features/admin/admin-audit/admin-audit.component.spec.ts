import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  AdminActionLogEntry,
  Paginated,
} from '../../../core/models/api.models';
import { AdminAuditComponent } from './admin-audit.component';

const API = environment.API_URL;

const voce = (over: Partial<AdminActionLogEntry> = {}): AdminActionLogEntry =>
  ({
    id: 'a1',
    action: 'set-role',
    adminEmail: 'admin@bff.it',
    userEmail: 'mario@bff.it',
    createdAt: '2026-09-01T10:00:00.000Z',
    ...over,
  }) as AdminActionLogEntry;

const pagina = (
  items: AdminActionLogEntry[],
  over: Partial<Paginated<AdminActionLogEntry>> = {},
): Paginated<AdminActionLogEntry> => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
  ...over,
});

describe('AdminAuditComponent', () => {
  let fixture: ComponentFixture<AdminAuditComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rispondi = async (p: Paginated<AdminActionLogEntry>) => {
    http.expectOne((r) => r.url === `${API}/admin/audit`).flush(p);
    await stabilizza();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAuditComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminAuditComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('è una TABELLA con le intestazioni, non un elenco di card', async () => {
    await rispondi(pagina([voce()]));
    const th = [
      ...fixture.nativeElement.querySelectorAll('thead th'),
    ] as HTMLElement[];
    expect(th.length).toBeGreaterThan(0);
    // `scope` non è decorativo: senza, uno screen reader non associa la cella
    // alla sua intestazione e legge una griglia di valori sciolti.
    for (const h of th) expect(h.getAttribute('scope')).toBe('col');
    expect(
      fixture.nativeElement.querySelector('tbody th[scope="row"]'),
    ).toBeTruthy();
  });

  it('⚠️ traduce lo slug dell’azione, non lo stampa grezzo', async () => {
    // Le stringhe di `AdminAction` sono una union chiusa lato server e le
    // etichette vivono in `action-labels.ts`: una voce nuova senza etichetta
    // finirebbe in pagina come `add-staking-movement`.
    await rispondi(pagina([voce({ action: 'set-role' })]));
    expect(testo()).not.toContain('set-role');
    expect(testo()).toContain('Ruolo modificato');
    expect(testo()).toContain('mario@bff.it');
  });

  it('⚠️ un’azione di sistema dice «sistema», non lascia la cella vuota', async () => {
    // Una cella vuota si legge come «dato mancante» e manda a cercare un
    // guasto; qui l'assenza di un amministratore è un'informazione esatta.
    await rispondi(pagina([voce({ adminEmail: undefined })]));
    expect(testo()).toContain('sistema');
  });

  it('riepiloga la modifica come «prima → dopo» con le etichette italiane', async () => {
    await rispondi(
      pagina([
        voce({
          before: { role: 'USER' },
          after: { role: 'SQUALO' },
        } as Partial<AdminActionLogEntry>),
      ]),
    );
    expect(testo()).toContain('Ruolo: USER → SQUALO');
  });

  it('lo stato vuoto è un messaggio, non una tabella con la sola intestazione', async () => {
    await rispondi(pagina([]));
    expect(testo()).toContain('Nessuna azione registrata');
    expect(fixture.nativeElement.querySelector('table')).toBeFalsy();
  });

  it('con una pagina sola il pager non c’è', async () => {
    await rispondi(pagina([voce()]));
    expect(fixture.nativeElement.querySelector('.admin-users__pager')).toBeFalsy();
  });

  it('il pager chiede la pagina giusta', async () => {
    // ⚠️ Una sola risposta: il costruttore fa UN `load()`, e un secondo
    // `expectOne` cercherebbe una chiamata che nessuno ha fatto.
    await rispondi(pagina([voce()], { page: 1, totalPages: 3, total: 60 }));
    const avanti = [
      ...fixture.nativeElement.querySelectorAll('button'),
    ].find((b: HTMLButtonElement) =>
      b.textContent?.includes('Successivi'),
    ) as HTMLButtonElement;
    avanti.click();
    const req = http.expectOne((r) => r.url === `${API}/admin/audit`);
    expect(req.request.params.get('page')).toBe('2');
    req.flush(pagina([voce()], { page: 2, totalPages: 3 }));
    await stabilizza();
  });

  it('un errore di caricamento si vede e NON si traveste da elenco vuoto', async () => {
    http
      .expectOne((r) => r.url === `${API}/admin/audit`)
      .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });
    await stabilizza();
    expect(
      fixture.nativeElement.querySelector('[role="alert"]'),
    ).toBeTruthy();
    expect(testo()).not.toContain('Nessuna azione registrata');
  });
});
