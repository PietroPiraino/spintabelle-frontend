import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { LiveSession } from '../../../core/models/api.models';
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

/** Trova un bottone dal testo (il markup usa classi condivise, non id). */
const buttonWith = (el: HTMLElement, text: string): HTMLButtonElement =>
  Array.from(el.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  )!;

describe('AdminLiveComponent — pubblicazione della registrazione', () => {
  let fixture: ComponentFixture<AdminLiveComponent>;
  let http: HttpTestingController;
  let el: HTMLElement;

  const isList = (r: { url: string }) => r.url === `${API}/live`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLiveComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLiveComponent);
    http = TestBed.inject(HttpTestingController);
    el = fixture.nativeElement as HTMLElement;

    http.expectOne(isList).flush([readySession()]);
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  /** Apre il pannello e risolve la richiesta dei tag esistenti. */
  async function openPanel(tags: string[] = ['icm', 'push fold']) {
    buttonWith(el, 'Pubblica come lezione').click();
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
    el.querySelector<HTMLButtonElement>(
      '.admin-panel__actions .btn--primary',
    )!.click();
  }

  it('i pulsanti della registrazione stanno FUORI dallo span meta', () => {
    // .admin-item__meta è un inline mono senza gap e Angular scarta i nodi di
    // solo whitespace: un bottone lì dentro nasce incollato al testo (bug
    // visto in prod). Il fix li ha spostati in un div.row col suo gap.
    const publish = buttonWith(el, 'Pubblica come lezione');
    expect(publish.closest('.admin-item__meta')).toBeNull();
    expect(publish.closest('.row')).not.toBeNull();
  });

  it('il pannello nasce precompilato con i dati della live e il tag "live"', async () => {
    await openPanel();

    const title = el.querySelector<HTMLInputElement>('#pt-s1');
    const description = el.querySelector<HTMLTextAreaElement>('#pd-s1');
    const stakes = el.querySelector<HTMLSelectElement>('#ps-s1');
    const videoDate = el.querySelector<HTMLInputElement>('#pv-s1');

    expect(title?.value).toBe('Bastogne87 — Lezione Low Stakes');
    expect(description?.value).toBe('Sessione live del martedì');
    expect(stakes?.value).toBe('LOW');
    // la data del video è quella della live, non quella di oggi
    expect(videoDate?.value).toBe('2026-07-28');
    // i tag esistenti sono proposti, 'live' è già selezionato
    expect(el.textContent).toContain('icm');
    const liveChip = Array.from(el.querySelectorAll('.badge--tag')).find(
      (b) => b.textContent?.trim() === 'live',
    );
    expect(liveChip?.classList.contains('is-active')).toBe(true);
  });

  it('pubblica con le correzioni: un solo invio, avvisi attivi, senza rimandare "live"', async () => {
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
    // 'live' lo aggiunge il backend: rimandarlo qui rischierebbe un doppione
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
