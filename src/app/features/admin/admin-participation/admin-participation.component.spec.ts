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
  LiveAttendanceEntry,
  LiveAttendanceReport,
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

/**
 * ⚠️ Un registro COMPLETO, con `sessione` e `totali`.
 *
 * Il template legge `r.totali.*` dentro il ramo «ci sono partecipanti», quindi
 * un payload dimezzato regge finché l'elenco è vuoto — e si rompe il giorno in
 * cui una riga di riepilogo esce da quel ramo. Un dato di prova che è valido
 * solo per caso non è un dato di prova.
 */
const report = (
  partecipanti: Partial<LiveAttendanceEntry>[] = [],
): LiveAttendanceReport => ({
  sessione: { id: 's1', titolo: 'Live di prova', inizio: fra(-2 * ORA), fine: null },
  partecipanti: partecipanti.map((p, i) => ({
    userId: `u${i + 1}`,
    nickname: 'anonimo',
    ruolo: 'audience',
    primoIngresso: fra(-2 * ORA),
    ultimaUscita: null,
    minuti: 30,
    ingressi: 1,
    ancoraInSala: false,
    durataStimata: false,
    ...p,
  })),
  totali: {
    partecipanti: partecipanti.length,
    mediaMinuti: partecipanti.length ? 30 : null,
    troncato: false,
  },
});

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

  /**
   * ⚠️ I comandi di riga si cercano per NOME ACCESSIBILE, mai per classe.
   *
   * È contro la corrente: da quando sono solo-icona il loro `textContent` è
   * vuoto, quindi la ricerca per testo schianta con un TypeError, e la
   * riparazione naturale — `querySelector('.admin-ico')` — rimetterebbe il
   * verde lasciando ZERO righe nel repo che nominano l'etichetta del comando.
   * Cercandolo per `aria-label` il test resta una rete su ciò che rende quel
   * bottone non anonimo.
   */
  const comandi = (): HTMLButtonElement[] => [
    ...fixture.nativeElement.querySelectorAll('.admin-table__c-ultimo button'),
  ];

  const comando = (etichetta: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(
      `button[aria-label="${etichetta}"]`,
    ) as HTMLButtonElement;

  const campoRicerca = (): HTMLInputElement =>
    fixture.nativeElement.querySelector(
      'input[type="search"]',
    ) as HTMLInputElement;

  const dialog = (): HTMLDialogElement | null =>
    fixture.nativeElement.querySelector('dialog');

  const chiudiModale = () =>
    (fixture.nativeElement.querySelector('.mo__chiudi') as HTMLButtonElement)
      .click();

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
      comando('Presenze di Live di prova').click();
      await stabilizza();
      http
        .expectOne((r) => r.url === `${API}/live/s1/attendance`)
        .flush(report());
      await stabilizza();
      expect(testo()).toContain('Nessun ingresso registrato');
    });

    it('⚠️ il comando di riga NOMINA la riga, così due righe non si confondono', async () => {
      // `app-icon` porta `aria-hidden` sull'host: un bottone solo-icona senza
      // etichetta è ANONIMO, e con un'etichetta fissa sarebbero N pulsanti che
      // annunciano tutti la stessa parola. L'asserzione che conta è che le due
      // etichette siano DIVERSE.
      await rispondiPresenze([
        sessione({ title: 'Prima live', startsAt: fra(-48 * ORA) }),
        sessione({ id: 's2', title: 'Seconda live', startsAt: fra(-24 * ORA) }),
      ]);
      const etichette = comandi().map((b) => b.getAttribute('aria-label'));
      expect(etichette).toEqual([
        'Presenze di Prima live',
        'Presenze di Seconda live',
      ]);
      expect(new Set(etichette).size).toBe(2);
    });

    it('il comando apre una MODALE, e chiuderla la smonta', async () => {
      await rispondiPresenze([sessione({ durationMin: 90 })]);
      expect(dialog()).toBeNull();

      const bottone = comando('Presenze di Live di prova');
      // Non sono i tre puntini: qui si apre una scheda modale, e dirlo è
      // l'unica cosa che colma quella distanza.
      expect(bottone.getAttribute('aria-haspopup')).toBe('dialog');
      bottone.click();
      await stabilizza();
      http
        .expectOne((r) => r.url === `${API}/live/s1/attendance`)
        .flush(report([{ nickname: 'mario', minuti: 42 }]));
      await stabilizza();

      expect(dialog()).toBeTruthy();
      expect(testo()).toContain('Presenze — Live di prova');
      expect(testo()).toContain('mario');
      // ⚠️ La durata prevista è la colonna che sparisce sotto i 720px, e la
      // nota mobile promette che sia «nella scheda di ogni sessione»: se non
      // la stampa, quella frase è falsa.
      expect(testo()).toContain('durata prevista 90 min');

      chiudiModale();
      await stabilizza();
      expect(dialog()).toBeNull();
    });

    it('⚠️ la risposta FUORI ORDINE non finisce sotto il titolo sbagliato', async () => {
      // Aprire una riga, chiudere e aprirne un'altra: la risposta lenta della
      // PRIMA arriva dopo quella della seconda. Senza guardia riempirebbe la
      // modale con le presenze di una sessione sotto il nome di un'altra —
      // cioè dati personali attribuiti alla persona sbagliata.
      await rispondiPresenze([
        sessione({ title: 'Prima live', startsAt: fra(-48 * ORA) }),
        sessione({ id: 's2', title: 'Seconda live', startsAt: fra(-24 * ORA) }),
      ]);

      comando('Presenze di Prima live').click();
      await stabilizza();
      const lenta = http.expectOne((r) => r.url === `${API}/live/s1/attendance`);

      chiudiModale();
      await stabilizza();
      comando('Presenze di Seconda live').click();
      await stabilizza();
      http
        .expectOne((r) => r.url === `${API}/live/s2/attendance`)
        .flush(report([{ nickname: 'della-seconda', minuti: 10 }]));
      await stabilizza();

      // Ora atterra la risposta della PRIMA, in ritardo.
      lenta.flush(report([{ nickname: 'della-prima', minuti: 99 }]));
      await stabilizza();

      expect(testo()).toContain('Presenze — Seconda live');
      expect(testo()).toContain('della-seconda');
      expect(testo()).not.toContain('della-prima');
    });
  });

  describe('le viste delle lezioni', () => {
    it('la ricerca filtra per titolo, e il conteggio dice «N su M»', async () => {
      await rispondiPresenze([sessione()]);
      await apriViste([
        riga(),
        riga({ lessonId: 'l2', titolo: 'Difesa dal big blind' }),
      ]);

      const campo = campoRicerca();
      campo.value = 'push';
      campo.dispatchEvent(new Event('input'));
      await stabilizza();

      expect(testo()).toContain('Push-fold da 10bb');
      expect(testo()).not.toContain('Difesa dal big blind');
      expect(testo()).toContain('1 lezione aperta su 2');
    });

    it('⚠️ il segnaposto della ricerca promette SOLO il titolo', async () => {
      // `LessonViewsRow` porta solo `{lessonId, titolo, spettatori, aperture,
      // ultimaApertura}`: promettere tag o descrizione manda a cercare un campo
      // che non esiste. Stessa regola dell'altra scheda.
      await rispondiPresenze([sessione()]);
      await apriViste([riga()]);
      const campo = campoRicerca();
      expect(campo.getAttribute('placeholder')).not.toContain('tag');
      expect(campo.getAttribute('aria-label')).not.toContain('tag');
    });

    it('⚠️ il vuoto da ricerca è DIVERSO dal vuoto vero e offre la via d’uscita', async () => {
      await rispondiPresenze([sessione()]);
      await apriViste([riga()]);
      const campo = campoRicerca();
      campo.value = 'niente-che-esista';
      campo.dispatchEvent(new Event('input'));
      await stabilizza();

      expect(testo()).toContain('Nessuna lezione con questa ricerca');
      expect(testo()).not.toContain('Nessuna apertura registrata finora');
      const azzera = [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim() === 'Azzera la ricerca',
      ) as HTMLButtonElement;
      azzera.click();
      await stabilizza();
      expect(testo()).toContain('Push-fold da 10bb');
    });

    it('⚠️ le due cifre portano la propria etichetta sullo stretto', async () => {
      // Sotto i 720px `thead` sparisce: senza `data-etichetta` la riga
      // diventerebbe «Push-fold da 10bb · 4 · 9», due numeri di cui non si sa
      // quale sia quale. La classe `--etichettata` è OPT-IN.
      await rispondiPresenze([sessione()]);
      await apriViste([riga()]);
      const tabella = fixture.nativeElement.querySelector(
        '.admin-table',
      ) as HTMLElement;
      expect(tabella.classList).toContain('admin-table--etichettata');
      const etichette = [
        ...fixture.nativeElement.querySelectorAll('td[data-etichetta]'),
      ].map((td: HTMLElement) => td.getAttribute('data-etichetta'));
      expect(etichette).toEqual(['Persone', 'Aperture']);
    });

    it('gli spettatori si caricano SOLO all’apertura, in una modale', async () => {
      await rispondiPresenze([sessione()]);
      await apriViste([riga()]);
      http.expectNone((r) => r.url === `${API}/lessons/l1/views`);

      comando('Chi ha visto Push-fold da 10bb').click();
      await stabilizza();
      http.expectOne((r) => r.url === `${API}/lessons/l1/views`).flush([
        { userId: 'u1', nome: 'mario', aperture: 3, percentualeMax: 84 },
      ]);
      await stabilizza();

      expect(dialog()).toBeTruthy();
      expect(testo()).toContain('Spettatori — Push-fold da 10bb');
      expect(testo()).toContain('mario');
      expect(testo()).toContain('84% visto');
    });

    it('⚠️ un errore sugli spettatori NON si legge come «nessuno l’ha aperta»', async () => {
      // Fino al 18/09/2026 il ramo di errore faceva `viewers.set([])`: una
      // chiamata fallita si leggeva come una lezione che nessuno ha guardato.
      // Sono due fatti opposti, e solo il primo ha una via d'uscita.
      await rispondiPresenze([sessione()]);
      await apriViste([riga()]);
      comando('Chi ha visto Push-fold da 10bb').click();
      await stabilizza();
      http
        .expectOne((r) => r.url === `${API}/lessons/l1/views`)
        .flush({ message: 'Boom' }, { status: 500, statusText: 'Server Error' });
      await stabilizza();

      expect(testo()).not.toContain("Nessuno l'ha ancora aperta");
      const riprova = [...fixture.nativeElement.querySelectorAll('button')].find(
        (b: HTMLButtonElement) => b.textContent?.trim() === 'Riprova',
      ) as HTMLButtonElement;
      expect(riprova).toBeTruthy();

      // E «Riprova» rifà SOLO quella chiamata.
      riprova.click();
      await stabilizza();
      http.expectOne((r) => r.url === `${API}/lessons/l1/views`).flush([]);
      await stabilizza();
      expect(testo()).toContain("Nessuno l'ha ancora aperta");
    });
  });
});
