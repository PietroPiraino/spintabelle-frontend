import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LESSON_CATEGORIA_NESSUNA,
  LESSON_CATEGORIES,
  LESSON_CATEGORY_LABELS,
  Lesson,
  LessonCategoriaFiltro,
  LessonCategory,
  LessonStakes,
  LessonsSommario,
  Paginated,
} from '../../../core/models/api.models';
import { LessonsService } from '../../../core/services/lessons.service';
import { TagPickerComponent } from '../../../shared/ui/tag-picker/tag-picker.component';
import { apiErrorMessage } from '../../../core/utils/http-error';

/** Lezioni per pagina nel pannello (pager classico, come gli iscritti). */
const PAGE_SIZE = 25;

@Component({
  selector: 'app-admin-lessons',
  imports: [ReactiveFormsModule, DatePipe, TagPickerComponent],
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
  /**
   * Conteggi per categoria e — la parte che conta qui — quante lezioni restano
   * da classificare. È la coda di lavoro della migrazione, e questa schermata è
   * l'unico posto che la rende visibile.
   * ⚠️ Best-effort: contro un backend vecchio `/lessons/sommario` cade su
   * `@Get(':id')` e torna 404. Il pannello deve continuare a funzionare.
   */
  protected readonly sommario = signal<LessonsSommario | null>(null);
  /** Filtro della lista per categoria; `null` = tutte. */
  protected readonly filtroCategoria = signal<LessonCategoriaFiltro | null>(null);

  protected readonly categorie = LESSON_CATEGORIES;
  protected readonly categoryLabels = LESSON_CATEGORY_LABELS;
  protected readonly NESSUNA = LESSON_CATEGORIA_NESSUNA;
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
    // ⚠️ `required` QUI perché il campo è obbligatorio ANCHE là: un obbligo
    // solo lato client mentirebbe sul contratto, uno solo lato server darebbe
    // un 400 in inglese al primo salvataggio. Le due righe si toccano insieme.
    // ⚠️ È anche il meccanismo che porta a termine la triage: una lezione
    // legacy senza categoria non si può ri-salvare senza classificarla.
    categoria: ['' as LessonCategory | '', Validators.required],
    stakes: ['LOW' as LessonStakes, Validators.required],
    // anteprima gratuita: la lezione resta visibile a tutti i registrati
    freePreview: [false],
    videoDate: ['', Validators.required],
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
      .getLessons({
        page: this.currentPage(),
        limit: PAGE_SIZE,
        categoria: this.filtroCategoria() ?? undefined,
      })
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
    this.lessonsApi.sommario().subscribe({
      next: (s) => this.sommario.set(s),
      // best-effort: senza il sommario il pannello perde il contatore, non la lista
      error: () => undefined,
    });
  }

  /** Cambia il filtro per categoria e riparte dalla prima pagina. */
  protected setFiltroCategoria(value: string): void {
    this.filtroCategoria.set((value || null) as LessonCategoriaFiltro | null);
    this.currentPage.set(1);
    this.load();
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  protected edit(lesson: Lesson): void {
    this.editingId.set(lesson.id);
    this.feedback.set(null);
    this.error.set(null);
    this.form.patchValue({
      title: lesson.title,
      description: lesson.description,
      bunnyEmbedUrl: lesson.bunnyEmbedUrl ?? '',
      categoria: lesson.categoria ?? '',
      stakes: lesson.stakes ?? 'LOW',
      // stato "gratis" corrente: dedotto dalla visibilità USER
      freePreview: lesson.visibility === 'USER',
      videoDate: this.toDateInput(lesson.videoDate),
    });
    this.selectedTags.set([...lesson.tags]);
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ stakes: 'LOW', freePreview: false, categoria: '' });
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

    const {
      title,
      description,
      bunnyEmbedUrl,
      categoria,
      stakes,
      freePreview,
      videoDate,
    } = this.form.getRawValue();
    const payload = {
      title,
      description,
      bunnyEmbedUrl,
      stakes,
      freePreview,
      videoDate,
      tags: this.selectedTags(),
      // ⚠️ La chiave si omette quando è vuota, non si manda `''`: il DTO ha
      // `@IsIn(LESSON_CATEGORIES)` e una stringa vuota è un 400, non un
      // «nessuna categoria». È anche ciò che permette di ri-salvare una lezione
      // non ancora classificata senza doverla classificare adesso.
      ...(categoria ? { categoria } : {}),
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
