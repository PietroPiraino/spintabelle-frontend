import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { News } from '../../../core/models/api.models';
import { NewsService } from '../../../core/services/news.service';
import { MarkdownComponent } from '../../../shared/ui/markdown/markdown.component';

@Component({
  selector: 'app-news-detail',
  imports: [RouterLink, DatePipe, MarkdownComponent],
  templateUrl: './news-detail.component.html',
  styleUrl: './news-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsDetailComponent {
  private readonly newsApi = inject(NewsService);
  private readonly titleService = inject(Title);

  /** Param della rotta news/:id (component input binding) */
  readonly id = input.required<string>();

  protected readonly news = signal<News | null>(null);
  protected readonly notFound = signal(false);

  constructor() {
    effect(() => {
      const id = this.id();
      this.news.set(null);
      this.notFound.set(false);
      this.newsApi.getById(id).subscribe({
        next: (news) => {
          this.news.set(news);
          this.titleService.setTitle(`${news.title} — Best Fish Forever`);
        },
        error: () => this.notFound.set(true),
      });
    });
  }
}
