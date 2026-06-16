import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  Paginated,
  SubscriptionRequest,
  SubscriptionRequestStatus,
} from '../../../core/models/api.models';
import { SubscriptionsService } from '../../../core/services/subscriptions.service';
import { apiErrorMessage } from '../../../core/utils/http-error';

const PAGE_SIZE = 25;
type StatusFilter = 'all' | SubscriptionRequestStatus;

@Component({
  selector: 'app-admin-subscription-requests',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './admin-subscription-requests.component.html',
  styleUrl: '../admin-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSubscriptionRequestsComponent {
  private readonly api = inject(SubscriptionsService);

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly query = signal('');

  protected readonly page = signal<Paginated<SubscriptionRequest> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);
  /** Id della richiesta su cui è in corso un'azione (approva/rifiuta). */
  protected readonly actingId = signal<string | null>(null);

  protected readonly statusFilter = signal<StatusFilter>('pending');
  protected readonly statuses: { key: StatusFilter; label: string }[] = [
    { key: 'pending', label: 'In attesa' },
    { key: 'approved', label: 'Approvate' },
    { key: 'rejected', label: 'Rifiutate' },
    { key: 'all', label: 'Tutte' },
  ];
  private readonly currentPage = signal(1);

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.query.set(q.trim());
        this.currentPage.set(1);
        this.load();
      });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const status = this.statusFilter();
    this.api
      .listRequests({
        status: status === 'all' ? undefined : status,
        q: this.query() || undefined,
        page: this.currentPage(),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (page) => {
          this.page.set(page);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.currentPage.set(this.page()?.page ?? 1);
          this.error.set(
            apiErrorMessage(err, 'Caricamento richieste non riuscito.'),
          );
        },
      });
  }

  protected setStatus(s: StatusFilter): void {
    if (this.statusFilter() === s) return;
    this.statusFilter.set(s);
    this.currentPage.set(1);
    // niente messaggi stantii dopo un cambio di filtro
    this.feedback.set(null);
    this.error.set(null);
    this.load();
  }

  protected goToPage(n: number): void {
    const total = this.page()?.totalPages ?? 1;
    if (n < 1 || n > total || n === this.currentPage()) return;
    this.currentPage.set(n);
    this.load();
  }

  protected approve(req: SubscriptionRequest): void {
    if (this.actingId()) return;
    this.actingId.set(req.id);
    this.error.set(null);
    this.feedback.set(null);
    this.api.approve(req.id).subscribe({
      next: (updated) => {
        this.actingId.set(null);
        this.feedback.set(
          `Abbonamento ${updated.tierLabel} attivato per ${updated.userEmail}.`,
        );
        this.load();
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.error.set(apiErrorMessage(err, 'Approvazione non riuscita.'));
      },
    });
  }

  protected reject(req: SubscriptionRequest): void {
    if (this.actingId()) return;
    const note = window.prompt(
      'Motivo del rifiuto (opzionale). Premi Annulla per non rifiutare.',
    );
    if (note === null) return; // annullato
    this.actingId.set(req.id);
    this.error.set(null);
    this.feedback.set(null);
    this.api.reject(req.id, note.trim() || undefined).subscribe({
      next: (updated) => {
        this.actingId.set(null);
        this.feedback.set(`Richiesta di ${updated.userEmail} rifiutata.`);
        this.load();
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        this.error.set(apiErrorMessage(err, 'Rifiuto non riuscito.'));
      },
    });
  }

  protected methodLabel(m: string): string {
    if (m === 'skrill') return 'Skrill';
    if (m === 'manuale') return 'Concesso da admin';
    return 'PayPal';
  }

  protected statusLabel(s: SubscriptionRequestStatus): string {
    if (s === 'pending') return 'In attesa';
    return s === 'approved' ? 'Approvata' : 'Rifiutata';
  }
}
