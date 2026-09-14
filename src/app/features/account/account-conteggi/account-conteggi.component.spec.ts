import { ProspettoMese, StakingMio } from '../../../core/models/api.models';
import { CARICO, errore, ok } from '../account.types';
import { Ctx, monta, prospettoMadRoxKO } from '../account.spec-helper';
import { AccountConteggiComponent } from './account-conteggi.component';

async function apri(prospetto: unknown, staking: unknown = ok(null)): Promise<Ctx<AccountConteggiComponent>> {
  const ctx = await monta(AccountConteggiComponent, { inputs: { prospetto, staking } });
  await ctx.stabilizza();
  return ctx;
}

const registro: StakingMio = {
  stato: 'APERTO',
  saldoFondiCent: 50_000,
  saldoEvCent: -34_000,
  apertoAt: '2026-09-01T10:00:00Z',
  chiusoAt: null,
  movimenti: [
    { id: 'm1', tipo: 'FONDI', importoCent: 50_000, causale: 'roll iniziale', createdAt: '2026-09-01T10:00:00Z' },
    { id: 'm2', tipo: 'EV', importoCent: -34_000, causale: 'scarto di settembre', createdAt: '2026-09-10T10:00:00Z' },
    { id: 'm3', tipo: 'EV', importoCent: 7_000, causale: 'recupero parziale', createdAt: '2026-09-12T10:00:00Z' },
  ],
};

/**
 * Il prospetto dei propri conteggi: la prima superficie del modulo rivolta
 * all'utente (11/09/2026), ora in una scheda. Le prove di formattazione sono
 * quelle della fixture di MadRoxKO; quelle legali guardano ciò che NON deve
 * comparire (valutazione §D/§H/§I).
 */
describe('AccountConteggiComponent', () => {
  it('mostra i propri numeri, dichiara il mese aperto come provvisorio, e il primo mese è aperto', async () => {
    const ctx = await apri(ok(prospettoMadRoxKO));
    const t = ctx.testo();
    expect(t).toContain('I miei conteggi');
    expect(t).toContain('settembre 2026');
    expect(t).toContain('461,17');
    expect(t).toContain('28,09');
    expect(t).toContain('18,09');
    expect(t).toContain('provvisorio');
    const dettagli = ctx.el.querySelector<HTMLDetailsElement>('details.cnt__mese')!;
    expect(dettagli.open).toBeTrue();
    // la cifra chiave nel summary
    expect(dettagli.querySelector('summary')!.textContent).toContain('Resta da darti');
    expect(dettagli.querySelector('summary')!.textContent).toContain('18,09');
  });

  it('con più mesi solo il primo è aperto', async () => {
    const due: ProspettoMese[] = [
      prospettoMadRoxKO[0],
      { ...prospettoMadRoxKO[0], meseId: 'm0', mese: 8, etichetta: 'agosto 2026', provvisorio: false },
    ];
    const ctx = await apri(ok(due));
    const aperti = [...ctx.el.querySelectorAll<HTMLDetailsElement>('details.cnt__mese')].map((d) => d.open);
    expect(aperti).toEqual([true, false]);
  });

  /**
   * ⚠️ REQUISITO LEGALE: nel prospetto nessun punto BFF (punti e conteggi
   * sono comunicazioni DISTINTE) e nessun pattern di confronto o
   * incoraggiamento (§I). Le tre percentuali pattuite di `formattaBp` invece
   * DEVONO restare — così la guardia non diventa vuota se la sezione sparisce.
   */
  it('nessun punto BFF e nessun confronto; le percentuali pattuite ci sono', async () => {
    const ctx = await apri(ok(prospettoMadRoxKO));
    const t = ctx.el.querySelector('details.cnt__mese')!.textContent ?? '';
    expect(t).not.toMatch(/\bpunti\b|\bpt\b/i);
    expect(t).not.toMatch(/[+−-]\s?\d+(,\d+)?\s?%/);
    expect(t).not.toMatch(/rispetto|mese precedente|continua|miglior/i);
    expect(t).toMatch(/50(,00)?%/);
    expect(t).toMatch(/\b45(,00)?%/);
  });

  it('i due canali per una rettifica: l’email del Titolare e Discord', async () => {
    const ctx = await apri(ok(prospettoMadRoxKO));
    expect(ctx.el.querySelector('a[href^="mailto:"]')).not.toBeNull();
    expect(ctx.el.querySelector('a[href*="discord"]')).not.toBeNull();
  });

  /**
   * Il registro dello staking (14/09/2026): fondi, scarto EV, movimenti col
   * segno. ⚠️ Nessuna percentuale di recupero e nessun punto BFF (le misure 5
   * e 4 della valutazione), e «in pari» quando lo scarto è zero.
   */
  it('il registro di staking: saldi, movimenti col segno, nessuna percentuale', async () => {
    const ctx = await apri(ok([]), ok(registro));
    const t = ctx.testo();
    expect(t).toContain('Il tuo accordo di staking');
    expect(t).toContain('in corso');
    expect(t).toMatch(/500,00\s€/);
    expect(t).toMatch(/340,00\s€/);
    expect(t).toContain('roll iniziale');
    expect(t).toMatch(/\+500,00\s€/);
    expect(t).toMatch(/−340,00\s€/);
    expect(t).toMatch(/\+70,00\s€/);
    expect(t).toContain('EV da recuperare');
    // nessuna percentuale, nessun punto, nessun incoraggiamento
    const blocco = ctx.el.querySelector('[aria-labelledby="stk-titolo"]')!.textContent ?? '';
    expect(blocco).not.toMatch(/\d\s?%/);
    expect(blocco).not.toMatch(/\bpunti\b|\bpt\b|continua|obiettiv/i);
    // senza mesi, niente card «I miei conteggi»
    expect(t).not.toContain('I miei conteggi');
  });

  it('scarto a zero → «in pari»; accordo chiuso → pillola «chiuso»', async () => {
    const ctx = await apri(ok([]), ok({ ...registro, stato: 'CHIUSO', saldoEvCent: 0, chiusoAt: '2026-09-13T10:00:00Z' }));
    expect(ctx.testo()).toContain('in pari');
    expect(ctx.el.querySelector('.pill-stato--off')!.textContent).toContain('chiuso');
  });

  it('registro in carico → NIENTE (nessuno scheletro che sparisca per chi non ha un accordo); in errore → «Riprova»; senza accordo → niente blocco', async () => {
    const ctx = await apri(ok(prospettoMadRoxKO), CARICO);
    expect(ctx.el.querySelector('[aria-labelledby="stk-titolo"]')).toBeNull();
    const ctx2 = await apri(ok(prospettoMadRoxKO), errore('giù'));
    expect(ctx2.el.querySelector('[aria-labelledby="stk-titolo"] [role="alert"]')!.textContent).toContain('Riprova');
    const ctx3 = await apri(ok(prospettoMadRoxKO));
    expect(ctx3.el.querySelector('[aria-labelledby="stk-titolo"]')).toBeNull();
  });

  it('in carico uno scheletro; in errore «Riprova»', async () => {
    const ctx = await apri(CARICO);
    expect(ctx.el.querySelector('.scheletro')).not.toBeNull();
    const ctx2 = await apri(errore('giù'));
    expect(ctx2.el.querySelector('[role="alert"]')!.textContent).toContain('Riprova');
  });
});
