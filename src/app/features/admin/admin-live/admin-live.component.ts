import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LessonStakes,
  LiveSession,
  LiveSessionPayload,
} from '../../../core/models/api.models';
import { LiveService } from '../../../core/services/live.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

@Component({
  selector: 'app-admin-live',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-live.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLiveComponent {
  private readonly fb = inject(FormBuilder);
  private readonly liveApi = inject(LiveService);

  protected readonly sessions = signal<LiveSession[] | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    description: ['', [Validators.maxLength(2000)]],
    stakes: ['LOW' as LessonStakes, Validators.required],
    startsAt: ['', Validators.required],
    durationMin: [60],
    platform: ['', [Validators.maxLength(80)]],
    joinUrl: [
      '',
      [Validators.required, Validators.pattern(/^https?:\/\/.+/)],
    ],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    // includePast: l'admin vede e gestisce anche le sessioni passate
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

  /** ISO → valore per input[type=datetime-local] in ora LOCALE. */
  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  protected edit(session: LiveSession): void {
    this.editingId.set(session.id);
    this.feedback.set(null);
    this.error.set(null);
    this.form.patchValue({
      title: session.title,
      description: session.description ?? '',
      stakes: session.stakes,
      startsAt: this.toLocalInput(session.startsAt),
      durationMin: session.durationMin ?? 60,
      platform: session.platform ?? '',
      joinUrl: session.joinUrl ?? '',
    });
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ stakes: 'LOW', durationMin: 60 });
    this.error.set(null);
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);

    const v = this.form.getRawValue();
    const payload: LiveSessionPayload = {
      title: v.title,
      description: v.description.trim() || undefined,
      stakes: v.stakes,
      // datetime-local (ora locale) → ISO UTC
      startsAt: new Date(v.startsAt).toISOString(),
      durationMin: v.durationMin || undefined,
      platform: v.platform.trim() || undefined,
      joinUrl: v.joinUrl,
    };

    const id = this.editingId();
    const request$ = id
      ? this.liveApi.update(id, payload)
      : this.liveApi.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.set(id ? 'Sessione aggiornata.' : 'Sessione creata.');
        this.cancelEdit();
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected remove(session: LiveSession): void {
    if (!confirm(`Eliminare la sessione "${session.title}"?`)) return;
    this.liveApi.remove(session.id).subscribe({
      next: () => {
        this.feedback.set('Sessione eliminata.');
        if (this.editingId() === session.id) this.cancelEdit();
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }
}
