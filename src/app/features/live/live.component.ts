import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LiveSession } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LiveService } from '../../core/services/live.service';
import { SeoService } from '../../core/services/seo.service';
import { apiErrorMessage } from '../../core/utils/http-error';

/**
 * Con quanto anticipo la stanza si considera aperta.
 *
 * ⚠️ È lo stesso numero di `LIVE_REMINDER_MINUTES` lato backend (il promemoria
 * Discord «live in arrivo»). Non è una coincidenza da mantenere a mano: è la
 * definizione che il progetto ha già dato di «sta per iniziare», e due anticipi
 * diversi vorrebbero dire che l'avviso arriva quando il sito dice ancora di no.
 */
const ANTICIPO_APERTURA_MIN = 60;

@Component({
  selector: 'app-live',
  imports: [DatePipe, RouterLink],
  templateUrl: './live.component.html',
  styleUrl: './live.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveComponent {
  private readonly liveApi = inject(LiveService);
  protected readonly auth = inject(AuthService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * L'orologio, come SEGNALE.
   *
   * ⚠️ Senza, `stato()` verrebbe calcolato una volta al mount e non si
   * aggiornerebbe mai: chi tiene aperta la pagina vedrebbe per sempre la
   * situazione del momento in cui è entrato, e una sessione non passerebbe mai
   * da «imminente» a «in diretta ora» — proprio nei minuti in cui la pagina
   * serve. Trenta secondi bastano: la soglia più fine che mostriamo è il
   * minuto.
   */
  private readonly adesso = signal(Date.now());

  protected readonly sessions = signal<LiveSession[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Il calendario è già stato caricato per questo utente (guardia dell'effect). */
  private loadedForUserId: string | null = null;

  /**
   * FAQ del teaser pubblico: unica sorgente per il testo a schermo e per il
   * JSON-LD FAQPage. ⚠️ Niente calendario reale qui: `GET /live` richiede il
   * JWT, quindi date e titoli delle sessioni non sono disponibili.
   */
  protected readonly faq: readonly { q: string; a: string }[] = [
    {
      q: 'Come si svolgono le lezioni dal vivo?',
      a: "In una sala interna al sito, senza installare nulla: il coach trasmette video, audio e schermo, chi partecipa può intervenire a voce e scrivere in chat. Su richiesta uno studente può condividere il proprio schermo per farsi rivedere una sessione davanti a tutti.",
    },
    {
      q: 'Servono Zoom, Discord o altri programmi?',
      a: "No, la sala è una pagina del sito e funziona dal browser. La condivisione dello schermo richiede però un computer: i browser mobili non la supportano. Guardare e parlare, invece, funzionano anche da telefono.",
    },
    {
      q: 'Se non posso esserci, la sessione resta disponibile?',
      a: "Sì, quando la sessione viene registrata: la registrazione viene poi pubblicata come lezione nel catalogo, gated per lo stesso livello della live. Chi entra in una sessione registrata vede un avviso e deve dare il proprio consenso prima di partecipare.",
    },
    {
      q: 'Chi può partecipare?',
      a: "Le sessioni sono riservate agli abbonati, e il livello di gioco trattato determina quale piano serve. L'elenco delle sessioni in programma è visibile a tutti gli iscritti: la registrazione al sito è gratuita.",
    },
  ];

  constructor() {
    // ⚠️ Solo nel browser: in prerender `setInterval` girerebbe in Node e
    // terrebbe vivo il processo, impedendo alla pagina di stabilizzarsi.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const t = setInterval(() => this.adesso.set(Date.now()), 30_000);
      this.destroyRef.onDestroy(() => clearInterval(t));
    }

    this.seo.setJsonLd('ld-live-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: this.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
    this.destroyRef.onDestroy(() => this.seo.removeJsonLd('ld-live-faq'));

    // ⚠️ Gated su `auth.user()`: senza `authGuard` sulla rotta il componente
    // monta anche per un anonimo e in prerender, e `GET /live` richiede il JWT.
    // Una `load()` incondizionata faceva morire il prerender in timeout (il 401
    // manda l'interceptor sul giro di refresh, che senza cookie non si chiude).
    effect(() => {
      const user = this.auth.user();
      if (!user) {
        this.loadedForUserId = null;
        return;
      }
      if (this.loadedForUserId === user.id) return;
      this.loadedForUserId = user.id;
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.liveApi.getSessions().subscribe({
      next: (sessions) => {
        this.sessions.set(sessions);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.sessions.update((cur) => cur ?? []);
        this.error.set(
          apiErrorMessage(err, 'Caricamento delle sessioni non riuscito.'),
        );
      },
    });
  }

  /**
   * "In diretta ora": iniziata da non oltre la durata prevista (default 90 min)
   * e non terminata dal coach. Usata per il badge nella lista.
   */
  protected isLiveNow(s: LiveSession): boolean {
    if (s.ended) return false;
    const start = new Date(s.startsAt).getTime();
    const now = this.adesso();
    const windowMs = (s.durationMin && s.durationMin > 0 ? s.durationMin : 90) * 60_000;
    return now >= start && now <= start + windowMs;
  }

  /**
   * Lo stato di una sessione, in quattro gradi.
   *
   * ⚠️ PERCHÉ ESISTE. Fino al 27/08/2026 «Entra nella stanza» compariva con lo
   * STESSO peso su ogni sessione, comprese quelle fra dieci giorni — e non era
   * solo un problema visivo: `canJoinLive` è `unlocked && !endedAt` e **non
   * guarda l'orologio**, né nel service né nell'endpoint che conia il token.
   * Quel pulsante era davvero cliccabile, e portava in una stanza LiveKit
   * effimera vuota, senza coach e senza spiegazione. `isLiveNow` esisteva già
   * ma pilotava soltanto il badge rosso, mai il pulsante.
   *
   * ⚠️ Resta una CONVENZIONE DEL CLIENT, non una verità: chi ha l'URL diretto
   * della stanza entra comunque. Il gate sul server è stato valutato e
   * rimandato di proposito (decisione owner del 27/08/2026) — richiederebbe
   * l'eccezione esplicita per il coach che apre la stanza in anticipo per
   * sistemare l'audio, scritta nello stesso commit e coperta da un caso in
   * `live.controller.spec.ts`. Chi legge questa funzione non deve scambiarla
   * per quel gate.
   *
   * La soglia di «imminente» è 60 minuti perché è il numero che il progetto ha
   * già scelto per dire «sta per iniziare»: `LIVE_REMINDER_MINUTES` governa il
   * promemoria Discord. Allinearsi a quello, invece di inventare un secondo
   * anticipo che poi diverge.
   */
  protected stato(s: LiveSession): 'ora' | 'imminente' | 'programmata' | 'terminata' {
    if (s.ended) return 'terminata';
    if (this.isLiveNow(s)) return 'ora';
    const mancano = new Date(s.startsAt).getTime() - this.adesso();
    if (mancano <= 0) return 'terminata';
    return mancano <= ANTICIPO_APERTURA_MIN * 60_000 ? 'imminente' : 'programmata';
  }

  /** «fra 42 minuti», «fra 3 ore», «domani», «fra 5 giorni». */
  protected quandoManca(s: LiveSession): string {
    const ms = new Date(s.startsAt).getTime() - this.adesso();
    if (ms <= 0) return '';
    const min = Math.round(ms / 60_000);
    if (min < 60) return `fra ${min} minut${min === 1 ? 'o' : 'i'}`;
    const ore = Math.round(min / 60);
    if (ore < 24) return `fra ${ore} or${ore === 1 ? 'a' : 'e'}`;
    const giorni = Math.round(ore / 24);
    return giorni === 1 ? 'domani' : `fra ${giorni} giorni`;
  }

  /** La sessione da mettere in evidenza: quella in diretta, o la prima futura. */
  protected readonly inEvidenza = computed(() => {
    const elenco = this.sessions();
    if (!elenco?.length) return null;
    return elenco.find((s) => this.stato(s) === 'ora') ?? elenco.find((s) => !s.ended) ?? null;
  });

  /** Tutte le altre, nell'ordine in cui arrivano dal server. */
  protected readonly altre = computed(() => {
    const elenco = this.sessions();
    const prima = this.inEvidenza();
    if (!elenco) return [];
    return prima ? elenco.filter((s) => s.id !== prima.id) : elenco;
  });
}
