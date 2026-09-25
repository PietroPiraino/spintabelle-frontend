/**
 * Quali indirizzi del sito vivono con la BARRA FINALE (`/glossario/limp/`).
 *
 * ⚠️ PERCHE' ESISTE. Le pagine pubbliche sono servite a 200 solo nella forma
 * con la barra: le prerenderizzate perche' l'SSG emette `<rotta>/index.html` e
 * Cloudflare Pages risponde 308 dalla forma nuda, quelle composte all'edge
 * (news, singola mano) perche' la Function risponde 301. Canonical e sitemap
 * dichiarano la forma con la barra dal 18/07/2026 — i LINK INTERNI no: ogni
 * `routerLink` scriveva `href="/glossario/limp"`, cioe' un reindirizzamento.
 * Search Console li contava in «Pagina con reindirizzamento»: 123 il
 * 25/09/2026, uno per ogni link interno del sito, in crescita a ogni pagina
 * nuova. `BarraFinaleUrlSerializer` legge questo elenco e aggiunge la barra
 * agli `href` (e all'indirizzo nella barra del browser).
 *
 * ⚠️⚠️ MAI UNA ROTTA CLIENT QUI DENTRO (`/login`, `/account`, `/admin/…`,
 * `/allenamento/sessione`, `/live/:id/stanza`…). Quelle vivono SENZA barra:
 * la loro regola in `public/_redirects` e' `/login`, e con la barra
 * l'indirizzo non corrisponde a niente — chi ricarica la pagina, o apre un
 * link copiato, riceve la 404. E' l'unico modo in cui questo file puo' fare
 * danni veri, e per questo `scripts/check-routes.mjs` lo confronta a ogni
 * build con il manifest del prerender, `public/_routes.json` e `_redirects`,
 * in entrambi i versi: una pagina pubblica mancante qui fa fallire il build
 * (i suoi link tornerebbero a reindirizzare), una rotta client presente qui
 * lo fa fallire a maggior ragione.
 *
 * ⚠️ File di SOLE COSTANTI e funzioni pure, senza import: lo legge anche Node
 * (`scripts/check-routes.mjs`, `scripts/check-prerender-content.mjs`), che
 * importa un `.ts` solo se non contiene sintassi da trasformare.
 *
 * La radice `/` non c'e': ha gia' la sua barra, e il serializer di Angular la
 * scrive cosi' da se'.
 */
export const PERCORSI_CON_BARRA_FINALE: readonly string[] = [
  // Prerenderizzate (app.routes.server.ts, RenderMode.Prerender).
  'tabelle',
  'tabelle/:slug',
  'simulatore-varianza',
  'chi-siamo',
  'abbonati',
  'replayer',
  'lezioni',
  'allenamento',
  'negozio',
  'docs',
  'live',
  'guide',
  'guide/:slug',
  'glossario',
  'glossario/:slug',
  'affiliazioni',
  'privacy',
  'cookie-policy',
  'redazione',
  'policy-editoriale',
  // Composte dalla Pages Function (public/_routes.json): la forma nuda
  // risponde 301 verso quella con la barra.
  'news',
  'news/:id',
  'replayer/:publicId',
];

/**
 * Vero se il percorso fatto di questi segmenti vive con la barra finale.
 * Un `:parametro` corrisponde a un segmento qualunque non vuoto; il numero di
 * segmenti deve coincidere, cosi' `live` non trascina con se' `live/:id/stanza`.
 */
export function vuoleBarraFinale(segmenti: readonly string[]): boolean {
  if (segmenti.length === 0) return false;
  return PERCORSI_CON_BARRA_FINALE.some((schema) => {
    const parti = schema.split('/');
    return (
      parti.length === segmenti.length &&
      parti.every((p, i) =>
        p.startsWith(':') ? segmenti[i] !== '' : p === segmenti[i],
      )
    );
  });
}

/** Stessa domanda su un percorso scritto (`/glossario/limp`, barra o no). */
export function percorsoVuoleBarraFinale(percorso: string): boolean {
  return vuoleBarraFinale(percorso.split('/').filter((s) => s !== ''));
}

/** Indice in cui finisce il percorso: il primo `?` o `#`, o la fine. */
function fineDelPercorso(url: string): number {
  const i = url.search(/[?#]/);
  return i === -1 ? url.length : i;
}

/** `/glossario/limp?x=1` -> `/glossario/limp/?x=1`. Idempotente. */
export function aggiungiBarraFinale(url: string): string {
  const fine = fineDelPercorso(url);
  if (fine === 0 || url[fine - 1] === '/') return url;
  return `${url.slice(0, fine)}/${url.slice(fine)}`;
}

/**
 * `/glossario/limp/?x=1` -> `/glossario/limp?x=1`; la radice resta `/`.
 * Serve al parser: per il router di Angular una barra finale e' un segmento
 * VUOTO in piu', e `glossario/:slug` non corrisponderebbe piu' — la pagina
 * cadrebbe sulla 404 del wildcard.
 */
export function togliBarraFinale(url: string): string {
  const fine = fineDelPercorso(url);
  const percorso = url.slice(0, fine);
  if (percorso.length <= 1 || !percorso.endsWith('/')) return url;
  const senza = percorso.replace(/\/+$/, '');
  return `${senza === '' ? '/' : senza}${url.slice(fine)}`;
}
