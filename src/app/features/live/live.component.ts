import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LiveSession } from '../../core/models/api.models';
import { LiveService } from '../../core/services/live.service';
import { apiErrorMessage } from '../../core/utils/http-error';

@Component({
  selector: 'app-live',
  imports: [DatePipe, RouterLink],
  templateUrl: './live.component.html',
  styleUrl: './live.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveComponent {
  private readonly liveApi = inject(LiveService);

  protected readonly sessions = signal<LiveSession[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.liveApi.getSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.sessions.update((cur) => cur ?? []);
        this.error.set(
          apiErrorMessage(err, 'Caricamento delle sessioni non riuscito.'),
        );
      },
    });
  }
}
