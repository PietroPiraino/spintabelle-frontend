/**
 * Entry-point SSR — l'artefatto che gira DENTRO la Pages Function.
 *
 * COSA E' E COSA NON E'. Non e' un server: non ascolta su una porta, non usa
 * niente di Node (il bundle e' compilato con `"platform": "neutral"`). E' una
 * funzione `Request -> Response` che Cloudflare invoca per le rotte dichiarate
 * `RenderMode.Server` in `app.routes.server.ts` — oggi `/news` e `news/:id`.
 * Tutto il resto del sito resta prerenderizzato e non passa mai di qui.
 *
 * Il build lo emette come `dist/frontend/server/server.mjs`, con l'export di
 * default che si vede sotto; lo importa `functions/news/[[path]].ts`.
 *
 * ⚠️ `allowedHosts` NON E' FACOLTATIVO, ed e' la trappola piu' facile di tutta
 * la migrazione. `AngularAppEngine` valida l'header `Host` e l'hostname
 * dell'URL contro questa lista (difesa SSRF, @angular/ssr 22); il builder la
 * riempie da `security.allowedHosts` in angular.json, che **di default e' un
 * array VUOTO**. Con la lista vuota `isHostAllowed()` risponde `false` per
 * QUALSIASI hostname e ogni richiesta esce **400 Bad Request** con un corpo di
 * testo — non un 500, non una pagina: un 400 muto, su ogni articolo, in
 * produzione e non in locale (in locale non gira nessun engine). Verificato
 * leggendo `_validation-chunk.mjs` di @angular/ssr 22.0.0, non a memoria.
 *
 * Le voci, una per una:
 *   - i due domini di produzione (con e senza `www`);
 *   - `*.pages.dev` — le anteprime di ramo (`<ramo>.spintabelle-frontend.pages.dev`),
 *     senza le quali la prova su preview OBBLIGATORIA prima del push
 *     (PLAN-news-redazione.md §1.7) risponderebbe 400 e sembrerebbe che la
 *     migrazione non funzioni;
 *   - `spintabelle.it` (+ www) — il dominio vecchio e' ancora vivo e i suoi 301
 *     passano da qui finche' resta pagato.
 * `isHostAllowed` tratta `*.dominio` come suffisso, l'host nudo va elencato a
 * parte: `*.pages.dev` NON copre `pages.dev`, e non deve.
 */

import { AngularAppEngine, createRequestHandler } from '@angular/ssr';

const engine = new AngularAppEngine({
  allowedHosts: [
    'bestfishforever.it',
    'www.bestfishforever.it',
    '*.pages.dev',
    'spintabelle.it',
    'www.spintabelle.it',
  ],
});

/**
 * ⚠️ `handle()` restituisce `null` quando nessuna rotta corrisponde: e' un caso
 * atteso, non un errore. Qui si risponde con un 404 minimo e in italiano — la
 * pagina 404 vera (`public/404.html`) la serve la Function, che ha accesso agli
 * asset; questo e' solo il fondo del barile perche' `null` non e' una Response.
 */
export default createRequestHandler(async (request: Request) => {
  const res = await engine.handle(request);
  return res ?? new Response('Pagina non trovata', { status: 404 });
});
