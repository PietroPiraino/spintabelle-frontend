import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import {
  computed,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReplaySubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DiscountsValidation,
  MySubscription,
  PaymentInfo,
  SubscriptionPlans,
  User,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { SubscribeComponent } from './subscribe.component';

const API = environment.API_URL;

const TIERS = [
  { tier: 'PESCE_ROSSO' as const, label: 'Pesce Rosso', priceEur: 55 },
  { tier: 'SQUALO' as const, label: 'Squalo', priceEur: 125 },
];

const userOf = (over: Partial<User> = {}): User => ({
  id: 'u1',
  email: 'tizio@example.com',
  nickname: 'Tizio',
  role: 'USER',
  verified: true,
  points: 100_000,
  ...over,
});

/**
 * ⚠️ `plans()` è la risposta PUBBLICA, e non porta i parametri dei punti: è la
 * stessa asimmetria che tiene il tasso di conversione fuori dall'HTML
 * prerenderizzato di /abbonati (art. 9 DL 87/2018). Se un giorno comparisse
 * qui, il test del ramo anonimo più sotto diventerebbe rosso.
 */
const plans = (): SubscriptionPlans => ({ tiers: TIERS, durationDays: 30 });

const paymentInfo = (): PaymentInfo => ({
  tiers: TIERS,
  receivers: { paypal: 'pay@bff.it', skrill: 'skr@bff.it' },
  durationDays: 30,
  punti: { tasso: 1000, passo: 1000 },
});

const mySub = (over: Partial<MySubscription> = {}): MySubscription => ({
  role: 'USER',
  tier: null,
  subscriptionExpiresAt: null,
  pendingRequest: null,
  ...over,
});

const validazione = (
  over: Partial<DiscountsValidation> = {},
): DiscountsValidation => ({
  valid: true,
  codes: [],
  listPriceEur: 125,
  discountedPriceEur: 125,
  message: 'Buoni applicati.',
  punti: {
    saldo: 100_000,
    tasso: 1000,
    passo: 1000,
    prezzoInPunti: 125_000,
    massimo: 100_000,
  },
  ...over,
});

const el = (f: ComponentFixture<unknown>) => f.nativeElement as HTMLElement;
const text = (f: ComponentFixture<unknown>): string =>
  (el(f).textContent ?? '').replace(/\s+/g, ' ').trim();
const label = (n: Element | null | undefined): string =>
  (n?.textContent ?? '').replace(/\s+/g, ' ').trim();
const button = (
  f: ComponentFixture<unknown>,
  needle: string,
): HTMLButtonElement | undefined =>
  Array.from(el(f).querySelectorAll('button')).find((b) =>
    label(b).includes(needle),
  );

interface Ctx {
  fixture: ComponentFixture<SubscribeComponent>;
  http: HttpTestingController;
}

describe('SubscribeComponent', () => {
  let http: HttpTestingController | null = null;

  /**
   * Monta la pagina. Il costruttore chiama SEMPRE `plans()` (le card devono
   * comparire senza aspettare la sessione) e, solo a sessione pronta e attiva,
   * il `forkJoin` con payment-info / me / my-vouchers.
   */
  async function setup(
    opts: { user?: User | null; ready?: boolean } = {},
  ): Promise<Ctx> {
    const user = signal<User | null>(opts.user ?? null);
    const ready$ = new ReplaySubject<void>(1);
    const auth = {
      user,
      ready: signal(true),
      ready$,
      isAuthenticated: computed(() => user() !== null),
      points: computed(() => user()?.points ?? 0),
      loadMe: () => new ReplaySubject<User>(1),
    };

    await TestBed.configureTestingModule({
      imports: [SubscribeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(SubscribeComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await fixture.whenStable();

    http.expectOne(`${API}/subscriptions/plans`).flush(plans());
    if (opts.ready !== false) ready$.next();
    await fixture.whenStable();

    if (user() !== null && opts.ready !== false) {
      http.expectOne(`${API}/subscriptions/payment-info`).flush(paymentInfo());
      http.expectOne(`${API}/subscriptions/me`).flush(mySub());
      http.expectOne(`${API}/shop/my-vouchers`).flush([]);
      await fixture.whenStable();
    }
    return { fixture, http };
  }

  /** Sceglie un piano e serve l'anteprima prezzo che ne consegue. */
  async function scegli(
    ctx: Ctx,
    tier: 'PESCE_ROSSO' | 'SQUALO',
    over: Partial<DiscountsValidation> = {},
  ): Promise<void> {
    button(ctx.fixture, tier === 'SQUALO' ? 'Scegli Squalo' : 'Scegli Pesce')!.click();
    await ctx.fixture.whenStable();
    ctx.http
      .expectOne(`${API}/subscriptions/validate-discounts`)
      .flush(validazione(over));
    await ctx.fixture.whenStable();
  }

  afterEach(() => {
    http?.verify();
    http = null;
  });

  // ── Il vincolo legale ─────────────────────────────────────────────────────

  /**
   * ⚠️ Vincolo **legale**, non estetico (art. 9 DL 87/2018). /abbonati è
   * pubblica e PRERENDERIZZATA: tutto ciò che sta fuori dal ramo autenticato
   * finisce nell'HTML indicizzabile, e un tasso di conversione punti↔euro lì
   * dentro è un incentivo — la stessa regola per cui /negozio tiene i prezzi in
   * punti dietro il login e /affiliazioni non promette numeri.
   *
   * La seconda guardia è in `scripts/check-prerender-content.mjs`, che apre
   * l'artefatto vero. Questa qui è la prima: se il blocco dei punti risalisse
   * fuori dal pannello, questo test è rosso prima del build.
   */
  it('anonimo: nessun punto, nessun tasso, nessuna cifra in punti', async () => {
    const ctx = await setup({ user: null });
    const testo = text(ctx.fixture);
    expect(testo).not.toContain('punti');
    expect(testo).not.toContain('Punti');
    expect(el(ctx.fixture).querySelector('.subscribe__points')).toBeNull();
    // I prezzi in euro invece ci sono e ci devono essere: sono pubblici.
    expect(testo).toContain('125');
  });

  it("loggato: il selettore dei punti vive solo dentro il pannello", async () => {
    const ctx = await setup({ user: userOf() });
    // Prima di scegliere un piano il pannello non esiste, e i punti nemmeno.
    expect(el(ctx.fixture).querySelector('.subscribe__points')).toBeNull();

    await scegli(ctx, 'SQUALO');
    expect(el(ctx.fixture).querySelector('.subscribe__points')).not.toBeNull();
  });

  // ── Il conto ──────────────────────────────────────────────────────────────

  it('lo scatto vale 1 € e il dovuto scende di conseguenza', async () => {
    const ctx = await setup({ user: userOf() });
    await scegli(ctx, 'SQUALO');

    const piu = el(ctx.fixture).querySelector<HTMLButtonElement>(
      'button[aria-label="Usa più punti"]',
    )!;
    piu.click();
    piu.click();
    await ctx.fixture.whenStable();

    const valore = label(el(ctx.fixture).querySelector('.subscribe__points-value'));
    // ⚠️ "2000" senza punto: `Intl.NumberFormat('it-IT')` non raggruppa i numeri
    // di quattro cifre. È lo stesso formattatore del gettone in header, e va
    // lasciato tale — la coerenza vale più di un separatore in più.
    expect(valore).toContain('2000 pt');
    expect(valore).toContain('−€2');
    expect(text(ctx.fixture)).toContain('€123');
  });

  it('«usa il massimo» si ferma al saldo, non al prezzo', async () => {
    const ctx = await setup({ user: userOf({ points: 40_000 }) });
    await scegli(ctx, 'SQUALO', {
      punti: {
        saldo: 40_000,
        tasso: 1000,
        passo: 1000,
        prezzoInPunti: 125_000,
        massimo: 40_000,
      },
    });
    button(ctx.fixture, 'Usa il massimo')!.click();
    await ctx.fixture.whenStable();
    expect(text(ctx.fixture)).toContain('€85');
  });

  /**
   * ⚠️ Il ramo omaggio del template si apre su `effectivePrice() === 0`: senza
   * i punti dentro quel conto, un abbonamento coperto interamente dai punti
   * continuerebbe a dire «Invia €125 via PayPal» e a chiedere un riferimento di
   * pagamento che non esiste.
   */
  it('punti che coprono tutto: niente da pagare e niente campi di pagamento', async () => {
    const ctx = await setup({ user: userOf({ points: 200_000 }) });
    await scegli(ctx, 'SQUALO', {
      punti: {
        saldo: 200_000,
        tasso: 1000,
        passo: 1000,
        prezzoInPunti: 125_000,
        massimo: 125_000,
      },
    });
    button(ctx.fixture, 'Usa il massimo')!.click();
    await ctx.fixture.whenStable();

    expect(text(ctx.fixture)).toContain('niente da pagare');
    expect(
      el(ctx.fixture).querySelector('input[value="paypal"]'),
    ).toBeNull();
  });

  /**
   * ⚠️ Togliendo un buono il prezzo SALE, quindi il tetto dei punti scende: un
   * valore rimasto sopra passerebbe il client e prenderebbe un 400 all'invio,
   * cioè DOPO che l'utente ha già pagato fuori sito.
   */
  it('il valore dei punti si ri-clampa quando il prezzo cambia', async () => {
    const ctx = await setup({ user: userOf({ points: 200_000 }) });
    await scegli(ctx, 'SQUALO', {
      punti: {
        saldo: 200_000,
        tasso: 1000,
        passo: 1000,
        prezzoInPunti: 125_000,
        massimo: 125_000,
      },
    });
    button(ctx.fixture, 'Usa il massimo')!.click();
    await ctx.fixture.whenStable();
    expect(label(el(ctx.fixture).querySelector('.subscribe__points-value'))).toContain(
      '125.000',
    );

    // Arriva un buono che dimezza il prezzo: il tetto scende a 62.000.
    ctx.fixture.componentInstance['addCode']('MENO50');
    await ctx.fixture.whenStable();
    ctx.http.expectOne(`${API}/subscriptions/validate-discounts`).flush(
      validazione({
        codes: [{ code: 'MENO50', kind: 'PERCENT', value: 50 }],
        discountedPriceEur: 62.5,
        punti: {
          saldo: 200_000,
          tasso: 1000,
          passo: 1000,
          prezzoInPunti: 62_500,
          massimo: 62_500,
        },
      }),
    );
    await ctx.fixture.whenStable();

    const valore = label(el(ctx.fixture).querySelector('.subscribe__points-value'));
    expect(valore).toContain('62.500');
    expect(text(ctx.fixture)).toContain('niente da pagare');
  });

  // ── L'invio ───────────────────────────────────────────────────────────────

  it('invia i punti scelti e ricarica il saldo', async () => {
    const ctx = await setup({ user: userOf() });
    await scegli(ctx, 'SQUALO');
    button(ctx.fixture, 'Usa il massimo')!.click();
    await ctx.fixture.whenStable();

    button(ctx.fixture, 'Invia richiesta')!.click();
    await ctx.fixture.whenStable();

    const req = ctx.http.expectOne(`${API}/subscriptions/request`);
    expect(req.request.body.pointsSpent).toBe(100_000);
    req.flush({
      id: 'r1',
      status: 'pending',
      tierLabel: 'Squalo',
      pointsSpent: 100_000,
    });
    await ctx.fixture.whenStable();
    // I buoni applicati sono ora riservati: la pagina li ricarica.
    ctx.http.expectOne(`${API}/shop/my-vouchers`).flush([]);
    await ctx.fixture.whenStable();
  });

  /**
   * ⚠️ Un `pointsSpent: 0` inviato SEMPRE farebbe fallire l'intera chiamata
   * (400 da `forbidNonWhitelisted`) contro un backend più vecchio, portandosi
   * dietro anche il flusso dei buoni che con i punti non c'entra.
   */
  it('senza punti il campo non viene inviato affatto', async () => {
    const ctx = await setup({ user: userOf() });
    await scegli(ctx, 'SQUALO');

    button(ctx.fixture, 'Invia richiesta')!.click();
    await ctx.fixture.whenStable();

    const req = ctx.http.expectOne(`${API}/subscriptions/request`);
    expect('pointsSpent' in req.request.body).toBe(false);
    req.flush({
      id: 'r1',
      status: 'pending',
      tierLabel: 'Squalo',
      pointsSpent: 0,
    });
    await ctx.fixture.whenStable();
    ctx.http.expectOne(`${API}/shop/my-vouchers`).flush([]);
    await ctx.fixture.whenStable();
  });

  it('la richiesta in attesa dice che i punti tornano indietro', async () => {
    const ctx = await setup({ user: userOf() });
    ctx.fixture.componentInstance['me'].set(
      mySub({
        pendingRequest: {
          id: 'r1',
          userId: 'u1',
          userEmail: 'tizio@example.com',
          tier: 'SQUALO',
          tierLabel: 'Squalo',
          paymentMethod: 'paypal',
          status: 'pending',
          pointsSpent: 25_000,
          pointsDiscountEur: 25,
        },
      }),
    );
    await ctx.fixture.whenStable();
    const testo = text(ctx.fixture);
    expect(testo).toContain('25.000 punti');
    expect(testo).toContain('tornano indietro');
  });
});
