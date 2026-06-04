import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { News } from '../../../core/models/api.models';
import { NewsService } from '../../../core/services/news.service';
import { NewsCardComponent } from '../../../shared/ui/news-card/news-card.component';

@Component({
  selector: 'app-news-list',
  imports: [NewsCardComponent],
  templateUrl: './news-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsListComponent {
  private readonly newsApi = inject(NewsService);

  protected readonly items = signal<News[] | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);

  private page = 1;
  private readonly pageSize = 9;

  constructor() {
    this.load();
  }

  protected loadMore(): void {
    if (this.loadingMore()) return;
    this.page += 1;
    this.load();
  }

  private load(): void {
    this.loadingMore.set(true);
    this.newsApi.getNews(this.page, this.pageSize).subscribe({
      next: (res) => {
        this.items.update((current) => [...(current ?? []), ...res.items]);
        this.hasMore.set(res.page < res.totalPages);
        this.loadingMore.set(false);
      },
      error: () => {
        this.items.update((current) => current ?? []);
        this.loadingMore.set(false);
      },
    });
  }
}
