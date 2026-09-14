import { HttpTestingController } from '@angular/common/http/testing';
import { AccountComponent } from './account.component';
import {
  Ctx,
  authStub,
  fallisci,
  monta,
  percorsoVuoto,
  prospettoMadRoxKO,
  puntiVuoti,
  rispondi,
  subVuota,
  utente,
} from './account.spec-helper';

/**
 * La SHELL di /account: testata, schede, `?vista=`, e le quattro letture.
 * Le schede hanno la loro spec ciascuna; qui si prova il contenitore.
 */
describe('AccountComponent (shell)', () => {
  /** Serve le quattro letture della shell + quelle della Panoramica. */
  function servi(http: HttpTestingController, over: { prospetto?: object; staking?: object | null } = {}) {
    rispondi(http, '/subscriptions/me', subVuota);
    rispondi(http, '/points/me', puntiVuoti);
    rispondi(http, 'mio-prospetto', over.prospetto ?? []);
    rispondi(http, '/account/percorso', percorsoVuoto);
    rispondi(http, '/stakings/mio', over.staking ?? null);
    // la Panoramica carica le affiliazioni da sé
    for (const r of http.match((r) => r.url.includes('/affiliations/me'))) r.flush([]);
  }

  it('la testata dice chi sei: nickname, email, verifica, «iscritto dal»', async () => {
    const ctx: Ctx<AccountComponent> = await monta(AccountComponent);
    await ctx.stabilizza();
    servi(ctx.http);
    await ctx.stabilizza();
    const h1 = ctx.el.querySelector('h1')!;
    expect(h1.textContent).toContain('Ciao, MadRoxKO');
    expect(ctx.testo()).toContain('rossana@example.it');
    expect(ctx.testo()).toContain('Email verificata');
    // LOCALE_ID 'it': «1 giu 2026», non «Jun 1, 2026»
    expect(ctx.testo()).toMatch(/iscritto dal 1 giu 2026/);
    expect(ctx.el.querySelectorAll('h1').length).toBe(1);
  });

  it('non verificato: un PULSANTE «Reinvia il link di verifica», non un link dentro la pillola', async () => {
    const ctx = await monta(AccountComponent, { auth: authStub(utente({ verified: false })) });
    await ctx.stabilizza();
    servi(ctx.http);
    await ctx.stabilizza();
    const btn = ctx.el.querySelector<HTMLAnchorElement>('a.btn[href="/recupera-verifica"]');
    expect(btn).withContext('il pulsante di reinvio').not.toBeNull();
    expect(btn!.textContent).toContain('Reinvia il link di verifica');
    expect(ctx.testo()).toContain('Email non verificata');
  });

  it('quattro schede solo con un prospetto; senza, Conteggi non esiste', async () => {
    const ctx = await monta(AccountComponent);
    await ctx.stabilizza();
    servi(ctx.http);
    await ctx.stabilizza();
    const schede = [...ctx.el.querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(schede).toEqual(['Panoramica', 'Acquisti e punti', 'Profilo e sicurezza']);
    // un pannello raggiungibile da tastiera, etichettato dalla scheda attiva
    const pannello = ctx.el.querySelector('[role="tabpanel"]')!;
    expect(pannello.getAttribute('tabindex')).toBe('0');
    expect(pannello.getAttribute('aria-labelledby')).toBe(
      ctx.el.querySelector('[role="tab"][aria-selected="true"]')!.id,
    );
  });

  it('con un prospetto la scheda Conteggi compare, e `?vista=conteggi` ci atterra', async () => {
    const ctx = await monta(AccountComponent, { inputs: { vista: 'conteggi' } });
    await ctx.stabilizza();
    servi(ctx.http, { prospetto: prospettoMadRoxKO });
    await ctx.stabilizza();
    const schede = [...ctx.el.querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(schede).toContain('Conteggi');
    expect(ctx.el.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toContain('Conteggi');
    expect(ctx.testo()).toContain('I miei conteggi');
    expect(ctx.testo()).toContain('461,17');
  });

  it('`?vista=conteggi` SENZA prospetto ricade sulla Panoramica dopo la risposta, e `?vista=tutto` non è una scheda', async () => {
    const ctx = await monta(AccountComponent, { inputs: { vista: 'conteggi' } });
    await ctx.stabilizza();
    // durante il carico la scheda chiesta esiste (scheletro), non si rimbalza a vuoto
    expect(ctx.el.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toContain('Conteggi');
    servi(ctx.http);
    await ctx.stabilizza();
    expect(ctx.el.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toContain('Panoramica');

    const ctx2 = await monta(AccountComponent, { inputs: { vista: 'tutto' } });
    await ctx2.stabilizza();
    expect(ctx2.el.querySelector('[role="tab"][aria-selected="true"]')!.textContent).toContain('Panoramica');
    servi(ctx2.http);
  });

  it('con un accordo di staking e NESSUN prospetto la scheda Conteggi esiste lo stesso, col registro', async () => {
    const ctx = await monta(AccountComponent, { inputs: { vista: 'conteggi' } });
    await ctx.stabilizza();
    servi(ctx.http, {
      staking: {
        stato: 'APERTO',
        saldoFondiCent: 50_000,
        saldoEvCent: -34_000,
        apertoAt: '2026-09-01T10:00:00Z',
        chiusoAt: null,
        movimenti: [{ id: 'm1', tipo: 'FONDI', importoCent: 50_000, causale: 'roll iniziale', createdAt: '2026-09-01T10:00:00Z' }],
      },
    });
    await ctx.stabilizza();
    const schede = [...ctx.el.querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(schede).toContain('Conteggi');
    expect(ctx.testo()).toContain('Il tuo accordo di staking');
    expect(ctx.testo()).toContain('roll iniziale');
    // senza mesi la card «I miei conteggi» non compare
    expect(ctx.testo()).not.toContain('I miei conteggi');
  });

  it('un 500 sul prospetto non rompe la pagina e non crea la scheda', async () => {
    const ctx = await monta(AccountComponent);
    await ctx.stabilizza();
    rispondi(ctx.http, '/subscriptions/me', subVuota);
    rispondi(ctx.http, '/points/me', puntiVuoti);
    fallisci(ctx.http, 'mio-prospetto');
    rispondi(ctx.http, '/account/percorso', percorsoVuoto);
    rispondi(ctx.http, '/stakings/mio', null);
    for (const r of ctx.http.match((r) => r.url.includes('/affiliations/me'))) r.flush([]);
    await ctx.stabilizza();
    const schede = [...ctx.el.querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(schede).not.toContain('Conteggi');
    expect(ctx.testo()).toContain('Ciao, MadRoxKO');
  });

  it('cambiando scheda si monta la scheda Acquisti, che carica buoni e ordini da sé', async () => {
    const ctx = await monta(AccountComponent);
    await ctx.stabilizza();
    servi(ctx.http);
    await ctx.stabilizza();
    const tab = [...ctx.el.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((b) =>
      b.textContent?.includes('Acquisti'),
    )!;
    tab.click();
    await ctx.stabilizza();
    rispondi(ctx.http, 'my-vouchers', []);
    rispondi(ctx.http, 'my-orders', []);
    await ctx.stabilizza();
    expect(ctx.testo()).toContain('Buoni e ordini');
    ctx.http.verify();
  });
});
