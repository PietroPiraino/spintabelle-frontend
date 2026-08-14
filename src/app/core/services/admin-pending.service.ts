import { Injectable, inject, signal } from '@angular/core';
import { AffiliationsService } from './affiliations.service';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Conteggi "in attesa di una decisione" per la dashboard admin: richieste di
 * abbonamento pending e affiliazioni in verifica. Alimenta i badge della
 * sidebar e le card della Panoramica.
 *
 * Best-effort come il badge del tab affiliazioni: ogni chiamata degrada a
 * `null` (badge nascosto / "—") senza banner d'errore — il conteggio è un
 * accessorio e non deve rubare la banda errore delle liste.
 *
 * Le richieste non hanno un endpoint di conteggio: si riusa la lista con
 * `limit: 1` e si legge `Paginated.total` dall'envelope.
 */
@Injectable({ providedIn: 'root' })
export class AdminPendingService {
  private readonly affiliationsApi = inject(AffiliationsService);
  private readonly subscriptionsApi = inject(SubscriptionsService);

  readonly richieste = signal<number | null>(null);
  readonly affiliazioni = signal<number | null>(null);

  /** Istante dell'ultimo refresh non forzato partito davvero. */
  private lastRefresh = 0;

  /**
   * Min-interval fra due refresh non forzati: la shell chiama `refresh()` a
   * ogni cambio di sezione, senza questo freno ogni click farebbe due chiamate.
   * Il prezzo è un badge che può restare ~30s stale dopo un'approvazione.
   */
  private static readonly MIN_INTERVAL_MS = 30_000;

  refresh(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastRefresh < AdminPendingService.MIN_INTERVAL_MS) {
      return;
    }
    this.lastRefresh = now;

    this.subscriptionsApi
      .listRequests({ status: 'pending', page: 1, limit: 1 })
      .subscribe({
        next: (page) => this.richieste.set(page.total),
        error: () => this.richieste.set(null),
      });
    this.affiliationsApi.pendingCount().subscribe({
      next: (res) => this.affiliazioni.set(res.inVerifica),
      error: () => this.affiliazioni.set(null),
    });
  }
}
