import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of } from 'rxjs';
import { Lesson, LessonVisibility } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LessonsService } from '../../core/services/lessons.service';
import { apiErrorMessage } from '../../core/utils/http-error';
import { BunnyPlayerComponent } from '../../shared/ui/bunny-player/bunny-player.component';
import { SOCIAL_LINKS } from '../../core/social-links';

/** Filtro per livello: tutte, solo Base (USER) o solo Premium (SUBSCRIBER). */
type VisibilityFilter = 'all' | LessonVisibility;

/** Lezioni per pagina: la griglia è a 2 colonne → 12 righe per batch. */
const PAGE_SIZE = 24;

@Component({
  selector: 'app-lessons',
  imports: [BunnyPlayerComponent, DatePipe],
  templateUrl: './lessons.component.html',
  styleUrl: './lessons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonsComponent {
  private readonly lessonsApi = inject(LessonsService);
  protected readonly auth = inject(AuthService);

  protected readonly social = SOCIAL_LINKS;
  protected readonly pageSize = PAGE_SIZE;

  /** Lezioni accumulate ("carica altre"); null = primo caricamento in corso. */
  protected readonly lessons = signal<Lesson[] | null>(null);
  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  /** Una richiesta lista è in volo (primo load, cambio filtro o carica-altre). */
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  /** Errore dell'ultima richiesta lista: mai mascherato da "nessuna lezione". */
  protected readonly error = signal<string | null>(null);

  protected readonly tags = toSignal(
    this.lessonsApi.getTags().pipe(catchError(() => of([] as string[]))),
    { initialValue: [] as string[] },
  );

  protected readonly searchTerm = signal('');
  /** tag selezionati: una lezione passa solo se li contiene TUTTI (logica AND) */
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly visibilityFilter = signal<VisibilityFilter>('all');
  /** id della lezione con il player aperto (click-to-play) */
  protected readonly playingId = signal<string | null>(null);

  private page = 1;
  /** Scarta le risposte superate da un cambio filtro più recente. */
  private requestSeq = 0;
  private readonly search$ = new Subject<string>();

  /** True quando c'è almeno un filtro attivo (ricerca, tag o livello). */
  protected readonly hasFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.selectedTags().length > 0 ||
      this.visibilityFilter() !== 'all',
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

  /**
   * Ricarica da pagina 1 (i filtri sono applicati dal backend). La lista
   * corrente resta visibile finché non arriva la risposta (niente flash).
   */
  private reload(): void {
    this.page = 1;
    this.load();
  }

  private load(append = false): void {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    const term = this.searchTerm().trim();
    const tags = this.selectedTags();
    const vis = this.visibilityFilter();
    this.lessonsApi
      .getLessons({
        page: this.page,
        limit: PAGE_SIZE,
        q: term || undefined,
        tags: tags.length > 0 ? tags : undefined,
        visibility: vis === 'all' ? undefined : vis,
      })
      .subscribe({
        next: (res) => {
          if (seq !== this.requestSeq) return;
          this.lessons.update((cur) =>
            append
              ? [
                  ...(cur ?? []),
                  // dedup: una pubblicazione concorrente sposta la finestra
                  // di offset e ripresenterebbe l'ultimo item della pagina prima
                  ...res.items.filter(
                    (item) => !(cur ?? []).some((c) => c.id === item.id),
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
          // il retry di "carica altre" deve richiedere la STESSA pagina
          if (append) this.page -= 1;
          this.lessons.update((cur) => cur ?? []);
          this.error.set(
            apiErrorMessage(err, 'Caricamento delle lezioni non riuscito.'),
          );
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  /** Riprova dopo un errore, ripartendo dalla prima pagina dei filtri attuali. */
  protected retry(): void {
    this.reload();
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.page += 1;
    this.load(true);
  }

  protected toggleTag(tag: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
    this.reload();
  }

  protected setVisibility(filter: VisibilityFilter): void {
    if (this.visibilityFilter() === filter) return;
    this.visibilityFilter.set(filter);
    this.reload();
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    // soppianta un'eventuale emissione debounce in volo (la ricerca azzerata
    // non deve "risorgere" 300ms dopo); la guardia '' === '' evita il doppio reload
    this.search$.next('');
    this.selectedTags.set([]);
    this.visibilityFilter.set('all');
    this.reload();
  }

  protected play(id: string): void {
    this.playingId.set(id);
  }

  /** Nasconde la copertina se non carica (video senza thumbnail) → resta il gradiente. */
  protected onThumbError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }

  protected onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }
}
