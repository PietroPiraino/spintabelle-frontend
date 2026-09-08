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

/**
 * ⚠️ Le date sono RELATIVE a `Date.now()` e mai letterali: «avvenuta» e «non
 * ancora cominciata» dipendono dall'orologio, e una data fissa nel sorgente
 * cambia significato da sola col passare del calendario — il test passerebbe
 * oggi e direbbe il contrario fra un anno, senza che nessuno abbia toccato
 * niente.
 */
const fra = (ms: number) => new Date(Date.now() + ms).toISOString();
const ORA = 60 * 60 * 1000;

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

  // ⚠️ Gli spazi si NORMALIZZANO, come in ogni altra spec del progetto: il
  // template va a capo fra un `@if` e il testo che segue, e `textContent`
  // conserva quei ritorni a capo mentre l'HTML li collassa — cioè
  // l'asserzione fallirebbe su una stringa che a schermo è giusta.
  const testo = () =>
    ((fixture.nativeElement.textContent as string) ?? '')
      .replace(/\s+/g, ' ')
      .trim();

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

    it('⚠️ NON elenca le sessioni che devono ancora COMINCIARE', async () => {
      // Una live futura ha zero presenze **per definizione**, non perché non è
      // venuto nessuno: elencarla mostra uno zero che non è una misura.
      await rispondiPresenze([
        sessione({ startsAt: fra(-48 * ORA) }),
        sessione({ id: 's2', title: 'Live di domani', startsAt: fra(24 * ORA) }),
        sessione({ id: 's3', title: 'Live fra poco', startsAt: fra(0.5 * ORA) }),
      ]);
      expect(testo()).toContain('Live di prova');
      expect(testo()).not.toContain('Live di domani');
      // ⚠️ Anche l'IMMINENTE è fuori: mancano trenta minuti, quindi non è
      // ancora entrato nessuno.
      expect(testo()).not.toContain('Live fra poco');
    });

    it('⚠️ e lo DICE quante ne ha nascoste, invece di tacerlo', async () => {
      // Un elenco con meno righe di quante ne esistono, e senza spiegazione, fa
      // cercare un guasto.
      await rispondiPresenze([
        sessione({ startsAt: fra(-48 * ORA) }),
        sessione({ id: 's2', title: 'Domani', startsAt: fra(24 * ORA) }),
        sessione({ id: 's3', title: 'Dopodomani', startsAt: fra(48 * ORA) }),
      ]);
      expect(testo()).toContain('2 sessioni non sono ancora cominciate');
    });

    it('una live IN CORSO resta: si sta riempiendo proprio adesso', async () => {
      // ⚠️ Il taglio è «già cominciata», non «terminata»: la sessione in corso
      // è quella che si guarda più volentieri.
      await rispondiPresenze([
        sessione({ title: 'In corso ora', startsAt: fra(-20 * 60 * 1000), durationMin: 90 }),
      ]);
      expect(testo()).toContain('In corso ora');
      expect(testo()).not.toContain('non sono ancora cominciate');
    });

    it('la ricerca filtra per titolo, e il conteggio dice «N su M»', async () => {
      await rispondiPresenze([
        sessione({ title: 'Review di sessione', startsAt: fra(-48 * ORA) }),
        sessione({ id: 's2', title: 'Push-fold da 10bb', startsAt: fra(-24 * ORA) }),
      ]);
      const campo = fixture.nativeElement.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      campo.value = 'push';
      campo.dispatchEvent(new Event('input'));
      await stabilizza();

      expect(testo()).toContain('Push-fold da 10bb');
      expect(testo()).not.toContain('Review di sessione');
      // Il conteggio è delle righe VISIBILI, non dell'archivio.
      expect(testo()).toContain('1 sessione su 2');
    });

    it('⚠️ il segnaposto della ricerca NON promette i tag', async () => {
      // Una sessione live non ha tag, né nel modello né nello schema Mongo:
      // prometterli manda a cercare un campo che non esiste.
      await rispondiPresenze([sessione({ startsAt: fra(-48 * ORA) })]);
      const campo = fixture.nativeElement.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      expect(campo.getAttribute('placeholder')).not.toContain('tag');
      expect(campo.getAttribute('aria-label')).not.toContain('tag');
    });

    it('il filtro per tier restringe l’elenco', async () => {
      await rispondiPresenze([
        sessione({ title: 'Alta posta', stakes: 'HIGH', startsAt: fra(-48 * ORA) }),
        sessione({ id: 's2', title: 'Bassa posta', stakes: 'LOW', startsAt: fra(-24 * ORA) }),
      ]);
      const low = [
        ...fixture.nativeElement.querySelectorAll('[role="radio"]'),
      ].find((b: HTMLElement) => b.textContent?.trim() === 'Low stakes') as HTMLElement;
      low.click();
      await stabilizza();

      expect(testo()).toContain('Bassa posta');
      expect(testo()).not.toContain('Alta posta');
    });

    it('⚠️ se i filtri nascondono tutto, il vuoto è DIVERSO e offre la via d’uscita', async () => {
      await rispondiPresenze([sessione({ startsAt: fra(-48 * ORA) })]);
      const campo = fixture.nativeElement.querySelector(
        'input[type="search"]',
      ) as HTMLInputElement;
      campo.value = 'niente-che-esista';
      campo.dispatchEvent(new Event('input'));
      await stabilizza();

      // «non c'è niente» e «i filtri nascondono tutto» sono due situazioni
      // opposte, e la seconda ha una via d'uscita che va offerta.
      expect(testo()).toContain('Nessuna sessione con questi filtri');
      const azzera = [
        ...fixture.nativeElement.querySelectorAll('button'),
      ].find((b: HTMLButtonElement) => b.textContent?.trim() === 'Azzera i filtri') as HTMLButtonElement;
      expect(azzera).toBeTruthy();

      azzera.click();
      await stabilizza();
      expect(testo()).toContain('Live di prova');
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
