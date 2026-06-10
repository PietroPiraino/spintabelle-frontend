import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Lesson,
  LessonVisibility,
  Paginated,
} from '../../../core/models/api.models';
import { LessonsService } from '../../../core/services/lessons.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

/** Lezioni per pagina nel pannello (pager classico, come gli iscritti). */
const PAGE_SIZE = 25;

@Component({
  selector: 'app-admin-lessons',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-lessons.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLessonsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly lessonsApi = inject(LessonsService);

  protected readonly page = signal<Paginated<Lesson> | null>(null);
  protected readonly listLoading = signal(false);
  /** Errore di caricamento della lista (distinto dall'errore del form). */
  protected readonly listError = signal<string | null>(null);
  protected readonly knownTags = signal<string[]>([]);
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  private readonly currentPage = signal(1);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(2000)]],
    bunnyEmbedUrl: [
      '',
      [
        Validators.required,
        Validators.pattern(
          /^https:\/\/(iframe|player)\.mediadelivery\.net\/embed\/.+/,
        ),
      ],
    ],
    visibility: ['USER' as LessonVisibility, Validators.required],
    videoDate: ['', Validators.required],
    newTag: [''],
  });

  /** Converte una data ISO nel formato YYYY-MM-DD richiesto da input[type=date]. */
  private toDateInput(iso?: string): string {
    return iso ? iso.slice(0, 10) : '';
  }

  constructor() {
    this.reload();
  }

  private load(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.lessonsApi
      .getLessons({ page: this.currentPage(), limit: PAGE_SIZE })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.listLoading.set(false);
        },
        error: (err: unknown) => {
          this.listLoading.set(false);
          // riallinea il pager all'ultima pagina davvero caricata, così il
          // clic successivo può ritentare (goToPage scarta i no-op)
          this.currentPage.set(this.page()?.page ?? 1);
          this.listError.set(
            apiErrorMessage(err, 'Caricamento lezioni non riuscito.'),
          );
        },
      });
  }

  private reload(): void {
    this.load();
    this.lessonsApi.getTags().subscribe({
      next: (tags) => this.knownTags.set(tags),
    });
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  protected toggleTag(tag: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  }

  /**
   * Aggiunge i tag scritti nel campo libero (select-or-create). La virgola
   * separa più tag e non può far parte di un tag (è il separatore del
   * filtro lista: il backend la rifiuta con 400).
   */
  protected addNewTag(event?: Event): void {
    event?.preventDefault();
    const parts = this.form.controls.newTag.value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    for (const raw of parts) {
      if (!this.knownTags().includes(raw)) {
        this.knownTags.update((tags) => [...tags, raw].sort());
      }
      if (!this.selectedTags().includes(raw)) {
        this.selectedTags.update((tags) => [...tags, raw]);
      }
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
      bunnyEmbedUrl: lesson.bunnyEmbedUrl ?? '',
      visibility: lesson.visibility,
      videoDate: this.toDateInput(lesson.videoDate),
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

    const { title, description, bunnyEmbedUrl, visibility, videoDate } =
      this.form.getRawValue();
    const payload = {
      title,
      description,
      bunnyEmbedUrl,
      visibility,
      videoDate,
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
        // Una lezione nuova (data video recente) appare in cima: torna a pagina 1.
        if (!id) this.currentPage.set(1);
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
        // Se era l'ultima della pagina, arretra di una (la pagina non esiste più).
        const p = this.page();
        if (p && p.items.length === 1 && p.page > 1) {
          this.currentPage.set(p.page - 1);
        }
        this.reload();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }
}
