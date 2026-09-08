import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  DocumentCategory,
  DocumentResource,
  DocumentVisibility,
  Paginated,
} from '../../../core/models/api.models';
import { DocumentsService } from '../../../core/services/documents.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';

/** Materiali per pagina nel pannello (pager classico, come iscritti/lezioni). */
const PAGE_SIZE = 25;

/** Tetto upload lato client: coincide col cap backend (DOCUMENTS_MAX_FILE_MB). */
const MAX_MB = 50;

/**
 * Le estensioni ammesse, in UN posto solo.
 *
 * ⚠️ Era una frase scritta a mano nel template («Ammessi: pdf, xls(x), …»),
 * cioè una copia dell'allowlist del server aggiornata a memoria: aggiungendo un
 * formato al backend, l'amministratore continuava a leggere che non era
 * ammesso. Ora la stessa tupla scrive sia l'`accept` dell'input sia la riga di
 * aiuto — e l'input file non aveva NESSUN `accept`, unico dei tre upload del
 * pannello (logo sala e immagine gadget ce l'hanno).
 *
 * ⚠️ Resta una copia di quella del backend, e non può non esserlo: il client
 * non la può chiedere. La differenza è che ora è una sola, ed è dichiarata.
 */
const ESTENSIONI = [
  'pdf',
  'xls',
  'xlsx',
  'csv',
  'doc',
  'docx',
  'xml',
  'txt',
  'zip',
  'rtf',
  'ppt',
  'pptx',
  'html',
  'htm',
] as const;

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
  imports: [ReactiveFormsModule, DatePipe, IconComponent, ModalComponent],
  templateUrl: './admin-documents.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDocumentsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly docsApi = inject(DocumentsService);

  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly maxMb = MAX_MB;
  /** Per l'attributo `accept` dell'input file. */
  protected readonly accept = ESTENSIONI.map((e) => `.${e}`).join(',');
  /** Per la riga di aiuto sotto il campo. */
  protected readonly estensioni = ESTENSIONI.join(', ');


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

  /**
   * ⚠️ `sporco` per la modale si costruisce da `toSignal(valueChanges)` e MAI
   * da un `computed` che legge `form.value`: un FormGroup non è un signal,
   * quindi quel computed non si ricalcola mai e resterebbe `false` per sempre —
   * cioè Escape butterebbe via il digitato, il difetto che l'input previene.
   * Il file scelto conta come sporco: è la parte del form che costa di più
   * rifare.
   */
  private readonly baseline = signal('');
  private readonly valori = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue() as Record<string, unknown>,
  });
  protected readonly sporco = computed(
    () =>
      JSON.stringify(this.valori()) !== this.baseline() ||
      this.selectedFile() !== null,
  );

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

  /** La modale è aperta: `null` = chiusa, `''` = creazione, id = modifica. */
  protected readonly aperto = signal<string | null>(null);

  /**
   * Il documento in modifica, RILETTO dalla pagina.
   *
   * ⚠️ Non una copia: dopo un salvataggio `load()` sostituisce l'elenco, e una
   * copia congelata mostrerebbe i dati di prima sotto il titolo nuovo.
   */
  protected readonly apertoDoc = computed(() => {
    const id = this.editingId();
    if (!id) return null;
    return this.page()?.items.find((d) => d.id === id) ?? null;
  });

  protected creaNuovo(): void {
    this.editingId.set(null);
    this.selectedFile.set(null);
    this.form.reset({ category: 'PT4_FILTER', visibility: 'PESCE_ROSSO' });
    this.error.set(null);
    this.feedback.set(null);
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
    this.aperto.set('');
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
    // ⚠️ La baseline si scrive DOPO il patch, o la modale nasce già sporca e
    // il primo Escape chiede conferma senza che nessuno abbia digitato nulla.
    this.baseline.set(JSON.stringify(this.form.getRawValue()));
    this.aperto.set(doc.id);
  }

  protected cancelEdit(): void {
    this.aperto.set(null);
    this.confermaElimina.set(false);
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
        // ⚠️ Prima si chiude la modale e poi si scrive il messaggio: la banda
        // di successo vive nella PAGINA, e scriverla mentre il dialog è ancora
        // aperto la metterebbe dietro il fondale.
        this.cancelEdit();
        this.feedback.set(id ? 'Materiale aggiornato.' : 'Materiale caricato.');
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

  /**
   * La cancellazione è armata (conferma in linea).
   *
   * ⚠️ Sostituisce un `confirm()` nativo. Quello è un riquadro di sistema: non
   * si stila, non si legge nel contesto della modale, e su alcune
   * configurazioni il browser lo sopprime — nel qual caso il ramo «annulla» non
   * è mai raggiungibile e il materiale sparisce al primo clic.
   */
  protected readonly confermaElimina = signal(false);

  protected armaElimina(): void {
    this.confermaElimina.set(true);
  }

  protected remove(doc: DocumentResource): void {
    this.confermaElimina.set(false);
    this.saving.set(true);
    this.docsApi.remove(doc.id).subscribe({
      next: () => {
        this.saving.set(false);
        if (this.editingId() === doc.id) this.cancelEdit();
        this.feedback.set('Materiale eliminato.');
        const p = this.page();
        if (p && p.items.length === 1 && p.page > 1) {
          this.currentPage.set(p.page - 1);
        }
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.'));
      },
    });
  }
}
