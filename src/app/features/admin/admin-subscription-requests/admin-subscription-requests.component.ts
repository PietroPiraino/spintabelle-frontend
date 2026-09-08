import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
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
import { FiltroComponent, VoceFiltro } from '../../../shared/ui/filtro/filtro.component';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';

const PAGE_SIZE = 25;
type StatusFilter = 'all' | SubscriptionRequestStatus;

/**
 * La coda delle richieste di abbonamento.
 *
 * ⚠️ Riscritta l'08/09/2026 da elenco di card a tabella + modale. La riga
 * portava OTTO campi — importi, buoni, punti, rimborsi, scadenza risultante,
 * motivo del rifiuto — e i due comandi della decisione in fondo a tutto: si
 * scorreva una colonna di paragrafi per trovare il numero da confrontare col
 * bonifico. Ora la tabella porta le cinque cose su cui si SCEGLIE quale riga
 * aprire, e la modale porta la decisione con il conto sotto gli occhi.
 *
 * ⚠️ Il rifiuto usava `window.prompt` per il motivo: un campo di sistema, non
 * stilizzabile, che su alcune configurazioni il browser sopprime del tutto —
 * e in quel caso la richiesta veniva rifiutata SENZA motivo senza che nessuno
 * lo notasse. Ora è un campo dentro la modale.
 */
@Component({
  selector: 'app-admin-subscription-requests',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    FiltroComponent,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './admin-subscription-requests.component.html',
  styleUrls: ['../admin-shared.scss', '../admin-table.scss', '../admin-modale.scss'],
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

  /** La riga aperta nella modale. */
  protected readonly apertaId = signal<string | null>(null);
  /**
   * ⚠️ La richiesta della modale si RILEGGE dalla pagina, non è una copia: dopo
   * un'azione `load()` sostituisce l'elenco, e una copia congelata mostrerebbe
   * lo stato di prima sotto il nome giusto. Se la riga sparisce dalla pagina
   * (cambio filtro, decisione presa), la modale si chiude da sé.
   */
  protected readonly aperta = computed(() => {
    const id = this.apertaId();
    if (!id) return null;
    return this.page()?.items.find((r) => r.id === id) ?? null;
  });
  protected readonly motivo = new FormControl('', { nonNullable: true });

  protected readonly statusFilter = signal<StatusFilter>('pending');
  protected readonly statuses: readonly VoceFiltro<StatusFilter>[] = [
    { valore: 'pending', etichetta: 'In attesa' },
    { valore: 'approved', etichetta: 'Approvate' },
    { valore: 'rejected', etichetta: 'Rifiutate' },
    { valore: 'all', etichetta: 'Tutte' },
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

  protected apri(req: SubscriptionRequest): void {
    this.apertaId.set(req.id);
    this.motivo.setValue('');
    this.error.set(null);
    this.feedback.set(null);
  }

  protected chiudi(): void {
    this.apertaId.set(null);
  }

  protected approve(req: SubscriptionRequest): void {
    if (this.actingId()) return;
    this.actingId.set(req.id);
    this.error.set(null);
    this.feedback.set(null);
    this.api.approve(req.id).subscribe({
      next: (updated) => {
        this.actingId.set(null);
        this.chiudi();
        this.feedback.set(
          `Abbonamento ${updated.tierLabel} attivato per ${updated.userEmail}.`,
        );
        this.load();
      },
      error: (err: unknown) => {
        this.actingId.set(null);
        // ⚠️ La modale resta APERTA: il messaggio va letto qui dentro, e un
        // toast dipingerebbe dietro il fondale del dialog.
        this.error.set(apiErrorMessage(err, 'Approvazione non riuscita.'));
      },
    });
  }

  protected reject(req: SubscriptionRequest): void {
    if (this.actingId()) return;
    this.actingId.set(req.id);
    this.error.set(null);
    this.feedback.set(null);
    const note = this.motivo.value.trim();
    this.api.reject(req.id, note || undefined).subscribe({
      next: (updated) => {
        this.actingId.set(null);
        this.chiudi();
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
    // ⚠️ Senza questo ramo una richiesta pagata in punti compariva come
    // «PayPal»: il default silenzioso e' il modo piu' rapido di mostrare una
    // cosa falsa senza che niente si rompa.
    if (m === 'punti') return 'Punti BFF';
    return 'PayPal';
  }

  protected fmtPunti(n: number): string {
    return new Intl.NumberFormat('it-IT').format(n);
  }

  /** Euro da incassare davvero (snapshot al netto di buoni e punti). */
  protected daIncassare(r: SubscriptionRequest): number | null {
    return r.discountedPriceEur ?? r.listPriceEur ?? null;
  }

  protected statusLabel(s: SubscriptionRequestStatus): string {
    if (s === 'pending') return 'In attesa';
    return s === 'approved' ? 'Approvata' : 'Rifiutata';
  }

  protected tierLabel(r: SubscriptionRequest): string {
    return r.tier === 'SQUALO' ? 'Squalo' : 'Pesce Rosso';
  }
}
