import {
  ChangeDetectionStrategy,
  Component,
  PendingTasks,
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
  private readonly pendingTasks = inject(PendingTasks);

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
    //
    // ⚠️ PERCHE' UN PendingTask, E PERCHE' QUI. `import('marked')` è un dynamic
    // import ES puro: Angular non lo traccia, quindi in prerender l'app
    // risultava stabile e l'HTML veniva serializzato mentre il chunk era ancora
    // in volo. `html()` era ancora null → nell'HTML statico di OGNI news usciva
    // il ramo @else, cioè il Markdown sorgente con dentro `##` e `**` letterali,
    // zero <h2> e zero link cliccabili: l'unico contenuto editoriale del sito
    // arrivava a Google come blocco piatto.
    // Il task deve coprire anche `renderer.set()`, non solo l'import: avvolgere
    // il solo `loadMarked()` (e rilasciare il task in un `.finally`) lo libera
    // un microtask PRIMA che il segnale venga scritto — provato, e l'HTML
    // usciva grezzo esattamente come prima. Per questo sta nel componente, che
    // è il posto in cui lo stato cambia, e non nel loader.
    this.pendingTasks.run(async () => {
      try {
        this.renderer.set(await this.loader());
      } catch {
        /* resta il fallback testo (pre-line), sempre leggibile */
      }
    });
  }
}
