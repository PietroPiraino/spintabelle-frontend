import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { StatoCanale } from '../../../core/models/api.models';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import { CanaleService } from '../../../core/services/canale.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';

/**
 * «Canale» — decide quale video del canale YouTube compare in home.
 *
 * ⚠️⚠️ **QUESTA SCHERMATA È UN PRESIDIO, NON UN PANNELLO DI COMODO.** La home è
 * pubblica e indicizzabile, e l'art. 9 DL 87/2018 vieta la pubblicità di gioco:
 * il titolo lo filtra una lista di termini, ma **la miniatura no** — nessun
 * controllo automatico legge un logo dentro un JPEG, e sul canale della scuola
 * è già esistito un video con il marchio di una sala stampato sopra.
 *
 * Da qui la regola di disegno: **la copertina si mostra GRANDE**. Mostrarla
 * piccola trasformerebbe l'approvazione in un clic automatico, e la garanzia
 * svanirebbe senza che nulla si rompa a vista.
 *
 * ⚠️ E la copertina che si vede qui è quella **ri-ospitata sui nostri server**,
 * mai `i.ytimg.com`: `/admin` è `noindex`, ma resta una nostra pagina, e
 * l'affermazione del registro riguarda i visitatori — l'owner compreso.
 */
@Component({
  selector: 'app-admin-canale',
  imports: [DatePipe, IconComponent],
  templateUrl: './admin-canale.component.html',
  styleUrls: [
    '../admin-shared.scss',
    // `.admin-avviso` e `.admin-stato` vivono qui, non in admin-shared.
    '../admin-cruscotto.scss',
    './admin-canale.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCanaleComponent {
  private readonly api = inject(CanaleService);
  private readonly pending = inject(AdminPendingService);

  protected readonly stato = signal<StatoCanale | null>(null);
  protected readonly caricamento = signal(false);
  protected readonly errore = signal<string | null>(null);
  /** Esito dell'ultimo comando, mostrato come riga e non come toast. */
  protected readonly esito = signal<string | null>(null);
  protected readonly inCorso = signal(false);
  /** Conferma in linea: `null` | 'scarta' | 'togli'. Mai un `confirm()`. */
  protected readonly conferma = signal<'scarta' | 'togli' | null>(null);

  /** Il video in attesa può essere approvato? Se no, il pannello dice perché. */
  protected readonly bloccoApprovazione = computed<string | null>(() => {
    const p = this.stato()?.proposto;
    if (!p) return null;
    if (!p.miniaturaUrl) {
      return 'La copertina non è stata ri-ospitata sui nostri server. Senza, la home contatterebbe Google prima che qualcuno clicchi: premi «Controlla ora» per riprovare.';
    }
    return null;
  });

  constructor() {
    this.carica();
  }

  protected carica(): void {
    this.caricamento.set(true);
    this.errore.set(null);
    this.api.stato().subscribe({
      next: (s) => {
        this.stato.set(s);
        this.caricamento.set(false);
      },
      error: () => {
        this.errore.set('Non sono riuscito a leggere lo stato del canale.');
        this.caricamento.set(false);
      },
    });
  }

  protected controlla(): void {
    this.inCorso.set(true);
    this.esito.set(null);
    this.api.controlla().subscribe({
      next: (r) => {
        this.esito.set(`Controllo eseguito: ${r.esito}.`);
        this.inCorso.set(false);
        this.carica();
        this.pending.refresh(true);
      },
      error: () => {
        this.esito.set('Il controllo non è riuscito. Riprova fra poco.');
        this.inCorso.set(false);
      },
    });
  }

  protected approva(videoId: string): void {
    this.inCorso.set(true);
    this.esito.set(null);
    this.api.approva(videoId).subscribe({
      next: (v) => {
        this.esito.set(`«${v.titolo}» è ora il video in home.`);
        this.inCorso.set(false);
        this.carica();
        this.pending.refresh(true);
      },
      error: (e: { error?: { message?: string } }) => {
        // ⚠️ Il messaggio del server si mostra VERBATIM: dice quale termine ha
        // bloccato l'approvazione, o che la proposta è cambiata mentre si
        // decideva. Sostituirlo con un generico «errore» toglie l'unica cosa
        // che rende l'errore azionabile.
        this.esito.set(
          e?.error?.message ?? 'Non sono riuscito ad approvare il video.',
        );
        this.inCorso.set(false);
        this.carica();
      },
    });
  }

  protected scarta(videoId: string): void {
    this.inCorso.set(true);
    this.api.scarta(videoId).subscribe({
      next: () => {
        this.esito.set('Video scartato: non verrà più riproposto.');
        this.inCorso.set(false);
        // ⚠️ La conferma si DISARMA sempre, anche in errore: lasciare
        // «Scarta davvero» sotto il dito invita una seconda pressione.
        this.conferma.set(null);
        this.carica();
        this.pending.refresh(true);
      },
      error: () => {
        this.esito.set('Non sono riuscito a scartare il video.');
        this.inCorso.set(false);
        this.conferma.set(null);
        this.carica();
      },
    });
  }

  protected togli(): void {
    this.inCorso.set(true);
    this.api.togliDallaHome().subscribe({
      next: () => {
        this.esito.set('Il blocco video non compare più in home.');
        this.inCorso.set(false);
        this.conferma.set(null);
        this.carica();
      },
      error: () => {
        this.esito.set('Non sono riuscito a togliere il video dalla home.');
        this.inCorso.set(false);
        this.conferma.set(null);
        this.carica();
      },
    });
  }
}
