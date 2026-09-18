import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  LessonViewer,
  LessonViewsRow,
  LiveAttendanceReport,
  LiveSession,
} from '../../../core/models/api.models';
import { LessonsService } from '../../../core/services/lessons.service';
import { LiveService } from '../../../core/services/live.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';
import {
  FiltroComponent,
  VoceFiltro,
} from '../../../shared/ui/filtro/filtro.component';
import { orologio, statoSessione } from '../../../shared/live/stato-sessione';

/** Le due metà della pagina, che non condividono alcuno stato. */
type Scheda = 'presenze' | 'viste';

/**
 * Tab "Partecipazione": chi c'era davvero.
 *
 * Presenze alle lezioni live on-site, per sessione. Il registro si carica
 * SOLO all'apertura di una sessione (una richiesta per volta): l'elenco delle
 * live è già in pagina, caricare tutti i registri in anticipo sarebbe lavoro
 * buttato nel 90% dei casi.
 *
 * ⚠️ Dal 18/09/2026 le due metà sono TABELLE e il dettaglio si apre in una
 * `app-modal`, cioè la grammatica del pannello dall'08/09/2026. Prima erano
 * card con il dettaglio in una card sorella: una `<table>` non può ospitarlo
 * così, e la modale è comunque la forma che il resto del pannello usa. Il
 * foglio `admin-table.scss` era GIÀ in questa lista di stili e il template non
 * conteneva una sola `<table>`: l'intenzione c'era, mancava la conversione.
 */
@Component({
  selector: 'app-admin-participation',
  imports: [
    DatePipe,
    SchedeComponent,
    FiltroComponent,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './admin-participation.component.html',
  styleUrls: ['../admin-shared.scss', '../admin-table.scss', '../admin-modale.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminParticipationComponent {
  private readonly liveApi = inject(LiveService);
  private readonly lessonsApi = inject(LessonsService);

  protected readonly sessions = signal<LiveSession[] | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal<string | null>(null);

  /** La sessione aperta NELLA MODALE (una alla volta). */
  protected readonly apertaSessioneId = signal<string | null>(null);
  protected readonly report = signal<LiveAttendanceReport | null>(null);
  protected readonly reportLoading = signal(false);
  protected readonly reportError = signal<string | null>(null);

  /**
   * ⚠️ La modale si lega alla riga RILETTA dall'elenco, non a una copia
   * congelata al momento del clic: se un ricaricamento fa sparire quella
   * sessione, la modale si chiude da sé invece di restare aperta su dati che
   * non esistono più. È l'idioma di `utenteAperto` in `admin-users`.
   */
  protected readonly sessioneAperta = computed<LiveSession | null>(() => {
    const id = this.apertaSessioneId();
    if (!id) return null;
    return this.sessions()?.find((s) => s.id === id) ?? null;
  });

  /**
   * Solo le sessioni on-site: quelle EXTERNAL (Zoom/Discord) non lasciano
   * alcuna traccia lato sito. Mostrarle con "0 presenti" sarebbe una bugia.
   */
  protected readonly onsite = computed(() =>
    (this.sessions() ?? []).filter((s) => s.mode === 'LIVEKIT'),
  );

  protected readonly hasExternal = computed(() =>
    (this.sessions() ?? []).some((s) => s.mode !== 'LIVEKIT'),
  );

  /**
   * L'orologio condiviso: serve a sapere quali sessioni sono già cominciate.
   *
   * ⚠️ È lo stesso `orologio()` di `/live` e `/admin/live`, e lo stato lo
   * calcola `statoSessione()`: una terza definizione di «è già iniziata» in una
   * terza schermata è il modo con cui le tre divergono senza che nessuno se ne
   * accorga. Passo 30s — qui basterebbe molto meno spesso, ma un secondo
   * orologio è comunque peggio di uno un po' troppo sveglio.
   */
  private readonly adesso = orologio();

  /**
   * Le on-site GIÀ COMINCIATE.
   *
   * ⚠️ Una sessione che deve ancora iniziare ha zero presenze **per
   * definizione**, non perché non è venuto nessuno: elencarla significa
   * mostrare uno zero che non è una misura. Il taglio è `startsAt` nel passato,
   * non «terminata»: una live IN CORSO si sta riempiendo proprio adesso, ed è
   * quella che si guarda più volentieri.
   */
  protected readonly presenzeAvvenute = computed(() =>
    this.onsite().filter((s) => {
      const st = statoSessione(s, this.adesso());
      return st !== 'imminente' && st !== 'programmata';
    }),
  );

  /**
   * Quante ne sono state nascoste perché non ancora avvenute.
   *
   * ⚠️ Si DICE, non si tace: un elenco che mostra meno righe di quante ne
   * esistono, e non spiega perché, fa cercare un guasto. È la stessa regola di
   * `.admin-table__nota-mobile`.
   */
  protected readonly futureNascoste = computed(
    () => this.onsite().length - this.presenzeAvvenute().length,
  );

  /**
   * ⚠️ La ricerca copre titolo e descrizione, e NON la piattaforma: qui le
   * sessioni sono tutte `LIVEKIT` (le EXTERNAL non lasciano traccia e sono già
   * escluse), quindi «piattaforma» varrebbe «On-site» su ogni riga — un campo
   * di ricerca che non discrimina niente promette qualcosa che non può dare.
   * ⚠️ E non è debounced: il filtro è LOCALE, non una chiamata di rete. I 300ms
   * delle altre sezioni servono a non sfondare il throttle del server; qui
   * sarebbero solo un ritardo.
   */
  protected readonly ricerca = signal('');

  protected readonly tier = signal<'TUTTI' | 'LOW' | 'HIGH'>('TUTTI');
  protected readonly vociTier: readonly VoceFiltro<'TUTTI' | 'LOW' | 'HIGH'>[] = [
    { valore: 'TUTTI', etichetta: 'Tutti' },
    { valore: 'LOW', etichetta: 'Low stakes' },
    { valore: 'HIGH', etichetta: 'High stakes' },
  ];

  protected readonly presenzeVisibili = computed(() => {
    const q = this.ricerca().trim().toLowerCase();
    const t = this.tier();
    return this.presenzeAvvenute().filter((s) => {
      if (t !== 'TUTTI' && s.stakes !== t) return false;
      if (!q) return true;
      return `${s.title} ${s.description ?? ''}`.toLowerCase().includes(q);
    });
  });

  /** Vero se un filtro sta nascondendo delle righe che esistono. */
  protected readonly filtroAttivo = computed(
    () => this.ricerca().trim().length > 0 || this.tier() !== 'TUTTI',
  );

  protected onRicerca(e: Event): void {
    this.ricerca.set((e.target as HTMLInputElement).value);
  }

  protected azzeraFiltri(): void {
    this.ricerca.set('');
    this.tier.set('TUTTI');
  }

  /**
   * La scheda aperta.
   *
   * ⚠️ Le due sezioni erano impilate in colonna, la seconda staccata da uno
   * `style="margin-top: 2.4rem"`: per arrivare alle viste bisognava scorrere
   * ~130 righe di markup di presenze. Sono due elenchi che non condividono
   * NIENTE — né stato, né filtri, né una chiamata — quindi non c'è alcuna
   * ragione per cui debbano stare sullo stesso schermo.
   */
  protected readonly scheda = signal<Scheda>('presenze');
  protected readonly schede: readonly VoceScheda<Scheda>[] = [
    { valore: 'presenze', etichetta: 'Presenze live' },
    { valore: 'viste', etichetta: 'Viste delle lezioni' },
  ];

  /**
   * ⚠️ Chi ha già caricato. Il caricamento è PIGRO — la seconda scheda non
   * chiede niente finché non la si apre — ma una volta caricata non si
   * ricarica cambiando scheda: un elenco che si ricostruisce a ogni andata e
   * ritorno fa lampeggiare lo spinner su dati che erano già lì.
   */
  private readonly caricate = new Set<Scheda>();

  constructor() {
    this.apriScheda('presenze');
  }

  protected apriScheda(s: Scheda): void {
    // ⚠️ Le due modali vivono FUORI dall'`@if` che sceglie la scheda, quindi un
    // id rimasto valorizzato lascerebbe aperta la scheda di una sessione sopra
    // l'elenco delle lezioni. Oggi non è raggiungibile — un `<dialog>` modale
    // rende inerte ciò che sta sotto — ma costa due righe e chiude il buco per
    // costruzione invece che per coincidenza.
    this.chiudiSessione();
    this.chiudiLezione();
    this.scheda.set(s);
    if (this.caricate.has(s)) return;
    this.caricate.add(s);
    if (s === 'presenze') this.load();
    else this.loadViews();
  }

  /**
   * Il contatore anti-risposta-fuori-ordine dei DETTAGLI.
   *
   * ⚠️ Non è prudenza generica: aprendo una riga, chiudendo e aprendone
   * un'altra, la risposta lenta della PRIMA arriva dopo quella della seconda e
   * riempirebbe la modale con le presenze di una sessione **sotto il titolo di
   * un'altra** — cioè dei dati personali attribuiti alla persona sbagliata.
   * Uno solo per entrambe: le due schede sono esclusive, ma una risposta della
   * prima può atterrare mentre è aperta la modale della seconda.
   */
  private seqDettaglio = 0;

  private load(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.liveApi.getSessions(true).subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.listLoading.set(false);
      },
      error: (err: unknown) => {
        this.listLoading.set(false);
        this.listError.set(
          apiErrorMessage(err, 'Caricamento sessioni non riuscito.'),
        );
      },
    });
  }

  // ── Viste delle video-lezioni ───────────────────────────────────────────--

  protected readonly viewsRows = signal<LessonViewsRow[] | null>(null);
  protected readonly viewsLoading = signal(false);
  protected readonly viewsError = signal<string | null>(null);

  protected readonly apertaLezioneId = signal<string | null>(null);
  protected readonly viewers = signal<LessonViewer[] | null>(null);
  protected readonly viewersLoading = signal(false);
  /**
   * ⚠️ Esiste dal 18/09/2026, e prima no: il ramo di errore faceva
   * `viewers.set([])`, cioè una chiamata fallita si leggeva come «nessuno l'ha
   * ancora aperta». Sono due fatti opposti, e il secondo ha una via d'uscita
   * («Riprova») che il primo non ha.
   */
  protected readonly viewersError = signal<string | null>(null);

  /** La riga RILETTA, per la stessa ragione di `sessioneAperta`. */
  protected readonly lezioneAperta = computed<LessonViewsRow | null>(() => {
    const id = this.apertaLezioneId();
    if (!id) return null;
    return this.viewsRows()?.find((r) => r.lessonId === id) ?? null;
  });

  /**
   * ⚠️ Un signal di ricerca PER SCHEDA, non uno condiviso: le due filtrano cose
   * diverse (sessioni live da una parte, lezioni dall'altra) e una query che
   * sopravvive al cambio di scheda nasconderebbe righe senza che si capisca
   * perché. Non debounced, per la ragione scritta su `ricerca`.
   * ⚠️ Guarda SOLO il titolo, e il segnaposto deve promettere solo quello:
   * `LessonViewsRow` porta `{lessonId, titolo, spettatori, aperture,
   * ultimaApertura}` e nient'altro — niente tag, niente descrizione.
   */
  protected readonly ricercaViste = signal('');

  protected readonly visteVisibili = computed(() => {
    const q = this.ricercaViste().trim().toLowerCase();
    const rows = this.viewsRows() ?? [];
    if (!q) return rows;
    return rows.filter((r) => r.titolo.toLowerCase().includes(q));
  });

  protected readonly filtroVisteAttivo = computed(
    () => this.ricercaViste().trim().length > 0,
  );

  protected onRicercaViste(e: Event): void {
    this.ricercaViste.set((e.target as HTMLInputElement).value);
  }

  protected azzeraRicercaViste(): void {
    this.ricercaViste.set('');
  }

  private loadViews(): void {
    this.viewsLoading.set(true);
    this.viewsError.set(null);
    this.lessonsApi.viewsSummary().subscribe({
      next: (rows) => {
        this.viewsRows.set(rows);
        this.viewsLoading.set(false);
      },
      error: (err: unknown) => {
        this.viewsLoading.set(false);
        this.viewsError.set(
          apiErrorMessage(err, 'Caricamento viste non riuscito.'),
        );
      },
    });
  }

  protected apriLezione(row: LessonViewsRow): void {
    this.apertaLezioneId.set(row.lessonId);
    this.caricaSpettatori(row.lessonId);
  }

  /**
   * ⚠️ Azzera anche il contenuto e non solo l'id: riaprendo un'altra riga, per
   * l'istante che precede la risposta si vedrebbe altrimenti l'elenco
   * precedente sotto il titolo nuovo.
   */
  protected chiudiLezione(): void {
    this.seqDettaglio++;
    this.apertaLezioneId.set(null);
    this.viewers.set(null);
    this.viewersError.set(null);
    this.viewersLoading.set(false);
  }

  /** «Riprova» dentro la modale: rifà SOLO questa chiamata. */
  protected riprovaSpettatori(): void {
    const id = this.apertaLezioneId();
    if (id) this.caricaSpettatori(id);
  }

  private caricaSpettatori(lessonId: string): void {
    const mio = ++this.seqDettaglio;
    this.viewers.set(null);
    this.viewersError.set(null);
    this.viewersLoading.set(true);
    this.lessonsApi.viewers(lessonId).subscribe({
      next: (people) => {
        if (mio !== this.seqDettaglio) return;
        this.viewers.set(people);
        this.viewersLoading.set(false);
      },
      error: (err: unknown) => {
        if (mio !== this.seqDettaglio) return;
        this.viewersLoading.set(false);
        this.viewersError.set(
          apiErrorMessage(err, 'Caricamento spettatori non riuscito.'),
        );
      },
    });
  }

  protected apriSessione(session: LiveSession): void {
    this.apertaSessioneId.set(session.id);
    this.caricaReport(session.id);
  }

  protected chiudiSessione(): void {
    this.seqDettaglio++;
    this.apertaSessioneId.set(null);
    this.report.set(null);
    this.reportError.set(null);
    this.reportLoading.set(false);
  }

  protected riprovaReport(): void {
    const id = this.apertaSessioneId();
    if (id) this.caricaReport(id);
  }

  private caricaReport(sessionId: string): void {
    const mio = ++this.seqDettaglio;
    this.report.set(null);
    this.reportError.set(null);
    this.reportLoading.set(true);
    this.liveApi.getAttendance(sessionId).subscribe({
      next: (report) => {
        if (mio !== this.seqDettaglio) return;
        this.report.set(report);
        this.reportLoading.set(false);
      },
      error: (err: unknown) => {
        if (mio !== this.seqDettaglio) return;
        this.reportLoading.set(false);
        this.reportError.set(
          apiErrorMessage(err, 'Caricamento presenze non riuscito.'),
        );
      },
    });
  }
}
