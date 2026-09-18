import { HttpErrorResponse } from '@angular/common/http';
import { mergeMap, throwError, timer } from 'rxjs';
import { Role } from '../../../core/models/api.models';
import { CARICO, ok } from '../account.types';
import { Ctx, authStub, monta, percorsoVuoto, utente } from '../account.spec-helper';
import { AccountProfiloComponent } from './account-profilo.component';

// ⚠️ ASINCRONO come in rete: un errore sincrono arriverebbe prima del primo
// giro di change detection e il DOM non vedrebbe mai il valore ottimistico —
// la spunta «che torna com'era» sarebbe una prova vuota.
const err = (status: number, message: string) =>
  timer(0).pipe(mergeMap(() => throwError(() => new HttpErrorResponse({ status, error: { message } }))));

async function apri(opts: { auth?: ReturnType<typeof authStub>; percorso?: unknown; haConteggi?: boolean } = {}) {
  const ctx: Ctx<AccountProfiloComponent> = await monta(AccountProfiloComponent, {
    auth: opts.auth,
    inputs: { percorso: opts.percorso ?? ok(percorsoVuoto), haConteggi: opts.haConteggi ?? false },
  });
  await ctx.stabilizza();
  return ctx;
}

const input = (ctx: Ctx<unknown>, id: string) => ctx.el.querySelector<HTMLInputElement>(`#${id}`)!;
const digita = (el: HTMLInputElement, v: string) => {
  el.value = v;
  el.dispatchEvent(new Event('input'));
  el.dispatchEvent(new Event('blur'));
};
const bottone = (ctx: Ctx<unknown>, testo: string) =>
  [...ctx.el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(testo))!;
const attendi = () => new Promise((r) => setTimeout(r, 10));
/** Un giro di CD, un tick, un altro giro: per le risposte asincrone. */
const dopo = async (ctx: Ctx<unknown>) => {
  await ctx.stabilizza();
  await attendi();
  await ctx.stabilizza();
};

describe('AccountProfiloComponent — dati di profilo', () => {
  it('le regioni live esistono PRIMA dell’azione, e l’esito compare dentro', async () => {
    const ctx = await apri();
    const live = ctx.el.querySelectorAll('[role="status"][aria-live="polite"]');
    expect(live.length).toBeGreaterThanOrEqual(5);
    digita(input(ctx, 'nickname'), 'NuovoNick');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    const primo = ctx.el.querySelector('[aria-labelledby="pr-profilo"] [role="status"]')!;
    expect(primo.textContent).toContain('Profilo aggiornato.');
    expect(ctx.auth.updateProfile).toHaveBeenCalledWith({ email: 'rossana@example.it', nickname: 'NuovoNick', nomeSala: '' });
  });

  it('non verificato che cambia SOLO il nickname: il messaggio non parla di email', async () => {
    const ctx = await apri({ auth: authStub(utente({ verified: false })) });
    digita(input(ctx, 'nickname'), 'NuovoNick');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    const msg = ctx.el.querySelector('[aria-labelledby="pr-profilo"] .is-success')!.textContent ?? '';
    expect(msg).toContain('Profilo aggiornato');
    expect(msg).not.toContain('email');
    // e il pulsante di reinvio della verifica sta anche qui, dove si guarda
    expect(ctx.el.querySelector('[aria-labelledby="pr-profilo"] a[href="/recupera-verifica"]')).not.toBeNull();
  });

  it('cambiare email chiede CONFERMA prima di inviare, con la conseguenza scritta', async () => {
    const ctx = await apri();
    // l'avviso sta accanto al campo PRIMA del gesto
    expect(ctx.el.querySelector('#email-avviso')!.textContent).toContain('torna non verificato');
    digita(input(ctx, 'email'), 'Nuova@Example.it');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    expect(ctx.auth.updateProfile).not.toHaveBeenCalled();
    const conferma = ctx.el.querySelector('#conferma-email')!;
    expect(conferma.textContent).toContain('Nuova@Example.it');
    expect(conferma.getAttribute('role')).toBe('group');
    bottone(ctx, 'Sì, cambia email').click();
    await ctx.stabilizza();
    expect(ctx.auth.updateProfile).toHaveBeenCalledWith({ email: 'Nuova@Example.it', nickname: 'MadRoxKO', nomeSala: '' });
    expect(ctx.el.querySelector('[aria-labelledby="pr-profilo"] .is-success')!.textContent).toContain('Hai cambiato email');
  });

  it('un 409 sul nickname arriva come testo del server, nella regione live', async () => {
    const ctx = await apri();
    ctx.auth.updateProfile.and.returnValue(err(409, 'Nickname già in uso'));
    digita(input(ctx, 'nickname'), 'Occupato');
    bottone(ctx, 'Salva modifiche').click();
    await dopo(ctx);
    expect(ctx.el.querySelector('[aria-labelledby="pr-profilo"] [role="status"]')!.textContent).toContain('Nickname già in uso');
  });

  it('gli errori dei campi sono collegati con aria-describedby e aria-invalid', async () => {
    const ctx = await apri();
    digita(input(ctx, 'nickname'), 'a');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    const nick = input(ctx, 'nickname');
    expect(nick.getAttribute('aria-invalid')).toBe('true');
    expect(nick.getAttribute('aria-describedby')).toBe('nickname-errore');
    expect(ctx.el.querySelector('#nickname-errore')).not.toBeNull();
    expect(nick.getAttribute('autocomplete')).toBe('nickname');
  });
});

describe('AccountProfiloComponent — il nome da mostrare in sala', () => {
  it('⚠️ l’anteprima cambia MENTRE si digita', async () => {
    // È la prova che impedisce di «semplificare» l'anteprima in un `computed`
    // che legge il `FormControl`: un FormGroup non è un signal, quel computed
    // non si ricalcolerebbe mai e l'anteprima resterebbe congelata al valore
    // di partenza — cioè mentirebbe proprio nell'istante in cui la si guarda.
    const ctx = await apri();
    const aiuto = () => ctx.el.querySelector('#nomesala-aiuto')!.textContent ?? '';
    expect(aiuto()).toContain('MadRoxKO'); // a campo vuoto: il nickname

    digita(input(ctx, 'nomeSala'), 'Mario');
    await ctx.stabilizza();
    expect(aiuto()).toContain('Mario');
  });

  it('a campo vuoto l’anteprima dice il nickname, non una riga vuota', async () => {
    const ctx = await apri();
    expect(input(ctx, 'nomeSala').value).toBe('');
    expect(ctx.el.querySelector('#nomesala-aiuto')!.textContent).toContain(
      'MadRoxKO',
    );
  });

  it('⚠️ l’aiuto dichiara CHI lo vede: è l’informativa del campo', async () => {
    // Su questa frase poggia la legittimità di mostrare il proprio nome agli
    // altri partecipanti (voce di registro A10): chi compila sa in anticipo
    // chi lo leggerà. Accorciarla cambia il trattamento, non il testo.
    const ctx = await apri();
    const aiuto = ctx.el.querySelector('#nomesala-aiuto')!.textContent ?? '';
    expect(aiuto).toContain('coach');
    expect(aiuto).toContain('altri partecipanti');
    // E il caveat del token: il nome si vede al prossimo ingresso, non subito.
    expect(aiuto).toContain('prossimo ingresso');
  });

  it('il nome viaggia col salvataggio del profilo', async () => {
    const ctx = await apri();
    digita(input(ctx, 'nomeSala'), 'Mario Rossi');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    expect(ctx.auth.updateProfile).toHaveBeenCalledWith({
      email: 'rossana@example.it',
      nickname: 'MadRoxKO',
      nomeSala: 'Mario Rossi',
    });
  });

  it('svuotarlo manda la stringa vuota: è la cancellazione', async () => {
    const ctx = await apri({ auth: authStub(utente({ nomeSala: 'Mario' })) });
    expect(input(ctx, 'nomeSala').value).toBe('Mario');
    digita(input(ctx, 'nomeSala'), '');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    expect(ctx.auth.updateProfile).toHaveBeenCalledWith(
      jasmine.objectContaining({ nomeSala: '' }),
    );
  });

  it('⚠️ cambiare SOLO il nome non fa scattare la conferma dell’email', async () => {
    const ctx = await apri();
    digita(input(ctx, 'nomeSala'), 'Mario');
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    expect(ctx.el.querySelector('#conferma-email')).toBeNull();
    expect(ctx.auth.updateProfile).toHaveBeenCalled();
  });

  it('un nome non ammesso è segnalato sul campo, non al salvataggio', async () => {
    const ctx = await apri();
    digita(input(ctx, 'nomeSala'), 'M'); // sotto i due caratteri
    bottone(ctx, 'Salva modifiche').click();
    await ctx.stabilizza();
    const campo = input(ctx, 'nomeSala');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(campo.getAttribute('aria-describedby')).toBe('nomesala-errore');
    expect(ctx.el.querySelector('#nomesala-errore')).not.toBeNull();
  });
});

describe('AccountProfiloComponent — notifiche', () => {
  it('la spunta salva subito; su errore torna com’era', async () => {
    const ctx = await apri();
    const cb = ctx.el.querySelector<HTMLInputElement>('.pr__toggle input')!;
    expect(cb.checked).toBeTrue();
    ctx.auth.updateProfile.and.returnValue(err(500, 'giù'));
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
    await dopo(ctx);
    expect(ctx.auth.updateProfile).toHaveBeenCalledWith({ notifyNewLessons: false });
    expect(ctx.el.querySelector<HTMLInputElement>('.pr__toggle input')!.checked).toBeTrue();
    expect(ctx.el.querySelector('[aria-labelledby="pr-notifiche"] [role="status"]')!.textContent).toContain('giù');
    // nessun [disabled]: il fuoco non deve cadere su body
    expect(cb.hasAttribute('disabled')).toBeFalse();
  });

  it('UN solo interruttore (è ciò che l’informativa promette)', async () => {
    const ctx = await apri();
    expect(ctx.el.querySelectorAll('input[type="checkbox"]').length).toBe(1);
    expect(ctx.testo()).toContain('Le email di servizio');
  });
});

describe('AccountProfiloComponent — password', () => {
  it('403 «Password attuale errata»: messaggio in pagina, NESSUNA navigazione, nessun logout', async () => {
    const ctx = await apri();
    ctx.auth.changePassword.and.returnValue(err(403, 'Password attuale errata'));
    const navigate = spyOn(ctx.router, 'navigateByUrl').and.resolveTo(true);
    digita(input(ctx, 'currentPassword'), 'sbagliata');
    digita(input(ctx, 'newPassword'), 'nuovapassword');
    digita(input(ctx, 'confirm'), 'nuovapassword');
    bottone(ctx, 'Cambia password').click();
    await dopo(ctx);
    expect(ctx.el.querySelector('[aria-labelledby="pr-password"] [role="status"]')!.textContent).toContain(
      'Password attuale errata',
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(ctx.auth.logout).not.toHaveBeenCalled();
  });

  it('successo: logout, toast e /login?redirect=/account (dopo il logout)', async () => {
    const ctx = await apri();
    const navigate = spyOn(ctx.router, 'navigateByUrl').and.resolveTo(true);
    digita(input(ctx, 'currentPassword'), 'giusta');
    digita(input(ctx, 'newPassword'), 'nuovapassword');
    digita(input(ctx, 'confirm'), 'nuovapassword');
    bottone(ctx, 'Cambia password').click();
    await ctx.stabilizza();
    expect(ctx.auth.changePassword).toHaveBeenCalledWith('giusta', 'nuovapassword');
    expect(ctx.auth.logout).toHaveBeenCalled();
    expect(ctx.toast.success).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login?redirect=/account');
  });

  it('password attuale vuota e conferma vuota hanno un TESTO d’errore, non solo il bordo rosso', async () => {
    const ctx = await apri();
    digita(input(ctx, 'newPassword'), 'nuovapassword');
    bottone(ctx, 'Cambia password').click();
    await ctx.stabilizza();
    expect(ctx.el.querySelector('#current-errore')!.textContent).toContain('Inserisci la password attuale');
    expect(ctx.el.querySelector('#confirm-errore')!.textContent).toContain('Ripeti la nuova password');
    expect(ctx.auth.changePassword).not.toHaveBeenCalled();
  });
});

describe('AccountProfiloComponent — i tuoi dati', () => {
  it('l’export chiama UNA volta e scrive l’esito nella regione live', async () => {
    const ctx = await apri();
    spyOn(HTMLAnchorElement.prototype, 'click').and.stub();
    bottone(ctx, 'Scarica i miei dati').click();
    await ctx.stabilizza();
    expect(ctx.auth.exportMyData).toHaveBeenCalledTimes(1);
    expect(ctx.el.querySelector('[aria-labelledby="pr-dati"] [role="status"]')!.textContent).toContain(
      'best-fish-forever-i-miei-dati.json',
    );
  });

  it('i consensi alla registrazione delle live si leggono qui (titolo, data, versione)', async () => {
    const ctx = await apri({
      percorso: ok({
        ...percorsoVuoto,
        live: {
          seguite: 1,
          ultime: [],
          consensi: [{ sessionId: 's1', titolo: 'Live di prova', version: 'v1', createdAt: '2026-09-01T18:00:00Z' }],
        },
      }),
    });
    const blocco = ctx.el.querySelector('[aria-labelledby="pr-dati"]')!;
    expect(blocco.textContent).toContain('Live di prova');
    expect(blocco.textContent).toContain('testo versione v1');
    expect(blocco.textContent).toMatch(/1 set 2026/);
  });

  it('senza consensi lo dice; in carico uno scheletro', async () => {
    const ctx = await apri();
    expect(ctx.testo()).toContain('Non hai ancora prestato consensi');
    const ctx2 = await apri({ percorso: CARICO });
    expect(ctx2.el.querySelector('[aria-labelledby="pr-dati"] .scheletro')).not.toBeNull();
  });
});

describe('AccountProfiloComponent — elimina account', () => {
  it('la copy dice cosa sparisce e rimanda all’informativa; chi ha conteggi legge «resi anonimi»', async () => {
    const ctx = await apri({ haConteggi: true });
    const blocco = ctx.el.querySelector('[aria-labelledby="pr-elimina"]')!;
    expect(blocco.textContent).toContain('punti BFF e buoni');
    expect(blocco.textContent).toContain('irreversibile');
    expect(blocco.textContent).toContain('resi anonimi');
    const link = blocco.querySelector<HTMLAnchorElement>('a[href*="/privacy"]')!;
    expect(link.getAttribute('href')).toContain('#conservazione');
  });

  it('la conferma riceve il FUOCO come gruppo etichettato, e Escape la chiude', async () => {
    const ctx = await apri();
    bottone(ctx, 'Elimina il mio account').click();
    await ctx.stabilizza();
    await attendi();
    const gruppo = ctx.el.querySelector<HTMLElement>('#account-conferma-elimina')!;
    expect(gruppo.getAttribute('role')).toBe('group');
    expect(gruppo.getAttribute('aria-label')).toContain('Conferma eliminazione');
    expect(document.activeElement).toBe(gruppo);
    gruppo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await ctx.stabilizza();
    expect(ctx.el.querySelector('#account-conferma-elimina')).toBeNull();
    expect(ctx.auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('DELETE con status 0: errore, sessione INTATTA, si può riprovare', async () => {
    const ctx = await apri();
    ctx.auth.deleteAccount.and.returnValue(err(0, ''));
    const navigate = spyOn(ctx.router, 'navigateByUrl').and.resolveTo(true);
    bottone(ctx, 'Elimina il mio account').click();
    await ctx.stabilizza();
    bottone(ctx, 'Sì, elimina tutto').click();
    await dopo(ctx);
    expect(ctx.auth.user()).not.toBeNull();
    expect(navigate).not.toHaveBeenCalled();
    expect(ctx.el.querySelector('[aria-labelledby="pr-elimina"] [role="status"]')!.textContent).toContain(
      'Impossibile raggiungere il server',
    );
    expect(bottone(ctx, 'Sì, elimina tutto')).toBeDefined();
  });

  it('DELETE 500: lo dice e chiude la conferma; 200: si torna in home', async () => {
    const ctx = await apri();
    ctx.auth.deleteAccount.and.returnValue(err(500, 'boom'));
    bottone(ctx, 'Elimina il mio account').click();
    await ctx.stabilizza();
    bottone(ctx, 'Sì, elimina tutto').click();
    await dopo(ctx);
    expect(ctx.testo()).toContain('Cancellazione non completata');
    expect(ctx.el.querySelector('#account-conferma-elimina')).toBeNull();

    const ctx2 = await apri();
    const navigate = spyOn(ctx2.router, 'navigateByUrl').and.resolveTo(true);
    bottone(ctx2, 'Elimina il mio account').click();
    await ctx2.stabilizza();
    bottone(ctx2, 'Sì, elimina tutto').click();
    await ctx2.stabilizza();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
