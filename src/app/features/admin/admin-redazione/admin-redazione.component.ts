import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  NEWS_CATEGORY_LABELS,
  NewsAdmin,
  NewsApprovePayload,
  NewsCategory,
  CodaRedazione,
} from '../../../core/models/api.models';
import { AdminPendingService } from '../../../core/services/admin-pending.service';
import { NewsService } from '../../../core/services/news.service';
import { apiErrorMessage } from '../../../core/utils/http-error';
import { IconComponent } from '../../../shared/ui/icon/icon.component';
import { MarkdownComponent } from '../../../shared/ui/markdown/markdown.component';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/**
 * Quanti articoli si caricano in una volta.
 *
 * ⚠️ La coda si legge **una card alla volta**, quindi questo non è un "per
 * pagina" da sfogliare: è quanti ne tiene in mano il pannello. Il criterio di
 * pilota è una coda ≤ 10 (il tetto del DTO è 100): oltre i 25 caricati il
 * pannello lo dice in chiaro invece di far finta che la coda finisca lì.
 */
const PAGE_SIZE = 25;

/** Sotto questa soglia la striscia di scadenza diventa rossa. */
const SOGLIA_ROSSA_MS = 2 * 60 * 60 * 1000;

/**
 * Durata del rimando, specchio di `SNOOZE_ORE` lato server (D35).
 *
 * ⚠️ Serve **solo** a dire la verità sul costo del rimando, mai a calcolare la
 * data: quella la scrive il backend. Se le due costanti divergessero, l'unico
 * effetto sarebbe un avviso mostrato un po' prima o un po' dopo — non una data
 * sbagliata scritta a database.
 */
const SNOOZE_MS = 2 * 60 * 60 * 1000;

/** Specchio di `ApproveNewsDto.title` (`@MinLength(3) @MaxLength(200)`). */
const TITOLO_MIN = 3;
const TITOLO_MAX = 200;

/**
 * Specchio di `RejectNewsDto.note` (`@MinLength(3)`).
 *
 * ⚠️ Il controllo vero resta il ValidationPipe: questo evita solo il viaggio
 * (e il 400) su una nota vuota, come `assertNote` nelle affiliazioni.
 */
const NOTA_MIN = 3;

/**
 * Passo dell'orologio interno: la striscia di scadenza e il banner di pausa
 * sono conti alla rovescia, e una card aperta mezz'ora mostrerebbe altrimenti
 * un "scade fra 5 min" già superato. Un minuto basta: nessuna soglia di questa
 * pagina è più fine.
 */
const TICK_MS = 60_000;

const ORA = new Intl.DateTimeFormat('it-IT', {
  hour: '2-digit',
  minute: '2-digit',
});
const GIORNO_ORA = new Intl.DateTimeFormat('it-IT', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});
/**
 * Il giorno in cui la pausa finisce — l'unica data che l'owner **sceglie**, e
 * per questo l'unica stampata **con l'anno**.
 *
 * ⚠️ Senza l'anno una pausa digitata "2036" invece di "2026" si legge
 * «fino al 25 agosto» esattamente come quella giusta: né il toast di conferma
 * né il banner permanente mostrerebbero la differenza, e la redazione
 * resterebbe ferma per dieci anni con la pagina che dice il vero. È il guasto
 * che la FORMA a data doveva escludere («la pausa finisce da sola»): la
 * garanzia regge solo se il valore scelto è leggibile per intero.
 */
const GIORNO = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Una riga della bibliografia: il link e il nome leggibile della testata. */
interface Fonte {
  url: string | null;
  testata: string;
}

/** Dominio leggibile di un URL, per quando la testata non è dichiarata. */
function dominio(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Un URL malformato non deve far esplodere il template: si mostra com'è.
    return url;
  }
}

/**
 * Coda di revisione della redazione (`/admin/redazione`) — §3.3 del piano.
 *
 * È **una card alla volta**, non un elenco: l'owner revisiona dal telefono fra
 * una mano e l'altra, e una lista di card mezze aperte è esattamente il posto
 * in cui si approva la riga sbagliata. Da qui passa la conferma umana su cui
 * poggia l'esonero dell'art. 50(4) AI Act (`revisionatoDa`/`revisionatoAt` li
 * scrive il backend all'approvazione): la superficie è fatta per **leggere**
 * l'articolo prima di decidere, non per smaltirlo.
 *
 * ⚠️ Niente approvazione in blocco, niente editor (§3.7): il corpo si riscrive
 * dal form News, che è linkato in fondo alla card.
 *
 * ⚠️ Niente `confirm()` nativo e niente modale — nel progetto non esiste un
 * solo dialog: lo scarto è un inline-confirm a due tocchi (idioma
 * `live-room.component.ts:108, 856-865`).
 */
@Component({
  selector: 'app-admin-redazione',
  imports: [IconComponent, MarkdownComponent, RouterLink],
  templateUrl: './admin-redazione.component.html',
  styleUrls: ['../admin-shared.scss', './admin-redazione.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRedazioneComponent {
  private readonly api = inject(NewsService);
  private readonly toast = inject(ToastService);
  private readonly pending = inject(AdminPendingService);

  protected readonly titoloMax = TITOLO_MAX;

  // ── Stato della coda ──

  protected readonly coda = signal<CodaRedazione | null>(null);
  protected readonly caricamento = signal(false);
  /**
   * ⚠️ Banda persistente, mai una lista svuotata: un guasto di rete non deve
   * somigliare a "nessun articolo in coda" (stessa regola di lezioni e docs).
   */
  protected readonly erroreLista = signal<string | null>(null);

  /** Indice della card in vista: la coda è caricata, si sfoglia in locale. */
  protected readonly indice = signal(0);

  /**
   * QUALE decisione è in volo, non solo "ce n'è una": la barra deve poter dire
   * la verità mentre aspetta.
   *
   * ⚠️ Era un booleano unico, e il pulsante primario annunciava «Pubblico…»
   * anche durante un Rimanda o uno Scarta. Non innescava nulla (era comunque
   * disabilitato), ma questa è la superficie su cui una persona conferma una
   * pubblicazione: un'etichetta che nomina l'azione sbagliata è esattamente il
   * genere di piccola bugia che questa schermata non si può permettere.
   */
  protected readonly azione = signal<'pubblica' | 'rimanda' | 'scarta' | null>(
    null,
  );

  /** Una chiamata alla volta: blocca il doppio tocco sulla barra azioni. */
  protected readonly inVolo = computed(() => this.azione() !== null);
  /** Interruttore della pausa: in volo a parte, non spegne la revisione. */
  protected readonly pausaInVolo = signal(false);

  /**
   * Inline-confirm aperto (`'scarta'` | `'pausa'`), o null. Uno solo per
   * pagina, come in sala live: due conferme aperte insieme sono due modi di
   * confondersi.
   */
  protected readonly confirming = signal<string | null>(null);

  /** Motivo dello scarto: vive finché la conferma è aperta. */
  protected readonly notaScarto = signal('');

  /**
   * Titolo corretto al volo. `null` = non toccato → l'input mostra quello
   * dell'articolo e l'approvazione non manda alcun `title`.
   */
  protected readonly titoloBozza = signal<string | null>(null);

  /** Data scelta nel pannello "metti in pausa" (`yyyy-mm-dd` dell'input). */
  protected readonly pausaData = signal('');

  /** Orologio interno: fa scadere da soli conto alla rovescia e banner. */
  private readonly adesso = signal(Date.now());

  constructor() {
    this.carica();
    const t = setInterval(() => this.adesso.set(Date.now()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  // ── Derivati ──

  protected readonly articoli = computed<NewsAdmin[]>(
    () => this.coda()?.items ?? [],
  );

  protected readonly corrente = computed<NewsAdmin | null>(
    () => this.articoli()[this.indice()] ?? null,
  );

  /** Quante righe ci sono davvero in coda (può superare quelle caricate). */
  protected readonly totale = computed(() => this.coda()?.total ?? 0);

  /** Il titolo come sarà salvato: la correzione se c'è, altrimenti l'originale. */
  protected readonly titolo = computed(
    () => this.titoloBozza() ?? this.corrente()?.title ?? '',
  );

  protected readonly titoloModificato = computed(() => {
    const a = this.corrente();
    return !!a && this.titolo().trim() !== a.title;
  });

  protected readonly titoloValido = computed(() => {
    const t = this.titolo().trim();
    return t.length >= TITOLO_MIN && t.length <= TITOLO_MAX;
  });

  /**
   * Le fonti, appaiate. ⚠️ I due array sono paralleli ma **non è garantito**
   * che abbiano la stessa lunghezza (li scrive la pipeline): si scorre il più
   * lungo, e una testata senza URL resta testo — un link finto sarebbe peggio.
   */
  protected readonly fonti = computed<Fonte[]>(() => {
    const a = this.corrente();
    if (!a) return [];
    const urls = a.sourceUrls ?? [];
    const testate = a.sourceOutlets ?? [];
    const righe: Fonte[] = [];
    for (let i = 0; i < Math.max(urls.length, testate.length); i++) {
      const url = urls[i] ?? null;
      const nome = (testate[i] ?? '').trim() || (url ? dominio(url) : '');
      righe.push({ url, testata: nome || 'Fonte senza nome' });
    }
    return righe;
  });

  /**
   * ⚠️ Il blocco guarda `sourceUrls`, non `fonti`: la citazione è la condizione
   * di liceità dell'art. 101 LdA, e una testata senza indirizzo non è una fonte
   * verificabile — è un nome. Senza URL non si pubblica da qui.
   */
  protected readonly senzaFonti = computed(
    () => (this.corrente()?.sourceUrls ?? []).length === 0,
  );

  /**
   * I rilievi della pipeline, con la rete sotto.
   *
   * ⚠️ `?? []` non è pedanteria difensiva: la coda arriva da un'`aggregate`,
   * che **non applica i default di Mongoose**. Una riga scritta prima della
   * Fase 0 — un articolo storico ritirato e rimesso in revisione — non ha
   * affatto il campo, e un `a.complianceFlags.length` in template è un
   * TypeError che fa sparire l'**intera card**: il revisore vedrebbe una coda
   * che dichiara N articoli e uno schermo vuoto al posto del primo.
   */
  protected readonly rilievi = computed<string[]>(
    () => this.corrente()?.complianceFlags ?? [],
  );

  /**
   * Specchio del cancello copertina del backend (D57): approvare con
   * `imageSource: 'LICENZIATA'` e credito o licenza vuoti è un **400**.
   *
   * ⚠️ Senza questo specchio "Pubblica" resta acceso e promette una
   * pubblicazione che il server rifiuta — e la card non mostra la provenienza
   * dell'immagine da nessun'altra parte, quindi il rifiuto arriverebbe senza
   * che si capisca che cosa manca. È lo stesso motivo per cui `senzaFonti`
   * blocca invece di lasciar provare.
   */
  protected readonly copertinaIncompleta = computed(() => {
    const a = this.corrente();
    if (!a || a.imageSource !== 'LICENZIATA') return false;
    return !(a.imageCredit ?? '').trim() || !(a.imageLicense ?? '').trim();
  });

  /**
   * Il rimando arriverebbe **dopo** la scadenza.
   *
   * ⚠️ Rimandare un pezzo deperibile costa, e il costo va detto **prima**: lo
   * snooze dura due ore e la scadenza vince lo stesso (D35) — l'articolo non
   * "torna in coda", diventa `SCADUTO`. Un messaggio che promette il ritorno è
   * la promessa che la spazzata cancellerà, e chi rimanda lo scoprirebbe solo
   * non trovandolo più.
   */
  protected readonly rimandoOltreScadenza = computed(() => {
    const a = this.corrente();
    if (!a?.scadeIl) return false;
    const scade = new Date(a.scadeIl).getTime();
    if (Number.isNaN(scade)) return false;
    return scade < this.adesso() + SNOOZE_MS;
  });

  protected readonly confidenza = computed<number | null>(() => {
    const c = this.corrente()?.confidence;
    return typeof c === 'number' ? Math.round(c * 100) : null;
  });

  protected readonly pubblicabile = computed(
    () =>
      !!this.corrente() &&
      !this.senzaFonti() &&
      !this.copertinaIncompleta() &&
      this.titoloValido() &&
      !this.inVolo(),
  );

  /**
   * Striscia di scadenza: **l'ordinamento reso visibile**. Chi revisiona deve
   * vedere perché questa card è la prima, o l'ordine sembra arbitrario.
   */
  protected readonly scadenza = computed<{ testo: string; urgente: boolean }>(
    () => {
      const a = this.corrente();
      if (!a) return { testo: '', urgente: false };
      // ⚠️ `scadeIl` assente = evergreen, NON "scaduto": è la stessa semantica
      // della spazzata lato server (in MQL `$lte` non incontra mai `null`).
      if (!a.scadeIl) return { testo: 'Evergreen · nessuna scadenza', urgente: false };
      const scade = new Date(a.scadeIl).getTime();
      if (Number.isNaN(scade)) {
        return { testo: 'Scadenza non leggibile', urgente: false };
      }
      const mancano = scade - this.adesso();
      if (mancano <= 0) return { testo: 'Scadenza superata', urgente: true };
      const urgente = mancano < SOGLIA_ROSSA_MS;
      const minuti = Math.ceil(mancano / 60_000);
      if (minuti < 60) return { testo: `Scade fra ${minuti} min`, urgente };
      // ⚠️ Le ore si derivano dai MINUTI già arrotondati per eccesso, mai da
      // `mancano`: con `Math.floor(mancano / 3_600_000)` un residuo di 59 min
      // e mezzo dà `minuti = 60` (quindi salta il ramo dei minuti) e `ore = 0`,
      // cioè **"Scade fra 0 h" con un'ora intera davanti**. Un conto alla
      // rovescia che annuncia una scadenza non ancora arrivata è la bugia
      // peggiore su questa striscia: è l'unica cosa che dice perché questa card
      // è la prima, e a "0 h" si decide di fretta un pezzo che non lo chiede.
      const ore = Math.floor(minuti / 60);
      if (ore < 48) return { testo: `Scade fra ${ore} h`, urgente };
      return { testo: `Scade il ${GIORNO_ORA.format(scade)}`, urgente };
    },
  );

  /**
   * Rimando in corso (D35). ⚠️ Lo stato **non** cambia: la riga è ancora in
   * coda, è solo scesa in fondo — e la scadenza vince lo stesso.
   */
  protected readonly rimando = computed<string | null>(() => {
    const a = this.corrente();
    if (!a?.rimandatoFino) return null;
    const fino = new Date(a.rimandatoFino).getTime();
    if (Number.isNaN(fino) || fino <= this.adesso()) return null;
    const stessoGiorno =
      new Date(fino).toDateString() === new Date(this.adesso()).toDateString();
    return stessoGiorno
      ? `Rimandata fino alle ${ORA.format(fino)}`
      : `Rimandata fino al ${GIORNO_ORA.format(fino)}`;
  });

  /**
   * Modalità assenza (§3.5). ⚠️ È una **data**, non un interruttore: "in pausa"
   * è `pausaFino > adesso`, e una data passata è una pausa già finita — per
   * questo il banner si spegne da solo senza che nessuno debba ricordarsene.
   */
  protected readonly inPausa = computed(() => {
    const p = this.coda()?.pausaFino;
    if (!p) return false;
    const fino = new Date(p).getTime();
    return !Number.isNaN(fino) && fino > this.adesso();
  });

  protected readonly pausaEtichetta = computed(() => {
    const p = this.coda()?.pausaFino;
    if (!p) return '';
    const fino = new Date(p).getTime();
    return Number.isNaN(fino) ? '' : GIORNO.format(fino);
  });

  protected readonly notaValida = computed(
    () => this.notaScarto().trim().length >= NOTA_MIN,
  );

  protected categoriaLabel(c: NewsCategory): string {
    return NEWS_CATEGORY_LABELS[c] ?? c;
  }

  // ── Caricamento ──

  /**
   * ⚠️ `status` esplicito anche se il default lato server è lo stesso: questa
   * sezione **è** la coda da decidere, e un domani in cui il default cambiasse
   * la trasformerebbe in qualcos'altro senza che si veda.
   */
  private carica(): void {
    this.caricamento.set(true);
    this.erroreLista.set(null);
    this.api
      .adminList({ status: 'IN_REVISIONE', page: 1, limit: PAGE_SIZE })
      .subscribe({
        next: (coda) => {
          this.coda.set(coda);
          this.caricamento.set(false);
          // ⚠️ La barra si riaccende QUI, non alla risposta della decisione:
          // fra le due c'è una finestra in cui la card a schermo è ancora
          // quella appena decisa. Con i pulsanti già vivi, il secondo tocco di
          // un doppio tap sul telefono decide una riga che non è più in coda —
          // un 409 rosso al posto di un avanzamento.
          this.azione.set(null);
          // L'indice resta dov'è: la riga decisa è uscita dalla coda, quindi
          // lo stesso numero è già la card successiva (e una rimandata è
          // scesa in fondo). Si limita solo a non sfondare la lista.
          const max = Math.max(0, coda.items.length - 1);
          if (this.indice() > max) this.indice.set(max);
          this.azzeraBozze();
        },
        error: (err: unknown) => {
          this.caricamento.set(false);
          // Anche col ricaricamento fallito la barra deve tornare usabile: la
          // decisione precedente è già andata a buon fine.
          this.azione.set(null);
          // ⚠️ La coda già caricata resta in pagina: sostituirla con il vuoto
          // farebbe leggere un guasto di rete come "non c'è più niente da fare".
          this.erroreLista.set(
            apiErrorMessage(err, 'Caricamento della coda non riuscito.'),
          );
        },
      });
  }

  protected riprova(): void {
    this.carica();
  }

  /**
   * Correzioni al volo e conferme aperte valgono per UNA card sola.
   *
   * ⚠️ Si azzerano anche a ogni ricarica, non solo cambiando card: dopo una
   * decisione l'ordine lo rifà il server, quindi lo stesso indice può essere
   * un altro articolo — un titolo corretto che sopravvivesse alla ricarica
   * finirebbe addosso al pezzo sbagliato, ed è l'unico campo che l'approvazione
   * spedisce.
   */
  private azzeraBozze(): void {
    this.titoloBozza.set(null);
    this.notaScarto.set('');
    this.confirming.set(null);
  }

  // ── Navigazione fra le card ──

  protected vaiA(i: number): void {
    const ultimo = this.articoli().length - 1;
    if (i < 0 || i > ultimo || i === this.indice()) return;
    this.indice.set(i);
    this.azzeraBozze();
  }

  protected precedente(): void {
    this.vaiA(this.indice() - 1);
  }

  protected successivo(): void {
    this.vaiA(this.indice() + 1);
  }

  // ── Inline-confirm (idioma live-room: niente confirm() nativi) ──

  protected isConfirming(key: string): boolean {
    return this.confirming() === key;
  }

  protected askConfirm(key: string): void {
    this.confirming.set(key);
  }

  protected cancelConfirm(): void {
    this.confirming.set(null);
    this.notaScarto.set('');
  }

  // ── Campi ──

  protected onTitolo(event: Event): void {
    this.titoloBozza.set((event.target as HTMLInputElement).value);
  }

  protected onNota(event: Event): void {
    this.notaScarto.set((event.target as HTMLInputElement).value);
  }

  protected onPausaData(event: Event): void {
    this.pausaData.set((event.target as HTMLInputElement).value);
  }

  // ── Decisioni ──

  /**
   * Il cancello umano. ⚠️ Il titolo viaggia **solo se è cambiato**: mandarlo
   * sempre farebbe passare ogni approvazione dal ramo "correzione", e la
   * correzione è ciò che il backend ri-controlla contro la lista dell'art. 9.
   */
  protected pubblica(): void {
    const a = this.corrente();
    if (!a || !this.pubblicabile()) return;
    const t = this.titolo().trim();
    const payload: NewsApprovePayload = t === a.title ? {} : { title: t };
    this.esegui('pubblica', this.api.approve(a._id, payload), 'Articolo pubblicato.');
  }

  /**
   * "Rimanda" (D35): due ore in fondo alla coda, lo stato non cambia.
   *
   * ⚠️ Il messaggio si decide **prima** della chiamata, perché dopo la ricarica
   * la card in vista è un'altra. E sono due messaggi diversi di proposito: su
   * un pezzo che scade entro le due ore il rimando non è un rinvio, è una
   * rinuncia — dirgli "torna fra due ore" sarebbe una promessa che la spazzata
   * cancellerà da sola.
   */
  protected rimanda(): void {
    const a = this.corrente();
    if (!a) return;
    this.esegui(
      'rimanda',
      this.api.snooze(a._id),
      this.rimandoOltreScadenza()
        ? 'Rimandato — ma scade prima di risalire: senza una decisione diventerà «scaduto».'
        : 'Articolo rimandato: per due ore resta in fondo alla coda.',
    );
  }

  protected scarta(): void {
    const a = this.corrente();
    if (!a) return;
    const nota = this.notaScarto().trim();
    if (nota.length < NOTA_MIN) return;
    this.esegui('scarta', this.api.reject(a._id, nota), 'Articolo scartato.');
  }

  /**
   * Runner delle decisioni: una alla volta, esito a toast, ricarica completa.
   *
   * ⚠️ Ricarica, non una modifica in posto: una decisione toglie la riga dalla
   * coda (o la sposta in fondo), e l'ordine lo decide il server. È anche
   * l'avanzamento automatico alla card successiva.
   */
  private esegui(
    quale: 'pubblica' | 'rimanda' | 'scarta',
    work$: Observable<NewsAdmin>,
    messaggio: string,
  ): void {
    if (this.inVolo()) return;
    this.azione.set(quale);
    work$.subscribe({
      next: () => {
        // ⚠️ L'azione resta impostata: la spegne la ricarica qui sotto. Riaccendere
        // la barra adesso la offrirebbe per qualche decina di millisecondi
        // sopra la card appena decisa, che è ancora quella a schermo.
        this.toast.success(messaggio);
        // ⚠️ `force`: senza, il badge della sidebar resta indietro fino a 30s
        // e continua a contare un articolo appena deciso.
        this.pending.refresh(true);
        this.carica();
      },
      error: (err: unknown) => {
        this.azione.set(null);
        this.toast.error(apiErrorMessage(err, 'Operazione non riuscita.'));
        // ⚠️ Si ricarica sul 409 **e sul 404**, non solo sul primo: sono i due
        // codici che dicono "la riga in vista non è più decidibile" — decisa da
        // un'altra scheda o scaduta nella spazzata (409), oppure cancellata dal
        // form News mentre la card era aperta (404, il ramo `NotFound` di
        // `conflittoRicaricato`). Restando lì, la coda continuerebbe a mostrare
        // e a contare un articolo che non esiste, con "Pubblica" acceso sopra.
        // Su un errore di rete NON si ricarica: rispondere a un guasto con una
        // seconda chiamata che fallisce uguale non aggiunge niente.
        const stato = err instanceof HttpErrorResponse ? err.status : 0;
        if (stato === 409 || stato === 404) this.carica();
      },
    });
  }

  // ── Modalità assenza ──

  /**
   * ⚠️ La data scelta vale **fino a tutto** quel giorno: l'owner che scrive
   * "in pausa fino al 25" intende il 25 compreso. Si manda quindi la fine
   * della giornata locale, non la mezzanotte che la apre.
   */
  protected confermaPausa(): void {
    if (this.pausaInVolo()) return;
    const [y, m, d] = this.pausaData().split('-').map(Number);
    if (!y || !m || !d) {
      this.toast.error('Scegli il giorno fino al quale fermare la generazione.');
      return;
    }
    const fine = new Date(y, m - 1, d, 23, 59, 59, 999);
    if (fine.getTime() <= Date.now()) {
      this.toast.error('Scegli una data futura: una pausa già scaduta non ferma nulla.');
      return;
    }
    this.scrivePausa(
      fine.toISOString(),
      `Generazione in pausa fino al ${GIORNO.format(fine)}.`,
    );
  }

  /** `null` = riprendi subito. È un valore legittimo, non un campo omesso. */
  protected riprendi(): void {
    if (this.pausaInVolo()) return;
    this.scrivePausa(null, 'Generazione ripresa.');
  }

  private scrivePausa(fino: string | null, messaggio: string): void {
    this.pausaInVolo.set(true);
    this.api.impostaPausa(fino).subscribe({
      next: () => {
        this.pausaInVolo.set(false);
        this.confirming.set(null);
        this.pausaData.set('');
        this.toast.success(messaggio);
        // Non esiste una GET gemella dello stato pausa: lo riporta l'envelope
        // della coda, quindi si rilegge la coda.
        this.carica();
      },
      error: (err: unknown) => {
        this.pausaInVolo.set(false);
        this.toast.error(
          apiErrorMessage(err, 'Impostazione della pausa non riuscita.'),
        );
      },
    });
  }
}
