import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { Lesson } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LessonsService } from '../../core/services/lessons.service';
import { BunnyPlayerComponent } from '../../shared/ui/bunny-player/bunny-player.component';
import { SOCIAL_LINKS } from '../../core/social-links';

@Component({
  selector: 'app-lessons',
  imports: [BunnyPlayerComponent],
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
  protected readonly selectedTag = signal<string | null>(null);
  /** id della lezione con il player aperto (click-to-play) */
  protected readonly playingId = signal<string | null>(null);

  protected readonly filtered = computed<Lesson[]>(() => {
    const lessons = this.lessons();
    if (!lessons) return [];
    const term = this.searchTerm().trim().toLowerCase();
    const tag = this.selectedTag();
    return lessons.filter((lesson) => {
      if (tag && !lesson.tags.includes(tag)) return false;
      if (!term) return true;
      return (
        lesson.title.toLowerCase().includes(term) ||
        lesson.description.toLowerCase().includes(term) ||
        lesson.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  });

  protected toggleTag(tag: string): void {
    this.selectedTag.update((current) => (current === tag ? null : tag));
  }

  protected play(id: string): void {
    this.playingId.set(id);
  }

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
