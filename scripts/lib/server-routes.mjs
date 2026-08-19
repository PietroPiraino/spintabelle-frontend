// Le due liste che decidono chi passa dalle Cloudflare Pages Functions:
// `app.routes.server.ts` (chi e' Prerender, chi Client, chi Server) e
// `public/_routes.json` (quali URL invocano la Function).
//
// PERCHE' UN FILE A PARTE. E' lo stesso motivo di `redirects.mjs`: qui vive il
// pezzo che DECIDE ("questa URL invoca la Function?"). Se sbaglia, il controllo
// rotte passa per il motivo sbagliato e non protegge piu' niente. Funzioni pure
// -> coperte da `npm run test:scripts` (`node --test`, zero dipendenze).
//
// REGOLA D'ORO ereditata da route-inventory.mjs: se non capisce, LANCIA. Un
// parser che salta in silenzio e' il modo in cui questa guardia si spegnerebbe
// senza dirlo.

import { readFileSync } from 'node:fs';
import ts from 'typescript';

// ---- app.routes.server.ts ----------------------------------------------

/**
 * Legge `export const serverRoutes: ServerRoute[] = [...]` e restituisce
 * `[{ path, renderMode, line }]`. Guarda SOLO `path` e `renderMode`: tutto il
 * resto (`fallback`, `getPrerenderParams`) e' roba di Angular e non ci riguarda.
 *
 * Lancia se: non trova l'array, un elemento non e' un oggetto letterale, `path`
 * non e' un letterale stringa, `renderMode` manca o non e' nella forma
 * `RenderMode.<Nome>`.
 */
export function readServerRoutes(file) {
  const src = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );

  let arr = null;
  for (const stmt of src.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && d.name.text === 'serverRoutes') arr = d.initializer;
    }
  }
  if (!arr || !ts.isArrayLiteralExpression(arr))
    throw new Error('app.routes.server.ts: non trovo `export const serverRoutes = [...]`');

  const riga = (n) => n.getSourceFile().getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const out = [];

  for (const el of arr.elements) {
    if (!ts.isObjectLiteralExpression(el))
      throw new Error(
        `app.routes.server.ts: elemento non riconosciuto (spread? variabile?) a riga ${riga(el)}` +
          ' — il controllo rotte si rifiuta di indovinare.',
      );

    let path = null;
    let renderMode = null;
    for (const p of el.properties) {
      if (!ts.isPropertyAssignment(p) || !ts.isIdentifier(p.name)) continue;
      if (p.name.text === 'path') {
        if (!ts.isStringLiteral(p.initializer))
          throw new Error(
            `app.routes.server.ts: \`path\` non e' un letterale stringa a riga ${riga(p)}.`,
          );
        path = p.initializer.text;
      }
      if (p.name.text === 'renderMode') {
        const init = p.initializer;
        if (
          !ts.isPropertyAccessExpression(init) ||
          !ts.isIdentifier(init.expression) ||
          init.expression.text !== 'RenderMode'
        )
          throw new Error(
            `app.routes.server.ts: \`renderMode\` non e' nella forma \`RenderMode.<Nome>\`` +
              ` a riga ${riga(p)}.`,
          );
        renderMode = init.name.text;
      }
    }
    if (path === null)
      throw new Error(`app.routes.server.ts: rotta senza \`path\` a riga ${riga(el)}`);
    if (renderMode === null)
      throw new Error(
        `app.routes.server.ts: la rotta \`${path}\` non dichiara \`renderMode\` (riga ${riga(el)}).`,
      );
    out.push({ path, renderMode, line: riga(el) });
  }
  return out;
}

/** Solo le rotte rese dal server (`RenderMode.Server`), che e' chi ha bisogno della Function. */
export function serverPaths(routes) {
  return routes.filter((r) => r.renderMode === 'Server').map((r) => r.path);
}

// ---- public/_routes.json ------------------------------------------------

/**
 * Parsing + validazione di forma. Lancia su tutto cio' che non capisce, chiavi
 * sconosciute comprese: il file lo legge Cloudflare, e una chiave inventata la
 * ignorerebbe in silenzio facendoci credere di aver configurato qualcosa.
 */
export function parseRoutesJson(text) {
  let dati;
  try {
    dati = JSON.parse(text);
  } catch (e) {
    throw new Error(`_routes.json non e' JSON valido (${e.message})`);
  }
  if (!dati || typeof dati !== 'object' || Array.isArray(dati))
    throw new Error('_routes.json: mi aspetto un oggetto');
  for (const k of Object.keys(dati))
    if (!['version', 'include', 'exclude'].includes(k))
      throw new Error(`_routes.json: chiave sconosciuta \`${k}\` (ammesse: version, include, exclude)`);
  if (dati.version !== 1) throw new Error(`_routes.json: \`version\` deve essere 1 (trovato ${dati.version})`);
  for (const campo of ['include', 'exclude']) {
    const v = dati[campo];
    if (!Array.isArray(v)) throw new Error(`_routes.json: \`${campo}\` deve essere un array`);
    for (const p of v) {
      if (typeof p !== 'string' || !p.startsWith('/'))
        throw new Error(`_routes.json: in \`${campo}\` il pattern ${JSON.stringify(p)} non inizia con "/"`);
      const stelle = p.split('*').length - 1;
      if (stelle > 1 || (stelle === 1 && !p.endsWith('*')))
        throw new Error(
          `_routes.json: \`${p}\` — Cloudflare ammette UN solo \`*\` e solo in fondo; ` +
            'qualsiasi altra forma qui non saprei come valutarla.',
        );
    }
  }
  return { version: 1, include: dati.include, exclude: dati.exclude };
}

/**
 * Semantica Cloudflare di un pattern di `_routes.json`: match esatto, oppure
 * `*` finale che divora qualsiasi coda (barre comprese).
 *
 * ⚠️ IL PUNTO CHE CONTA: `/news/*` NON copre `/news` — il prefisso letterale
 * include la barra. E' la stessa trappola gia' pagata con `/live/*` in
 * `_redirects` (li' pero' al contrario: quella regola catturava anche il
 * prefisso nudo). Due file, due semantiche opposte: non riusare il matcher.
 */
export function includeMatches(pattern, url) {
  if (pattern.endsWith('*')) return url.startsWith(pattern.slice(0, -1));
  return pattern === url;
}

/** Il primo pattern che cattura l'URL, o null. */
export function findInclude(patterns, url) {
  return patterns.find((p) => includeMatches(p, url)) ?? null;
}

/**
 * Invarianti su un singolo pattern di `include`. Oggi ce n'e' una sola, ed e'
 * la regola d'oro della casa nella sua terza incarnazione (dopo `_redirects` e
 * `_headers`): niente catch-all.
 */
export function lintInclude(pattern) {
  if (pattern === '/*' || pattern === '/**')
    return (
      `catch-all \`${pattern}\` in _routes.json: manda OGNI richiesta del sito ` +
      'dentro la Function — asset, chunk, immagini, sitemap. Si paga ogni file ' +
      "come invocazione e ci si mette una Function davanti a tutto cio' che " +
      'oggi funziona da solo. Elenca i percorsi uno per uno.'
    );
  return null;
}

export function lintIncludes(patterns) {
  return patterns
    .map((p) => ({ pattern: p, problema: lintInclude(p) }))
    .filter((x) => x.problema !== null);
}

/**
 * Una rotta di `app.routes.server.ts` (`news/:id`, `news`) -> le URL concrete
 * che Cloudflare deve saper instradare. Due forme, perche' l'SSG serve le
 * pagine con lo slash finale ma i link interni usano la forma nuda: se una
 * delle due non e' coperta, quella meta' del traffico non arriva alla Function.
 */
export function urlDiEsempio(routePath) {
  const nuda = '/' + routePath.split('/').map((s) => (s.startsWith(':') ? '__esempio__' : s)).join('/').replace(/^\/+/, '');
  return nuda === '/' ? ['/'] : [nuda, `${nuda}/`];
}
