import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  CodaRedazione,
  NEWS_FILTRO_LABELS,
  NEWS_STATUS_FILTRI,
  NEWS_STATUS_LABELS,
  NEWS_STATUS_TUTTI,
  NewsAdmin,
  NewsStatus,
  NewsStatusFiltro,
} from '../../../core/models/api.models';
import { NewsService } from '../../../core/services/news.service';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { MarkdownComponent } from '../../../shared/ui/markdown/markdown.component';

/** Righe per pagina: il tetto del DTO admin è 100, 25 è il default del server. */
const PAGE_SIZE = 25;

/** Le tre transizioni di ritorno raggiungibili da questa schermata. */
type AzioneRitorno = 'riapri' | 'in-revisione' | 'ritira';

/** Tutto ciò che può essere in volo su una riga (il ritorno più la cancellazione). */
type AzioneRiga = AzioneRitorno | 'elimina';

/** La singola via di ritorno offerta da uno stato, già in italiano. */
interface Ritorno {
  azione: AzioneRitorno;
  etichetta: string;
  inCorso: string;
  /** `true` = passa da un inline-confirm (azione distruttiva). */
  confermare: boolean;
}

/**
 * Tab **News**: l'archivio completo, con la via di ritorno dagli stati che
 * nessuna schermata raggiungeva.
 *
 * ⚠️ Perché esiste: il backend garantisce che «ogni stato terminale ha una via
 * di ritorno, perché la riga non si cancella mai», ma finché questo elenco
 * chiamava la lista **pubblica** (`GET /news`, che proietta solo i
 * `PUBBLICATO`) un articolo scartato o scaduto spariva dallo schermo — la porta
 * c'era sul server e non esisteva nella UI. Ora la sorgente è
 * `GET /admin/news`, che torna la riga intera (`NewsAdmin`, `status` compreso).
 *
 * ⚠️ Questa **non** è la coda: approvare e scartare restano in
 * `/admin/redazione`, che è la superficie su cui poggia la revisione umana
 * dell'art. 50(4) AI Act. Qui si raggiunge e si riporta indietro, e su una riga
 * `IN_REVISIONE` non c'è alcun pulsante di decisione: c'è un collegamento. Mai
 * un'azione in blocco (§3.7): è la gesture che dissolve la revisione umana.
 *
 * ⚠️ Un pulsante che propone una transizione non ammessa da
 * `ALLOWED_TRANSITIONS` è una bugia che finisce in un 409: ogni stato mostra
 * **solo** la sua riga della macchina a stati (vedi `ritorno()`).
 *
 * ⚠️ Niente `confirm()` nativo — nel progetto non esiste un solo dialog:
 * ritiro e cancellazione sono inline-confirm a due tocchi (idioma
 * `live-room.component.ts:108, 856-865`, ripreso da `admin-redazione`).
 */
@Component({
  selector: 'app-admin-news',
  imports: [ReactiveFormsModule, DatePipe, RouterLink, MarkdownComponent],
  templateUrl: './admin-news.component.html',
  styleUrls: ['../admin-shared.scss', './admin-news.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNewsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly newsApi = inject(NewsService);
  private readonly toast = inject(ToastService);
  private readonly pending = inject(AdminPendingService);

  // ── Elenco ─────────────────────────────────────────────────────────────────

  /** L'envelope intero: servono `total`/`totalPages` per il pager. */
  protected readonly pagina = signal<CodaRedazione | null>(null);
  protected readonly caricamento = signal(false);

  /**
   * ⚠️ Banda persistente, e la lista già caricata **resta in pagina**: prima di
   * questo lotto un guasto di rete faceva `items.set([])`, cioè si leggeva come
   * "non c'è nessuna news". È lo stesso anti-idioma che `admin-redazione`
   * documenta sulla coda.
   */
  protected readonly erroreLista = signal<string | null>(null);

  /**
   * Filtro attivo. Default «Tutti» di proposito: questa schermata **è**
   * l'archivio, e un default che ne nasconde tre stati su cinque ricostruirebbe
   * esattamente il punto cieco che il lotto rimuove. Il filtro è sempre
   * dichiarato a schermo (pillola attiva + riga di stato vuoto), perché un
   * elenco vuoto senza il suo filtro si legge come "ho perso gli articoli".
   */
  protected readonly filtro = signal<NewsStatusFiltro>(NEWS_STATUS_TUTTI);
  protected readonly pageNum = signal(1);

  /**
   * Il filtro **delle righe a schermo**, che non è `filtro()`.
   *
   * ⚠️ `filtro()` è la *domanda* (cambia al clic, e ci resta anche se la
   * risposta non arriva mai); questo è la *risposta*. Conteggio e testo del
   * vuoto leggono QUESTO, perché descrivono le righe: con la sola `filtro()`
   * dopo un cambio filtro fallito l'intestazione diceva «2 articoli · filtro:
   * Scartato» sopra due righe che scartate non erano, e un elenco vuoto
   * invitava a uscire da un filtro mai applicato.
   */
  protected readonly filtroCaricato =
    signal<NewsStatusFiltro>(NEWS_STATUS_TUTTI);

  /**
   * Numero d'ordine dell'ultima richiesta partita: una risposta sorpassata si
   * **butta**.
   *
   * ⚠️ Idioma già in casa (`features/docs`, `features/lessons`,
   * `features/shop`): due GET possono essere in volo insieme — la prima parte
   * dal costruttore, e ogni salvataggio o azione di riga ne accoda un'altra —
   * e senza questo vince l'ultima che **atterra**, non l'ultima **chiesta**:
   * le righe di un filtro sotto la pillola e il conteggio di un altro, senza
   * un errore e senza una riga di log.
   */
  private seq = 0;

  protected readonly filtri = NEWS_STATUS_FILTRI;
  /** La sentinella, per confrontarla nel template senza scriverla a mano. */
  protected readonly TUTTI = NEWS_STATUS_TUTTI;

  // ── Azioni di riga ─────────────────────────────────────────────────────────

  /**
   * QUALE azione è in volo e su QUALE riga: la lista ne mostra molte, e un
   * booleano unico farebbe annunciare «Ritiro…» sopra la riga sbagliata.
   */
  protected readonly azione = signal<{ id: string; quale: AzioneRiga } | null>(
    null,
  );

  /** Una chiamata alla volta: blocca il doppio tocco su tutta la lista. */
  protected readonly inVolo = computed(() => this.azione() !== null);

  /**
   * Inline-confirm aperto (`'<azione>:<id>'`), o null. Uno solo per pagina,
   * come in sala live: due conferme aperte insieme sono due modi di
   * confondersi.
   */
  protected readonly confirming = signal<string | null>(null);

  /** Nota facoltativa del ritiro: vive finché la conferma è aperta. */
  protected readonly notaRitiro = signal('');

  // ── Form (invariato: create/update restano sulle rotte pubbliche) ──────────

  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly feedback = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    body: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(20000)]],
    coverImageUrl: [''],
  });

  /** Tab attiva dell'editor del corpo: scrittura o anteprima markdown. */
  protected readonly editorTab = signal<'write' | 'preview'>('write');

  /** Valore live del corpo come signal, per l'anteprima markdown. */
  protected readonly bodyPreview = toSignal(this.form.controls.body.valueChanges, {
    initialValue: this.form.controls.body.value,
  });

  constructor() {
    this.carica();
  }

  // ── Caricamento ────────────────────────────────────────────────────────────

  /**
   * ⚠️ `status` esplicito sempre, anche quando coincide col default del server:
   * omettere il campo significa `IN_REVISIONE` (la coda), **non** «tutti».
   */
  private carica(): void {
    // ⚠️ Il filtro si fotografa QUI: è quello che descrive la risposta di
    // questa chiamata, e nel frattempo `filtro()` può essere già cambiato.
    const chiesto = this.filtro();
    const mio = ++this.seq;
    this.caricamento.set(true);
    this.erroreLista.set(null);
    this.newsApi
      .adminList({ status: chiesto, page: this.pageNum(), limit: PAGE_SIZE })
      .subscribe({
        next: (res) => {
          // Risposta sorpassata: non è più la domanda a schermo, si butta.
          if (mio !== this.seq) return;
          this.caricamento.set(false);
          // ⚠️ L'azione si spegne alla RICARICA, non alla risposta: fra le due
          // c'è una finestra in cui a schermo c'è ancora la riga appena decisa,
          // e col pulsante già vivo il secondo tocco di un doppio tap agirebbe
          // su uno stato che non esiste più (409).
          this.azione.set(null);
          this.confirming.set(null);
          this.notaRitiro.set('');

          // Ultima riga di una pagina eliminata (o filtro più stretto): la
          // pagina richiesta può non esistere più. Si rientra sull'ultima vera
          // invece di mostrare un vuoto che sembra un archivio svuotato.
          const ultima = Math.max(1, res.totalPages);
          if (res.items.length === 0 && this.pageNum() > ultima) {
            this.pageNum.set(ultima);
            this.carica();
            return;
          }
          this.pagina.set(res);
          // Righe e intestazione cambiano insieme: da qui in poi il conteggio
          // e il vuoto parlano di ciò che si vede.
          this.filtroCaricato.set(chiesto);
        },
        error: (err: unknown) => {
          if (mio !== this.seq) return;
          this.caricamento.set(false);
          // Anche col ricaricamento fallito i pulsanti tornano usabili:
          // l'azione precedente è già andata a buon fine.
          this.azione.set(null);
          // ⚠️ `pagina()` NON si azzera: la lista precedente resta a schermo.
          this.erroreLista.set(
            apiErrorMessage(err, 'Caricamento dell’archivio non riuscito.'),
          );
        },
      });
  }

  protected riprova(): void {
    this.carica();
  }

  /**
   * ⚠️ Nessuna guardia «è già il filtro attivo»: dopo un caricamento fallito
   * `filtro()` vale **già** quel valore, e con quella guardia ricliccare la
   * pillola per riprovare non faceva assolutamente nulla — un controllo acceso
   * e inerte, con la sola via d'uscita nel «Riprova» della banda. Ricliccare la
   * pillola attiva ricarica, che è ciò che quel gesto significa.
   */
  protected setFiltro(f: NewsStatusFiltro): void {
    if (this.inVolo() || this.caricamento()) return;
    this.filtro.set(f);
    this.pageNum.set(1);
    this.confirming.set(null);
    this.notaRitiro.set('');
    this.carica();
  }

  /**
   * ⚠️ Anche qui niente confronto con la pagina **chiesta**, per la stessa
   * ragione: dopo un caricamento di pagina fallito `pageNum()` vale 2 mentre a
   * schermo c'è la 1, e il pager (che legge l'envelope, cioè la pagina VERA)
   * richiedeva la 2 — scartata come «sei già lì». Risultato: «Successive»
   * abilitato e morto, «Precedenti» disabilitato perché la pagina mostrata è la
   * prima, cioè un pager intero senza un solo controllo vivo.
   */
  protected vaiA(n: number): void {
    if (this.inVolo() || this.caricamento()) return;
    const totale = this.pagina()?.totalPages ?? 1;
    if (n < 1 || n > totale) return;
    this.pageNum.set(n);
    this.confirming.set(null);
    this.carica();
  }

  // ── Etichette e stato ──────────────────────────────────────────────────────

  /**
   * ⚠️ Etichette dal vocabolario condiviso: mai una seconda mappa qui dentro.
   *
   * ⚠️ `undefined` è un caso REALE e non una difesa di comodo: con «Tutti» il
   * backend filtra `{}` di proposito, così una riga storica mai migrata resta
   * raggiungibile (vedi `NewsAdmin.status`). Va detto in italiano, non lasciato
   * in bianco: una riga senza etichetta si legge come un guasto del pannello.
   */
  protected statoLabel(s: NewsStatus | undefined): string {
    return s ? (NEWS_STATUS_LABELS[s] ?? s) : 'Senza stato';
  }

  protected filtroLabel(f: NewsStatusFiltro): string {
    return NEWS_FILTRO_LABELS[f] ?? f;
  }

  /**
   * Colore del chip per stato (idioma `aff-chip` delle affiliazioni).
   *
   * ⚠️ Il `?.` non è pignoleria: `undefined.toLowerCase()` dentro un binding è
   * un TypeError che interrompe il render dell'elenco **e si ripete a ogni
   * ciclo** — cioè l'archivio che si rompe esattamente sulla riga che esiste
   * per farsi ritrovare.
   */
  protected chipClass(s: NewsStatus | undefined): string {
    return `an-chip an-chip--${s ? s.toLowerCase() : 'ignoto'}`;
  }

  /** Cosa dice il vuoto: sempre con il nome del filtro **caricato**. */
  protected readonly vuotoTesto = computed(() =>
    this.filtroCaricato() === NEWS_STATUS_TUTTI
      ? 'Nessuna news in archivio.'
      : `Nessuna news nello stato «${this.filtroLabel(this.filtroCaricato())}».`,
  );

  /**
   * La **sola** transizione di ritorno ammessa da questo stato — copia della
   * riga corrispondente di `ALLOWED_TRANSITIONS` (`backend/src/news/news.types.ts`).
   *
   * ⚠️ `IN_REVISIONE` torna `null` e non è una dimenticanza: da lì si decide, e
   * si decide in Redazione. Duplicare qui approve/reject sdoppierebbe il
   * cancello umano su due schermate.
   *
   * ⚠️ Anche una riga **senza stato** torna `null`, ed è l'unica risposta
   * onesta: `ALLOWED_TRANSITIONS` non ha una riga per «nessuno stato», quindi
   * ogni transizione partirebbe da `canTransition(undefined, …)` e tornerebbe
   * un 409. Quella riga si spiega a parole (vedi il template), non con un
   * pulsante che non può funzionare.
   */
  protected ritorno(s: NewsStatus | undefined): Ritorno | null {
    if (!s) return null;
    switch (s) {
      case 'BOZZA':
        return {
          azione: 'in-revisione',
          etichetta: 'Manda in revisione',
          inCorso: 'Mando…',
          confermare: false,
        };
      case 'PUBBLICATO':
        // ⚠️ Unica di ritorno che TOGLIE qualcosa dal pubblico: due tocchi.
        return {
          azione: 'ritira',
          etichetta: 'Ritira',
          inCorso: 'Ritiro…',
          confermare: true,
        };
      case 'SCARTATO':
      case 'SCADUTO':
        return {
          azione: 'riapri',
          etichetta: 'Rimetti in coda',
          inCorso: 'Rimetto…',
          confermare: false,
        };
      case 'IN_REVISIONE':
        return null;
    }
  }

  protected inVoloSu(id: string, quale: AzioneRiga): boolean {
    const a = this.azione();
    return a !== null && a.id === id && a.quale === quale;
  }

  // ── Inline-confirm (idioma live-room: niente confirm() nativi) ─────────────

  protected isConfirming(key: string): boolean {
    return this.confirming() === key;
  }

  protected askConfirm(key: string): void {
    this.confirming.set(key);
    this.notaRitiro.set('');
  }

  /** ⚠️ Annullando si porta via anche il campo, come in redazione. */
  protected cancelConfirm(): void {
    this.confirming.set(null);
    this.notaRitiro.set('');
  }

  protected onNotaRitiro(event: Event): void {
    this.notaRitiro.set((event.target as HTMLInputElement).value);
  }

  // ── Transizioni di ritorno ─────────────────────────────────────────────────

  /** Click sul pulsante di ritorno: apre la conferma o parte subito. */
  protected ritornoClick(news: NewsAdmin): void {
    const r = this.ritorno(news.status);
    if (!r || this.inVolo()) return;
    if (r.confermare) {
      this.askConfirm(`${r.azione}:${news._id}`);
      return;
    }
    this.avvia(r.azione, news);
  }

  protected confermaRitiro(news: NewsAdmin): void {
    this.avvia('ritira', news);
  }

  private avvia(quale: AzioneRitorno, news: NewsAdmin): void {
    switch (quale) {
      case 'riapri':
        // SCARTATO|SCADUTO → IN_REVISIONE. Il badge della coda cresce: `force`.
        this.esegui(
          'riapri',
          news._id,
          this.newsApi.riapri(news._id),
          'Articolo rimesso in coda: ora si decide dalla Redazione.',
          true,
        );
        break;
      case 'in-revisione':
        // BOZZA → IN_REVISIONE.
        this.esegui(
          'in-revisione',
          news._id,
          this.newsApi.inviaInRevisione(news._id),
          'Bozza mandata in revisione.',
          true,
        );
        break;
      case 'ritira': {
        // PUBBLICATO → BOZZA. ⚠️ Nota vuota = nessuna nota: una stringa vuota
        // finirebbe nell'audit come motivo del ritiro.
        const nota = this.notaRitiro().trim();
        this.esegui(
          'ritira',
          news._id,
          this.newsApi.ritira(news._id, nota ? nota : undefined),
          'Articolo ritirato: non è più online e torna in bozza.',
          false,
        );
        break;
      }
    }
  }

  /**
   * Runner: una chiamata alla volta, esito a toast, ricarica completa.
   *
   * ⚠️ Ricarica e non modifica in posto: la riga cambia stato, quindi con un
   * filtro attivo esce (o entra) dall'elenco, e `total`/`totalPages` cambiano
   * con lei.
   */
  private esegui(
    quale: AzioneRiga,
    id: string,
    work$: Observable<unknown>,
    messaggio: string,
    toccaLaCoda: boolean,
  ): void {
    if (this.inVolo()) return;
    this.azione.set({ id, quale });
    this.confirming.set(null);
    work$.subscribe({
      next: () => {
        this.toast.success(messaggio);
        // ⚠️ `force`: senza, il badge «Redazione» della sidebar resta indietro
        // fino a 30s e mente sul numero di articoli che aspettano una decisione.
        if (toccaLaCoda) this.pending.refresh(true);
        this.carica();
      },
      error: (err: unknown) => {
        this.azione.set(null);
        this.toast.error(apiErrorMessage(err, 'Operazione non riuscita.'));
        // ⚠️ Si ricarica sul 409 e sul 404 — i due codici che dicono "la riga a
        // schermo non è più quella" (decisa da un'altra scheda, o cancellata) —
        // mai su un errore di rete: rispondere a un guasto con una seconda
        // chiamata che fallisce uguale non aggiunge niente.
        const stato = err instanceof HttpErrorResponse ? err.status : 0;
        if (stato === 409 || stato === 404) this.carica();
      },
    });
  }

  // ── Form: scrittura e cancellazione ────────────────────────────────────────

  protected edit(news: NewsAdmin): void {
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
      next: (salvata) => {
        this.saving.set(false);
        // ⚠️ Lo stato risultante lo dice la RISPOSTA, non un'assunzione su
        // quale delegato pubblica direttamente: entrambe le rotte legacy
        // tornano la riga intera. Se un domani `POST /news` facesse nascere una
        // bozza, questo messaggio si corregge da solo.
        const stato = (salvata as Partial<NewsAdmin>).status;
        this.feedback.set(this.messaggioSalvataggio(!!id, stato));
        this.cancelEdit();
        this.carica();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorMessage(err, 'Salvataggio non riuscito.'));
      },
    });
  }

  /**
   * ⚠️ Un salvataggio che non muove nessuna riga si legge come non andato a
   * buon fine: con un filtro attivo che l'articolo salvato non soddisfa,
   * l'elenco qui sotto resta identico — stesse righe, stesso conteggio — e
   * l'unico segno del salvataggio è una frase in cima al form. Il messaggio
   * dice **dov'è finito** invece di lasciarlo dedurre.
   */
  private messaggioSalvataggio(modifica: boolean, stato?: NewsStatus): string {
    const base = modifica ? 'News aggiornata.' : 'News pubblicata.';
    const f = this.filtro();
    if (f === NEWS_STATUS_TUTTI || !stato || f === stato) return base;
    return (
      `${base} Non compare nell'elenco: è «${this.statoLabel(stato)}» e il ` +
      `filtro attivo è «${this.filtroLabel(f)}».`
    );
  }

  /**
   * Cancellazione: irreversibile davvero (la riga sparisce, e con lei lo slug e
   * i 301 che ci puntano) → inline-confirm, mai `confirm()` nativo.
   */
  protected confermaElimina(news: NewsAdmin): void {
    if (this.editingId() === news._id) this.cancelEdit();
    this.esegui(
      'elimina',
      news._id,
      this.newsApi.remove(news._id),
      'News eliminata.',
      // Cancellare una riga in coda cambia il badge: si forza solo allora.
      news.status === 'IN_REVISIONE',
    );
  }
}
