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
  GruppoSalaPunti,
  Paginated,
  PokerRoomAdmin,
  PuntiMeseAffiliati,
  RigaPuntiAffiliato,
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
  escludiDaPuntiMensili: false,
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
  setView(v: 'richieste' | 'sale' | 'attivi'): void;
  scriviBozza(g: GruppoSalaPunti, r: RigaPuntiAffiliato, v: string): void;
  bozza(r: RigaPuntiAffiliato): string;
  chiediAccredito(g: GruppoSalaPunti): void;
  confermaAccredito(g: GruppoSalaPunti): void;
  scegliMese(m: string): void;
  confermaCambioMese(): void;
  confermaSala: WritableSignal<string | null>;
  meseInAttesa: WritableSignal<string | null>;
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

  it("sale: l'esclusione dagli accrediti mensili viaggia nel multipart, spenta per default", async () => {
    await flushBoot();
    comp.setView('sale');
    http.expectOne(isRooms).flush(pageOf<PokerRoomAdmin>([], 0));
    await fixture.whenStable();

    fillRoomForm();
    comp.submitRoom();
    const post = http.expectOne(
      (r) => r.url === `${API}/admin/affiliations/rooms` && r.method === 'POST',
    );
    // ⚠️ Senza la riga in `toFormData` il campo non arriverebbe mai: il flag
    // resterebbe al valore di prima, in silenzio.
    expect((post.request.body as FormData).get('escludiDaPuntiMensili')).toBe(
      'false',
    );
    post.flush(roomOf('r1'));
    await fixture.whenStable();
    http.expectOne(isRooms).flush(pageOf([roomOf('r1')], 1));
    await fixture.whenStable();

    fillRoomForm();
    comp.form.patchValue({ slug: 'sala-due', escludiDaPuntiMensili: true });
    comp.submitRoom();
    const post2 = http.expectOne(
      (r) => r.url === `${API}/admin/affiliations/rooms` && r.method === 'POST',
    );
    expect((post2.request.body as FormData).get('escludiDaPuntiMensili')).toBe(
      'true',
    );
    post2.flush(roomOf('r2'));
    await fixture.whenStable();
    http.expectOne(isRooms).flush(pageOf([roomOf('r1'), roomOf('r2')], 2));
    await fixture.whenStable();
  });

  // ── Affiliati attivi: accrediti mensili di punti ──────────────────────────
  // ⚠️ Prima di cambiare un'asserzione qui: `gdpr/dpia-affiliazioni-punti.md`.

  describe('Affiliati attivi', () => {
    const isPunti = (r: { url: string; method: string }) =>
      r.url === `${API}/admin/affiliations/punti` && r.method === 'GET';
    const isAccredito = (r: { url: string; method: string }) =>
      r.url === `${API}/admin/affiliations/punti` && r.method === 'POST';

    const rigaOf = (
      id: string,
      extra: Partial<RigaPuntiAffiliato> = {},
    ): RigaPuntiAffiliato => ({
      affiliationId: id,
      userId: `u-${id}`,
      nickname: `Nick${id}`,
      email: `${id}@esempio.it`,
      roomUsername: `User${id}`,
      tracciatoDal: '2026-05-01T10:00:00.000Z',
      status: 'APPROVATO',
      ...extra,
    });
    const gruppoOf = (
      roomId: string,
      name: string,
      righe: RigaPuntiAffiliato[],
      extra: Partial<GruppoSalaPunti> = {},
    ): GruppoSalaPunti => ({
      roomId,
      name,
      esclusa: false,
      righe,
      tracciati: righe.length,
      accreditati: 0,
      puntiAccreditati: 0,
      ...extra,
    });
    const vistaOf = (
      gruppi: GruppoSalaPunti[],
      mese = '2026-09',
    ): PuntiMeseAffiliati => ({
      mese,
      etichetta: mese === '2026-09' ? 'settembre 2026' : 'agosto 2026',
      mesi: [
        { mese: '2026-09', etichetta: 'settembre 2026' },
        { mese: '2026-08', etichetta: 'agosto 2026' },
      ],
      gruppi,
      troncato: false,
    });

    const sisal = () =>
      gruppoOf('sisal', 'Sisal', [
        rigaOf('a1', {
          giaAccreditati: { punti: 1200, at: '2026-10-05T09:00:00.000Z' },
        }),
        rigaOf('a2'),
        rigaOf('a3'),
      ]);
    const snai = () => gruppoOf('snai', 'Snai', [rigaOf('b1')]);

    const apri = async (vista: PuntiMeseAffiliati) => {
      await flushBoot();
      comp.setView('attivi');
      const req = http.expectOne(isPunti);
      // Il primo caricamento non nomina il mese: la finestra la decide il
      // server, nel fuso di Roma, non l'orologio del browser.
      expect(req.request.params.has('mese')).toBe(false);
      req.flush(vista);
      await fixture.whenStable();
      fixture.detectChanges();
    };

    const testo = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    it("all'avvio non si legge niente degli accrediti (la scheda è pigra)", async () => {
      await flushBoot();
      expect(http.match(isPunti).length).toBe(0);
    });

    it('la terza scheda mostra le sale con gli affiliati, non il catalogo', async () => {
      const v = vistaOf([sisal(), snai()]);
      await apri(v);
      expect(testo()).toContain('Sisal');
      expect(testo()).toContain('Snai');
      expect(testo()).toContain('Usera2');
      // ⚠️ Con il vecchio `@else` sarebbe caduta nel ramo del catalogo.
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[aria-label="Crea una nuova poker room"]')).toBeNull();
      // la riga già accreditata non ha il campo: porta i punti
      expect(testo()).toMatch(/1[.,]?200/);
    });

    it('?vista=attivi apre la scheda e carica una volta sola', async () => {
      fixture.componentRef.setInput('vista', 'attivi');
      await flushBoot();
      http.expectOne(isPunti).flush(vistaOf([sisal()]));
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(http.match(isPunti).length).toBe(0);
    });

    it("l'accredito manda SOLO le righe compilate di quella sala, coi punti all'italiana", async () => {
      const v = vistaOf([sisal(), snai()]);
      await apri(v);
      const [gSisal, gSnai] = v.gruppi;

      comp.scriviBozza(gSisal, gSisal.righe[2], '3.000');
      comp.scriviBozza(gSnai, gSnai.righe[0], '500');
      comp.chiediAccredito(gSisal);
      fixture.detectChanges();
      // La conferma dice il totale prima di partire.
      expect(testo()).toMatch(/Accredito\s+3[.,]?000\s+punti a 1 iscritto di Sisal/);
      expect(http.match(isAccredito).length).toBe(0);

      comp.confermaAccredito(gSisal);
      const post = http.expectOne(isAccredito);
      expect(post.request.body).toEqual({
        mese: '2026-09',
        roomId: 'sisal',
        righe: [{ affiliationId: 'a3', punti: 3000 }],
      });
      const dopo = vistaOf([
        gruppoOf('sisal', 'Sisal', [
          sisal().righe[0],
          rigaOf('a2'),
          rigaOf('a3', {
            giaAccreditati: { punti: 3000, at: '2026-10-08T10:00:00.000Z' },
          }),
        ]),
        snai(),
      ]);
      post.flush({ esito: { accreditate: 1, punti: 3000, saltate: 0 }, vista: dopo });
      await fixture.whenStable();

      // ⚠️ Le bozze vivono fuori dalla vista: quanto scritto su Snai resta.
      expect(comp.bozza(gSnai.righe[0])).toBe('500');
      expect(comp.confermaSala()).toBeNull();
    });

    it('un valore che non è un numero di punti ferma l’accredito e segna il campo', async () => {
      const v = vistaOf([sisal()]);
      await apri(v);
      const g = v.gruppi[0];
      comp.scriviBozza(g, g.righe[1], '3,5');
      comp.chiediAccredito(g);
      fixture.detectChanges();

      expect(comp.confermaSala()).toBeNull();
      expect(testo()).toContain('non contiene un numero di punti valido');
      const campo = (fixture.nativeElement as HTMLElement).querySelector(
        'input[aria-invalid="true"]',
      );
      expect(campo).not.toBeNull();
    });

    it('sull’errore la conferma si disarma e il mese si rilegge', async () => {
      const v = vistaOf([sisal()]);
      await apri(v);
      const g = v.gruppi[0];
      comp.scriviBozza(g, g.righe[1], '100');
      comp.chiediAccredito(g);
      comp.confermaAccredito(g);
      http
        .expectOne(isAccredito)
        .flush(
          { message: 'L’accredito si è fermato su NickA2.' },
          { status: 500, statusText: 'Server Error' },
        );
      await fixture.whenStable();

      // Un lotto fermato a metà deve mostrare quali righe sono già passate.
      const rilettura = http.expectOne(isPunti);
      expect(rilettura.request.params.get('mese')).toBe('2026-09');
      rilettura.flush(v);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(comp.confermaSala()).toBeNull();
      expect(testo()).toContain('L’accredito si è fermato su NickA2.');
      // la bozza resta: correggere non vuol dire riscrivere tutto
      expect(comp.bozza(g.righe[1])).toBe('100');
    });

    it('una sala esclusa non ha campi e non ha il pulsante', async () => {
      const esclusa = gruppoOf('lotto', 'Lottomatica', [
        rigaOf('c1', { motivoEsclusione: 'Sala esclusa dagli accrediti mensili.' }),
      ], { esclusa: true });
      await apri(vistaOf([esclusa]));
      const el = fixture.nativeElement as HTMLElement;
      const sezione = el.querySelector('section.aff-gruppo')!;
      expect(sezione.querySelector('input')).toBeNull();
      expect(
        sezione.querySelector('[aria-label^="Accredita i punti di"]'),
      ).toBeNull();
      expect(sezione.textContent).toContain('esclusa dagli accrediti mensili');
    });

    it('cambiare mese con dei numeri scritti chiede conferma prima di buttarli', async () => {
      const v = vistaOf([sisal()]);
      await apri(v);
      const g = v.gruppi[0];
      comp.scriviBozza(g, g.righe[1], '700');

      comp.scegliMese('2026-08');
      expect(http.match(isPunti).length).toBe(0);
      expect(comp.meseInAttesa()).toBe('2026-08');

      comp.confermaCambioMese();
      const req = http.expectOne(isPunti);
      expect(req.request.params.get('mese')).toBe('2026-08');
      req.flush(vistaOf([sisal()], '2026-08'));
      await fixture.whenStable();
      expect(comp.bozza(g.righe[1])).toBe('');
    });

    it('ogni campo nomina la propria riga (aria-label diversi)', async () => {
      await apri(vistaOf([sisal()]));
      const etichette = Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll(
          'input[inputmode="numeric"]',
        ),
      ).map((i) => i.getAttribute('aria-label'));
      expect(etichette.length).toBe(2);
      expect(new Set(etichette).size).toBe(2);
      expect(etichette[0]).toContain('settembre 2026');
    });
  });
});
