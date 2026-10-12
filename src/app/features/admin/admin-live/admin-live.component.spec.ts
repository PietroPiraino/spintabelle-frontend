import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { LiveMode, LiveSession } from '../../../core/models/api.models';
import { AdminLiveComponent } from './admin-live.component';

const API = environment.API_URL;

/** Sessione on-site con registrazione pronta da pubblicare. */
const readySession = (over: Partial<LiveSession> = {}): LiveSession => ({
  id: 's1',
  title: 'Bastogne87 — Lezione Low Stakes',
  description: 'Sessione live del martedì',
  stakes: 'LOW',
  startsAt: '2026-07-28T20:00:00.000Z',
  mode: 'LIVEKIT',
  locked: false,
  recordingEnabled: true,
  recordingState: 'READY',
  ...over,
});

/** Sessione esterna (Zoom/Discord) già programmata: il caso non-default. */
const externalSession = (): LiveSession => ({
  id: 's2',
  title: 'Q&A su Discord',
  stakes: 'HIGH',
  startsAt: '2026-08-04T20:00:00.000Z',
  mode: 'EXTERNAL',
  platform: 'Discord',
  joinUrl: 'https://discord.gg/bff',
  locked: false,
});

/** Trova un bottone dal testo (il markup usa classi condivise, non id). */
const buttonWith = (el: HTMLElement, text: string): HTMLButtonElement =>
  Array.from(el.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  )!;

const isList = (r: { url: string; method?: string }) =>
  r.url === `${API}/live` && r.method !== 'POST';

/** Admin e coach finti per il campo «Conduce». */
const STAFF = {
  ADMIN: [
    { id: 'u-exi', email: 'exi@bff.it', nickname: 'Exivezzz2323', role: 'ADMIN' },
  ],
  COACH: [
    { id: 'u-velo', email: 'velo@bff.it', nickname: 'Velenoso1983', role: 'COACH' },
    { id: 'u-jin', email: 'jin@bff.it', nickname: 'Jinwoosung', role: 'COACH' },
  ],
};

/**
 * Risponde alle due letture di admin e coach che l'apertura del form fa (una
 * per ruolo). Nessuna richiesta in sospeso = nessuna risposta: l'elenco si
 * carica una volta sola.
 */
function serviConduttori(http: HttpTestingController): void {
  for (const req of http.match((r) => r.url === `${API}/admin/users`)) {
    const role = req.request.params.get('role') as 'ADMIN' | 'COACH';
    const items = STAFF[role];
    req.flush({
      items,
      total: items.length,
      page: 1,
      limit: 100,
      totalPages: 1,
      affiliazioniPerUtente: {},
    });
  }
}

/** Monta il componente e risolve la prima lettura dell'elenco. */
async function bootstrap(sessions: LiveSession[]): Promise<{
  fixture: ComponentFixture<AdminLiveComponent>;
  http: HttpTestingController;
  el: HTMLElement;
}> {
  await TestBed.configureTestingModule({
    imports: [AdminLiveComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AdminLiveComponent);
  const http = TestBed.inject(HttpTestingController);
  const el = fixture.nativeElement as HTMLElement;

  http.expectOne(isList).flush(sessions);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, http, el };
}

/**
 * I membri del componente sono `protected`: il form si legge attraverso un
 * cast a questa forma minima (idioma delle altre spec del pannello).
 */
interface FormTestabile {
  form: {
    valid: boolean;
    controls: {
      title: FormControl<string>;
      startsAt: FormControl<string>;
      mode: FormControl<LiveMode>;
      joinUrl: FormControl<string>;
    };
  };
}

describe('AdminLiveComponent — pubblicazione della registrazione', () => {
  let fixture: ComponentFixture<AdminLiveComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    ({ fixture, http, el } = await bootstrap([readySession()]));
  });

  afterEach(() => http.verify());

  /**
   * Apre la scheda di pubblicazione e risolve la richiesta dei tag esistenti.
   *
   * ⚠️ Dall'08/09/2026 il comando di riga è solo-icona e si cerca per NOME
   * ACCESSIBILE, mai per classe: se l'etichetta sparisce il test torna rosso,
   * mentre un selettore di classe resterebbe verde su un bottone anonimo.
   */
  async function openPanel(tags: string[] = ['icm', 'push fold']) {
    el.querySelector<HTMLButtonElement>(
      '[aria-label^="Pubblica la registrazione di"]',
    )!.click();
    http.expectOne(`${API}/lessons/tags`).flush(tags);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Invia il form del pannello. Serve un selettore preciso: cercare il testo
   * "Pubblica" trova PRIMA il bottone "Pubblica come lezione" della card, che
   * riaprirebbe il pannello invece di inviarlo.
   */
  function submitPublish(): void {
    // Il submit vive nel PIEDE della modale, fuori dal <form>, e ci arriva con
    // `form="pub-form"`.
    el.querySelector<HTMLButtonElement>(
      '.mo__piede button[type="submit"]',
    )!.click();
  }

  it('⚠️ il comando di pubblicazione ha un NOME ACCESSIBILE che nomina la sessione', () => {
    // Il bottone è solo-icona e `app-icon` porta `aria-hidden` sull'host:
    // senza etichetta uno screen reader annuncia «pulsante» e basta. E con
    // un'etichetta fissa sarebbero N bottoni indistinguibili.
    const publish = el.querySelector<HTMLButtonElement>(
      '[aria-label^="Pubblica la registrazione di"]',
    );
    expect(publish).not.toBeNull();
    expect(publish!.getAttribute('aria-label')).toContain('Bastogne87');
    expect(publish!.textContent?.trim()).toBe('');
    // Sta nell'ultima colonna della tabella, non dentro uno <span> di meta.
    expect(publish!.closest('.admin-item__meta')).toBeNull();
    expect(publish!.closest('.admin-table__c-ultimo')).not.toBeNull();
  });

  it('il pannello nasce precompilato con i dati della live e NESSUN tag preselezionato', async () => {
    // 'live' fra i tag noti: esiste in archivio (le VOD storiche lo portano),
    // e deve comparire come chip qualunque, spenta.
    await openPanel(['icm', 'live', 'push fold']);

    const title = el.querySelector<HTMLInputElement>('#pt-s1');
    const description = el.querySelector<HTMLTextAreaElement>('#pd-s1');
    const stakes = el.querySelector<HTMLSelectElement>('#ps-s1');
    const videoDate = el.querySelector<HTMLInputElement>('#pv-s1');

    expect(title?.value).toBe('Bastogne87 — Lezione Low Stakes');
    expect(description?.value).toBe('Sessione live del martedì');
    expect(stakes?.value).toBe('LOW');
    // la data del video è quella della live, non quella di oggi
    expect(videoDate?.value).toBe('2026-07-28');
    // i tag esistenti sono proposti…
    expect(el.textContent).toContain('icm');
    // …ma nessuno è attivo all'apertura. ⚠️ Fino al 16/09/2026 questo test
    // asseriva il CONTRARIO su 'live' (preselezionato «perché si veda che ci
    // sarà»): l'owner ha tolto il marcatore — la VOD la classifica la
    // categoria «Sessioni dal vivo» — e 'live' è tornato un tag come gli altri.
    const chips = Array.from(
      el.querySelectorAll<HTMLButtonElement>('button.badge--tag'),
    );
    expect(chips.length).toBe(3);
    expect(chips.filter((b) => b.classList.contains('is-active'))).toEqual([]);
    const liveChip = chips.find((b) => b.textContent?.trim() === 'live')!;
    expect(liveChip).toBeDefined();
    expect(liveChip.classList.contains('is-active')).toBe(false);
    expect(liveChip.getAttribute('aria-pressed')).toBe('false');
  });

  it('pubblica con le correzioni: un solo invio, avvisi attivi, i tag sono esattamente quelli scelti', async () => {
    await openPanel();

    el.querySelector<HTMLInputElement>('#pt-s1')!.value = 'Review del martedì';
    el.querySelector<HTMLInputElement>('#pt-s1')!.dispatchEvent(
      new Event('input'),
    );
    // aggiunge un tag esistente dalla lista
    Array.from(el.querySelectorAll<HTMLButtonElement>('.badge--tag'))
      .find((b) => b.textContent?.trim() === 'icm')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();

    submitPublish();

    const req = http.expectOne(`${API}/live/s1/recording/publish`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as {
      title: string;
      tags: string[];
      stakes: string;
      videoDate: string;
      notify: boolean;
    };
    expect(body.title).toBe('Review del martedì');
    // Solo 'icm', perché l'utente ha scelto solo 'icm': dal 16/09/2026 il
    // client non filtra più niente e il backend non aggiunge più 'live' (prima
    // il commento qui diceva «rimandarlo rischierebbe un doppione»).
    expect(body.tags).toEqual(['icm']);
    expect(body.stakes).toBe('LOW');
    expect(body.videoDate).toBe('2026-07-28');
    expect(body.notify).toBe(true);

    req.flush({ ok: true, lessonId: 'lez1' });
    // dopo la pubblicazione la lista si ricarica
    http.expectOne(isList).flush([readySession({ recordingState: 'DONE' })]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Pubblicata come lezione');
  });

  it("⚠️ se l'admin sceglie LUI il tag 'live', il client lo manda come ogni altro", async () => {
    // Specchio della spec backend «se sceglie lui il tag 'live', resta un tag
    // qualunque»: fino al 16/09/2026 `confirmPublish` faceva
    // `.filter((t) => t !== 'live')`, e se qualcuno lo rimettesse «per
    // sicurezza» un tag scelto a mano sparirebbe dal payload in silenzio — il
    // test con la sola 'icm' era verde anche col filtro.
    await openPanel(['icm', 'live']);
    Array.from(el.querySelectorAll<HTMLButtonElement>('.badge--tag'))
      .find((b) => b.textContent?.trim() === 'live')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();

    submitPublish();
    const req = http.expectOne(`${API}/live/s1/recording/publish`);
    expect((req.request.body as { tags: string[] }).tags).toEqual(['live']);

    req.flush({ ok: true, lessonId: 'lez1' });
    http.expectOne(isList).flush([readySession({ recordingState: 'DONE' })]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('togliendo la spunta "Avvisa" la pubblicazione parte silenziosa', async () => {
    await openPanel([]);

    const notify = Array.from(
      el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).at(-1)!;
    expect(notify.checked).toBe(true);
    notify.click();
    await fixture.whenStable();
    fixture.detectChanges();

    submitPublish();
    const req = http.expectOne(`${API}/live/s1/recording/publish`);
    expect((req.request.body as { notify: boolean }).notify).toBe(false);

    req.flush({ ok: true, lessonId: 'lez1' });
    http.expectOne(isList).flush([readySession({ recordingState: 'DONE' })]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('senza avvisi');
  });

  it('un errore di pubblicazione è mostrato e il pannello resta aperto', async () => {
    await openPanel([]);
    submitPublish();
    http
      .expectOne(`${API}/live/s1/recording/publish`)
      .flush('boom', { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('Pubblicazione non riuscita');
    // il pannello non si chiude: i dati inseriti non vanno persi
    expect(el.querySelector('#pt-s1')).not.toBeNull();
  });
});

describe('AdminLiveComponent — programmazione di una sessione', () => {
  let fixture: ComponentFixture<AdminLiveComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let comp: FormTestabile;

  beforeEach(async () => {
    ({ fixture, http, el } = await bootstrap([
      readySession(),
      externalSession(),
    ]));
    comp = fixture.componentInstance as unknown as FormTestabile;
  });

  afterEach(() => http.verify());

  /** Il `+` della barra: si cerca per nome accessibile, mai per classe. */
  async function apriNuova(): Promise<void> {
    el.querySelector<HTMLButtonElement>(
      '[aria-label="Crea una nuova sessione live"]',
    )!.click();
    serviConduttori(http);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** La matita di una riga, per nome accessibile. */
  async function apriModifica(titolo: string): Promise<void> {
    el.querySelector<HTMLButtonElement>(
      `[aria-label="Modifica ${titolo}"]`,
    )!.click();
    serviConduttori(http);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('una sessione nuova nasce On-site: niente link da incollare, form valido senza joinUrl', async () => {
    await apriNuova();

    // ⚠️ Decisione owner del 16/09/2026: le live si fanno tutte nella sala
    // del sito, quindi il default del form è LIVEKIT (fino ad allora nasceva
    // EXTERNAL, con il link Zoom/Discord obbligatorio).
    expect(comp.form.controls.mode.value).toBe('LIVEKIT');
    const select = el.querySelector<HTMLSelectElement>('#mode')!;
    expect(select.value).toBe('LIVEKIT');
    // la prima voce della tendina È il default: è quella che si legge come tale
    expect(select.options[0].value).toBe('LIVEKIT');

    // il campo del link non è nel DOM: non «disabilitato», proprio assente
    expect(el.querySelector('#joinUrl')).toBeNull();

    // compilati titolo e data, il form è valido senza alcun link. ⚠️ È la
    // ragione per cui `joinUrl` nasce con validatori vuoti nel FormGroup: con
    // `Validators.required` scritto nell'inizializzatore il form nuovo sarebbe
    // invalido su un campo che il template nemmeno mostra.
    comp.form.controls.title.setValue('Review mani 50bb');
    comp.form.controls.startsAt.setValue('2026-09-24T20:00');
    expect(comp.form.controls.joinUrl.invalid).toBe(false);
    expect(comp.form.valid).toBe(true);
  });

  it('scegliendo Esterna il link ricompare ed è obbligatorio', async () => {
    await apriNuova();

    const select = el.querySelector<HTMLSelectElement>('#mode')!;
    select.value = 'EXTERNAL';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(comp.form.controls.mode.value).toBe('EXTERNAL');
    expect(el.querySelector('#joinUrl')).not.toBeNull();
    // i validatori required + pattern arrivano da `setJoinUrlValidators`, non
    // dall'inizializzatore: senza link il form non si invia
    comp.form.controls.title.setValue('Q&A');
    comp.form.controls.startsAt.setValue('2026-09-24T20:00');
    expect(comp.form.controls.joinUrl.invalid).toBe(true);
    expect(comp.form.valid).toBe(false);
    comp.form.controls.joinUrl.setValue('https://discord.gg/bff');
    expect(comp.form.valid).toBe(true);
  });

  it('la modifica di una sessione Esterna carica il suo mode e il suo link (il default non la tocca)', async () => {
    await apriModifica('Q&A su Discord');

    expect(comp.form.controls.mode.value).toBe('EXTERNAL');
    const joinUrl = el.querySelector<HTMLInputElement>('#joinUrl');
    expect(joinUrl).not.toBeNull();
    expect(joinUrl!.value).toBe('https://discord.gg/bff');
    // e resta obbligatorio: svuotandolo la sessione non si salva
    comp.form.controls.joinUrl.setValue('');
    expect(comp.form.controls.joinUrl.invalid).toBe(true);
  });

  it('chiudendo la modifica di una Esterna, la sessione nuova successiva nasce di nuovo On-site', async () => {
    // I due ripristini del form (`cancelEdit` e `creaNuova`) devono concordare
    // sul default e sui validatori del link: se uno dei due dimenticasse di
    // togliere `required` dopo una modifica a una EXTERNAL, il form nuovo
    // sarebbe invalido su un campo invisibile.
    await apriModifica('Q&A su Discord');
    expect(comp.form.controls.mode.value).toBe('EXTERNAL');

    // l'«Annulla» del PIEDE della modale (quello della sezione «Elimina» è
    // un altro bottone con lo stesso testo, ma compare solo dopo «Elimina»)
    Array.from(el.querySelectorAll<HTMLButtonElement>('.mo__piede button'))
      .find((b) => b.textContent?.trim() === 'Annulla')!
      .click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('#mode')).toBeNull();

    await apriNuova();
    expect(comp.form.controls.mode.value).toBe('LIVEKIT');
    expect(el.querySelector('#joinUrl')).toBeNull();
    comp.form.controls.title.setValue('Review mani 50bb');
    comp.form.controls.startsAt.setValue('2026-09-24T20:00');
    expect(comp.form.valid).toBe(true);
  });
});

describe('AdminLiveComponent — chi conduce e riapertura (12/10/2026)', () => {
  let fixture: ComponentFixture<AdminLiveComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;
  let comp: FormTestabile;

  /** Live chiusa (registrata) e live in programma condotta da un coach. */
  const chiusa = readySession({
    id: 's3',
    title: 'Exivezzz • Scelte al river',
    ended: true,
  });
  const condotta = readySession({
    id: 's4',
    title: 'Velenoso1983 • Mental game',
    startsAt: '2099-10-14T20:00:00.000Z',
    recordingEnabled: false,
    recordingState: 'NONE',
    hostUserId: 'u-velo',
  });

  beforeEach(async () => {
    ({ fixture, http, el } = await bootstrap([chiusa, condotta]));
    comp = fixture.componentInstance as unknown as FormTestabile;
  });

  afterEach(() => http.verify());

  async function apri(selettore: string): Promise<void> {
    el.querySelector<HTMLButtonElement>(selettore)!.click();
    serviConduttori(http);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const opzioni = () =>
    Array.from(
      el.querySelectorAll<HTMLOptionElement>('#hostUserId option'),
    ).map((o) => o.textContent?.trim());

  /** Invia il form col pulsante del piede (che sta FUORI dal <form>). */
  async function salva(): Promise<void> {
    el.querySelector<HTMLButtonElement>('button[form="live-form"]')!.click();
    await fixture.whenStable();
  }

  it('«Conduce» elenca admin e coach in ordine, con «Nessuno» per primo', async () => {
    await apri('[aria-label="Crea una nuova sessione live"]');
    expect(opzioni()).toEqual([
      'Nessuno — la chiudono solo gli admin',
      'Exivezzz2323 · admin',
      'Jinwoosung · coach',
      'Velenoso1983 · coach',
    ]);
  });

  it('creando con un coach scelto, il payload porta il suo id', async () => {
    await apri('[aria-label="Crea una nuova sessione live"]');
    comp.form.controls.title.setValue('Mental game');
    comp.form.controls.startsAt.setValue('2099-10-21T22:00');
    const select = el.querySelector<HTMLSelectElement>('#hostUserId')!;
    select.value = 'u-velo';
    select.dispatchEvent(new Event('change'));
    await salva();
    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url === `${API}/live`,
    );
    expect((req.request.body as { hostUserId?: string }).hostUserId).toBe(
      'u-velo',
    );
    req.flush({ id: 'nuova' });
    http.expectOne(isList).flush([chiusa, condotta]);
  });

  it('creando con «Nessuno» il campo non si manda affatto', async () => {
    await apri('[aria-label="Crea una nuova sessione live"]');
    comp.form.controls.title.setValue('Live senza conduttore');
    comp.form.controls.startsAt.setValue('2099-10-21T22:00');
    await salva();
    const req = http.expectOne(
      (r) => r.method === 'POST' && r.url === `${API}/live`,
    );
    expect(
      (req.request.body as { hostUserId?: string }).hostUserId,
    ).toBeUndefined();
    req.flush({ id: 'nuova' });
    http.expectOne(isList).flush([chiusa, condotta]);
  });

  it('in modifica la tendina mostra chi conduce, e «Nessuno» manda null (che lo TOGLIE)', async () => {
    await apri(`[aria-label="Modifica ${condotta.title}"]`);
    const select = el.querySelector<HTMLSelectElement>('#hostUserId')!;
    expect(select.value).toBe('u-velo');

    select.value = '';
    select.dispatchEvent(new Event('change'));
    await salva();
    const req = http.expectOne(
      (r) => r.method === 'PATCH' && r.url === `${API}/live/s4`,
    );
    // ⚠️ null e non '': `@IsMongoId` rifiuterebbe la stringa vuota con un 400
    expect((req.request.body as { hostUserId?: unknown }).hostUserId).toBeNull();
    req.flush({ id: 's4' });
    http.expectOne(isList).flush([chiusa, condotta]);
  });

  it('un conduttore fuori dall’elenco di admin e coach non si legge come «nessuno»', async () => {
    fixture.destroy();
    TestBed.resetTestingModule();
    const promosso = readySession({
      id: 's5',
      title: 'Live con ospite',
      startsAt: '2099-10-14T20:00:00.000Z',
      hostUserId: 'u-ex-coach',
    });
    ({ fixture, http, el } = await bootstrap([promosso]));
    await apri(`[aria-label="Modifica ${promosso.title}"]`);
    expect(opzioni()).toContain('Utente non più fra admin e coach');
    expect(el.querySelector<HTMLSelectElement>('#hostUserId')!.value).toBe(
      'u-ex-coach',
    );
  });

  it('una live CHIUSA offre «Riapri la sala»: conferma, POST, la modale si chiude', async () => {
    await apri(`[aria-label="Modifica ${chiusa.title}"]`);
    buttonWith(el, 'Riapri la sala').click();
    fixture.detectChanges();
    buttonWith(el, 'Confermo, riapri').click();
    http
      .expectOne((r) => r.method === 'POST' && r.url === `${API}/live/s3/reopen`)
      .flush({ ok: true });
    http.expectOne(isList).flush([{ ...chiusa, ended: false }, condotta]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('#hostUserId')).toBeNull();
    expect(el.textContent).toContain('Sala riaperta');
  });

  it('una live NON chiusa non mostra «Riapri la sala»', async () => {
    await apri(`[aria-label="Modifica ${condotta.title}"]`);
    expect(buttonWith(el, 'Riapri la sala')).toBeUndefined();
  });
});
