import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LessonStakes,
  LiveMode,
  LiveSession,
  LiveSessionPayload,
} from '../../../core/models/api.models';
import { LiveService } from '../../../core/services/live.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

@Component({
  selector: 'app-admin-live',
  imports: [ReactiveFormsModule, DatePipe, RouterLink],
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
  protected readonly publishing = signal(false);
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
    mode: ['EXTERNAL' as LiveMode, Validators.required],
    recordingEnabled: [false],
    joinUrl: [
      '',
      [Validators.required, Validators.pattern(/^https?:\/\/.+/)],
    ],
  });

  constructor() {
    this.load();
  }

  /** joinUrl è obbligatorio solo per le sessioni EXTERNAL; LIVEKIT lo ignora. */
  private setJoinUrlValidators(mode: LiveMode): void {
    const c = this.form.controls.joinUrl;
    c.setValidators(
      mode === 'EXTERNAL'
        ? [Validators.required, Validators.pattern(/^https?:\/\/.+/)]
        : [],
    );
    c.updateValueAndValidity();
  }

  protected onModeChange(): void {
    this.setJoinUrlValidators(this.form.controls.mode.value);
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
      mode: session.mode,
      recordingEnabled: session.recordingEnabled ?? false,
      joinUrl: session.joinUrl ?? '',
    });
    this.setJoinUrlValidators(session.mode);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({
      stakes: 'LOW',
      durationMin: 60,
      mode: 'EXTERNAL',
      recordingEnabled: false,
    });
    this.setJoinUrlValidators('EXTERNAL');
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
      mode: v.mode,
      // joinUrl solo per EXTERNAL; LIVEKIT genera la stanza on-site lato backend
      joinUrl: v.mode === 'EXTERNAL' ? v.joinUrl : undefined,
      // registrazione solo per LIVEKIT
      recordingEnabled: v.mode === 'LIVEKIT' ? v.recordingEnabled : undefined,
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

  /** Etichetta leggibile dello stato registrazione. */
  protected recLabel(state: string | undefined): string {
    return (
      {
        STARTING: 'in avvio',
        ACTIVE: 'in corso',
        PROCESSING: 'in elaborazione',
        READY: 'pronta da pubblicare',
        DONE: 'pubblicata',
        FAILED: 'fallita',
      }[state ?? ''] ?? state ?? ''
    );
  }

  /** Riprocessa una registrazione fallita (rifà ingest dal file su R2). */
  protected retryRecording(session: LiveSession): void {
    this.feedback.set(null);
    this.error.set(null);
    this.liveApi.retryRecording(session.id).subscribe({
      next: () => {
        this.feedback.set('Riprocessamento avviato.');
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Riprocessamento non riuscito.')),
    });
  }

  /** Pubblica una registrazione pronta come lezione VOD (avvisa gli abbonati). */
  protected publishRecording(session: LiveSession): void {
    if (this.publishing()) return;
    if (
      !confirm(
        `Pubblicare la registrazione di "${session.title}" come lezione? ` +
          'Gli abbonati del tier riceveranno un avviso via email.',
      )
    )
      return;
    this.publishing.set(true);
    this.feedback.set(null);
    this.error.set(null);
    this.liveApi.publishRecording(session.id).subscribe({
      next: () => {
        this.publishing.set(false);
        this.feedback.set('Registrazione pubblicata come lezione.');
        this.load();
      },
      error: (err: unknown) => {
        this.publishing.set(false);
        this.error.set(apiErrorMessage(err, 'Pubblicazione non riuscita.'));
      },
    });
  }
}
