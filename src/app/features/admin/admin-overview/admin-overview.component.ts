import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AdminActionLogEntry,
  AdminStatsView,
} from '../../../core/models/api.models';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import { AdminStatsService } from '../../../core/services/admin-stats.service';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { actionLabel } from '../action-labels';
import { roleLabel } from '../role-labels';

const NF = new Intl.NumberFormat('it-IT');
const EUR = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
/** Il segno È il senso della variazione: "+12,5%" dice più di "12,5%". */
const DELTA = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/**
 * Panoramica: la home della dashboard admin.
 *
 * TRE fonti dati indipendenti, ognuna con loading/errore propri — un guasto di
 * una non spegne le altre (stesso patto della sezione Statistiche):
 *  1. `GET /admin/stats` (già cachato lato server ~5 min) per i numeri chiave;
 *  2. il log admin (prime voci) per la striscia "Ultime azioni";
 *  3. `AdminPendingService` per le card "in attesa" (gli stessi conteggi dei
 *     badge in sidebar — refresh forzato entrando qui).
 *
 * ⚠️ Niente `/admin/stats/video` qui: dietro c'è una chiamata di rete a Bunny,
 * resta nella sezione Statistiche col suo pannello che fallisce da solo.
 */
@Component({
  selector: 'app-admin-overview',
  imports: [DatePipe, RouterLink, IconComponent],
  templateUrl: './admin-overview.component.html',
  styleUrl: './admin-overview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {
  private readonly statsApi = inject(AdminStatsService);
  private readonly usersApi = inject(AdminUsersService);
  protected readonly pending = inject(AdminPendingService);

  protected readonly stats = signal<AdminStatsView | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal<string | null>(null);

  protected readonly actions = signal<AdminActionLogEntry[] | null>(null);
  protected readonly actionsLoading = signal(false);
  protected readonly actionsError = signal<string | null>(null);

  protected readonly actionLabel = actionLabel;

  constructor() {
    this.loadStats();
    this.loadActions();
    // NON forzato: al primo ingresso la shell li ha appena chiesti e il
    // min-interval assorbe il doppione (2 chiamate, non 4); tornando qui da
    // un'altra sezione il service decide da solo se sono da rinfrescare.
    this.pending.refresh();
  }

  protected loadStats(): void {
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.statsApi.overview().subscribe({
      next: (view) => {
        this.stats.set(view);
        this.statsLoading.set(false);
      },
      error: (err: unknown) => {
        this.statsLoading.set(false);
        this.statsError.set(
          apiErrorMessage(err, 'Caricamento statistiche non riuscito.'),
        );
      },
    });
  }

  protected loadActions(): void {
    this.actionsLoading.set(true);
    this.actionsError.set(null);
    this.usersApi.auditAll(1, 8).subscribe({
      next: (page) => {
        this.actions.set(page.items);
        this.actionsLoading.set(false);
      },
      error: (err: unknown) => {
        this.actionsLoading.set(false);
        this.actionsError.set(
          apiErrorMessage(err, 'Caricamento log non riuscito.'),
        );
      },
    });
  }

  protected int(v: number): string {
    return NF.format(v);
  }

  protected euro(v: number): string {
    return EUR.format(v);
  }

  /** ⚠️ `deltaPct` è in punti percentuali (12.5 = +12,5%), non una frazione. */
  protected delta(v: number): string {
    return `${DELTA.format(v)}%`;
  }

  /** Etichette tier dalla mappa unica condivisa (vedi `role-labels.ts`). */
  protected readonly roleLabel = roleLabel;
}
