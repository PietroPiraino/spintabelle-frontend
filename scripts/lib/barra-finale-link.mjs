// I link interni di una pagina che non usano la forma giusta della barra finale.
//
// Pura: riceve l'HTML e la regola (`percorsoVuoleBarraFinale` di
// src/app/core/barra-finale.ts) e restituisce i colpevoli. La usa
// check-prerender-content.mjs su ogni pagina prerenderizzata, ed e' la prova
// sull'ARTEFATTO che il serializer del router sta davvero lavorando: l'elenco
// puo' essere giusto e il provider sparito da app.config.ts, e allora solo
// l'HTML lo dice. Copre anche gli `href` scritti a mano nei template.
//
// Due versi, due costi:
//   - `href="/glossario/limp"` verso un indirizzo che vive con la barra ->
//     un 308, che Search Console conta in «Pagina con reindirizzamento»;
//   - `href="/login/"` verso un indirizzo che vive SENZA -> nessuna regola di
//     `_redirects` lo serve: 404.

/** Un `href` interno che punta a un file (chunk, font, immagine), non a una pagina. */
const eUnFile = (percorso) => /\.[a-z0-9]{2,5}$/i.test(percorso);

/**
 * @param {string} html
 * @param {(percorso: string) => boolean} vuoleBarra
 * @returns {{ href: string, atteso: string }[]}
 */
export function linkSenzaBarraGiusta(html, vuoleBarra) {
  const visti = new Set();
  const out = [];
  for (const [, href] of html.matchAll(/\bhref="(\/[^"]*)"/g)) {
    if (href.startsWith('//') || visti.has(href)) continue;
    visti.add(href);
    const fine = href.search(/[?#]/);
    const percorso = fine === -1 ? href : href.slice(0, fine);
    const resto = fine === -1 ? '' : href.slice(fine);
    if (percorso === '/' || eUnFile(percorso)) continue;
    const haBarra = percorso.endsWith('/');
    const deve = vuoleBarra(percorso);
    if (deve && !haBarra) out.push({ href, atteso: `${percorso}/${resto}` });
    else if (!deve && haBarra)
      out.push({ href, atteso: `${percorso.replace(/\/+$/, '')}${resto}` });
  }
  return out;
}
