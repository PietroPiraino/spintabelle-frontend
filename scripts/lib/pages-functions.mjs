// Chi viene servito da una Cloudflare Pages Function: `public/_routes.json`
// (quali URL invocano `functions/`) e la semantica dei suoi pattern.
//
// ⚠️ PERCHE' NON SI CHIAMA PIU' `server-routes.mjs`. Fino al 19/08/2026 questo
// file leggeva ANCHE `app.routes.server.ts`, perche' per qualche ora la terza
// categoria di rotte e' stata "RenderMode.Server": la Function delegava
// all'handler SSR di Angular. Cloudflare ha rifiutato quella Function («Your
// Worker exceeded the size limit of 3 MiB»: `dist/frontend/server` pesa 11 MB
// non compressi / 2,84 MB gzip, e il pezzo dominante e' un chunk lazy che con
// le notizie non c'entra niente), e la Function e' tornata a comporre l'HTML da
// se'. Da allora `/news` e `news/:id` sono `RenderMode.Client` — il render mode
// governa solo la navigazione INTERNA dello SPA — e l'unico fatto che dice chi
// e' servito dall'edge e' l'`include` qui sotto. Il nome del file dice cosa il
// file decide.
//
// ⚠️ E il pezzo che leggeva i render mode e' stato TOLTO, non tenuto "per
// prudenza": nessuno lo usava piu', e finche' angular.json dice
// `outputMode: "static"` una rotta `RenderMode.Server` non arriva nemmeno a
// essere costruita — il builder si ferma con un errore di schema. Un controllo
// che non puo' fallire occupa il posto di uno vero e fa sentire coperti.
//
// PERCHE' UN FILE A PARTE. E' lo stesso motivo di `redirects.mjs`: qui vive il
// pezzo che DECIDE ("questa URL invoca la Function?"). Se sbaglia, il controllo
// rotte passa per il motivo sbagliato e non protegge piu' niente. Funzioni pure
// -> coperte da `npm run test:scripts` (`node --test`, zero dipendenze).
//
// REGOLA D'ORO ereditata da route-inventory.mjs: se non capisce, LANCIA. Un
// parser che salta in silenzio e' il modo in cui questa guardia si spegnerebbe
// senza dirlo.

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
 *
 * Conseguenza concreta oggi: l'indice `/news` e' composto all'edge come gli
 * articoli, quindi va elencato A PARTE nell'include — e infatti
 * `public/_routes.json` ha sia `/news` sia `/news/*`. Per lo stesso motivo la
 * Function si chiama `[[path]].ts` (catch-all OPZIONALE): un `[path].ts`
 * prenderebbe solo i figli e lascerebbe scoperto il prefisso nudo.
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
 * Una rotta di `app.routes.ts` (`news/:id`, `news`) -> le URL concrete che
 * Cloudflare deve saper instradare. Due forme, perche' l'SSG serve le pagine
 * con lo slash finale ma i link interni usano la forma nuda: se una delle due
 * non e' coperta, quella meta' del traffico non arriva alla Function.
 */
export function urlDiEsempio(routePath) {
  const nuda = '/' + routePath.split('/').map((s) => (s.startsWith(':') ? '__esempio__' : s)).join('/').replace(/^\/+/, '');
  return nuda === '/' ? ['/'] : [nuda, `${nuda}/`];
}
