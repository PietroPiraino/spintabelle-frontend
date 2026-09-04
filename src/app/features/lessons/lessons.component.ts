import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Subject, catchError, debounceTime, of } from 'rxjs';
import {
  LESSON_CATEGORY_LABELS,
  Lesson,
  LessonCategory,
  LessonStakes,
  LessonsSommario,
} from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LessonsService } from '../../core/services/lessons.service';
import { SeoService } from '../../core/services/seo.service';
import { apiErrorMessage } from '../../core/utils/http-error';
import { HeroCardsComponent } from '../../shared/ui/hero-cards/hero-cards.component';
import { frecceRadiogroup } from '../../shared/a11y/radiogroup';
import { IconComponent } from '../../shared/ui/icon/icon.component';
import {
  BunnyPlayerComponent,
  type BunnyProgress,
} from '../../shared/ui/bunny-player/bunny-player.component';

/** Sezione stakes: tutte, solo Low o solo High. */
type StakesFilter = 'all' | LessonStakes;

/** Un filtro acceso, mostrato come chip removibile sopra i risultati. */
interface ChipFiltro {
  tipo: 'q' | 'stakes' | 'tag' | 'categoria';
  /** Valore su cui agisce `rimuoviFiltro` (il tag, o la sezione stakes). */
  chiave: string;
  etichetta: string;
}

/** Lezioni per pagina: la griglia è a 2 colonne → 12 righe per batch. */
const PAGE_SIZE = 24;

/**
 * Tag stampati su una card; il resto finisce in un `+N` non cliccabile.
 *
 * ⚠️ È il secondo pezzo di muraglia, e pesa più del primo: ogni tag di card è
 * un `<button class="badge--tag">`, e `styles/_cards.scss` dichiara
 * `min-height: 44px` proprio su quei bottoni (giustamente: sono filtri anche
 * lì). Con 24 card in griglia, ogni riga di tag in più è una riga da 44px
 * moltiplicata per 24.
 *
 * ⚠️ È anche una perdita netta di informazione senza via d'uscita: non esiste
 * una pagina di dettaglio della lezione dove leggere i tag tagliati, e il
 * `title` del `+N` in pratica funziona solo col mouse. Il numero si alza qui,
 * in un punto solo, guardando la pagina.
 */
const MAX_TAG_CARD = 4;

/** Oltre questo numero di tag la fila si richiude in un `<details>`. */
const SOGLIA_DISCLOSURE_TAG = 8;

/** Oltre questo, dentro il pannello compare la ricerca fra i tag. */
const SOGLIA_CERCA_TAG = 20;

/** Finestra del badge «Nuova», in giorni, misurata su `createdAt`. */
const GIORNI_NUOVA = 14;

@Component({
  selector: 'app-lessons',
  imports: [
    BunnyPlayerComponent,
    DatePipe,
    RouterLink,
    HeroCardsComponent,
    IconComponent,
    // ⚠️ Serve per il `<ng-template #media>`: il blocco poster/player/bloccata
    // è scritto UNA volta e consumato sia dalla card in evidenza sia da quelle
    // in griglia. È il punto di montaggio dell'iframe Bunny, cioè ciò su cui
    // poggia l'esimente dell'art. 122: due copie sarebbero due punti da tenere
    // allineati, e la spec ne guarderebbe uno solo.
    NgTemplateOutlet,
  ],
  templateUrl: './lessons.component.html',
  styleUrl: './lessons.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonsComponent {
  private readonly lessonsApi = inject(LessonsService);
  protected readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Il catalogo è già stato caricato per questo utente (guardia dell'effect). */
  private loadedForUserId: string | null = null;

  /**
   * FAQ del teaser pubblico: unica sorgente per il testo a schermo e per il
   * JSON-LD FAQPage. ⚠️ Niente prezzi e niente conteggi di lezioni: i primi
   * sono env-driven (`SUB_PRICE_*` vince sul codice), i secondi arriverebbero
   * da un endpoint che richiede il JWT e qui non è disponibile.
   */
  protected readonly faq: readonly { q: string; a: string }[] = [
    {
      q: 'Le lezioni sono adatte a chi inizia adesso?',
      a: "Sì, purché tu conosca le regole del Texas Hold'em. Il percorso parte dalle decisioni preflop, che nel 3-max hyper turbo sono la maggior parte del gioco, e sale gradualmente verso postflop e heads-up finale. Chi gioca già da tempo di solito salta la parte iniziale e usa i tag per andare sull'argomento che gli manca.",
    },
    {
      q: 'In che lingua sono?',
      a: 'Tutte in italiano, spiegate dai coach della scuola. È la ragione principale per cui molti giocatori italiani arrivano qui: il materiale serio su Spin & Go e Twister è quasi tutto in inglese.',
    },
    {
      q: 'Posso vedere qualcosa senza abbonarmi?',
      a: "Sì. Una parte del catalogo è aperta a tutti gli iscritti e la registrazione è gratuita. Le lezioni riservate restano comunque visibili nell'elenco, con l'indicazione di cosa serve per sbloccarle: si vede sempre cosa contiene la scuola, non una pagina vuota.",
    },
    {
      q: 'Ogni quanto vengono aggiunte nuove lezioni?',
      a: 'Il catalogo cresce con i nuovi contenuti dei coach e con le registrazioni delle sessioni dal vivo, che vengono pubblicate come lezioni. Gli abbonati ricevono un avviso via email a ogni nuova pubblicazione, disattivabile dalle impostazioni account.',
    },
    {
      q: 'Servono software o strumenti a pagamento per seguirle?',
      a: "No. Le tabelle preflop e il simulatore di varianza sono già sul sito e inclusi nell'account. Alcuni materiali di supporto sono filtri e report per PokerTracker 4, utili se lo usi già, ma non sono necessari per seguire le lezioni.",
    },
  ];

  protected readonly pageSize = PAGE_SIZE;

  /** Lezioni accumulate ("carica altre"); null = primo caricamento in corso. */
  protected readonly lessons = signal<Lesson[] | null>(null);
  protected readonly total = signal(0);
  protected readonly hasMore = signal(false);
  /** Una richiesta lista è in volo (primo load, cambio filtro o carica-altre). */
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  /** Errore dell'ultima richiesta lista: mai mascherato da "nessuna lezione". */
  protected readonly error = signal<string | null>(null);

  /**
   * Tag disponibili per i filtri.
   * ⚠️ Era un `toSignal(getTags())` come field initializer, quindi partiva
   * SEMPRE — anche per un anonimo e in prerender. `GET /lessons/tags` richiede
   * il JWT: il 401 mandava l'interceptor sul giro di refresh, che senza cookie
   * di sessione non si chiudeva, e il prerender di /lezioni moriva in timeout
   * ("Request for: http://ng-localhost/lezioni was aborted"). Ora si popola
   * dentro l'effect gated su `auth.user()`, come il catalogo.
   */
  protected readonly tags = signal<string[]>([]);

  /**
   * Conteggi per categoria: alimentano le pillole dell'asse primario.
   *
   * ⚠️ I numeri sono la dimensione della categoria nel CATALOGO, non del
   * risultato filtrato, e NON si aggiornano digitando nella ricerca:
   * ricalcolarli per filtro vorrebbe dire una chiamata per battuta di tastiera.
   * Con «bb defense» digitato la pillola dirà ancora «Preflop 3-max 12» mentre
   * la toolbar dice «3 lezioni» — è corretto, è come funziona una biblioteca,
   * ed è il primo posto in cui qualcuno dirà «il numero è sbagliato». La riga
   * di intestazione dei risultati esiste anche per questo.
   */
  protected readonly sommario = signal<LessonsSommario | null>(null);
  /**
   * Quante lezioni ha il catalogo in tutto — le classificate più la coda.
   *
   * ⚠️ Sta sulla pillola «Tutte» per DUE ragioni. La prima è disambiguare: la
   * riga sotto ha anch'essa una pillola «Tutte» (gli stakes), e due «Tutte»
   * incolonnate senza altro segno si leggono come lo stesso comando. La
   * seconda è che accanto a «4 lezioni» della toolbar rende visibile la
   * differenza fra la dimensione del CATALOGO e quella del RISULTATO — che è
   * la domanda che qualcuno farà guardando i conteggi delle pillole fermi
   * mentre digita nella ricerca.
   */
  protected readonly totaleCatalogo = computed(() => {
    const s = this.sommario();
    if (!s) return 0;
    return (
      s.categorie.reduce((n, c) => n + c.count, 0) + s.senzaCategoria
    );
  });

  /** Categoria scelta; `null` = tutte. */
  protected readonly categoria = signal<LessonCategory | null>(null);
  protected readonly categoryLabels = LESSON_CATEGORY_LABELS;

  protected readonly searchTerm = signal('');
  /** tag selezionati: una lezione passa solo se li contiene TUTTI (logica AND) */
  protected readonly selectedTags = signal<string[]>([]);
  protected readonly stakesFilter = signal<StakesFilter>('all');
  /** id della lezione con il player aperto (click-to-play) */
  protected readonly playingId = signal<string | null>(null);
  /** Lezioni che l'utente ha già aperto: alimenta il badge "già visto". */
  protected readonly viste = signal<ReadonlySet<string>>(new Set());
  /** Ultimo avanzamento inviato per lezione (throttling): non è stato di UI. */
  private readonly progressSent = new Map<
    string,
    { seconds: number; at: number }
  >();

  private page = 1;
  /** Scarta le risposte superate da un cambio filtro più recente. */
  private requestSeq = 0;
  private readonly search$ = new Subject<string>();

  /** True quando c'è almeno un filtro attivo (ricerca, tag o sezione stakes). */
  protected readonly hasFilters = computed(
    () =>
      this.searchTerm().trim().length > 0 ||
      this.selectedTags().length > 0 ||
      this.categoria() !== null ||
      this.stakesFilter() !== 'all',
  );

  // ── Card in evidenza ──────────────────────────────────────────────────────

  /**
   * La lezione in evidenza: la prima dell'elenco, che per costruzione è la più
   * recente (il server ordina `{videoDate: -1, _id: -1}`).
   *
   * ⚠️ Sparisce con QUALUNQUE filtro attivo. Chi filtra ha smesso di sfogliare
   * e ha cominciato a cercare: una card fissa che ignora la sua richiesta gli
   * spinge i risultati sotto la piega, e «in evidenza» dentro un risultato
   * filtrato vorrebbe dire «la più recente fra queste quattro», cioè niente.
   *
   * ⚠️ Il `> 1` non è una rifinitura: con una sola lezione l'evidenza sarebbe
   * la card sopra una griglia vuota.
   */
  protected readonly inEvidenza = computed<Lesson | null>(() => {
    const l = this.lessons();
    if (!l || l.length <= 1 || this.hasFilters()) return null;
    return l[0];
  });

  /**
   * Le lezioni della griglia: tutte, meno quella in evidenza.
   *
   * ⚠️ Toglierla dalla griglia NON rompe niente, contro il timore ovvio:
   * `total` viene dall'envelope del server, il dedup per id gira
   * sull'accumulatore e l'offset della paginazione è `this.page`. La griglia è
   * solo una vista su `lessons()`.
   */
  protected readonly inGriglia = computed<Lesson[] | null>(() => {
    const l = this.lessons();
    if (!l) return null;
    return this.inEvidenza() ? l.slice(1) : l;
  });

  // ── Fila dei tag: adattiva al numero di tag ───────────────────────────────

  protected readonly mostraDisclosureTag = computed(
    () => this.tags().length > SOGLIA_DISCLOSURE_TAG,
  );
  protected readonly mostraCercaTag = computed(
    () => this.tags().length > SOGLIA_CERCA_TAG,
  );

  /** Testo digitato nella ricerca DENTRO il pannello dei tag (client-side). */
  protected readonly filtroTag = signal('');

  /**
   * Stato aperto/chiuso del pannello tag.
   *
   * ⚠️ È un signal scritto dall'evento `toggle` e MAI derivato da
   * `selectedTags()`: legandolo alla selezione, deselezionando l'ultimo tag il
   * pannello si richiuderebbe **in faccia a chi lo sta usando**. Che un filtro
   * acceso resti visibile lo garantiscono i chip dei filtri attivi, che stanno
   * fuori dal pannello ed esistono apposta.
   */
  protected readonly tagAperti = signal(false);

  /**
   * I tag da disegnare nel pannello, filtrati dalla ricerca interna.
   * ⚠️ Un tag SELEZIONATO resta sempre visibile anche se non corrisponde alla
   * ricerca: nasconderlo lascerebbe acceso un filtro che non si può spegnere
   * da lì.
   */
  protected readonly tagVisibili = computed(() => {
    const q = this.filtroTag().trim().toLowerCase();
    const tutti = this.tags();
    if (!q) return tutti;
    const sel = this.selectedTags();
    return tutti.filter(
      (t) => t.toLowerCase().includes(q) || sel.includes(t),
    );
  });

  // ── Intestazione dei risultati e chip dei filtri attivi ───────────────────

  /**
   * Che cosa si sta guardando. È anche ciò che rende leggibile la sparizione
   * della card in evidenza: la pagina dichiara di aver cambiato modo, invece
   * di far sembrare che una card sia svanita.
   */
  protected readonly titoloRisultati = computed(() => {
    const q = this.searchTerm().trim();
    if (q) return `Risultati per «${q}»`;
    const cat = this.categoria();
    if (cat) return LESSON_CATEGORY_LABELS[cat];
    const tag = this.selectedTags();
    if (tag.length === 1) return `Argomento: ${tag[0]}`;
    if (tag.length > 1) return `${tag.length} argomenti selezionati`;
    const s = this.stakesFilter();
    if (s === 'LOW') return 'Lezioni low stakes';
    if (s === 'HIGH') return 'Lezioni high stakes';
    return 'Tutte le lezioni';
  });

  /**
   * Un chip per filtro acceso. È l'unica cosa sempre visibile che spiega perché
   * la lista mostra quattro risultati — e prima non esisteva: «Azzera i filtri»
   * viveva SOLO dentro lo stato vuoto, cioè si poteva azzerare soltanto dopo
   * aver trovato zero lezioni.
   */
  protected readonly filtriAttivi = computed<ChipFiltro[]>(() => {
    const out: ChipFiltro[] = [];
    const q = this.searchTerm().trim();
    if (q) out.push({ tipo: 'q', chiave: q, etichetta: `«${q}»` });
    const cat = this.categoria();
    if (cat) {
      out.push({
        tipo: 'categoria',
        chiave: cat,
        etichetta: LESSON_CATEGORY_LABELS[cat],
      });
    }
    const s = this.stakesFilter();
    if (s !== 'all') {
      out.push({
        tipo: 'stakes',
        chiave: s,
        etichetta: s === 'LOW' ? 'Low stakes' : 'High stakes',
      });
    }
    for (const t of this.selectedTags()) {
      out.push({ tipo: 'tag', chiave: t, etichetta: t });
    }
    return out;
  });

  /**
   * Istante oltre il quale una lezione è «Nuova», calcolato UNA volta.
   *
   * ⚠️ La finestra si misura su `createdAt` e non su `videoDate`: quest'ultima
   * è una data EDITORIALE scelta a mano dall'admin e retrodatabile, quindi una
   * lezione appena pubblicata ma datata a marzo non finirebbe in cima — e il
   * badge è l'unico modo di dire «è appena uscita» quando l'ordinamento non lo
   * dice. Il campo viaggia già nella risposta, non serve nulla dal backend.
   */
  private readonly sogliaNuova =
    Date.now() - GIORNI_NUOVA * 24 * 60 * 60 * 1000;

  constructor() {
    // FAQPage dello stesso `faq` mostrato nel teaser pubblico. Rimosso su
    // destroy, altrimenti resta nel <head> navigando altrove.
    this.seo.setJsonLd('ld-lezioni-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    this.destroyRef.onDestroy(() => this.seo.removeJsonLd('ld-lezioni-faq'));

    this.search$
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((term) => {
        if (term === this.searchTerm()) return;
        this.searchTerm.set(term);
        this.reload();
      });
    // ⚠️ Il catalogo parte da un effect su `auth.user()`, non da una chiamata
    // secca: da quando la rotta non ha più `authGuard`, il componente monta
    // anche per un anonimo e in prerender. Una `load()` incondizionata qui
    // sparerebbe un 401 a ogni visita pubblica e, al build, terrebbe il
    // prerender in attesa di una chiamata destinata a fallire.
    // Guardia "già caricato per questo id": un refresh di sessione ricrea
    // l'oggetto User ma non ne cambia l'id, quindi non ricarica nulla.
    // Stesso idioma di features/affiliations.
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.loadedForUserId = null;
        return;
      }
      if (this.loadedForUserId === user.id) return;
      this.loadedForUserId = user.id;
      untracked(() => {
        this.load();
        // Una sola richiesta per sessione: quali lezioni ho già aperto.
        // Best-effort, il badge è un di più — se fallisce la lista funziona
        // identica. Sta qui dentro perché anch'essa richiede il JWT.
        this.lessonsApi.myViews().subscribe({
          next: (rows) => this.viste.set(new Set(rows.map((r) => r.lessonId))),
          error: () => undefined,
        });
        this.caricaTag();
        // Conteggi per categoria. ⚠️ Best-effort come le altre due chiamate qui
        // dentro: contro un backend vecchio `/lessons/sommario` cade su
        // `@Get(':id')` e torna 404, e un `subscribe` senza handler d'errore
        // genererebbe un errore non gestito.
        this.lessonsApi.sommario().subscribe({
          next: (s) => this.sommario.set(s),
          error: () => undefined,
        });
      });
    });
  }

  /**
   * Ricarica da pagina 1 (i filtri sono applicati dal backend). La lista
   * corrente resta visibile finché non arriva la risposta (niente flash).
   */
  private reload(): void {
    this.page = 1;
    this.load();
  }

  private load(append = false): void {
    const seq = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);
    const term = this.searchTerm().trim();
    const tags = this.selectedTags();
    const stakes = this.stakesFilter();
    this.lessonsApi
      .getLessons({
        page: this.page,
        limit: PAGE_SIZE,
        q: term || undefined,
        tags: tags.length > 0 ? tags : undefined,
        stakes: stakes === 'all' ? undefined : stakes,
        categoria: this.categoria() ?? undefined,
      })
      .subscribe({
        next: (res) => {
          if (seq !== this.requestSeq) return;
          this.lessons.update((cur) =>
            append
              ? [
                  ...(cur ?? []),
                  // dedup: una pubblicazione concorrente sposta la finestra
                  // di offset e ripresenterebbe l'ultimo item della pagina prima
                  ...res.items.filter(
                    (item) => !(cur ?? []).some((c) => c.id === item.id),
                  ),
                ]
              : res.items,
          );
          this.total.set(res.total);
          this.hasMore.set(res.page < res.totalPages);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: (err: unknown) => {
          if (seq !== this.requestSeq) return;
          // il retry di "carica altre" deve richiedere la STESSA pagina
          if (append) this.page -= 1;
          this.lessons.update((cur) => cur ?? []);
          this.error.set(
            apiErrorMessage(err, 'Caricamento delle lezioni non riuscito.'),
          );
          this.loading.set(false);
          this.loadingMore.set(false);
        },
      });
  }

  /** Riprova dopo un errore, ripartendo dalla prima pagina dei filtri attuali. */
  protected retry(): void {
    this.reload();
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    this.loadingMore.set(true);
    this.page += 1;
    this.load(true);
  }

  protected toggleTag(tag: string): void {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
    this.reload();
  }

  protected setStakes(filter: StakesFilter): void {
    if (this.stakesFilter() === filter) return;
    this.stakesFilter.set(filter);
    this.reload();
  }

  /**
   * Le tre sezioni stakes, con la loro etichetta: UNA lista, non un array di
   * valori accanto a tre stringhe scritte nel template. Serve anche alle
   * frecce, che devono conoscere l'ordine.
   */
  protected readonly sezioniStakes: readonly {
    valore: StakesFilter;
    etichetta: string;
  }[] = [
    { valore: 'all', etichetta: 'Tutte' },
    { valore: 'LOW', etichetta: 'Low stakes' },
    { valore: 'HIGH', etichetta: 'High stakes' },
  ];

  /**
   * Frecce dentro il gruppo esclusivo delle sezioni stakes (roving tabindex).
   *
   * ⚠️ `role="radiogroup"` PROMETTE questo comportamento: uno screen reader
   * annuncia «1 di 3» e si aspetta che le frecce spostino la scelta.
   * Dichiarare il ruolo senza implementarlo è peggio che non dichiararlo,
   * perché costruisce un'aspettativa e poi non la mantiene.
   */
  protected onCategorieKeydown(event: KeyboardEvent): void {
    const cat = this.sommario()?.categorie ?? [];
    // indice 0 = «Tutte», poi le categorie nell'ordine del programma
    const corrente = this.categoria();
    const i = corrente
      ? cat.findIndex((c) => c.categoria === corrente) + 1
      : 0;
    frecceRadiogroup(event, cat.length + 1, i, (j) =>
      this.setCategoria(j === 0 ? null : cat[j - 1].categoria),
    );
  }

  protected onStakesKeydown(event: KeyboardEvent): void {
    frecceRadiogroup(
      event,
      this.sezioniStakes.length,
      this.sezioniStakes.findIndex((s) => s.valore === this.stakesFilter()),
      (j) => this.setStakes(this.sezioniStakes[j].valore),
    );
  }

  /**
   * Cambia categoria: riparte da pagina 1 E ricarica i tag ristretti a quella
   * categoria — è ciò che rende i tag un secondo livello invece di una seconda
   * tassonomia parallela.
   */
  protected setCategoria(c: LessonCategory | null): void {
    if (this.categoria() === c) return;
    this.categoria.set(c);
    // ⚠️ I tag scelti si azzerano: sopravvivendo al cambio di categoria
    // resterebbero accesi filtri che nella nuova categoria non esistono, e la
    // lista uscirebbe vuota senza che si capisca perché.
    this.selectedTags.set([]);
    this.filtroTag.set('');
    this.caricaTag();
    this.reload();
  }

  /** I tag della categoria corrente. Best-effort: un errore lascia la fila vuota. */
  private caricaTag(): void {
    this.lessonsApi
      .getTags(this.categoria() ?? undefined)
      .pipe(catchError(() => of([] as string[])))
      .subscribe((t) => this.tags.set(t));
  }

  protected resetFilters(): void {
    this.categoria.set(null);
    this.filtroTag.set('');
    this.searchTerm.set('');
    // soppianta un'eventuale emissione debounce in volo (la ricerca azzerata
    // non deve "risorgere" 300ms dopo); la guardia '' === '' evita il doppio reload
    this.search$.next('');
    this.selectedTags.set([]);
    this.stakesFilter.set('all');
    this.caricaTag();
    this.reload();
  }

  /** Spegne UN filtro dal suo chip. */
  protected rimuoviFiltro(c: ChipFiltro): void {
    if (c.tipo === 'tag') {
      this.toggleTag(c.chiave);
      return;
    }
    if (c.tipo === 'stakes') {
      this.setStakes('all');
      return;
    }
    if (c.tipo === 'categoria') {
      this.setCategoria(null);
      return;
    }
    // ricerca: stesso trattamento di `resetFilters` — svuotare il signal senza
    // soppiantare il debounce lascerebbe "risorgere" il termine 300ms dopo.
    this.searchTerm.set('');
    this.search$.next('');
    this.reload();
  }

  protected onFiltroTag(event: Event): void {
    this.filtroTag.set((event.target as HTMLInputElement).value);
  }

  protected onTagToggle(event: Event): void {
    this.tagAperti.set((event.target as HTMLDetailsElement).open);
  }

  /** true se la lezione è stata pubblicata negli ultimi giorni (badge «Nuova»). */
  protected isNuova(l: Lesson): boolean {
    if (!l.createdAt) return false;
    return new Date(l.createdAt).getTime() >= this.sogliaNuova;
  }

  /**
   * I tag da stampare sulla card: i selezionati davanti, poi gli altri
   * nell'ordine originale, tagliati a `MAX_TAG_CARD`.
   * (`Array.prototype.sort` è stabile: i non selezionati non si rimescolano.)
   */
  protected tagCard(l: Lesson): string[] {
    if (l.tags.length <= MAX_TAG_CARD) return l.tags;
    const sel = this.selectedTags();
    return [...l.tags]
      .sort((a, b) => Number(sel.includes(b)) - Number(sel.includes(a)))
      .slice(0, MAX_TAG_CARD);
  }

  /** I tag che il taglio ha nascosto: alimentano il `+N` e il suo `title`. */
  protected tagNascosti(l: Lesson): string[] {
    if (l.tags.length <= MAX_TAG_CARD) return [];
    const mostrati = new Set(this.tagCard(l));
    return l.tags.filter((t) => !mostrati.has(t));
  }

  /**
   * Ritardo dell'animazione di ingresso, relativo al BATCH e non all'indice di
   * griglia.
   *
   * ⚠️ Senza il correttivo `+1` la card in evidenza sfalsa tutto, e il modo in
   * cui fallisce è invisibile a ogni test: `.rise` ha `animation-fill-mode:
   * both`, quindi il ritardo è tempo passato a `opacity: 0`. Togliendo la prima
   * lezione dalla griglia, il primo elemento del secondo batch scivola
   * dall'indice 24 (ritardo 0) al 23 — cioè 1380 ms di nulla dopo aver premuto
   * «Carica altre lezioni».
   */
  protected ritardoRise(i: number): number {
    return (((i + (this.inEvidenza() ? 1 : 0)) % PAGE_SIZE) * 60);
  }

  /**
   * Monta il player (click-to-load) e registra l'apertura.
   *
   * ⚠️ Il montaggio DEVE restare qui, dietro il clic: il player scrive in
   * localStorage già al caricamento dell'iframe, e l'esimente dell'art. 122
   * Codice Privacy poggia su questa condotta. Montarlo al caricamento della
   * pagina la farebbe cadere. (Il clic **non è consenso** ex art. 7: è la
   * richiesta esplicita del servizio.)
   *
   * Il tracking è fire-and-forget: un evento accessorio non deve mai far
   * fallire né ritardare la visione, e l'errore non si mostra all'utente.
   */
  protected play(id: string): void {
    this.playingId.set(id);
    this.viste.update((set) => new Set(set).add(id));
    this.lessonsApi.trackView(id).subscribe({ error: () => undefined });
  }

  /** true se l'utente ha già aperto questa lezione (badge "già visto"). */
  protected isViewed(id: string): boolean {
    return this.viste().has(id);
  }

  /**
   * Avanzamento riportato dal player. Arriva ~4 volte al secondo: si invia al
   * massimo una volta al minuto e solo se il punto più avanzato è cresciuto di
   * almeno 15 secondi — altrimenti sarebbero migliaia di richieste per lezione.
   *
   * Si manda sempre il MASSIMO raggiunto, non la posizione corrente: chi torna
   * indietro a rivedere un passaggio non deve "perdere" i minuti già guardati.
   * L'ultimo pezzo (fino a un minuto) può andare perso alla chiusura della
   * pagina: `sendBeacon` non può portare il token, che vive solo in memoria.
   */
  protected onProgress(lessonId: string, p: BunnyProgress): void {
    const now = Date.now();
    const prev = this.progressSent.get(lessonId);
    const maxSeconds = Math.max(prev?.seconds ?? 0, p.seconds);
    if (prev && now - prev.at < 60_000 && maxSeconds - prev.seconds < 15) {
      // ancora troppo presto: aggiorna solo il massimo locale
      this.progressSent.set(lessonId, { ...prev, seconds: maxSeconds });
      return;
    }
    this.progressSent.set(lessonId, { seconds: maxSeconds, at: now });
    this.lessonsApi
      .trackProgress(lessonId, maxSeconds, p.duration)
      .subscribe({ error: () => undefined });
  }

  /** Nasconde la copertina se non carica (video senza thumbnail) → resta il gradiente. */
  protected onThumbError(event: Event): void {
    (event.target as HTMLElement).style.display = 'none';
  }

  protected onSearch(event: Event): void {
    this.search$.next((event.target as HTMLInputElement).value);
  }
}
