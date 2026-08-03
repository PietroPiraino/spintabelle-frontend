import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  WritableSignal,
  computed,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Params, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MyAffiliation,
  Paginated,
  PokerRoom,
  User,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { AffiliationsComponent } from './affiliations.component';

const API = environment.API_URL;

const isRooms = (r: { url: string }) => r.url === `${API}/affiliations/rooms`;
const isMine = (r: { url: string }) => r.url === `${API}/affiliations/me`;

const userOf = (over: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'tizio@example.com',
  nickname: 'Tizio',
  role: 'USER',
  verified: true,
  ...over,
});

const roomOf = (id: string, over: Partial<PokerRoom> = {}): PokerRoom => ({
  id,
  name: `Sala ${id}`,
  slug: id,
  identifierLabel: 'Username di login',
  identifierMinLen: 3,
  identifierMaxLen: 40,
  richiedeSecondoId: false,
  consenteAccountEsistenti: false,
  ordine: 100,
  ...over,
});

const affOf = (over: Partial<MyAffiliation> = {}): MyAffiliation => ({
  id: 'a1',
  roomId: 'sala-uno',
  roomName: 'Sala sala-uno',
  roomSlug: 'sala-uno',
  roomAttiva: true,
  refCode: 'AFF-7K2M9QRT',
  status: 'RICHIESTO',
  statusLabel: 'Link inviato',
  accountEsistente: false,
  dichiaraProprieta: true,
  accettaTermini: true,
  riaperture: 0,
  ...over,
});

const pageOf = (items: PokerRoom[]): Paginated<PokerRoom> => ({
  items,
  total: items.length,
  page: 1,
  limit: 50,
  totalPages: 1,
});

/** Testo della pagina con gli spazi normalizzati (il template va a capo). */
const text = (fixture: ComponentFixture<unknown>): string =>
  ((fixture.nativeElement as HTMLElement).textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const el = (fixture: ComponentFixture<unknown>): HTMLElement =>
  fixture.nativeElement as HTMLElement;

const label = (node: Element | null): string =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Primo bottone la cui etichetta contiene `needle` (o `undefined`). */
const button = (
  fixture: ComponentFixture<unknown>,
  needle: string,
): HTMLButtonElement | undefined =>
  Array.from(el(fixture).querySelectorAll('button')).find((b) =>
    label(b).includes(needle),
  );

/** Un giro di macrotask: i `setTimeout(0)` di fuoco/scorrimento del componente. */
const macrotask = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve));

/** Il bottone che apre/chiude il dettaglio di una riga. */
const toggle = (
  fixture: ComponentFixture<unknown>,
  roomId: string,
): HTMLButtonElement | null =>
  el(fixture).querySelector<HTMLButtonElement>(`#dettaglio-toggle-${roomId}`);

/** Quante volte una frase compare nel testo della pagina. */
const occorrenze = (fixture: ComponentFixture<unknown>, frase: string): number =>
  text(fixture).split(frase).length - 1;

/**
 * Sessione finta: `user` e `ready` sono signal scrivibili dal test, perché il
 * caso che conta è proprio l'ordine in cui i due arrivano (§3).
 */
interface Session {
  user: WritableSignal<User | null>;
  ready: WritableSignal<boolean>;
}

interface Ctx extends Session {
  fixture: ComponentFixture<AffiliationsComponent>;
  http: HttpTestingController;
}

describe('AffiliationsComponent', () => {
  let http: HttpTestingController | null = null;

  /**
   * Monta la pagina. ⚠️ `detectChanges()` fa girare l'`effect()` del
   * costruttore: **con `user` a null non parte nessuna chiamata**, ed è per
   * questo che nessun `beforeEach` flusha alla cieca (§16: quante richieste
   * servire È l'asserzione).
   */
  async function setup(
    opts: { query?: Params; user?: User | null; ready?: boolean } = {},
  ): Promise<Ctx> {
    const user = signal<User | null>(opts.user ?? null);
    const ready = signal(opts.ready ?? true);
    const auth = {
      user,
      ready,
      isAuthenticated: computed(() => user() !== null),
    };

    await TestBed.configureTestingModule({
      imports: [AffiliationsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        // La query string è lo stato della pagina: `?completa=` e il `redirect`
        // della CTA di accesso escono entrambi da qui.
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of(opts.query ?? {}) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AffiliationsComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, http, user, ready };
  }

  /** Serve le DUE richieste dell'effect (vetrina + righe personali). */
  async function flushCatalogo(
    ctx: Ctx,
    rooms: PokerRoom[],
    mine: MyAffiliation[] = [],
  ): Promise<void> {
    ctx.http.expectOne(isRooms).flush(pageOf(rooms));
    ctx.http.expectOne(isMine).flush(mine);
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
  }

  /** Utente già in sessione al montaggio + catalogo servito. */
  async function loggedWith(
    rooms: PokerRoom[],
    mine: MyAffiliation[] = [],
    query?: Params,
  ): Promise<Ctx> {
    const ctx = await setup({ user: userOf(), query });
    await flushCatalogo(ctx, rooms, mine);
    return ctx;
  }

  /**
   * Apre il dettaglio di una riga, se non è già aperto.
   *
   * ⚠️ **È un gesto, non un'asserzione**: da quando la riga chiusa tiene solo
   * ciò che serve a decidere, codici, link, promemoria e azioni secondarie
   * stanno dietro questo bottone. I test che li interrogano fanno il gesto e
   * poi asseriscono esattamente quello che asserivano prima. Idempotente
   * apposta: una riga può nascere aperta (vedi il caso della pratica unica), e
   * un clic alla cieca la richiuderebbe.
   */
  async function apriDettaglio(ctx: Ctx, roomId: string): Promise<void> {
    const btn = toggle(ctx.fixture, roomId);
    expect(btn).withContext(`toggle di ${roomId}`).not.toBeNull();
    if (btn!.getAttribute('aria-expanded') === 'true') return;
    btn!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
  }

  afterEach(() => {
    http?.verify();
    http = null;
  });

  // ── Anonimo ───────────────────────────────────────────────────────────────

  it('anonimo: vede il programma e la CTA, mai le sale né i form — e non chiama nulla', async () => {
    const ctx = await setup({ query: { completa: 'admiralbet' } });
    const page = el(ctx.fixture);

    // Il programma sta in pagina per tutti: è la parte prerenderizzata.
    expect(text(ctx.fixture)).toContain('Come funziona');
    expect(text(ctx.fixture)).toContain('Termini del programma');
    expect(text(ctx.fixture)).toContain('18+');

    // Vetrina e form vivono solo nel ramo autenticato.
    expect(page.querySelector('.aff__rooms')).toBeNull();
    expect(page.querySelector('.aff-card')).toBeNull();
    expect(page.querySelectorAll('form').length).toBe(0);

    // La CTA porta il percorso CON la query string: un deep-link arrivato per
    // email deve sopravvivere al login.
    const cta = page.querySelector<HTMLAnchorElement>('a[href*="/login"]');
    expect(label(cta)).toContain('Accedi per vedere le sale disponibili');
    const href = cta!.getAttribute('href')!;
    const redirect = new URL(href, 'http://localhost').searchParams.get(
      'redirect',
    );
    expect(redirect).toBe('/affiliazioni?completa=admiralbet');

    // ⚠️ Zero richieste: nessuna chiamata parte dal costruttore, e senza utente
    // l'effect non ne fa partire nessuna. È l'altra metà dell'asserzione di
    // "quante ne flusho" (l'`afterEach` verificherebbe comunque).
    ctx.http.verify();
  });

  /**
   * ⚠️ Vincolo **legale**, non estetico. Il ramo anonimo finisce nell'HTML
   * prerenderizzato e indicizzabile: un premio in cambio di gioco lì dentro è un
   * incentivo, mentre il perimetro approvato dal consulente è un *programma di
   * affiliazione*. Il blocco dei punti vive solo dietro login — fuori resta il
   * solo invito a iscriversi. E dentro non porta cifre: i punti li assegna
   * l'owner a mano e a sua discrezione, e i termini in pagina dicono già che il
   * programma non garantisce alcun vantaggio.
   */
  it('i punti BFF stanno solo dietro login, e senza promettere numeri', async () => {
    const ctx = await setup({ user: null, ready: true });
    expect(el(ctx.fixture).querySelector('.aff__points')).toBeNull();
    expect(text(ctx.fixture)).not.toContain('punti BFF');

    ctx.user.set(userOf());
    await ctx.fixture.whenStable();
    await flushCatalogo(ctx, [roomOf('sala-uno')]);

    const punti = el(ctx.fixture).querySelector('.aff__points');
    expect(punti).not.toBeNull();
    expect(label(punti)).toContain('Giocando da affiliato guadagni punti BFF');
    // Nessuna cifra, nessun tasso, nessuna cadenza.
    expect(label(punti)).not.toMatch(/\d/);
    // I punti si spendono nel Negozio: il rimando dev'essere un link vero.
    expect(punti!.querySelector('a[href="/negozio"]')).not.toBeNull();
  });

  // ── L'ordine di arrivo della sessione (il caso che pinna la decisione) ─────

  it('carica quando `user` arriva DOPO `ready` (cap 8s), e non ricarica a ogni refresh di sessione', async () => {
    // `ready` ha già emesso con `user` ancora null: è esattamente lo stato che
    // un `ready$.pipe(take(1))` fotograferebbe come "anonimo" per sempre.
    const ctx = await setup({ user: null, ready: true });
    ctx.http.verify(); // ancora niente in volo

    ctx.user.set(userOf());
    await ctx.fixture.whenStable();

    // L'effect vede l'utente e parte: due richieste, non una.
    await flushCatalogo(ctx, [roomOf('sala-uno')]);
    expect(text(ctx.fixture)).toContain('Sala sala-uno');

    // Refresh di sessione: nuovo oggetto User, stesso id → nessuna richiesta.
    // Senza la guardia "già caricato per questo id" ogni rinnovo del token
    // rifarebbe due chiamate e resetterebbe la pagina sotto le mani.
    ctx.user.set(userOf({ points: 150 }));
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
    ctx.http.verify();
    expect(text(ctx.fixture)).toContain('Sala sala-uno');
  });

  // ── Stati della riga ──────────────────────────────────────────────────────

  it('IN_VERIFICA: chip di attesa, tempi dichiarati e nessun bottone di richiesta', async () => {
    const ctx = await loggedWith(
      [roomOf('sala-uno')],
      [affOf({ status: 'IN_VERIFICA', statusLabel: 'In verifica' })],
    );

    const chip = el(ctx.fixture).querySelector('.aff-chip');
    expect(label(chip)).toBe('In verifica');
    expect(chip!.classList).toContain('aff-chip--wait');
    expect(chip!.classList).not.toContain('aff-chip--ok');
    expect(text(ctx.fixture)).toContain('di solito entro 48 ore');

    // Una richiesta è già in corso: né "Richiedi il collegamento" né "Richiedi
    // di nuovo" devono comparire (aprirebbero una strada che il server nega).
    expect(button(ctx.fixture, 'Richiedi')).toBeUndefined();
    expect(button(ctx.fixture, 'Ho fatto: invia i miei dati')).toBeDefined();
  });

  it('APPROVATO: annulla il tracciamento con la formula di §9.1 (la sala non si annulla da qui)', async () => {
    const ctx = await loggedWith(
      [roomOf('sala-uno')],
      [affOf({ status: 'APPROVATO', statusLabel: 'Tracciato' })],
    );
    // Le azioni secondarie stanno nel dettaglio: il gesto in più è aprirlo.
    await apriDettaglio(ctx, 'sala-uno');

    const annulla = button(ctx.fixture, 'Annulla il tracciamento');
    expect(annulla).toBeDefined();
    annulla!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    // ⚠️ La promessa è solo la nostra: il rapporto con la sala resta.
    expect(text(ctx.fixture)).toContain(
      'Il tracciamento presso la sala non si annulla da qui: smettiamo di conservare i tuoi dati di collegamento.',
    );

    button(ctx.fixture, 'Confermo')!.click();
    const del = ctx.http.expectOne(
      (r) =>
        r.url === `${API}/affiliations/rooms/sala-uno` && r.method === 'DELETE',
    );
    del.flush(affOf({ status: 'ANNULLATO', statusLabel: 'Annullato' }));
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    expect(label(el(ctx.fixture).querySelector('.aff-chip'))).toBe('Annullato');
    // Uno stato terminale ha sempre una via di ritorno.
    expect(button(ctx.fixture, 'Richiedi di nuovo')).toBeDefined();
  });

  // ── Dettaglio a scomparsa (la cura della densità) ─────────────────────────

  /**
   * ⚠️ **Copia della copia**: `FIRST_CLIENT_LOGIN_REMINDER` vive nel backend,
   * ne esiste un duplicato dichiarato nel componente, e questa è la terza. Sta
   * qui perché è **la** frase che misurava il difetto: con cinque pratiche
   * aperte compariva cinque volte nella stessa schermata. Se cambia, cambiano
   * tutte e tre.
   */
  const PROMEMORIA =
    'Dopo aver creato il conto, fai un primo accesso al client di poker. Prima di quel passaggio il tuo username non risulta e non possiamo verificarlo.';

  it('riga chiusa: niente dettaglio ripetuto, ma offerta, stato, UNA azione e il gettone restano', async () => {
    const ctx = await loggedWith(
      [
        roomOf('sala-uno', { condizioni: 'Rakeback 45%, ogni mese.' }),
        roomOf('sala-due', { condizioni: 'Rakeback 38%, ogni mese.' }),
      ],
      [
        affOf({ roomId: 'sala-uno', richiestoAt: '2026-07-20T10:00:00.000Z' }),
        affOf({
          id: 'a2',
          roomId: 'sala-due',
          roomName: 'Sala sala-due',
          roomSlug: 'sala-due',
          refCode: 'AFF-P4X8DNVB',
          richiestoAt: '2026-07-21T10:00:00.000Z',
        }),
      ],
    );
    const page = el(ctx.fixture);

    // Il difetto misurato: la stessa frase, una volta per pratica. Ora: zero.
    expect(occorrenze(ctx.fixture, PROMEMORIA)).toBe(0);
    expect(page.querySelectorAll('.aff-row__detail').length).toBe(0);
    expect(page.querySelectorAll('.aff-code').length).toBe(0);
    expect(text(ctx.fixture)).not.toContain('AFF-7K2M9QRT');

    // Ciò che la riga chiusa DEVE tenere: offerta, stato + data, una sola
    // azione, e il gettone "tocca a te" — che è il punto del ridisegno.
    expect(text(ctx.fixture)).toContain('Rakeback 45%, ogni mese.');
    expect(page.querySelectorAll('.aff-chip').length).toBe(2);
    expect(text(ctx.fixture)).toContain('richiesta del 20/07/2026');
    expect(page.querySelectorAll('.aff-turn').length).toBe(2);
    expect(page.querySelectorAll('.aff-coin').length).toBe(2);
    expect(text(ctx.fixture)).toContain(
      'Tocca a te: crea il conto dal link, poi mandaci il tuo username.',
    );
    // Una azione per riga: la principale. Le secondarie sono nel dettaglio.
    expect(button(ctx.fixture, 'Ho fatto: invia i miei dati')).toBeDefined();
    expect(button(ctx.fixture, "Rinvia l'email")).toBeUndefined();
    expect(button(ctx.fixture, 'Annulla la richiesta')).toBeUndefined();

    // Aprendone una, e una sola, il dettaglio torna intero.
    await apriDettaglio(ctx, 'sala-uno');
    expect(occorrenze(ctx.fixture, PROMEMORIA)).toBe(1);
    expect(text(ctx.fixture)).toContain('AFF-7K2M9QRT');
    expect(button(ctx.fixture, "Rinvia l'email")).toBeDefined();
  });

  it('una sola riga aperta per volta: aprire la seconda chiude la prima', async () => {
    const ctx = await loggedWith(
      [roomOf('sala-uno'), roomOf('sala-due')],
      [
        affOf({ roomId: 'sala-uno' }),
        affOf({
          id: 'a2',
          roomId: 'sala-due',
          roomName: 'Sala sala-due',
          roomSlug: 'sala-due',
          refCode: 'AFF-P4X8DNVB',
        }),
      ],
    );
    const page = el(ctx.fixture);

    await apriDettaglio(ctx, 'sala-uno');
    expect(page.querySelector('#dettaglio-sala-uno')).not.toBeNull();
    expect(toggle(ctx.fixture, 'sala-uno')!.getAttribute('aria-expanded')).toBe(
      'true',
    );

    await apriDettaglio(ctx, 'sala-due');
    expect(page.querySelectorAll('.aff-row__detail').length).toBe(1);
    expect(page.querySelector('#dettaglio-sala-uno')).toBeNull();
    expect(page.querySelector('#dettaglio-sala-due')).not.toBeNull();
    expect(toggle(ctx.fixture, 'sala-uno')!.getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('chiudendo il dettaglio il fuoco torna sul bottone che l\'ha aperto', async () => {
    const ctx = await loggedWith([roomOf('sala-uno')], [affOf()]);
    await apriDettaglio(ctx, 'sala-uno');

    // Il fuoco è dentro il pannello: chiudendolo il DOM lo rimuove, e senza
    // rimetterlo sul bottone chi usa la tastiera finisce sul `<body>`.
    el(ctx.fixture)
      .querySelector<HTMLButtonElement>('.aff-copy')!
      .focus();

    toggle(ctx.fixture, 'sala-uno')!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
    await macrotask(); // il fuoco arriva in un `setTimeout(0)` (zoneless)

    expect(el(ctx.fixture).querySelector('#dettaglio-sala-uno')).toBeNull();
    const t = toggle(ctx.fixture, 'sala-uno')!;
    expect(t.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(t);
  });

  /**
   * ⚠️ **Scelta dichiarata** (vedi l'`effect` di apertura automatica nel
   * componente): con **una sola** pratica in pagina non c'è nulla da scegliere
   * e la riga nasce aperta; da **due in su** non se ne apre nessuna, perché
   * sceglierne una sarebbe arbitrario e aprirle tutte rimetterebbe il muro.
   */
  it('con una sola pratica la riga nasce aperta', async () => {
    const ctx = await loggedWith([roomOf('sala-uno')], [affOf()]);
    expect(el(ctx.fixture).querySelector('#dettaglio-sala-uno')).not.toBeNull();
    expect(toggle(ctx.fixture, 'sala-uno')!.getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(text(ctx.fixture)).toContain('AFF-7K2M9QRT');
  });

  it('con due pratiche non ne nasce aperta nessuna', async () => {
    const ctx = await loggedWith(
      [roomOf('sala-uno'), roomOf('sala-due')],
      [
        affOf({ roomId: 'sala-uno' }),
        affOf({
          id: 'a2',
          roomId: 'sala-due',
          roomName: 'Sala sala-due',
          roomSlug: 'sala-due',
        }),
      ],
    );
    expect(el(ctx.fixture).querySelectorAll('.aff-row__detail').length).toBe(0);
  });

  it('aprire un form apre il dettaglio: un clic solo, non due', async () => {
    // Due pratiche: nessuna nasce aperta, quindi il merito è tutto del clic.
    const ctx = await loggedWith(
      [roomOf('sala-uno'), roomOf('sala-due')],
      [
        affOf({ roomId: 'sala-uno' }),
        affOf({
          id: 'a2',
          roomId: 'sala-due',
          roomName: 'Sala sala-due',
          roomSlug: 'sala-due',
        }),
      ],
    );
    const page = el(ctx.fixture);
    expect(page.querySelectorAll('.aff-row__detail').length).toBe(0);

    page.querySelector<HTMLButtonElement>('#cta-sala-due')!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    expect(page.querySelector('#dati-sala-due')).not.toBeNull();
    expect(page.querySelector('#dettaglio-sala-due')).not.toBeNull();
    expect(toggle(ctx.fixture, 'sala-due')!.getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  // ── Errore di caricamento ─────────────────────────────────────────────────

  it('500 sulla lista: errore con "Riprova", mai un catalogo vuoto', async () => {
    const ctx = await setup({ user: userOf() });

    // ⚠️ `me` va tolto dalle richieste aperte PRIMA di far fallire l'altra: il
    // forkJoin la annulla, e una richiesta annullata resta "aperta" per
    // `http.verify()`.
    ctx.http.expectOne(isMine);
    ctx.http
      .expectOne(isRooms)
      .flush(
        { message: 'Servizio non disponibile.' },
        { status: 500, statusText: 'Server Error' },
      );
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    expect(text(ctx.fixture)).toContain('Servizio non disponibile.');
    expect(el(ctx.fixture).querySelector('[role="alert"]')).not.toBeNull();
    // Il fallimento non si traveste da "non ci sono sale".
    expect(text(ctx.fixture)).not.toContain('non ci sono sale disponibili');
    expect(el(ctx.fixture).querySelector('.empty-state')).toBeNull();

    const riprova = button(ctx.fixture, 'Riprova');
    expect(riprova).toBeDefined();
    riprova!.click();
    await ctx.fixture.whenStable();

    await flushCatalogo(ctx, [roomOf('sala-uno')]);
    expect(text(ctx.fixture)).toContain('Sala sala-uno');
    expect(text(ctx.fixture)).not.toContain('Servizio non disponibile.');
  });

  // ── Invio della richiesta ─────────────────────────────────────────────────

  it('richiesta: senza entrambe le spunte non parte nulla; con entrambe viaggiano `true`', async () => {
    const ctx = await loggedWith([roomOf('sala-uno')]);

    button(ctx.fixture, 'Richiedi il collegamento')!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    const form = el(ctx.fixture).querySelector<HTMLFormElement>(
      '#richiesta-sala-uno',
    )!;
    expect(form).not.toBeNull();

    const radios = form.querySelectorAll<HTMLInputElement>(
      'input[type="radio"]',
    );
    const checks = form.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checks.length).toBe(2);

    radios[0].click(); // "No, lo creo adesso"
    checks[0].click(); // dichiaraProprieta
    // `accettaTermini` resta spento.
    form.dispatchEvent(new Event('submit'));
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    // ⚠️ Nessuna chiamata: le due dichiarazioni sono `@Equals(true)` lato DTO,
    // e una spunta mancante deve fermarsi qui — mai diventare un 400 da
    // decifrare. (Il bottone di invio resta cliccabile: il blocco sta
    // nell'invio, non nel `[disabled]`; il caso in cui il submit È disabilitato
    // è quello dell'account già esistente, testato sotto.)
    ctx.http.verify();
    expect(text(ctx.fixture)).toContain(
      'Scegli una risposta e spunta entrambe le dichiarazioni.',
    );

    checks[1].click(); // accettaTermini
    form.dispatchEvent(new Event('submit'));
    await ctx.fixture.whenStable();

    const post = ctx.http.expectOne(
      (r) =>
        r.url === `${API}/affiliations/rooms/sala-uno/request` &&
        r.method === 'POST',
    );
    // Nessun identificativo nel corpo: `RequestAffiliationDto` non lo dichiara
    // e col `forbidNonWhitelisted` globale un campo di troppo è un 400 secco.
    expect(post.request.body).toEqual({
      accountEsistente: false,
      dichiaraProprieta: true,
      accettaTermini: true,
    });
    post.flush({ ...affOf(), emailSent: true });
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    expect(text(ctx.fixture)).toContain('AFF-7K2M9QRT');
  });

  it('"Sì, ce l\'ho già" su una sala che non lo collega: submit disabilitato, nessuna chiamata, uscita su Discord', async () => {
    const ctx = await loggedWith([
      roomOf('sala-uno', { consenteAccountEsistenti: false }),
    ]);

    button(ctx.fixture, 'Richiedi il collegamento')!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    const form = el(ctx.fixture).querySelector<HTMLFormElement>(
      '#richiesta-sala-uno',
    )!;
    form.querySelectorAll<HTMLInputElement>('input[type="radio"]')[1].click();
    form
      .querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
      .forEach((c) => c.click());
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();

    const submit = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    expect(submit.disabled).toBeTrue();

    // Non è un vicolo cieco: il ricollegamento si fa a mano, e l'uscita è
    // l'invito Discord del footer (mai un profilo diretto).
    const discord = form.querySelector<HTMLAnchorElement>('a[href*="discord"]');
    expect(discord).not.toBeNull();
    expect(discord!.target).toBe('_blank');

    form.dispatchEvent(new Event('submit'));
    await ctx.fixture.whenStable();
    ctx.http.verify();
  });

  // ── Deep-link ─────────────────────────────────────────────────────────────

  it('`?completa=<slug>` apre il form della sala giusta, non della prima', async () => {
    const ctx = await loggedWith(
      [roomOf('sala-uno'), roomOf('sala-due')],
      [],
      { completa: 'sala-due' },
    );
    await macrotask();
    ctx.fixture.detectChanges();

    const page = el(ctx.fixture);
    expect(page.querySelector('#richiesta-sala-due')).not.toBeNull();
    expect(page.querySelector('#richiesta-sala-uno')).toBeNull();
  });

  // ── Accessibilità ─────────────────────────────────────────────────────────

  it('a11y: la regione aria-live esiste sempre e il fuoco entra nel form aperto', async () => {
    const ctx = await loggedWith([roomOf('sala-uno')]);
    const page = el(ctx.fixture);

    // ⚠️ Deve stare nel DOM anche da vuota: un `aria-live` inserito insieme al
    // suo contenuto spesso non viene annunciato.
    const live = page.querySelector('[aria-live="polite"]');
    expect(live).not.toBeNull();
    expect(live!.getAttribute('role')).toBe('status');

    button(ctx.fixture, 'Richiedi il collegamento')!.click();
    await ctx.fixture.whenStable();
    ctx.fixture.detectChanges();
    // ⚠️ Il fuoco arriva in un `setTimeout(0)`: in zoneless il DOM non esiste
    // subito dopo il cambio di stato, e leggerlo prima non troverebbe nulla.
    await macrotask();

    const form = page.querySelector('#richiesta-sala-uno')!;
    expect(form.contains(document.activeElement)).toBeTrue();
    // Il primo comando del form, non un punto qualunque dentro di esso:
    // scorrere senza spostare il fuoco lascia tastiera e screen reader dov'erano
    // mentre la pagina salta sotto di loro.
    expect(document.activeElement).toBe(
      form.querySelector('input[type="radio"]'),
    );
  });

  // ── Copia ─────────────────────────────────────────────────────────────────

  it('copia: senza `navigator.clipboard` (contesto non sicuro) parte il ripiego e il codice resta visibile', async () => {
    const ctx = await loggedWith([roomOf('sala-uno')], [affOf()]);
    // I codici stanno nel dettaglio: il gesto in più è aprirlo.
    await apriDettaglio(ctx, 'sala-uno');

    // Fuori da un contesto sicuro l'API non esiste proprio.
    const own = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      get: () => undefined,
    });
    const exec = spyOn(document, 'execCommand').and.returnValue(true);

    try {
      const copia = el(ctx.fixture).querySelector<HTMLButtonElement>(
        'button[aria-label="Copia il codice di riferimento"]',
      );
      expect(copia).not.toBeNull();
      copia!.click();
      await ctx.fixture.whenStable();
      ctx.fixture.detectChanges();

      expect(exec).toHaveBeenCalledWith('copy');
      const fallback = el(ctx.fixture).querySelector<HTMLInputElement>(
        '.aff__copy-fallback',
      )!;
      expect(fallback.value).toBe('AFF-7K2M9QRT');
      expect(
        TestBed.inject(ToastService)
          .toasts()
          .map((t) => t.text),
      ).toContain('Numero di pratica copiato.');
      // Mai un bottone morto: il codice resta in pagina, selezionabile a mano.
      expect(text(ctx.fixture)).toContain('AFF-7K2M9QRT');
    } finally {
      if (own) Object.defineProperty(navigator, 'clipboard', own);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });
});
