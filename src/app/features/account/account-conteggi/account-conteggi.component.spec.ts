import { ProspettoMese } from '../../../core/models/api.models';
import { CARICO, errore, ok } from '../account.types';
import { Ctx, monta, prospettoMadRoxKO } from '../account.spec-helper';
import { AccountConteggiComponent } from './account-conteggi.component';

async function apri(prospetto: unknown): Promise<Ctx<AccountConteggiComponent>> {
  const ctx = await monta(AccountConteggiComponent, { inputs: { prospetto } });
  await ctx.stabilizza();
  return ctx;
}

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

  it('in carico uno scheletro; in errore «Riprova»', async () => {
    const ctx = await apri(CARICO);
    expect(ctx.el.querySelector('.scheletro')).not.toBeNull();
    const ctx2 = await apri(errore('giù'));
    expect(ctx2.el.querySelector('[role="alert"]')!.textContent).toContain('Riprova');
  });
});
