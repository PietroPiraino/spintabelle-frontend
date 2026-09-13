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
  CruscottoConteggi,
  VoceDaFare,
} from '../../../core/models/api.models';
import { AdminConteggiService } from '../../../core/services/admin-conteggi.service';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import { AdminStatsService } from '../../../core/services/admin-stats.service';
import { AdminUsersService } from '../../../core/services/admin-users.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { actionLabel } from '../action-labels';
import { testoEv } from '../admin-stakings/staking-format';
import {
  formattaCent,
  formattaDelta,
  formattaEur,
  formattaIntero,
} from '../denaro';
import { cassaLabel } from '../metodo-pagamento';

/**
 * Le schede dei Conteggi che una tessera o una voce «da fare» apre col
 * deep-link `?mese=&vista=`. ⚠️ È un SOTTOINSIEME della tupla chiusa `VISTE`
 * di `admin-conteggi-mensili.component.ts`, che non è esportata (e importarla
 * tirerebbe quel componente nel chunk della Panoramica): là `isVista()` fa da
 * guardia sul parametro, quindi un valore che non le corrisponde ricade sul
 * riepilogo — mai un pannello vuoto. Chi rinomina una scheda di là corregge
 * anche qui, e la spec sugli `href` lo vede.
 */
type VistaConteggi = 'riepilogo' | 'rakeback' | 'stakati' | 'voci' | 'soci';

/** Il testo di una voce «da fare»: il numero, le due righe e la scheda. */
interface TestoDaFare {
  /** Il conteggio: `null` dove la voce È il mese e un numero non dice niente. */
  n: number | null;
  strong: string;
  span: string;
  vista: VistaConteggi;
}

/**
 * Panoramica: la home della dashboard admin.
 *
 * QUATTRO fonti dati indipendenti, ognuna con loading/errore propri — un
 * guasto di una non spegne le altre (stesso patto della sezione Statistiche):
 *  1. `GET /admin/conteggi/cruscotto` (dal 13/09/2026): la coda «da fare», il
 *     mese contabile, il credito dei soci e il registro staking — UNA lettura,
 *     nessuna cache dietro, perché legge dati che si scrivono;
 *  2. `GET /admin/stats` (già cachato lato server ~5 min) per gli abbonati;
 *  3. il log admin (prime voci) per la striscia «Ultime azioni»;
 *  4. `AdminPendingService` per le card «in attesa» (gli stessi conteggi dei
 *     badge in sidebar — ⚠️ refresh NON forzato: il min-interval del service
 *     assorbe il doppione con la shell, che li ha appena chiesti).
 *
 * ⚠️ Niente `/admin/stats/video` qui: dietro c'è una chiamata di rete a Bunny,
 * resta nella sezione Statistiche col suo pannello che fallisce da solo.
 *
 * ⚠️ Nessun grafico e nessuna modale, di proposito: ogni tessera PORTA alla
 * sezione dove il dettaglio vive (Conteggi, Stakings, Statistiche). La
 * Panoramica è il minimo che si legge la mattina, non un secondo pannello.
 *
 * ⚠️ DUE unità di denaro convivono in questa pagina e non si incrociano: i
 * CENTESIMI interi del cruscotto (`formattaCent`) e gli EURO float di
 * `/admin/stats` (`formattaEur`). La scelta sbagliata è un fattore 100. E il
 * client non SOMMA mai: ogni cifra arriva già sommata dal server.
 *
 * ⚠️ `styleUrls` PLURALE coi quattro fogli condivisi (il quarto,
 * `admin-cruscotto.scss`, porta la tessera KPI, lo scheletro, l'avviso e la
 * coda «da fare»): col solo foglio locale nessuno di quei primitivi sarebbe
 * raggiungibile, che è il difetto che aveva isolato `/admin/replayer`.
 */
@Component({
  selector: 'app-admin-overview',
  imports: [DatePipe, RouterLink, IconComponent],
  templateUrl: './admin-overview.component.html',
  styleUrls: [
    '../admin-shared.scss',
    '../admin-table.scss',
    '../admin-modale.scss',
    '../admin-cruscotto.scss',
    './admin-overview.component.scss',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {
  private readonly conteggiApi = inject(AdminConteggiService);
  private readonly statsApi = inject(AdminStatsService);
  private readonly usersApi = inject(AdminUsersService);
  protected readonly pending = inject(AdminPendingService);

  protected readonly cruscotto = signal<CruscottoConteggi | null>(null);
  protected readonly cruscottoLoading = signal(false);
  protected readonly cruscottoError = signal<string | null>(null);

  protected readonly stats = signal<AdminStatsView | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal<string | null>(null);

  protected readonly actions = signal<AdminActionLogEntry[] | null>(null);
  protected readonly actionsLoading = signal(false);
  protected readonly actionsError = signal<string | null>(null);

  /**
   * Guardie di sequenza: «Riprova» premuto due volte manda due richieste, e
   * senza il contatore vincerebbe l'ULTIMA ad arrivare, non l'ultima chiesta.
   */
  private cruscottoSeq = 0;
  private statsSeq = 0;

  protected readonly actionLabel = actionLabel;
  protected readonly formattaCent = formattaCent;
  protected readonly formattaEur = formattaEur;
  protected readonly formattaDelta = formattaDelta;
  protected readonly formattaIntero = formattaIntero;
  protected readonly testoEv = testoEv;
  protected readonly cassaLabel = cassaLabel;

  /** Gli scheletri: uno per tessera, così l'altezza non cambia all'arrivo. */
  protected readonly scheletriMese = [0, 1, 2, 3, 4, 5];
  protected readonly scheletriStaking = [0, 1, 2];
  protected readonly scheletriAbbonati = [0, 1, 2, 3];
  protected readonly scheletriDaFare = [0, 1, 2];
  protected readonly scheletriAzioni = [0, 1, 2, 3, 4, 5, 6, 7];

  constructor() {
    this.loadCruscotto();
    this.loadStats();
    this.loadActions();
    // NON forzato: al primo ingresso la shell li ha appena chiesti e il
    // min-interval assorbe il doppione (2 chiamate, non 4); tornando qui da
    // un'altra sezione il service decide da solo se sono da rinfrescare.
    this.pending.refresh();
  }

  protected loadCruscotto(): void {
    const seq = ++this.cruscottoSeq;
    this.cruscottoLoading.set(true);
    this.cruscottoError.set(null);
    this.conteggiApi.cruscotto().subscribe({
      next: (view) => {
        if (seq !== this.cruscottoSeq) return;
        this.cruscotto.set(view);
        this.cruscottoLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.cruscottoSeq) return;
        this.cruscottoLoading.set(false);
        this.cruscottoError.set(
          apiErrorMessage(err, 'Lettura dei conteggi non riuscita.'),
        );
      },
    });
  }

  protected loadStats(): void {
    const seq = ++this.statsSeq;
    this.statsLoading.set(true);
    this.statsError.set(null);
    this.statsApi.overview().subscribe({
      next: (view) => {
        if (seq !== this.statsSeq) return;
        this.stats.set(view);
        this.statsLoading.set(false);
      },
      error: (err: unknown) => {
        if (seq !== this.statsSeq) return;
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

  /**
   * Come si legge una voce «da fare» e in quale scheda dei Conteggi si fa.
   *
   * ⚠️ `switch` ESAUSTIVO senza `default`: una voce nuova nel backend arriva
   * qui come un tipo nuovo in `TipoDaFare`, e questa funzione smette di
   * compilare finché non le si decide una riga e una scheda. Con un `default`
   * comparirebbe in coda con un testo generico e un link alla scheda sbagliata.
   */
  protected testoDaFare(v: VoceDaFare): TestoDaFare {
    switch (v.tipo) {
      case 'SPESE_FISSE':
        return {
          n: v.conteggio,
          strong: 'Spese fisse da registrare',
          span: v.etichetta,
          vista: 'voci',
        };
      case 'TICKET_NON_PAGATI':
        return {
          n: v.conteggio,
          strong: 'Ticket non pagati',
          span: `${v.etichetta} · ${formattaCent(v.importoCent ?? 0)}`,
          vista: 'rakeback',
        };
      case 'STAKATI_DA_REGISTRARE':
        return {
          n: v.conteggio,
          strong: 'Conteggi stakati da portare sul registro',
          span: v.etichetta,
          vista: 'stakati',
        };
      case 'INCASSO_AGENTE':
        return {
          n: null,
          strong: 'Incasso dell’agente non registrato',
          span: `${v.etichetta} · attesi ${formattaCent(v.importoCent ?? 0)}`,
          vista: 'rakeback',
        };
      case 'MESE_APERTO_ARRETRATO':
        return {
          n: null,
          strong: `${v.etichetta} è ancora aperto`,
          span: 'chiudilo o correggilo',
          vista: 'riepilogo',
        };
      case 'MESE_CORRENTE_NON_APERTO':
        return {
          n: null,
          strong: `${v.etichetta} non è ancora aperto`,
          span: 'aprilo dai Conteggi',
          vista: 'riepilogo',
        };
    }
  }

  /**
   * I parametri del deep-link verso i Conteggi. ⚠️ `mese` si OMETTE quando è
   * `null` (il mese corrente non ancora aperto non ha un id): con
   * `{ mese: null }` il RouterLink scriverebbe `?mese=&vista=…`, e di là
   * `mesi.find(m => m.id === '')` non trova niente — che per fortuna ricade sul
   * primo mese, ma con un URL che mente.
   */
  protected paramsConteggi(
    meseId: string | null | undefined,
    vista: VistaConteggi,
  ): Record<string, string> {
    return { ...(meseId ? { mese: meseId } : {}), vista };
  }

  protected paramsDaFare(v: VoceDaFare): Record<string, string> {
    return this.paramsConteggi(v.meseId, this.testoDaFare(v).vista);
  }

  /**
   * «di cui X presso l'agente, Y dai giocatori» — e se Y è negativo, sono
   * soldi da RIMBORSARE ai giocatori: «da riscuotere −5 €» direbbe il
   * contrario esatto (precedente della scheda Soci dei Conteggi).
   */
  protected notaCredito(c: CruscottoConteggi): string {
    const g = c.soci.daRiscuotereDaiGiocatoriCent;
    const giocatori =
      g < 0
        ? `${formattaCent(-g)} da rimborsare ai giocatori`
        : `${formattaCent(g)} dai giocatori`;
    return `di cui ${formattaCent(c.soci.pressoAgenteCent)} presso l’agente, ${giocatori}`;
  }

  /** Chiave stabile per il `track`: una voce per tipo e per mese. */
  protected chiaveDaFare(v: VoceDaFare): string {
    return `${v.tipo}|${v.meseId ?? ''}`;
  }
}
