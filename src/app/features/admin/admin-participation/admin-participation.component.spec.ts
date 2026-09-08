import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  LessonViewsRow,
  LiveSession,
} from '../../../core/models/api.models';
import { AdminParticipationComponent } from './admin-participation.component';

const API = environment.API_URL;

const sessione = (over: Partial<LiveSession> = {}): LiveSession =>
  ({
    id: 's1',
    title: 'Live di prova',
    startsAt: '2026-08-01T18:00:00.000Z',
    mode: 'LIVEKIT',
    stakes: 'HIGH',
    ...over,
  }) as LiveSession;

const riga = (over: Partial<LessonViewsRow> = {}): LessonViewsRow =>
  ({
    lessonId: 'l1',
    titolo: 'Push-fold da 10bb',
    spettatori: 4,
    aperture: 9,
    ...over,
  }) as LessonViewsRow;

describe('AdminParticipationComponent', () => {
  let fixture: ComponentFixture<AdminParticipationComponent>;
  let http: HttpTestingController;

  const testo = () => fixture.nativeElement.textContent as string;

  const stabilizza = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const schede = (): HTMLButtonElement[] =>
    [...fixture.nativeElement.querySelectorAll('[role="tab"]')];

  /** Risponde all'elenco delle presenze (la scheda che si apre per prima). */
  const rispondiPresenze = async (items: LiveSession[]) => {
    http.expectOne((r) => r.url === `${API}/live`).flush(items);
    await stabilizza();
  };

  const apriViste = async (items: LessonViewsRow[]) => {
    schede()[1].click();
    await stabilizza();
    http.expectOne((r) => r.url === `${API}/lessons/views-summary`).flush(items);
    await stabilizza();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminParticipationComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminParticipationComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  describe('le due schede', () => {
    it('⚠️ la seconda NON carica finché non la si apre', async () => {
      // È la ragione per cui le schede sono pigre e non due sezioni impilate:
      // aprendo la pagina si pagava anche la chiamata dell'altra metà, che nel
      // caso normale non si guarda. Le due sezioni non condividono nulla —
      // né stato, né filtri — quindi non c'è niente da sciogliere.
      await rispondiPresenze([sessione()]);
      http.expectNone((r) => r.url === `${API}/lessons/views-summary`);

      await apriViste([riga()]);
      expect(testo()).toContain('Push-fold da 10bb');
    });

    it('⚠️ tornando indietro NON ricarica quello che era già lì', async () => {
      // Un elenco che si ricostruisce a ogni andata e ritorno fa lampeggiare
      // lo spinner su dati che c'erano già.
      await rispondiPresenze([sessione()]);
      await apriViste([riga()]);
      schede()[0].click();
      await stabilizza();
      http.expectNone((r) => r.url === `${API}/live`);
      schede()[1].click();
      await stabilizza();
      http.expectNone((r) => r.url === `${API}/lessons/views-summary`);
    });

    it('il pannello esiste, porta role=tabpanel ed è collegato alla scheda accesa', async () => {
      await rispondiPresenze([sessione()]);
      const attiva = schede().find(
        (b) => b.getAttribute('aria-selected') === 'true',
      )!;
      const id = attiva.getAttribute('aria-controls')!;
      const pannello = fixture.nativeElement.querySelector(`#${id}`);
      expect(pannello).toBeTruthy();
      expect(pannello.getAttribute('role')).toBe('tabpanel');
      expect(pannello.getAttribute('aria-labelledby')).toBe(attiva.id);
      // Raggiungibile da tastiera anche quando dentro non c'è nulla di
      // focalizzabile.
      expect(pannello.getAttribute('tabindex')).toBe('0');
    });

    it('mostra una scheda per volta', async () => {
      await rispondiPresenze([sessione()]);
      expect(testo()).toContain('Presenze alle lezioni live');
      expect(testo()).not.toContain('Chi ha visto le lezioni');
      await apriViste([riga()]);
      expect(testo()).toContain('Chi ha visto le lezioni');
      expect(testo()).not.toContain('Presenze alle lezioni live');
    });
  });

  describe('le presenze', () => {
    it('⚠️ NON elenca le sessioni EXTERNAL con «0 presenti»', async () => {
      // Zoom e Discord non lasciano alcuna traccia lato sito: mostrarle a zero
      // sarebbe una bugia, e la pagina lo dice a parole invece di far dedurre
      // un'assenza.
      await rispondiPresenze([
        sessione(),
        sessione({ id: 's2', title: 'Su Zoom', mode: 'EXTERNAL' }),
      ]);
      expect(testo()).toContain('Live di prova');
      expect(testo()).not.toContain('Su Zoom');
    });

    it('il registro si carica SOLO all’apertura di una sessione', async () => {
      await rispondiPresenze([sessione()]);
      http.expectNone((r) => r.url === `${API}/live/s1/attendance`);
      const apri = [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim() === 'Presenze',
      ) as HTMLButtonElement;
      apri.click();
      await stabilizza();
      http
        .expectOne((r) => r.url === `${API}/live/s1/attendance`)
        .flush({ partecipanti: [], ingressi: 0, unici: 0 });
      await stabilizza();
    });
  });
});
