import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
   * e non terminata dal coach. Usata per il badge 🔴 nella lista.
   */
  protected isLiveNow(s: LiveSession): boolean {
    if (s.ended) return false;
    const start = new Date(s.startsAt).getTime();
    const now = Date.now();
    const windowMs = (s.durationMin && s.durationMin > 0 ? s.durationMin : 90) * 60_000;
    return now >= start && now <= start + windowMs;
  }
}
