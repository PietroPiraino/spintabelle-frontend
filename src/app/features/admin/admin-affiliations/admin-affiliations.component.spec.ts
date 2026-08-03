import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { environment } from '../../../../environments/environment';
import {
  AffiliationAdmin,
  Paginated,
  PokerRoomAdmin,
} from '../../../core/models/api.models';
import { AdminAffiliationsComponent } from './admin-affiliations.component';

const API = environment.API_URL;

const rowOf = (id: string): AffiliationAdmin => ({
  id,
  roomId: 'room-1',
  roomName: 'Sala Uno',
  roomSlug: 'sala-uno',
  roomAttiva: true,
  refCode: 'AFF-7K2M9QRT',
  status: 'IN_VERIFICA',
  statusLabel: 'In verifica',
  roomUsername: 'FishKiller91',
  accountEsistente: false,
  dichiaraProprieta: true,
  accettaTermini: true,
  riaperture: 0,
  userId: 'u1',
  userEmail: 'tizio@example.com',
  userNickname: 'Tizio',
});

const roomOf = (id: string, ordine = 100): PokerRoomAdmin => ({
  id,
  ordine,
  name: 'Sala Uno',
  slug: 'sala-uno',
  identifierLabel: 'Username di login',
  identifierMinLen: 3,
  identifierMaxLen: 40,
  richiedeSecondoId: false,
  consenteAccountEsistenti: false,
  affiliateUrlTemplate: 'https://esempio.it/redirect?pid=1',
  identifierFormat: 'LIBERO',
  identifierCaseSensitive: false,
  active: false,
  supportaCodice: false,
});

const pageOf = <T>(items: T[], total: number): Paginated<T> => ({
  items,
  total,
  page: 1,
  limit: 25,
  totalPages: Math.max(1, Math.ceil(total / 25)),
});

/** Membri protected che il test deve pilotare. */
interface Testable {
  form: FormGroup;
  selectedLogo: WritableSignal<File | null>;
  setView(v: 'richieste' | 'sale'): void;
  submitRoom(): void;
  approve(a: AffiliationAdmin, note: string): void;
  onLogoChange(event: Event): void;
  moveRoom(r: PokerRoomAdmin, delta: -1 | 1): void;
}

describe('AdminAffiliationsComponent', () => {
  let fixture: ComponentFixture<AdminAffiliationsComponent>;
  let http: HttpTestingController;
  let comp: Testable;

  const isList = (r: { url: string }) => r.url === `${API}/admin/affiliations`;
  const isPending = (r: { url: string }) =>
    r.url === `${API}/admin/affiliations/pending-count`;
  const isRooms = (r: { url: string }) =>
    r.url === `${API}/admin/affiliations/rooms`;

  /** Il costruttore carica la coda + il conteggio: entrambi vanno serviti. */
  const flushBoot = async (rows: AffiliationAdmin[] = []) => {
    http.expectOne(isList).flush(pageOf(rows, rows.length));
    http.expectOne(isPending).flush({ inVerifica: rows.length });
    await fixture.whenStable();
  };

  const fillRoomForm = () =>
    comp.form.patchValue({
      name: 'Sala Uno',
      slug: 'sala-uno',
      affiliateUrlTemplate: 'https://esempio.it/redirect?pid=1',
    });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminAffiliationsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminAffiliationsComponent);
    http = TestBed.inject(HttpTestingController);
    comp = fixture.componentInstance as unknown as Testable;
  });

  afterEach(() => http.verify());

  it('parte dalla coda da decidere: status=IN_VERIFICA, 25 per pagina', async () => {
    const req = http.expectOne(isList);
    expect(req.request.params.get('status')).toBe('IN_VERIFICA');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(pageOf([rowOf('a1')], 1));
    http.expectOne(isPending).flush({ inVerifica: 1 });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    // Numero di pratica e username dichiarato: le due stringhe della riga.
    expect(text).toContain('AFF-7K2M9QRT');
    expect(text).toContain('FishKiller91');
    // La nota fissa sul ritardo di attribuzione parla della registrazione.
    expect(text).toContain('fino a 48 ore');
  });

  it('approva: POST e ricarica completa (la riga cambia bucket)', async () => {
    const row = rowOf('a1');
    await flushBoot([row]);

    comp.approve(row, '');
    const post = http.expectOne(
      (r) =>
        r.url === `${API}/admin/affiliations/a1/approve` && r.method === 'POST',
    );
    expect(post.request.body).toEqual({});
    post.flush({ ...row, status: 'APPROVATO', statusLabel: 'Tracciato' });
    await fixture.whenStable();

    // Ricarica lista + conteggio: una patch in place lascerebbe la riga nel
    // filtro sbagliato.
    await flushBoot();
  });

  it('sale: una sala senza logo si crea normalmente (il logo è facoltativo)', async () => {
    await flushBoot();
    comp.setView('sale');
    http.expectOne(isRooms).flush(pageOf<PokerRoomAdmin>([], 0));
    await fixture.whenStable();

    fillRoomForm();
    comp.submitRoom();

    const post = http.expectOne(
      (r) =>
        r.url === `${API}/admin/affiliations/rooms` && r.method === 'POST',
    );
    const body = post.request.body as FormData;
    expect(body.get('slug')).toBe('sala-uno');
    expect(body.get('logo')).toBeNull();
    // ⚠️ Nasce spenta: si pubblica spuntando "Attiva", mai salvandola.
    expect(body.get('active')).toBe('false');
    post.flush(roomOf('r1'));
    await fixture.whenStable();

    http.expectOne(isRooms).flush(pageOf([roomOf('r1')], 1));
    await fixture.whenStable();
  });

  it('sale: un logo oltre il limite blocca il salvataggio (nessun POST)', async () => {
    await flushBoot();
    comp.setView('sale');
    http.expectOne(isRooms).flush(pageOf<PokerRoomAdmin>([], 0));
    await fixture.whenStable();

    const big = new File([new ArrayBuffer(3 * 1024 * 1024)], 'logo.png', {
      type: 'image/png',
    });
    const input = { files: [big], value: 'C:\\fake\\logo.png' };
    comp.onLogoChange({ target: input } as unknown as Event);
    // Il campo file viene azzerato, o riselezionare lo stesso file non emette
    // `change` e l'app sembra bloccata.
    expect(input.value).toBe('');

    fillRoomForm();
    comp.submitRoom();
    fixture.detectChanges();

    // Nessuna richiesta in volo: il file scartato ferma il salvataggio invece
    // di creare in silenzio una sala senza logo.
    http.verify();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'supera il limite',
    );
  });

  /**
   * ⚠️ Il caso reale: tutte le sale nascono con `ordine = 100`, e uno scambio
   * di valori identici non produce alcun movimento. La freccia deve stendere
   * una scala di valori DISTINTI sull'elenco riordinato.
   */
  it('frecce: con tutte le sale a 100 lo spostamento rinumera (10, 20, 30…)', async () => {
    await flushBoot();
    comp.setView('sale');
    const rooms = [roomOf('r1'), roomOf('r2'), roomOf('r3')];
    http.expectOne(isRooms).flush(pageOf(rooms, 3));
    await fixture.whenStable();

    // La terza sale di un posto: l'ordine visibile diventa r1, r3, r2.
    comp.moveRoom(rooms[2], -1);

    // ⚠️ In sequenza (`concat`), non in parallelo: una cascata che fallisce a
    // metà non deve continuare a scrivere.
    for (const [id, ordine] of [
      ['r1', '10'],
      ['r3', '20'],
      ['r2', '30'],
    ]) {
      const patch = http.expectOne(
        (r) =>
          r.url === `${API}/admin/affiliations/rooms/${id}` &&
          r.method === 'PATCH',
      );
      const body = patch.request.body as FormData;
      expect(body.get('ordine')).toBe(ordine);
      // Solo `ordine`: `toFormData` salta gli `undefined`, quindi una PATCH
      // parziale non tocca il template del link né lo stato di pubblicazione.
      expect(body.get('name')).toBeNull();
      expect(body.get('affiliateUrlTemplate')).toBeNull();
      expect(body.get('active')).toBeNull();
      patch.flush(roomOf(id, Number(ordine)));
    }
    await fixture.whenStable();

    // Ricarica: l'ordine mostrato è quello che risponde il server.
    http.expectOne(isRooms).flush(pageOf(rooms, 3));
    await fixture.whenStable();
  });

  it("frecce: se una PATCH fallisce la cascata si ferma e l'elenco si ricarica", async () => {
    await flushBoot();
    comp.setView('sale');
    const rooms = [roomOf('r1'), roomOf('r2'), roomOf('r3')];
    http.expectOne(isRooms).flush(pageOf(rooms, 3));
    await fixture.whenStable();

    comp.moveRoom(rooms[2], -1);

    http
      .expectOne((r) => r.url === `${API}/admin/affiliations/rooms/r1`)
      .flush(
        { message: 'Ordine non salvato.' },
        { status: 500, statusText: 'Server Error' },
      );
    await fixture.whenStable();

    // Nessuna seconda PATCH: `concat` non fa partire le successive. L'unica
    // richiesta rimasta è la ricarica dell'elenco.
    const reload = http.expectOne(isRooms);
    reload.flush(pageOf(rooms, 3));
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ordine non salvato.',
    );
  });
});
