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
 * Il player di bunny.net è cookieless: nessun cookie di profilazione di terze
 * parti → non richiede banner di consenso.
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
