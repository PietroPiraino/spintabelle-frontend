import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  viewChild,
  ElementRef,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Avanzamento della riproduzione riportato dal player. */
export interface BunnyProgress {
  /** secondi guardati (posizione corrente nel video) */
  seconds: number;
  /** durata totale del video in secondi */
  duration: number;
}

/** Origine dell'iframe: i messaggi da altre origini si scartano. */
const BUNNY_ORIGIN = 'https://iframe.mediadelivery.net';

/**
 * Player bunny.net (Bunny Stream) responsive 16:9, URL sanitizzato.
 *
 * Privacy — fatti VERIFICATI il 15/07/2026 (prove: `gdpr/prove-bunny-player.md`).
 * NON riscrivere questo commento senza rifare le misure: la vecchia formula
 * «cookieless → non richiede banner» era imprecisa ed è finita, copiata, nei
 * testi legali.
 * - Cookie: ZERO (misurato: 0 `Set-Cookie`, `context.cookies()` vuoto). Ma
 *   «niente cookie» NON basta a dire «niente banner»: l'art. 122 Codice Privacy
 *   guarda l'archiviazione sul terminale, e il player scrive 3 chiavi in
 *   localStorage (`cache-sprite-plyr`, `plyr--lib-<id>`, e `plyr-video-position-*`
 *   se «Resumable Player» è ON sulla libreria). Nessuna contiene identificatori.
 * - Ciò che regge l'eccezione dell'art. 122 c.1 («servizio esplicitamente
 *   richiesto») è una CONDOTTA NOSTRA: il click-to-load in
 *   `features/lessons/lessons.component.html` monta questo componente solo dopo
 *   il clic su play. ⚠️ Montarlo al caricamento della pagina farebbe cadere
 *   l'esenzione: lo storage del player avviene al load dell'iframe, non al play.
 *   Il clic NON è un consenso ex art. 7 GDPR: non scriverlo da nessuna parte.
 * - Le statistiche di visione sono telemetria CLIENT-side dell'iframe
 *   (POST `/.metrics/track-session` ogni ~5s), senza cookie né identificatori.
 *
 * Avanzamento (`progress`): l'embed implementa il protocollo **Player.js** —
 * verificato il 29/07/2026 con un browser vero, handshake `ready` che dichiara
 * `["ready","play","pause","ended","timeupdate","progress","seeked","error"]` e
 * 56 `timeupdate` ricevuti con `{seconds, duration}`. Ci si iscrive DOPO il
 * `ready` (prima i messaggi vengono ignorati) e si filtra per origine.
 * ⚠️ Ascoltare non scrive nulla nel terminale: l'analisi dell'art. 122 non
 * cambia. Restano vere entrambe le righe qui sopra.
 */
@Component({
  selector: 'app-bunny-player',
  imports: [],
  template: `
    <div class="bunny-frame">
      <iframe
        #frame
        [src]="safeUrl()"
        [title]="videoTitle()"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `,
  styles: `
    .bunny-frame {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: #0c1428; // cornice video sempre scura

      iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BunnyPlayerComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly url = input.required<string>();
  readonly videoTitle = input('Lezione video');
  /** Avanzamento della riproduzione (grezzo: la frequenza la gestisce il chiamante). */
  readonly progress = output<BunnyProgress>();

  private readonly frame =
    viewChild.required<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.url()),
  );

  constructor() {
    const onMessage = (e: MessageEvent) => this.onPlayerMessage(e);
    window.addEventListener('message', onMessage);
    inject(DestroyRef).onDestroy(() =>
      window.removeEventListener('message', onMessage),
    );
  }

  /** Messaggi Player.js dall'iframe: handshake e avanzamento. */
  private onPlayerMessage(e: MessageEvent): void {
    if (e.origin !== BUNNY_ORIGIN || typeof e.data !== 'string') return;
    let msg: { context?: string; event?: string; value?: unknown };
    try {
      msg = JSON.parse(e.data) as typeof msg;
    } catch {
      return;
    }
    if (msg.context !== 'player.js') return;

    // Il player accetta le iscrizioni solo DOPO aver annunciato "ready".
    if (msg.event === 'ready') {
      this.frame().nativeElement.contentWindow?.postMessage(
        JSON.stringify({
          context: 'player.js',
          version: '0.0.11',
          method: 'addEventListener',
          value: 'timeupdate',
          listener: 'bff-progress',
        }),
        BUNNY_ORIGIN,
      );
      return;
    }

    if (msg.event === 'timeupdate') {
      const v = msg.value as { seconds?: number; duration?: number } | undefined;
      const seconds = Number(v?.seconds);
      const duration = Number(v?.duration);
      if (Number.isFinite(seconds) && Number.isFinite(duration) && duration > 0)
        this.progress.emit({ seconds, duration });
    }
  }
}
