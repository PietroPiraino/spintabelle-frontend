import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { Lesson, LessonVisibility } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LessonsService } from '../../core/services/lessons.service';
import { BunnyPlayerComponent } from '../../shared/ui/bunny-player/bunny-player.component';
import { SOCIAL_LINKS } from '../../core/social-links';

/** Filtro per livello: tutte, solo Base (USER) o solo Premium (SUBSCRIBER). */
type VisibilityFilter = 'all' | LessonVisibility;

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

  protected readonly lessons = toSignal(
    this.lessonsApi.getLessons().pipe(catchError(() => of(null))),
  );
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

  protected readonly filtered = computed<Lesson[]>(() => {
    const lessons = this.lessons();
    if (!lessons) return [];
    const term = this.searchTerm().trim().toLowerCase();
    const tags = this.selectedTags();
    const vis = this.visibilityFilter();
    // L'ordine arriva già dal backend (data video desc): il filtro lo preserva.
    return lessons.filter((lesson) => {
      if (vis !== 'all' && lesson.visibility !== vis) return false;
      if (tags.length > 0 && !tags.every((t) => lesson.tags.includes(t))) {
        return false;
      }
      if (!term) return true;
      return (
        lesson.title.toLowerCase().includes(term) ||
        lesson.description.toLowerCase().includes(term) ||
        lesson.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  });

  /** True quando c'è almeno un filtro attivo (ricerca, tag o livello). */
  protected readonly hasFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.selectedTags().length > 0 ||
      this.visibilityFilter() !== 'all',
  );

  protected toggleTag(tag: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  }

  protected setVisibility(filter: VisibilityFilter): void {
    this.visibilityFilter.set(filter);
  }

  protected resetFilters(): void {
    this.searchTerm.set('');
    this.selectedTags.set([]);
    this.visibilityFilter.set('all');
  }

  protected play(id: string): void {
    this.playingId.set(id);
  }

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
