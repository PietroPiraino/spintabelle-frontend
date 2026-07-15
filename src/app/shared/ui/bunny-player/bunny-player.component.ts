import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

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
 */
@Component({
  selector: 'app-bunny-player',
  imports: [],
  template: `
    <div class="bunny-frame">
      <iframe
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

  protected readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.url()),
  );
}
