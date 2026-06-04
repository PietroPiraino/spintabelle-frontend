import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Lesson, LessonVisibility } from '../../../core/models/api.models';
import { LessonsService } from '../../../core/services/lessons.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

@Component({
  selector: 'app-admin-lessons',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-lessons.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLessonsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly lessonsApi = inject(LessonsService);

  protected readonly lessons = signal<Lesson[] | null>(null);
  protected readonly knownTags = signal<string[]>([]);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(2000)]],
    vimeoEmbedUrl: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
    visibility: ['USER' as LessonVisibility, Validators.required],
    newTag: [''],
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.lessonsApi.getLessons().subscribe({
      next: (lessons) => this.lessons.set(lessons),
      error: () => this.lessons.set([]),
    });
    this.lessonsApi.getTags().subscribe({
      next: (tags) => this.knownTags.set(tags),
    });
  }

  protected toggleTag(tag: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  }

  /** Aggiunge il tag scritto nel campo libero (select-or-create). */
  protected addNewTag(event?: Event): void {
    event?.preventDefault();
    const raw = this.form.controls.newTag.value.trim().toLowerCase();
    if (!raw) return;
    if (!this.knownTags().includes(raw)) {
      this.knownTags.update((tags) => [...tags, raw].sort());
    }
    if (!this.selectedTags().includes(raw)) {
      this.selectedTags.update((tags) => [...tags, raw]);
    }
    this.form.controls.newTag.setValue('');
  }

  protected edit(lesson: Lesson): void {
    this.editingId.set(lesson.id);
    this.feedback.set(null);
    this.error.set(null);
    this.form.patchValue({
      title: lesson.title,
      description: lesson.description,
      vimeoEmbedUrl: lesson.vimeoEmbedUrl ?? '',
      visibility: lesson.visibility,
    });
    this.selectedTags.set([...lesson.tags]);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ visibility: 'USER' });
    this.selectedTags.set([]);
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

    const { title, description, vimeoEmbedUrl, visibility } =
      this.form.getRawValue();
    const payload = {
      title,
      description,
      vimeoEmbedUrl,
      visibility,
      tags: this.selectedTags(),
    };

    const id = this.editingId();
    const request$ = id
      ? this.lessonsApi.update(id, payload)
      : this.lessonsApi.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.set(id ? 'Lezione aggiornata.' : 'Lezione creata.');
        this.cancelEdit();
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected remove(lesson: Lesson): void {
    if (!confirm(`Eliminare la lezione "${lesson.title}"?`)) return;
    this.lessonsApi.remove(lesson.id).subscribe({
      next: () => {
        this.feedback.set('Lezione eliminata.');
        if (this.editingId() === lesson.id) this.cancelEdit();
        this.reload();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }
}
