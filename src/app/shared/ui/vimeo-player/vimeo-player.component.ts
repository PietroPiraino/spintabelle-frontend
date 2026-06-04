import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Player Vimeo responsive 16:9 con URL sanitizzato. */
@Component({
  selector: 'app-vimeo-player',
  imports: [],
  template: `
    <div class="vimeo-frame">
      <iframe
        [src]="safeUrl()"
        [title]="videoTitle()"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
        loading="lazy"
      ></iframe>
    </div>
  `,
  styles: `
    .vimeo-frame {
      position: relative;
      aspect-ratio: 16 / 9;
      border-radius: var(--radius-sm);
      overflow: hidden;
      background: var(--bg-0);

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
export class VimeoPlayerComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly url = input.required<string>();
  readonly videoTitle = input('Lezione video');

  protected readonly safeUrl = computed<SafeResourceUrl>(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(this.url()),
  );
}
