import { InjectionToken } from '@angular/core';
import type { Token, Tokens } from 'marked';

/** Facade minimale esposto ai componenti: una funzione pura sincrona. */
export interface MarkdownRenderer {
  render(markdown: string): string;
}

const HEADING_OFFSET = 1; // '#' (depth 1) -> <h2>: la pagina ha già un <h1>
const MAX_DEPTH = 5; // non superare <h5>

let markedPromise: Promise<MarkdownRenderer> | null = null;

/**
 * Import dinamico di `marked`, memoizzato e configurato UNA sola volta:
 * - `gfm` + `breaks`: i singoli a-capo restano <br> (come il vecchio
 *   `white-space: pre-line`), così le news esistenti si vedono invariate;
 * - offset dei titoli via `walkTokens` (hook stabile tra le major di marked):
 *   `#` -> <h2> … cap a <h5>, perché la pagina ha già un <h1> (titolo articolo).
 * Istanza isolata (`new Marked`) per non toccare il singleton globale.
 */
export function loadMarked(): Promise<MarkdownRenderer> {
  markedPromise ??= import('marked').then(({ Marked }) => {
    const instance = new Marked({ gfm: true, breaks: true });
    instance.use({
      walkTokens(token: Token): void {
        if (token.type === 'heading') {
          const heading = token as Tokens.Heading;
          heading.depth = Math.min(heading.depth + HEADING_OFFSET, MAX_DEPTH);
        }
      },
    });
    return {
      // `async` non impostato -> `parse` ritorna sempre una string (sincrono).
      render: (markdown: string): string => instance.parse(markdown) as string,
    };
  });
  return markedPromise;
}

/**
 * Loader iniettabile: nei test si sostituisce con uno stub sincrono così
 * ChromeHeadless non importa mai il chunk reale di marked.
 */
export const MARKED_LOADER = new InjectionToken<() => Promise<MarkdownRenderer>>(
  'MARKED_LOADER',
  { providedIn: 'root', factory: () => loadMarked },
);
