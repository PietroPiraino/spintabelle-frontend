import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DocumentCategory,
  DocumentResource,
  DocumentVisibility,
  Paginated,
} from '../../../core/models/api.models';
import { DocumentsService } from '../../../core/services/documents.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

/** Materiali per pagina nel pannello (pager classico, come iscritti/lezioni). */
const PAGE_SIZE = 25;

/** Tetto upload lato client: coincide col cap backend (DOCUMENTS_MAX_FILE_MB). */
const MAX_MB = 50;

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: 'PT4_FILTER', label: 'Filtri PT4' },
  { value: 'PT4_REPORT', label: 'Report PT4' },
  { value: 'PDF', label: 'PDF' },
  { value: 'EXCEL', label: 'Excel' },
  { value: 'WORD', label: 'Word' },
  { value: 'ALTRO', label: 'Altro' },
];

@Component({
  selector: 'app-admin-documents',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-documents.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDocumentsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly docsApi = inject(DocumentsService);

  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly maxMb = MAX_MB;

  protected readonly page = signal<Paginated<DocumentResource> | null>(null);
  protected readonly listLoading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  /** File scelto nel form (null = nessuno; in modifica = mantieni quello attuale). */
  protected readonly selectedFile = signal<File | null>(null);

  private readonly currentPage = signal(1);

  protected readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    ],
    description: [
      '',
      [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
    ],
    category: ['PT4_FILTER' as DocumentCategory, Validators.required],
    visibility: ['PESCE_ROSSO' as DocumentVisibility, Validators.required],
  });

  constructor() {
    this.load();
  }

  protected categoryLabel(cat: DocumentCategory): string {
    return CATEGORY_OPTIONS.find((c) => c.value === cat)?.label ?? cat;
  }

  /** Dimensione leggibile (B/KB/MB). */
  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  private load(): void {
    this.listLoading.set(true);
    this.listError.set(null);
    this.docsApi
      .list({ page: this.currentPage(), limit: PAGE_SIZE })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.listLoading.set(false);
        },
        error: (err: unknown) => {
          this.listLoading.set(false);
          this.currentPage.set(this.page()?.page ?? 1);
          this.listError.set(
            apiErrorMessage(err, 'Caricamento materiali non riuscito.'),
          );
        },
      });
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  protected onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file && file.size > MAX_MB * 1024 * 1024) {
      this.error.set(`Il file supera il limite di ${MAX_MB} MB.`);
      this.selectedFile.set(null);
      input.value = '';
      return;
    }
    this.error.set(null);
    this.selectedFile.set(file);
  }

  protected edit(doc: DocumentResource): void {
    this.editingId.set(doc.id);
    this.feedback.set(null);
    this.error.set(null);
    this.selectedFile.set(null);
    this.form.patchValue({
      title: doc.title,
      description: doc.description,
      category: doc.category,
      visibility: doc.visibility,
    });
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.selectedFile.set(null);
    this.form.reset({ category: 'PT4_FILTER', visibility: 'PESCE_ROSSO' });
    this.error.set(null);
  }

  protected submit(): void {
    const id = this.editingId();
    // In creazione il file è obbligatorio; in modifica è opzionale.
    if (this.form.invalid || this.saving() || (!id && !this.selectedFile())) {
      this.form.markAllAsTouched();
      if (!id && !this.selectedFile()) {
        this.error.set('Seleziona un file da caricare.');
      }
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);

    const payload = this.form.getRawValue();
    const file = this.selectedFile();
    const request$ = id
      ? this.docsApi.update(id, payload, file ?? undefined)
      : this.docsApi.create(payload, file!);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.set(id ? 'Materiale aggiornato.' : 'Materiale caricato.');
        this.cancelEdit();
        // Un materiale nuovo (più recente) appare in cima: torna a pagina 1.
        if (!id) this.currentPage.set(1);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected remove(doc: DocumentResource): void {
    if (!confirm(`Eliminare il materiale "${doc.title}"?`)) return;
    this.docsApi.remove(doc.id).subscribe({
      next: () => {
        this.feedback.set('Materiale eliminato.');
        if (this.editingId() === doc.id) this.cancelEdit();
        const p = this.page();
        if (p && p.items.length === 1 && p.page > 1) {
          this.currentPage.set(p.page - 1);
        }
        this.load();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }
}
