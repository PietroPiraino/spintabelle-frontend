import { DatePipe } from '@angular/common';
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
import { Lesson, LessonStakes } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LessonsService } from '../../core/services/lessons.service';
import { SeoService } from '../../core/services/seo.service';
import { apiErrorMessage } from '../../core/utils/http-error';
import {
  BunnyPlayerComponent,
  type BunnyProgress,
} from '../../shared/ui/bunny-player/bunny-player.component';

/** Sezione stakes: tutte, solo Low o solo High. */
type StakesFilter = 'all' | LessonStakes;

/** Lezioni per pagina: la griglia è a 2 colonne → 12 righe per batch. */
const PAGE_SIZE = 24;

@Component({
  selector: 'app-lessons',
  imports: [BunnyPlayerComponent, DatePipe, RouterLink],
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
      a: "Sì, purché tu conosca le regole del Texas Hold'em. Il percorso parte dalle decisioni preflop, che nel 3-max hyper turbo sono la maggior parte del gioco, e sale gradualmente verso postflop e ICM. Chi gioca già da tempo di solito salta la parte iniziale e usa i tag per andare sull'argomento che gli manca.",
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
      this.stakesFilter() !== 'all',
  );

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
        this.lessonsApi
          .getTags()
          .pipe(catchError(() => of([] as string[])))
          .subscribe((t) => this.tags.set(t));
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

  protected resetFilters(): void {
    this.searchTerm.set('');
    // soppianta un'eventuale emissione debounce in volo (la ricerca azzerata
    // non deve "risorgere" 300ms dopo); la guardia '' === '' evita il doppio reload
    this.search$.next('');
    this.selectedTags.set([]);
    this.stakesFilter.set('all');
    this.reload();
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
