import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { stripMarkdown } from '../../../core/utils/strip-markdown';

@Component({
  selector: 'app-news-card',
  imports: [RouterLink, DatePipe],
  template: `
    <article class="card card--hover news-card">
      @if (news().coverImageUrl; as cover) {
        <img class="news-card__cover" [src]="cover" alt="" loading="lazy" />
      }
      <div class="news-card__body">
        <time class="news-card__date" [attr.datetime]="news().createdAt">
          {{ news().createdAt | date: 'dd MMMM yyyy' }}
        </time>
        <h3 class="news-card__title">
          <a [routerLink]="['/news', news()._id]">{{ news().title }}</a>
        </h3>
        <p class="news-card__excerpt">{{ excerpt() }}</p>
        <a [routerLink]="['/news', news()._id]" class="btn btn--link">Leggi tutto →</a>
      </div>
    </article>
  `,
  styles: `
    .news-card {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      height: 100%;
    }

    .news-card__cover {
      width: 100%;
      aspect-ratio: 21 / 9;
      object-fit: cover;
      border-bottom: 1px solid var(--line);
    }

    .news-card__body {
      display: flex;
      flex-direction: column;
      gap: 0.55rem;
      padding: 1.3rem 1.4rem 1.4rem;
      flex: 1;
    }

    .news-card__date {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--copper-400);
    }

    .news-card__title {
      font-size: 1.2rem;

      a {
        color: var(--cream-100);

        &:hover {
          color: var(--ember);
        }
      }
    }

    .news-card__excerpt {
      font-size: 0.93rem;
      color: var(--text-muted);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .btn--link {
      margin-top: auto;
      align-self: flex-start;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsCardComponent {
  readonly news = input.required<News>();

  /** Anteprima in chiaro: niente sintassi markdown nel testo della card. */
  protected readonly excerpt = computed(() => stripMarkdown(this.news().body));
}
