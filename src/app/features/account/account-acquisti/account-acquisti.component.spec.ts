import { MyVoucher, ShopOrder } from '../../../core/models/api.models';
import { CARICO, errore, ok } from '../account.types';
import { Ctx, fallisci, monta, rispondi } from '../account.spec-helper';
import { AccountAcquistiComponent } from './account-acquisti.component';

const buono = (over: Partial<MyVoucher>): MyVoucher => ({
  code: 'BFF-AAAA1111',
  kind: 'FIXED',
  value: 10,
  source: 'shop',
  status: 'available',
  validUntil: '2027-03-01T10:00:00Z',
  ...over,
});

const ordine = (over: Partial<ShopOrder>): ShopOrder => ({
  id: 'o1',
  userId: 'u1',
  userEmail: 'rossana@example.it',
  type: 'GADGET',
  typeLabel: 'Gadget',
  status: 'SPEDITO',
  statusLabel: 'Spedito',
  pointsSpent: 0,
  itemLabel: 'Felpa BFF',
  amountEur: 12.5,
  trackingNote: 'BRT 123456',
  createdAt: '2026-09-01T10:00:00Z',
  ...over,
});

async function apri(punti: unknown, opts: { buoni?: MyVoucher[] | 'errore'; ordini?: ShopOrder[] | 'errore' } = {}) {
  const ctx: Ctx<AccountAcquistiComponent> = await monta(AccountAcquistiComponent, {
    inputs: { punti },
  });
  await ctx.stabilizza();
  if (opts.buoni === 'errore') fallisci(ctx.http, 'my-vouchers');
  else rispondi(ctx.http, 'my-vouchers', opts.buoni ?? []);
  if (opts.ordini === 'errore') fallisci(ctx.http, 'my-orders');
  else rispondi(ctx.http, 'my-orders', opts.ordini ?? []);
  await ctx.stabilizza();
  return ctx;
}

describe('AccountAcquistiComponent — formattazione (LOCALE it)', () => {
  it('«150.000», delta col segno, saldo dopo, «12,50 €» e «10 €»', async () => {
    const ctx = await apri(
      ok({
        balance: 150_000,
        page: 1,
        limit: 20,
        total: 2,
        history: [
          { id: 'e1', delta: 5000, reason: 'Punti sul rakeback', balanceAfter: 150_000, createdAt: '2026-09-01T10:00:00Z' },
          { id: 'e2', delta: -25_000, reason: 'Buono €25', balanceAfter: 145_000, createdAt: '2026-08-01T10:00:00Z' },
        ],
      }),
      { buoni: [buono({}), buono({ code: 'BFF-BBBB2222', kind: 'PERCENT', value: 15, source: 'admin', status: 'expired' })], ordini: [ordine({})] },
    );
    const t = ctx.testo();
    expect(t).toContain('150.000');
    // separatore facoltativo sotto le cinque cifre (CLDR it), NBSP prima di «€»
    expect(t).toMatch(/\+5\.?000/);
    expect(t).toContain('−25.000');
    expect(t).toContain('→ 145.000');
    expect(t).toContain('2 di 2');
    // euro nella grammatica di denaro.ts, MAI «€12.50»
    expect(t).toMatch(/12,50\s€/);
    expect(t).not.toContain('€12.50');
    expect(t).toMatch(/10\s€/);
    expect(t).toContain('15%');
    // il tracking della spedizione, non solo la parola «Spedito»
    expect(t).toContain('BRT 123456');
    // il codice in un elemento dedicato, selezionabile per intero
    expect(ctx.el.querySelector('.codice')!.textContent).toContain('BFF-AAAA1111');
    // nessun «Carica altri»: 2 di 2
    expect(t).not.toContain('Carica altri');
  });

  it('un buono disponibile del Negozio ha DUE destinazioni con nomi accessibili diversi', async () => {
    const ctx = await apri(ok({ balance: 0, history: [] }), { buoni: [buono({})] });
    // «10 €» porta un NBSP: si cerca per prefisso e coda, non per stringa esatta
    const link = [...ctx.el.querySelectorAll<HTMLAnchorElement>('a[aria-label^="Usa il buono"]')];
    const a = link.find((x) => x.getAttribute('aria-label')!.endsWith("sull'abbonamento")) ?? null;
    const g = link.find((x) => x.getAttribute('aria-label')!.endsWith('su un gadget')) ?? null;
    expect(a).not.toBeNull();
    expect(g).not.toBeNull();
    expect(a!.getAttribute('href')).toBe('/abbonati');
    expect(g!.getAttribute('href')).toBe('/negozio');
    // le due pillole hanno un tono dallo switch esaustivo
    expect(ctx.el.querySelector('.pill-stato--ok')!.textContent).toContain('Disponibile');
  });

  it('«Carica altri» compare solo se il server ha detto quanti sono e ne restano, e accoda la pagina 2', async () => {
    const ctx = await apri(
      ok({
        balance: 100,
        page: 1,
        limit: 1,
        total: 2,
        history: [{ id: 'e1', delta: 100, reason: 'uno', balanceAfter: 100 }],
      }),
    );
    const btn = [...ctx.el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Carica altri'),
    );
    expect(btn).toBeDefined();
    btn!.click();
    await ctx.stabilizza();
    const req = ctx.http.expectOne((r) => r.url.includes('/points/me'));
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('1');
    req.flush({ balance: 100, page: 2, limit: 1, total: 2, history: [{ id: 'e2', delta: 0, reason: 'due', balanceAfter: 100 }] });
    await ctx.stabilizza();
    expect(ctx.testo()).toContain('due');
    expect(ctx.testo()).toContain('2 di 2');
    expect(ctx.testo()).not.toContain('Carica altri');
  });

  it('senza `total` (backend vecchio) nessun «Carica altri» e nessun totale inventato', async () => {
    const ctx = await apri(ok({ balance: 100, history: [{ id: 'e1', delta: 100, reason: 'uno', balanceAfter: 100 }] }));
    expect(ctx.testo()).not.toContain('Carica altri');
    expect(ctx.testo()).not.toMatch(/\d+ di \d+/);
  });
});

describe('AccountAcquistiComponent — stati', () => {
  it('in carico: scheletri, MAI «Non hai buoni» / «Nessun ordine»', async () => {
    const ctx: Ctx<AccountAcquistiComponent> = await monta(AccountAcquistiComponent, {
      inputs: { punti: CARICO },
    });
    await ctx.stabilizza();
    expect(ctx.el.querySelectorAll('.scheletro').length).toBeGreaterThan(0);
    expect(ctx.testo()).not.toContain('Non hai buoni');
    expect(ctx.testo()).not.toContain('Nessun ordine');
    expect(ctx.testo()).not.toContain('Compariranno qui');
    rispondi(ctx.http, 'my-vouchers', []);
    rispondi(ctx.http, 'my-orders', []);
  });

  it('due liste vuote → UNA riga («compariranno dopo il primo acquisto»)', async () => {
    const ctx = await apri(ok({ balance: 0, history: [] }));
    expect(ctx.testo()).toContain('Compariranno qui dopo il primo acquisto');
    expect(ctx.testo()).not.toContain('Non hai buoni');
    expect(ctx.testo()).not.toContain('Nessun ordine');
  });

  it('buoni in errore: [role=alert] con «Riprova» che rifà LA SOLA chiamata, e mai «Non hai buoni»', async () => {
    const ctx = await apri(ok({ balance: 0, history: [] }), { buoni: 'errore', ordini: [ordine({})] });
    const blocco = ctx.el.querySelector('[aria-labelledby="acq-acquisti"]')!;
    expect(blocco.querySelector('[role="alert"]')).not.toBeNull();
    expect(blocco.textContent).not.toContain('Non hai buoni');
    (blocco.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await ctx.stabilizza();
    rispondi(ctx.http, 'my-vouchers', [buono({})]);
    ctx.http.expectNone((r) => r.url.includes('my-orders'));
    await ctx.stabilizza();
    expect(ctx.testo()).toContain('BFF-AAAA1111');
  });

  it('punti in errore: banda con «Riprova» che chiede alla shell, e nessuna cifra inventata', async () => {
    const ctx = await apri(errore('giù'));
    const blocco = ctx.el.querySelector('[aria-labelledby="acq-movimenti"]')!;
    expect(blocco.querySelector('[role="alert"]')).not.toBeNull();
    expect(blocco.textContent).not.toContain('Nessun movimento');
    const emesso = jasmine.createSpy('riprovaPunti');
    ctx.fixture.componentInstance.riprovaPunti.subscribe(emesso);
    (blocco.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    expect(emesso).toHaveBeenCalled();
  });
});
