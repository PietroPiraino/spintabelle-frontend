import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import {
  DocumentCategory,
  DocumentResource,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { DocumentsService } from '../../core/services/documents.service';
import { apiErrorMessage } from '../../core/utils/http-error';

/** Filtro categoria: tutte o una specifica. */
type CategoryFilter = 'all' | DocumentCategory;

/** Materiali per pagina: griglia a 2 colonne → 12 righe per batch. */
const PAGE_SIZE = 24;

/** Etichette IT per categoria (l'enum è tecnico). */
const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  PT4_FILTER: 'Filtri PT4',
  PT4_REPORT: 'Report PT4',
  PDF: 'PDF',
  EXCEL: 'Excel',
  WORD: 'Word',
  ALTRO: 'Altro',
};

@Component({
  selector: 'app-docs',
  imports: [DatePipe, RouterLink],
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsComponent {
  private readonly docsApi = inject(DocumentsService);
  protected readonly auth = inject(AuthService);

  protected readonly pageSize = PAGE_SIZE;
  protected readonly categories: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'PT4_FILTER', label: CATEGORY_LABELS.PT4_FILTER },
    { key: 'PT4_REPORT', label: CATEGORY_LABELS.PT4_REPORT },
    { key: 'PDF', label: CATEGORY_LABELS.PDF },
    { key: 'EXCEL', label: CATEGORY_LABELS.EXCEL },
    { key: 'WORD', label: CATEGORY_LABELS.WORD },
    { key: 'ALTRO', label: CATEGORY_LABELS.ALTRO },
  ];

  /** Materiali accumulati ("carica altri"); null = primo caricamento in corso. */
  protected readonly docs = signal<DocumentResource[] | null>(null);
  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  /** Errore dell'ultima richiesta lista: mai mascherato da "nessun materiale". */
  protected readonly error = signal<string | null>(null);
  /** id del documento il cui link è in preparazione (spinner sul bottone). */
  protected readonly downloadingId = signal<string | null>(null);
  protected readonly downloadError = signal<string | null>(null);

  protected readonly searchTerm = signal('');
  protected readonly categoryFilter = signal<CategoryFilter>('all');

  private page = 1;
  /** Scarta le risposte superate da un cambio filtro più recente. */
  private requestSeq = 0;
  private readonly search$ = new Subject<string>();

  protected readonly hasFilters = computed(
    () => this.searchTerm().trim().length > 0 || this.categoryFilter() !== 'all',
  );

  constructor() {
    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((term) => {
        if (term === this.searchTerm()) return;
        this.searchTerm.set(term);
        this.reload();
      });
    this.load();
  }

  protected categoryLabel(cat: DocumentCategory): string {
    return CATEGORY_LABELS[cat];
  }

  /** Glifo per categoria, mostrato sulla card. */
  protected icon(cat: DocumentCategory): string {
    switch (cat) {
      case 'PT4_FILTER':
      case 'PT4_REPORT':
        return '📊';
      case 'PDF':
        return '📄';
      case 'EXCEL':
        return '📈';
      case 'WORD':
        return '📝';
      default:
        return '📁';
    }
  }

  /** Dimensione leggibile (B/KB/MB, virgola decimale italiana). */
  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }

  private reload(): void {
    this.page = 1;
    this.load();
  }

  private load(append = false): void {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    const term = this.searchTerm().trim();
    const cat = this.categoryFilter();
    this.docsApi
      .list({
        page: this.page,
        limit: PAGE_SIZE,
        q: term || undefined,
        category: cat === 'all' ? undefined : cat,
      })
      .subscribe({
        next: (res) => {
          if (seq !== this.requestSeq) return;
          this.docs.update((cur) =>
            append
              ? [
                  ...(cur ?? []),
                  // dedup: una pubblicazione concorrente sposta l'offset e
                  // ripresenterebbe l'ultimo item della pagina precedente
                  ...res.items.filter(
                    (it) => !(cur ?? []).some((c) => c.id === it.id),
                  ),
                ]
              : res.items,
          );
          this.total.set(res.total);
          this.hasMore.set(res.page < res.totalPages);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err: unknown) => {
          if (seq !== this.requestSeq) return;
          if (append) this.page -= 1;
          this.docs.update((cur) => cur ?? []);
          this.error.set(
            apiErrorMessage(err, 'Caricamento dei materiali non riuscito.'),
          );
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  protected retry(): void {
    this.reload();
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.page += 1;
    this.load(true);
  }

  protected setCategory(cat: CategoryFilter): void {
    if (this.categoryFilter() === cat) return;
    this.categoryFilter.set(cat);
    this.reload();
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.search$.next('');
    this.categoryFilter.set('all');
    this.reload();
  }

  protected onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }

  /**
   * Scarica: ottiene via XHR (Bearer attaccato dall'interceptor) il link CDN
   * firmato — 403 se non sblocchi il documento — poi naviga per avviare il
   * download. Il link viaggia in query, quindi la navigazione non richiede auth.
   */
  protected download(doc: DocumentResource): void {
    if (doc.locked || this.downloadingId()) return;
    this.downloadingId.set(doc.id);
    this.downloadError.set(null);
    this.docsApi.downloadUrl(doc.id).subscribe({
      next: ({ url }) => {
        this.downloadingId.set(null);
        this.triggerDownload(url);
      },
      error: (err: unknown) => {
        this.downloadingId.set(null);
        this.downloadError.set(apiErrorMessage(err, 'Download non riuscito.'));
      },
    });
  }

  private triggerDownload(url: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}
