import { MyAffiliation, Percorso, Role, SubscriptionRequest } from '../../../core/models/api.models';
import { CARICO, errore, ok } from '../account.types';
import {
  Ctx,
  authStub,
  fallisci,
  monta,
  percorsoVuoto,
  rispondi,
  subVuota,
  utente,
} from '../account.spec-helper';
import { AccountPanoramicaComponent } from './account-panoramica.component';

const GIORNO = 86_400_000;
const fra = (giorni: number) => new Date(Date.now() + giorni * GIORNO).toISOString();

const pending: SubscriptionRequest = {
  id: 'r1',
  userId: 'u1',
  userEmail: 'rossana@example.it',
  tier: 'SQUALO',
  tierLabel: 'Squalo',
  paymentMethod: 'punti',
  pointsSpent: 125_000,
  status: 'pending',
  createdAt: '2026-09-10T10:00:00.000Z',
};

const affiliazione = (over: Partial<MyAffiliation>): MyAffiliation => ({
  id: 'a1',
  roomId: 'room1',
  roomName: 'Sala Uno',
  roomSlug: 'sala-uno',
  roomAttiva: true,
  refCode: 'AFF-ABCDEFGH',
  status: 'APPROVATO',
  statusLabel: 'Tracciato',
  accountEsistente: false,
  dichiaraProprieta: true,
  accettaTermini: true,
  riaperture: 0,
  ...over,
});

async function apri(
  opts: {
    auth?: ReturnType<typeof authStub>;
    sub?: unknown;
    percorso?: unknown;
    haConteggi?: boolean;
    affiliazioni?: MyAffiliation[] | 'errore';
  } = {},
): Promise<Ctx<AccountPanoramicaComponent>> {
  const ctx = await monta(AccountPanoramicaComponent, {
    auth: opts.auth,
    inputs: {
      sub: opts.sub ?? ok(subVuota),
      punti: ok({ balance: 150_000, history: [], total: 0 }),
      percorso: opts.percorso ?? ok(percorsoVuoto),
      haConteggi: opts.haConteggi ?? false,
    },
  });
  await ctx.stabilizza();
  if (opts.affiliazioni === 'errore') fallisci(ctx.http, '/affiliations/me');
  else rispondi(ctx.http, '/affiliations/me', opts.affiliazioni ?? []);
  await ctx.stabilizza();
  return ctx;
}

describe('AccountPanoramicaComponent — «Il tuo accesso», per ruolo', () => {
  it('USER senza niente: «Nessun abbonamento attivo» + CTA primaria', async () => {
    const ctx = await apri();
    expect(ctx.testo()).toContain('Nessun abbonamento attivo');
    expect(ctx.el.querySelector('a.btn--primary[href="/abbonati"]')!.textContent).toContain(
      'Scopri gli abbonamenti',
    );
  });

  it('ADMIN, COACH e STAKATO: una frase e NESSUN pulsante di acquisto', async () => {
    for (const role of ['ADMIN', 'COACH', 'STAKATO'] as Role[]) {
      const ctx = await apri({ auth: authStub(utente({ role })), haConteggi: role === 'STAKATO' });
      expect(ctx.testo()).toContain('Hai accesso completo');
      expect(ctx.el.querySelector('[aria-labelledby="acc-accesso"] a[href="/abbonati"]')).withContext(role).toBeNull();
      expect(ctx.testo()).not.toContain('Nessun abbonamento');
      if (role === 'STAKATO') {
        // la porta ai conteggi: «sei in staking» da sola non diceva dove guardare
        expect(ctx.testo()).toContain('scheda Conteggi');
      }
    }
  });

  it('tier con più di 7 giorni: piano, scadenza, CTA fantasma', async () => {
    const ctx = await apri({
      auth: authStub(utente({ role: 'SQUALO' as Role, subscriptionExpiresAt: fra(28) })),
    });
    expect(ctx.testo()).toContain('Piano Squalo');
    expect(ctx.testo()).toMatch(/\(2[78] giorni\)/);
    expect(ctx.el.querySelector('a.btn--ghost[href="/abbonati"]')!.textContent).toContain('Gestisci o rinnova');
    expect(ctx.el.querySelector('a.btn--primary[href="/abbonati"]')).toBeNull();
  });

  it('tier a 2 giorni dalla scadenza: pillola «scade fra 2 giorni» e «Rinnova ora» primaria', async () => {
    const ctx = await apri({
      auth: authStub(utente({ role: 'PESCE_ROSSO' as Role, subscriptionExpiresAt: fra(2) })),
    });
    expect(ctx.el.querySelector('.pill-stato--wait')!.textContent).toContain('scade fra 2 giorni');
    expect(ctx.el.querySelector('a.btn--primary[href="/abbonati"]')!.textContent).toContain('Rinnova ora');
  });

  it('tier scaduto (fra la scadenza e il cron): lo dice, invece di «valido fino a ieri»', async () => {
    const ctx = await apri({
      auth: authStub(utente({ role: 'SQUALO' as Role, subscriptionExpiresAt: fra(-1) })),
    });
    expect(ctx.el.querySelector('.pill-stato--ko')!.textContent).toContain('scaduto');
    expect(ctx.testo()).toContain('si chiude entro poche ore');
    expect(ctx.el.querySelector('a.btn--primary[href="/abbonati"]')!.textContent).toContain('Rinnova');
  });

  it('richiesta in attesa: la riga vera, il metodo «Punti BFF» (non «PayPal») e il rimando — nessun «Scopri»', async () => {
    const ctx = await apri({ sub: ok({ ...subVuota, pendingRequest: pending }) });
    expect(ctx.testo()).toContain('Richiesta di abbonamento Squalo');
    expect(ctx.testo()).toContain('in attesa di approvazione');
    // ⚠️ il ternario `skrill ? 'Skrill' : 'PayPal'` avrebbe stampato «PayPal»
    expect(ctx.testo()).not.toContain('PayPal');
    expect(ctx.testo()).toContain('125.000 punti usati');
    expect(ctx.testo()).toContain('Vedi o ritira la richiesta');
    expect(ctx.testo()).not.toContain('Scopri gli abbonamenti');
    expect(ctx.testo()).not.toContain('Nessun abbonamento');
  });

  it('richiesta rifiutata: motivo in pagina + CTA', async () => {
    const ctx = await apri({
      sub: ok({
        ...subVuota,
        ultimaRifiutata: {
          tier: 'SQUALO',
          tierLabel: 'Squalo',
          createdAt: '2026-09-01T10:00:00.000Z',
          decidedAt: '2026-09-02T10:00:00.000Z',
          decisionNote: 'Pagamento non trovato: controlla il riferimento',
        },
      }),
    });
    expect(ctx.testo()).toContain('non è stata approvata');
    expect(ctx.testo()).toContain('Pagamento non trovato');
    expect(ctx.testo()).toContain('Scopri gli abbonamenti');
  });

  it('/subscriptions/me in errore: la riga del ruolo resta, con «Riprova» e senza inventare niente', async () => {
    const ctx = await apri({ sub: errore('giù') });
    expect(ctx.testo()).toContain('Nessun abbonamento attivo');
    expect(ctx.testo()).toContain('Stato della richiesta non disponibile');
  });
});

describe('AccountPanoramicaComponent — punti (vincoli e formattazione)', () => {
  it('il saldo ha il separatore delle migliaia, e il blocco dice dove SPENDERLI, mai da dove vengono', async () => {
    const ctx = await apri();
    const blocco = ctx.el.querySelector('[aria-labelledby="acc-punti"]')!;
    expect(blocco.textContent).toContain('150.000');
    expect(blocco.querySelector('a[href="/negozio"]')).not.toBeNull();
    // ⚠️ art. 9 DL 87/2018: nessun incentivo, nessun tasso, nessun «guadagna»
    expect(blocco.textContent).not.toMatch(/gioc|guadagn|\d[\d.]*\s*punti\s+ogni/i);
  });
});

describe('AccountPanoramicaComponent — «Il mio percorso»', () => {
  const percorso: Percorso = {
    lezioni: {
      viste: 7,
      riprendi: [
        { lessonId: 'l1', titolo: 'BvB 3-max', percentualeMax: 60.4, ultimaAperturaAt: '2026-09-10T10:00:00Z' },
      ],
    },
    allenamento: { sessioni: 14, risposte: 1234, precisione: 0.715 },
    preset: 2,
    mani: { usate: 12, tetto: 50 },
    live: {
      seguite: 3,
      ultime: [{ sessionId: 's1', titolo: 'Live di prova', primoIngresso: '2026-09-01T18:00:00Z', minuti: 90, stimata: true }],
      consensi: [],
    },
  };

  it('contatori che sono porte: «circa», precisione, quota, live «stimata»', async () => {
    const ctx = await apri({ percorso: ok(percorso) });
    const t = ctx.testo();
    expect(t).toContain('Riprendi: BvB 3-max');
    // ⚠️ la percentuale è una stima per difetto (A12): «circa» obbligatorio
    expect(t).toContain('visto fino a circa il 60%');
    expect(t).toContain('14 sessioni di allenamento');
    // ⚠️ separatore delle migliaia FACOLTATIVO: il CLDR italiano non lo mette
    // sotto le cinque cifre (1234), e il Chrome di Karma lo segue.
    expect(t).toMatch(/1\.?234 mani/);
    expect(t).toContain('precisione 71,5%');
    expect(t).toContain('2 configurazioni di allenamento salvate');
    expect(t).toMatch(/12 di 50\s+mani caricate/);
    expect(t).toContain('3 live seguite');
    expect(t).toContain('90 min');
    expect(t).toContain('(durata stimata)');
    for (const href of ['/lezioni', '/allenamento/risultati', '/allenamento', '/mie-mani', '/live']) {
      expect(ctx.el.querySelector(`a.btn[href="${href}"]`)).withContext(href).not.toBeNull();
    }
    // nessun punteggio complessivo, nessun badge, nessun incoraggiamento
    expect(t).not.toMatch(/completato il|continua così|obiettiv|classific|medagli/i);
  });

  it('con tutto a zero: una riga sola, non cinque contatori a zero', async () => {
    const ctx = await apri();
    const blocco = ctx.el.querySelector('[aria-labelledby="acc-percorso"]')!;
    expect(blocco.textContent).toContain('Il tuo percorso comincia');
    expect(blocco.querySelectorAll('li.riga').length).toBe(0);
  });

  it('in carico uno scheletro (non «comincia dalle lezioni»); in errore «Riprova»', async () => {
    const ctx = await apri({ percorso: CARICO });
    const blocco = ctx.el.querySelector('[aria-labelledby="acc-percorso"]')!;
    expect(blocco.querySelectorAll('.scheletro').length).toBe(3);
    expect(blocco.textContent).not.toContain('comincia');

    const ctx2 = await apri({ percorso: errore('giù') });
    const b2 = ctx2.el.querySelector('[aria-labelledby="acc-percorso"]')!;
    expect(b2.querySelector('[role="alert"]')).not.toBeNull();
    expect(b2.textContent).toContain('Riprova');
  });
});

describe('AccountPanoramicaComponent — affiliazioni', () => {
  it('tre gruppi, compreso «Da riprendere» col motivo del rifiuto e la via di ritorno', async () => {
    const ctx = await apri({
      affiliazioni: [
        affiliazione({ id: 'a1', roomName: 'Sala Uno', status: 'APPROVATO', statusLabel: 'Tracciato', decidedAt: '2026-08-01T10:00:00Z' }),
        affiliazione({ id: 'a2', roomName: 'Sala Due', roomSlug: 'sala-due', status: 'RICHIESTO', statusLabel: 'Link inviato', richiestoAt: '2026-09-01T10:00:00Z' }),
        affiliazione({ id: 'a3', roomName: 'Sala Tre', roomSlug: 'sala-tre', status: 'RIFIUTATO', statusLabel: 'Non approvato', decisionNote: 'username non trovato, controlla e riprova' }),
      ],
    });
    const t = ctx.testo();
    expect(t).toContain('1 tracciata · 1 in corso · 1 da riprendere');
    expect(t).toContain('Dove sei tracciato');
    expect(t).toContain('In corso');
    expect(t).toContain('Da riprendere');
    expect(t).toContain('username non trovato, controlla e riprova');
    expect(t).not.toContain('Non risulti tracciato');
    // due link con nomi accessibili DIVERSI (non «Completa i dati» ×N)
    const completa = ctx.el.querySelector('a[aria-label="Completa i dati per Sala Due"]');
    const riprova = ctx.el.querySelector('a[aria-label="Riprova con Sala Tre"]');
    expect(completa).not.toBeNull();
    expect(riprova).not.toBeNull();
    expect(completa!.getAttribute('href')).toContain('completa=sala-due');
  });

  it('nessuna affiliazione: la frase, solo dopo la risposta', async () => {
    const ctx = await apri({ affiliazioni: [] });
    expect(ctx.testo()).toContain('Non risulti tracciato su nessuna sala');
  });

  it('API giù: un [role=alert] con «Riprova», MAI «non risulti tracciato»', async () => {
    const ctx = await apri({ affiliazioni: 'errore' });
    const blocco = ctx.el.querySelector('[aria-labelledby="acc-aff"]')!;
    expect(blocco.querySelector('[role="alert"]')).not.toBeNull();
    expect(blocco.textContent).not.toContain('Non risulti tracciato');
    (blocco.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await ctx.stabilizza();
    rispondi(ctx.http, '/affiliations/me', []);
    await ctx.stabilizza();
    expect(ctx.testo()).toContain('Non risulti tracciato');
  });

  /**
   * ⚠️ REQUISITO LEGALE (valutazione affiliazioni, criterio 6): il nome di una
   * sala compare SOLO dentro il blocco delle affiliazioni. Se un giorno un
   * sotto-testo dei punti o del percorso nominasse una sala, questa prova
   * diventa rossa — ed è l'incrocio che accende la DPIA.
   */
  it('il nome di una sala compare SOLO nel blocco delle affiliazioni', async () => {
    const ctx = await apri({
      affiliazioni: [affiliazione({ roomName: 'SalaUnicaXYZ' })],
      percorso: ok({ ...percorsoVuoto, lezioni: { viste: 2, riprendi: [] } }),
    });
    const blocchi = [...ctx.el.querySelectorAll('section.blocco')];
    const conSala = blocchi.filter((b) => b.textContent?.includes('SalaUnicaXYZ'));
    expect(conSala.length).toBe(1);
    expect(conSala[0].getAttribute('aria-labelledby')).toBe('acc-aff');
  });
});
