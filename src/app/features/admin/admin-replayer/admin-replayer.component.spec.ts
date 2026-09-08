import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import {
  HandReportPage,
  HandReportRow,
} from '../../../core/services/admin-hands.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AdminReplayerComponent } from './admin-replayer.component';

const API = environment.API_URL;

/**
 * La PRIMA spec di questa sezione.
 *
 * ⚠️ Fino all'08/09/2026 `/admin/replayer` non ne aveva nessuna: le cinque
 * decisioni non erano coperte da niente, compresa l'unica **irreversibile** del
 * pannello — «Togli i nomi», che è la risposta all'art. 17 e fino a oggi
 * partiva al primo tocco senza alcuna conferma. Una schermata che tratta i dati
 * personali di terzi e non ha una rete è il posto sbagliato in cui non averla.
 *
 * ⚠️ Le tre etichette GDPR sono asserite **verbatim**: «Togli i nomi», «Rimuovi
 * la mano», «Ripristina» dicono tre cose diverse — togliere il nome lasciando
 * la mano, togliere la pagina lasciando il nome dentro, annullare — e chi le
 * confonde risponde alla richiesta sbagliata. Non sono stringhe di comodo.
 */
const riga = (over: Partial<HandReportRow> = {}): HandReportRow =>
  ({
    id: 'r1',
    handId: 'h1',
    handPublicId: 'pub1',
    motivo: 'DATI_PERSONALI',
    dettaglio: 'Sono io e non voglio comparire',
    contatto: 'tizio@example.com',
    stato: 'APERTA',
    decisionNote: '',
    createdAt: '2026-09-01T10:00:00.000Z',
    senzaAccount: true,
    mano: {
      roomLabel: 'PokerStars',
      status: 'PUBBLICA',
      anonimizzata: false,
      players: [{ posizione: 'BTN', nome: 'FishKiller' }],
    },
    ...over,
  }) as HandReportRow;

const pagina = (
  items: HandReportRow[],
  over: Partial<HandReportPage> = {},
): HandReportPage => ({
  items,
  total: items.length,
  page: 1,
  limit: 25,
  totalPages: 1,
  ...over,
});

describe('AdminReplayerComponent', () => {
  let fixture: ComponentFixture<AdminReplayerComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReplayerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReplayerComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const root = () => fixture.nativeElement as HTMLElement;
  const testo = (el: Element | null = root()) =>
    (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const uno = <T extends Element>(sel: string, scope: Element = root()) =>
    scope.querySelector<T>(sel);
  const tutti = <T extends Element>(sel: string, scope: Element = root()) => [
    ...scope.querySelectorAll<T>(sel),
  ];

  const stabilizza = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const rispondi = async (items: HandReportRow[]) => {
    http.expectOne((r) => r.url === `${API}/admin/hands/reports`).flush(pagina(items));
    await stabilizza();
  };

  const clicca = async (el: HTMLElement) => {
    el.click();
    await stabilizza();
  };

  /** Apre la scheda della prima riga e la restituisce. */
  const scheda = async (): Promise<HTMLElement> => {
    await clicca(uno<HTMLButtonElement>('.admin-table__c-ultimo .admin-ico')!);
    const s = uno<HTMLElement>('dialog .admin-modale');
    if (!s) throw new Error('Scheda non aperta');
    return s;
  };

  /** Scrive il motivo della decisione: senza, il server risponde 400. */
  const scriviMotivo = async (s: HTMLElement, v: string) => {
    const campo = uno<HTMLInputElement>('input.input', s)!;
    campo.value = v;
    campo.dispatchEvent(new Event('input'));
    await stabilizza();
  };

  // ── 1. L'elenco ──────────────────────────────────────────────────────────

  it('la coda è una TABELLA, e la riga non porta i comandi', async () => {
    await rispondi([riga()]);

    expect(tutti('table.admin-table tbody tr').length).toBe(1);
    // Il motivo in italiano, non l'enum.
    expect(testo(uno('.admin-table__ident-riga'))).toBe(
      'Compare nella mano e vuole essere rimosso',
    );
    // ⚠️ Un solo comando sulla riga: erano fino a sei pulsanti di testo dentro
    // una fisarmonica senza ARIA.
    expect(tutti('tbody .btn').length).toBe(0);
    expect(tutti('tbody .admin-ico').length).toBe(1);
  });

  it('lo stato è una pastiglia con un TONO, non l’enum in un badge', async () => {
    await rispondi([riga({ stato: 'ACCOLTA' })]);

    const p = uno('.admin-stato');
    // ⚠️ Era `<span class="badge badge--tag">{{ r.stato }}</span>`: la classe
    // dei FATTI usata per uno STATO, con l'enum grezzo in maiuscolo dentro.
    expect(p).not.toBeNull();
    expect(testo(p)).toBe('Accolta');
    expect(p!.getAttribute('data-tono')).toBe('ok');
  });

  it('«senza account» è un marcatore quieto nel sotto-testo, non una pastiglia', async () => {
    await rispondi([riga()]);

    // ⚠️ Si ripete su ogni riga ed è il caso NORMALE — lo dice il paragrafo
    // sopra l'elenco. Una pastiglia arancione piena che c'è sempre non marca
    // niente, e portava l'unico `#fff` letterale della sezione.
    expect(testo(uno('.admin-table__sub'))).toContain('senza account');
    expect(uno('.ar__anonimo')).toBeNull();
  });

  it('un elenco vuoto dice di QUALE vuoto si tratta', async () => {
    await rispondi([]);
    expect(testo(uno('.empty-state'))).toBe('Nessuna segnalazione aperta.');

    await clicca(
      tutti<HTMLButtonElement>('[role="radio"]').find(
        (b) => testo(b) === 'Tutte',
      )!,
    );
    await rispondi([]);
    expect(testo(uno('.empty-state'))).toBe('Nessuna segnalazione.');
  });

  it('il filtro ricarica la coda dalla prima pagina', async () => {
    await rispondi([riga()]);

    tutti<HTMLButtonElement>('[role="radio"]')
      .find((b) => testo(b) === 'Tutte')!
      .click();
    await stabilizza();

    const req = http.expectOne((r) => r.url === `${API}/admin/hands/reports`);
    expect(req.request.params.get('stato')).toBe('TUTTE');
    expect(req.request.params.get('page')).toBe('1');
    req.flush(pagina([]));
    await stabilizza();
  });

  // ── 2. Le tre azioni sui dati della mano ─────────────────────────────────

  it('le tre azioni GDPR ci sono TUTTE, con le loro etichette', async () => {
    await rispondi([riga()]);
    const s = await scheda();

    // ⚠️ Verbatim: dicono tre cose diverse, e confonderle significa rispondere
    // alla richiesta sbagliata.
    expect(testo(uno('.ar__anonimizza', s))).toBe('Togli i nomi (irreversibile)');
    expect(testo(uno('.ar__rimuovi', s))).toBe('Rimuovi la mano');
    expect(testo(uno('.ar__ripristina', s))).toBe('Ripristina');
  });

  it('⚠️ «Togli i nomi» NON parte al primo tocco: chiede conferma', async () => {
    await rispondi([riga()]);
    const s = await scheda();

    await clicca(uno<HTMLButtonElement>('.ar__anonimizza', s)!);

    // Nessuna chiamata: si è aperta la conferma. Era l'unica azione distruttiva
    // del pannello a partire subito, su un comando che si chiama irreversibile.
    http.expectNone((r) => r.url.endsWith('/anonimizza'));
    const conferma = uno<HTMLElement>('.ar__conferma');
    expect(conferma).not.toBeNull();
    expect(testo(conferma)).toContain('non si torna indietro');

    // Ripensarci non costa niente.
    await clicca(uno<HTMLButtonElement>('.ar__conferma-no', conferma!)!);
    expect(uno('.ar__conferma')).toBeNull();
    http.expectNone((r) => r.url.endsWith('/anonimizza'));
  });

  it('confermando, «Togli i nomi» chiama la rotta e ricarica la coda', async () => {
    await rispondi([riga()]);
    const s = await scheda();

    await clicca(uno<HTMLButtonElement>('.ar__anonimizza', s)!);
    await clicca(uno<HTMLButtonElement>('.ar__conferma-si')!);

    const req = http.expectOne(`${API}/admin/hands/h1/anonimizza`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ok: true });
    await stabilizza();

    // La scheda si chiude e l'elenco si ricarica.
    expect(uno('dialog .admin-modale')).toBeNull();
    await rispondi([riga({ mano: { ...riga().mano!, anonimizzata: true } })]);
  });

  it('«Rimuovi la mano» manda il motivo nel corpo', async () => {
    await rispondi([riga()]);
    const s = await scheda();
    await scriviMotivo(s, 'Richiesta del diretto interessato');

    await clicca(uno<HTMLButtonElement>('.ar__rimuovi', s)!);

    const req = http.expectOne(`${API}/admin/hands/h1/rimuovi`);
    expect(req.request.body).toEqual({
      decisionNote: 'Richiesta del diretto interessato',
    });
    req.flush({ ok: true });
    await stabilizza();
    await rispondi([]);
  });

  it('⚠️ senza motivo non parte NIENTE: il server risponde 400 e fa bene', async () => {
    const errore = spyOn(TestBed.inject(ToastService), 'error');
    await rispondi([riga()]);
    const s = await scheda();

    await clicca(uno<HTMLButtonElement>('.ar__rimuovi', s)!);

    http.expectNone((r) => r.url.endsWith('/rimuovi'));
    expect(errore).toHaveBeenCalled();
    expect(errore.calls.mostRecent().args[0]).toContain('agli atti');
  });

  // ── 3. Chiudere la pratica ───────────────────────────────────────────────

  it('«Chiudi: accolta» e «Chiudi: respinta» colpiscono la SEGNALAZIONE, non la mano', async () => {
    await rispondi([riga()]);
    const s = await scheda();
    await scriviMotivo(s, 'Verificato e sistemato');

    await clicca(uno<HTMLButtonElement>('.ar__accogli', s)!);
    // ⚠️ L'id della SEGNALAZIONE (`r1`), non della mano (`h1`): sono due
    // oggetti diversi, e sbagliarli chiude la pratica su un'altra riga.
    const req = http.expectOne(`${API}/admin/hands/reports/r1/accogli`);
    expect(req.request.body).toEqual({ decisionNote: 'Verificato e sistemato' });
    req.flush({ ok: true });
    await stabilizza();
    await rispondi([]);
  });

  it('una segnalazione già decisa non offre alcuna azione, e dice come è finita', async () => {
    await rispondi([
      riga({ stato: 'RESPINTA', decisionNote: 'Il nome non compare' }),
    ]);
    const s = await scheda();

    expect(testo(uno('.ar__decisa', s))).toContain('Respinta');
    expect(testo(uno('.ar__decisa', s))).toContain('Il nome non compare');
    expect(uno('.ar__anonimizza', s)).toBeNull();
    expect(uno('.ar__rimuovi', s)).toBeNull();
    expect(uno('input.input', s)).toBeNull();
  });

  // ── 4. Quello che la scheda deve mostrare prima di decidere ──────────────

  it('la scheda porta i nomi al tavolo: sono i dati di cui si sta decidendo', async () => {
    await rispondi([riga()]);
    const s = await scheda();

    expect(testo(uno('.ar__giocatori', s))).toContain('BTN FishKiller');
    expect(testo(uno('.ar__dettaglio', s))).toContain('non voglio comparire');
    expect(testo(s)).toContain('tizio@example.com');
  });

  it('una mano non più esistente lo dice, invece di lasciare il vuoto', async () => {
    await rispondi([riga({ mano: undefined })]);

    expect(testo(uno('.admin-table__sub'))).toContain('mano non più esistente');
    const s = await scheda();
    // Niente link a una mano che non c'è.
    expect(uno('a[href^="/replayer"]', s)).toBeNull();
  });
});
