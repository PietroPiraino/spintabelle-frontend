// Markdown per l'edge — COPIA DELIBERATA della configurazione di
// `src/app/shared/ui/markdown/marked-loader.ts`, piu' una differenza voluta.
//
// ⚠️ OGGI QUESTO FILE NON E' IMPORTATO DA NESSUNA FUNCTION, e va detto qui
// invece che scoperto fra sei mesi. Serviva alla TAPPA 1 del piano
// (PLAN-news-redazione.md §1.2), dove `functions/news/[id].ts` costruiva
// l'articolo a mano incollando HTML dentro la shell CSR. Si e' andati dritti
// alla TAPPA 2 (§1.3), dove la pagina la rende l'app Angular vera dentro
// `functions/news/[[path]].ts`: il Markdown lo converte il solito
// `marked-loader.ts` durante l'SSR, e all'edge non resta niente da impaginare.
// Restano solo `scripts/lib/markdown-fixture.test.mjs` a leggerlo.
// Due sole strade oneste, nessuna delle quali e' "lasciarlo li' per sicurezza":
// cancellare questo file col suo test se la tappa 1 non tornera' mai, oppure
// rimetterlo in uso il giorno in cui una Function tornasse a comporre HTML da
// se'. Un modulo morto che sembra vivo e' esattamente il difetto che
// `gen-sitemap.mjs` documenta su `lastmodNews()`.
//
// PERCHE' UNA COPIA E NON UN IMPORT. Il bundle della Pages Function e il chunk
// del browser sono due build diversi: la Function e' compilata da esbuild di
// Cloudflare a partire da `functions/`, l'app da Angular a partire da `src/`.
// Importare il loader Angular qui trascinerebbe `@angular/core` (InjectionToken)
// dentro un Worker. Quindi si duplicano le otto righe di configurazione — e si
// paga il prezzo della duplicazione con un test: `scripts/lib/
// markdown-fixture.test.mjs` rende la stessa fixture con questa copia e la
// confronta con l'output del loader, e rilegge i valori dal sorgente del loader
// per accorgersi se qualcuno cambia `breaks` o l'offset dei titoli da una parte
// sola. Se cambi qualcosa qui, cambialo li' — o il test te lo dice.
//
// ⚠️ LA DIFFERENZA VOLUTA: `renderer.html` restituisce stringa vuota, cioe'
// l'HTML grezzo dentro il Markdown viene SCARTATO. Nell'app quel rischio non
// esiste perche' il risultato passa da `[innerHTML]`, che in Angular e'
// sanificato dal DomSanitizer (`markdown.component.ts`). All'edge non c'e'
// nessun sanitizer: fidarsi dell'HTML dell'articolo significherebbe eseguirlo
// nella pagina. Meglio perderlo che eseguirlo.

import { Marked } from 'marked';

/** Le stesse opzioni di `new Marked({...})` nel loader Angular. */
export const MARKED_OPTIONS = { gfm: true, breaks: true };

/** `#` (depth 1) -> <h2>: la pagina dell'articolo ha gia' un <h1>. */
export const HEADING_OFFSET = 1;

/** Non superare <h5>. */
export const MAX_DEPTH = 5;

let istanza = null;

/**
 * Istanza memoizzata a livello di modulo: in un isolate di Workers il modulo
 * sopravvive fra una richiesta e l'altra, quindi la configurazione si paga una
 * volta sola. Istanza isolata (`new Marked`) per non toccare il singleton
 * globale di marked, come nel loader.
 */
function getIstanza() {
  if (istanza) return istanza;
  const marked = new Marked(MARKED_OPTIONS);
  marked.use({
    walkTokens(token) {
      if (token.type === 'heading') {
        token.depth = Math.min(token.depth + HEADING_OFFSET, MAX_DEPTH);
      }
    },
    renderer: {
      // ⚠️ Vedi l'intestazione: niente HTML grezzo all'edge. Copre sia i
      // blocchi (`Tokens.HTML`) sia i tag inline (`Tokens.Tag`) — in marked 18
      // e' lo stesso metodo del renderer.
      html: () => '',
    },
  });
  istanza = marked;
  return istanza;
}

/**
 * Markdown -> HTML. Sincrono: `async` non e' impostato, quindi `parse`
 * restituisce sempre una stringa.
 */
export function renderMarkdown(markdown) {
  return String(getIstanza().parse(markdown ?? ''));
}
