import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminHandsService,
  HandReportRow,
} from '../../../core/services/admin-hands.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  FiltroComponent,
  VoceFiltro,
} from '../../../shared/ui/filtro/filtro.component';

/**
 * `/admin/replayer` — la coda delle segnalazioni sulle mani.
 *
 * ⚠️ **È la metà che rende REALE la via di rimozione.** Il comando «Segnala
 * questa mano» sulla pagina pubblica raccoglie; senza qualcuno che legga questa
 * coda, l'art. 17 sarebbe **dichiarato** invece che esercitabile — e chi
 * segnala, nel caso che conta, è un terzo che non è nostro iscritto e non
 * saprebbe mai che nessuno ha guardato.
 *
 * ⚠️ **Tre azioni, tre significati diversi, e non vanno confusi:**
 * - **Togli i nomi** — sostituisce i nickname con le posizioni. È la risposta
 *   all'art. 17 che *non* distrugge la mano: il terzo esce dal documento, chi
 *   studia continua a vederla. **Irreversibile.**
 * - **Rimuovi** — toglie la mano dal pubblico (404), ma la riga resta e il
 *   nickname pure. Serve quando il problema è la mano, non il nome.
 * - **Ripristina** — per la segnalazione infondata.
 *
 * Chi chiede la cancellazione dei propri dati va servito con la **prima**:
 * rimuovere la pagina e lasciare il nome nel documento non è una cancellazione.
 */
@Component({
  selector: 'app-admin-replayer',
  imports: [FormsModule, RouterLink, FiltroComponent],
  templateUrl: './admin-replayer.component.html',
  styleUrl: './admin-replayer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReplayerComponent {
  private readonly api = inject(AdminHandsService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<HandReportRow[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly stato = signal<'APERTA' | 'TUTTE'>('APERTA');

  /** Le due voci del filtro, per `app-filtro`. */
  protected readonly vociFiltro: readonly VoceFiltro<'APERTA' | 'TUTTE'>[] = [
    { valore: 'APERTA', etichetta: 'Aperte' },
    { valore: 'TUTTE', etichetta: 'Tutte' },
  ];
  protected readonly caricando = signal(false);
  protected readonly errore = signal<string | null>(null);

  /** Il pannello aperto e il motivo che si sta scrivendo. */
  protected readonly aperto = signal<string | null>(null);
  protected motivo = '';

  constructor() {
    this.carica(1);
  }

  protected carica(p: number): void {
    this.caricando.set(true);
    this.errore.set(null);
    this.api.reports(p, this.stato()).subscribe({
      next: (r) => {
        this.items.set(r.items);
        this.total.set(r.total);
        this.page.set(r.page);
        this.totalPages.set(r.totalPages);
        this.caricando.set(false);
      },
      error: () => {
        this.errore.set('Non siamo riusciti a caricare la coda. Riprova.');
        this.caricando.set(false);
      },
    });
  }

  protected cambiaFiltro(v: 'APERTA' | 'TUTTE'): void {
    this.stato.set(v);
    this.carica(1);
  }

  protected apri(id: string): void {
    this.aperto.update((c) => (c === id ? null : id));
    this.motivo = '';
  }

  /** ⚠️ Il motivo è obbligatorio: il server risponde 400 senza, e fa bene. */
  private conMotivo(fn: (m: string) => void): void {
    const m = this.motivo.trim();
    if (m.length < 3) {
      this.toast.error('Scrivi il motivo della decisione: resta agli atti.');
      return;
    }
    fn(m);
  }

  protected rimuovi(r: HandReportRow): void {
    this.conMotivo((m) =>
      this.api.rimuovi(r.handId, m).subscribe({
        next: () => this.fatto('Mano rimossa dal pubblico.'),
        error: () => this.toast.error('Operazione non riuscita.'),
      }),
    );
  }

  protected ripristina(r: HandReportRow): void {
    this.conMotivo((m) =>
      this.api.ripristina(r.handId, m).subscribe({
        next: () => this.fatto('Mano ripristinata.'),
        error: () => this.toast.error('Operazione non riuscita.'),
      }),
    );
  }

  /** ⚠️ Irreversibile — il testo originale non si conserva. */
  protected anonimizza(r: HandReportRow): void {
    this.api.anonimizza(r.handId).subscribe({
      next: () => this.fatto('Nomi sostituiti con le posizioni al tavolo.'),
      error: () => this.toast.error('Operazione non riuscita.'),
    });
  }

  protected accogli(r: HandReportRow): void {
    this.conMotivo((m) =>
      this.api.accogli(r.id, m).subscribe({
        next: () => this.fatto('Segnalazione accolta e chiusa.'),
        error: () => this.toast.error('Operazione non riuscita.'),
      }),
    );
  }

  protected respingi(r: HandReportRow): void {
    this.conMotivo((m) =>
      this.api.respingi(r.id, m).subscribe({
        next: () => this.fatto('Segnalazione respinta e chiusa.'),
        error: () => this.toast.error('Operazione non riuscita.'),
      }),
    );
  }

  private fatto(msg: string): void {
    this.toast.success(msg);
    this.aperto.set(null);
    this.motivo = '';
    this.carica(this.page());
  }

  protected etichettaMotivo(m: string): string {
    switch (m) {
      case 'DATI_PERSONALI':
        return 'Compare nella mano e vuole essere rimosso';
      case 'CONTENUTO_ILLECITO':
        return 'Contenuto illecito o offensivo';
      case 'NON_MIA':
        return 'La mano non è di chi l’ha caricata';
      case 'FORMATO':
        return 'Campione di un formato non supportato';
      default:
        return 'Altro';
    }
  }

  protected data(iso: string): string {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  }
}
