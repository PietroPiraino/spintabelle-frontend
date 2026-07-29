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
  imports: [DatePipe],
  templateUrl: './admin-participation.component.html',
  styleUrl: '../admin-shared.scss',
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

  constructor() {
    this.load();
    this.loadViews();
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
