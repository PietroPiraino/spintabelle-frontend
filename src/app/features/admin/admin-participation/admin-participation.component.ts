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
import {
  SchedeComponent,
  VoceScheda,
} from '../../../shared/ui/schede/schede.component';

/** Le due metà della pagina, che non condividono alcuno stato. */
type Scheda = 'presenze' | 'viste';

/**
 * Tab "Partecipazione": chi c'era davvero.
 *
 * Presenze alle lezioni live on-site, per sessione. Il registro si carica
 * SOLO all'apertura di una sessione (una richiesta per volta): l'elenco delle
 * live è già in pagina, caricare tutti i registri in anticipo sarebbe lavoro
 * buttato nel 90% dei casi.
 */
@Component({
  selector: 'app-admin-participation',
  imports: [DatePipe, SchedeComponent],
  templateUrl: './admin-participation.component.html',
  styleUrls: ['../admin-shared.scss', '../admin-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminParticipationComponent {
  private readonly liveApi = inject(LiveService);
  private readonly lessonsApi = inject(LessonsService);

  protected readonly sessions = signal<LiveSession[] | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal<string | null>(null);

  /** Sessione aperta (una alla volta, come i pannelli degli Iscritti). */
  protected readonly openId = signal<string | null>(null);
  protected readonly report = signal<LiveAttendanceReport | null>(null);
  protected readonly reportLoading = signal(false);
  protected readonly reportError = signal<string | null>(null);

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
    this.scheda.set(s);
    if (this.caricate.has(s)) return;
    this.caricate.add(s);
    if (s === 'presenze') this.load();
    else this.loadViews();
  }

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

  protected readonly openLessonId = signal<string | null>(null);
  protected readonly viewers = signal<LessonViewer[] | null>(null);
  protected readonly viewersLoading = signal(false);

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

  protected toggleLesson(row: LessonViewsRow): void {
    if (this.openLessonId() === row.lessonId) {
      this.openLessonId.set(null);
      return;
    }
    this.openLessonId.set(row.lessonId);
    this.viewers.set(null);
    this.viewersLoading.set(true);
    this.lessonsApi.viewers(row.lessonId).subscribe({
      next: (people) => {
        this.viewers.set(people);
        this.viewersLoading.set(false);
      },
      error: () => {
        this.viewers.set([]);
        this.viewersLoading.set(false);
      },
    });
  }

  protected toggle(session: LiveSession): void {
    if (this.openId() === session.id) {
      this.openId.set(null);
      return;
    }
    this.openId.set(session.id);
    this.report.set(null);
    this.reportError.set(null);
    this.reportLoading.set(true);
    this.liveApi.getAttendance(session.id).subscribe({
      next: (report) => {
        this.report.set(report);
        this.reportLoading.set(false);
      },
      error: (err: unknown) => {
        this.reportLoading.set(false);
        this.reportError.set(
          apiErrorMessage(err, 'Caricamento presenze non riuscito.'),
        );
      },
    });
  }
}
