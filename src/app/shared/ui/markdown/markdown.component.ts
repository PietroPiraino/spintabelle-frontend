import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MARKED_LOADER, type MarkdownRenderer } from './marked-loader';

/**
 * Renderizza Markdown in HTML stilizzato (classe globale `.prose`).
 * - lazy-load di `marked` via `MARKED_LOADER` (memoizzato, fuori dal bundle main);
 * - bind a `[innerHTML]`: Angular sanitizza di default (`SecurityContext.HTML`),
 *   quindi tag script, handler inline e URL javascript vengono rimossi (difesa
 *   in profondità: il corpo lo scrive solo l'ADMIN);
 * - finché marked carica, fallback a testo con `pre-line` (nessun flash, e
 *   contenuto sempre leggibile anche se il load fallisce).
 */
@Component({
  selector: 'app-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (html(); as rendered) {
      <div class="prose" [innerHTML]="rendered"></div>
    } @else {
      <div class="prose markdown--raw">{{ markdown() }}</div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .markdown--raw {
      white-space: pre-line;
    }
  `,
})
export class MarkdownComponent {
  /** Sorgente markdown (es. news.body). Default '' per l'anteprima vuota. */
  readonly markdown = input('');

  private readonly loader = inject(MARKED_LOADER);

  /** null finché il chunk di marked non è pronto. */
  private readonly renderer = signal<MarkdownRenderer | null>(null);

  /**
   * HTML calcolato: si ricomputa quando cambia `markdown` OPPURE quando il
   * renderer diventa disponibile. Zoneless-friendly (solo segnali): copre sia
   * il rendering one-shot del dettaglio sia il live-preview per-keystroke.
   * Ritorna null nello stato pre-load -> il template mostra il fallback testo.
   */
  protected readonly html = computed<string | null>(() => {
    const render = this.renderer();
    if (!render) return null;
    const source = this.markdown();
    return source ? render.render(source) : '';
  });

  constructor() {
    // Lazy-load una volta; il loader è memoizzato a livello modulo, quindi N
    // istanze condividono lo stesso chunk e la stessa istanza di marked. In
    // zoneless, renderer.set() segna il computed dirty e schedula la CD.
    this.loader()
      .then((renderer) => this.renderer.set(renderer))
      .catch(() => {
        /* resta il fallback testo (pre-line), sempre leggibile */
      });
  }
}
