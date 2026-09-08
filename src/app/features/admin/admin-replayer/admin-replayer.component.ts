import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AdminHandsService,
  HandReportRow,
} from '../../../core/services/admin-hands.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { TonoStato } from '../admin-stato';
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
  imports: [
    FormsModule,
    RouterLink,
    FiltroComponent,
    IconComponent,
    ModalComponent,
  ],
  templateUrl: './admin-replayer.component.html',
  // ⚠️ I fogli condivisi non c'erano: `styleUrl` (singolare) portava il solo
  // foglio locale, quindi `.admin-barra`, `.admin-ico`, `.admin-nota`,
  // `.admin-stato` e la tabella NON erano raggiungibili da questo componente —
  // benché il commento in testa al foglio dichiarasse di riusarli. Da lì il
  // titolo più grande dell'h1 di pagina e dieci comandi su dodici sotto i 44px.
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
    './admin-replayer.component.scss',
  ],
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

  /**
   * La SCHEDA aperta e il motivo che si sta scrivendo.
   *
   * ⚠️ Era una fisarmonica senza una sola ARIA — niente `aria-expanded`, niente
   * `aria-controls`, e la classe `.ar__riga--aperta` senza una riga di CSS: chi
   * usa uno screen reader sentiva un bottone che non dichiarava di aprire
   * niente, chi guardava non aveva alcun segno che la riga fosse espandibile.
   * Ora è la scheda di riga del pannello, cioè un `<dialog>` che quelle cose le
   * dà il browser.
   */
  protected readonly aperto = signal<string | null>(null);
  protected motivo = '';

  /**
   * La segnalazione della scheda, **riletta dall'elenco** invece che copiata:
   * ogni decisione ricarica la lista, e una copia congelata mostrerebbe lo
   * stato di prima. Se la riga sparisce, la scheda si chiude da sé.
   */
  protected readonly scheda = computed<HandReportRow | null>(() => {
    const id = this.aperto();
    if (!id) return null;
    return this.items().find((r) => r.id === id) ?? null;
  });

  /**
   * Inline-confirm aperto (`'<azione>:<id>'`), o null.
   *
   * ⚠️ Esisteva SOLO qui, in tutto il pannello, un'azione irreversibile a un
   * tocco solo: `anonimizza` toglie i nomi da una mano e non si torna
   * indietro. Ogni altra azione distruttiva del pannello passa da due tocchi.
   */
  protected readonly conferma = signal<string | null>(null);

  protected chiediConferma(k: string): void {
    this.conferma.set(k);
  }

  protected annullaConferma(): void {
    this.conferma.set(null);
  }

  protected inConferma(k: string): boolean {
    return this.conferma() === k;
  }

  /** L'etichetta italiana dello stato: l'enum grezzo non è un'etichetta. */
  protected etichettaStato(s: string): string {
    switch (s) {
      case 'APERTA':
        return 'Aperta';
      case 'ACCOLTA':
        return 'Accolta';
      case 'RESPINTA':
        return 'Respinta';
      default:
        return s;
    }
  }

  /**
   * Il tono della pastiglia di stato.
   *
   * ⚠️ Era `<span class="badge badge--tag">{{ r.stato }}</span>`: l'enum in
   * maiuscolo dentro un `badge`, cioè la classe dei FATTI usata per uno STATO —
   * la regola di confine scritta in `admin-shared.scss`.
   */
  protected tono(s: string): TonoStato {
    switch (s) {
      case 'APERTA':
        return 'attesa';
      case 'ACCOLTA':
        return 'ok';
      case 'RESPINTA':
        return 'neutro';
      default:
        return 'ignoto';
    }
  }

  /** Il sotto-testo della riga: quando, dove, e in che stato è la mano. */
  protected sotto(r: HandReportRow): string {
    const parti = [this.data(r.createdAt)];
    if (!r.mano) {
      parti.push('mano non più esistente');
    } else {
      parti.push(r.mano.roomLabel);
      if (r.mano.status === 'RIMOSSA') parti.push('già rimossa');
      if (r.mano.anonimizzata) parti.push('già anonimizzata');
    }
    // ⚠️ Marcatore quieto e non più una pastiglia arancione piena: si ripete su
    // dodici righe su dodici ed è il caso NORMALE — lo dichiara il paragrafo
    // sopra l'elenco. Un marcatore che c'è sempre non marca niente.
    if (r.senzaAccount) parti.push('senza account');
    return parti.join(' · ');
  }

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
    this.aperto.set(id);
    this.conferma.set(null);
    this.motivo = '';
  }

  protected chiudi(): void {
    this.aperto.set(null);
    this.conferma.set(null);
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

  /**
   * ⚠️ Irreversibile — il testo originale non si conserva — e fino all'
   * 08/09/2026 era l'UNICA azione distruttiva del pannello a partire al PRIMO
   * TOCCO: nessuna conferma, su un comando che il suo stesso pulsante chiama
   * «irreversibile». Ora passa da un inline-confirm come tutte le altre.
   *
   * ⚠️ E NON passa da `conMotivo`, a differenza delle altre quattro: la rotta
   * `PATCH /admin/hands/:id/anonimizza` non accetta corpo e l'audit registra
   * solo il prima/dopo, quindi chiedere un motivo vorrebbe dire raccoglierlo e
   * buttarlo via — un verbale che non finisce da nessuna parte è peggio di
   * nessun verbale. Farglielo accettare è una modifica al backend (DTO +
   * audit), non a questa schermata.
   */
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
    // ⚠️ Prima si chiude la scheda, POI il toast: un `<dialog>` in top layer
    // copre qualunque `position: fixed`, quindi un messaggio emesso a modale
    // aperta dipinge dietro il fondale e non lo legge nessuno.
    this.aperto.set(null);
    this.conferma.set(null);
    this.motivo = '';
    this.toast.success(msg);
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
