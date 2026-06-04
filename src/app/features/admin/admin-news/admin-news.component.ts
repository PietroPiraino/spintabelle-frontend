import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { News } from '../../../core/models/api.models';
import { NewsService } from '../../../core/services/news.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

@Component({
  selector: 'app-admin-news',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './admin-news.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNewsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly newsApi = inject(NewsService);

  protected readonly items = signal<News[] | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    body: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20000)]],
    coverImageUrl: [''],
  });

  constructor() {
    this.reload();
  }

  private reload(): void {
    this.newsApi.getNews(1, 50).subscribe({
      next: (res) => this.items.set(res.items),
      error: () => this.items.set([]),
    });
  }

  protected edit(news: News): void {
    this.editingId.set(news._id);
    this.feedback.set(null);
    this.error.set(null);
    this.form.patchValue({
      title: news.title,
      body: news.body,
      coverImageUrl: news.coverImageUrl ?? '',
    });
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset();
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

    const { title, body, coverImageUrl } = this.form.getRawValue();
    const payload = {
      title,
      body,
      // campo opzionale: non inviarlo vuoto (forbidNonWhitelisted lato API è ok,
      // ma un URL vuoto fallirebbe la validazione IsUrl)
      ...(coverImageUrl.trim() ? { coverImageUrl: coverImageUrl.trim() } : {}),
    };

    const id = this.editingId();
    const request$ = id
      ? this.newsApi.update(id, payload)
      : this.newsApi.create(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.set(id ? 'News aggiornata.' : 'News pubblicata.');
        this.cancelEdit();
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  protected remove(news: News): void {
    if (!confirm(`Eliminare la news "${news.title}"?`)) return;
    this.newsApi.remove(news._id).subscribe({
      next: () => {
        this.feedback.set('News eliminata.');
        if (this.editingId() === news._id) this.cancelEdit();
        this.reload();
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Eliminazione non riuscita.')),
    });
  }
}
