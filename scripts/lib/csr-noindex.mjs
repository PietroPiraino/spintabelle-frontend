// Il `noindex` della shell CSR, in un posto solo.
//
// PERCHE' ESISTE QUESTO FILE. La stringa serve a due programmi che devono
// essere d'accordo: `inject-csr-noindex.mjs` la scrive dentro l'artefatto e
// `check-prerender-content.mjs` verifica che ci sia (e che NON sia finita sulle
// pagine pubbliche). Due copie della stessa costante in due file diversi sono
// una divergenza che aspetta solo di succedere: la guardia continuerebbe a
// cercare il testo vecchio e passerebbe verde su una shell senza piu' il meta.
//
// Le funzioni qui sono PURE (stringa in, stringa fuori): cosi' `npm run
// test:scripts` puo' coprirle con `node --test`, senza dist e senza mock.

/**
 * `follow` e non `nofollow`, come in `SeoService.setRobots`: la pagina non deve
 * entrare nell'indice, ma i link che contiene verso il resto del sito devono
 * continuare a valere.
 */
export const META_ROBOTS = '<meta name="robots" content="noindex, follow">';

/** Vero se l'HTML dichiara gia' un `noindex` (qualunque forma del meta). */
export function hasNoindex(html) {
  const meta = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i);
  return meta ? /noindex/i.test(meta[0]) : false;
}

/**
 * Inserisce il meta subito prima di `</head>`. Idempotente: se un `noindex`
 * c'e' gia' (per esempio perche' il build e' stato rilanciato sulla stessa
 * dist) restituisce l'HTML invariato, invece di accumulare tag.
 *
 * ⚠️ Lancia se manca `</head>`: significa che la forma dell'artefatto e'
 * cambiata sotto i piedi, e un'iniezione «best effort» che non inietta niente e
 * non lo dice e' esattamente il modo in cui una guardia si spegne in silenzio.
 */
export function injectNoindex(html) {
  if (hasNoindex(html)) return html;
  const i = html.search(/<\/head\s*>/i);
  if (i === -1) throw new Error('nessun </head> nella shell CSR');
  return html.slice(0, i) + `  ${META_ROBOTS}\n` + html.slice(i);
}

/** Vero se l'HTML dichiara un `<link rel="canonical">`. */
export function hasCanonical(html) {
  return /<link[^>]+rel=["']canonical["'][^>]*>/i.test(html);
}

/**
 * Toglie il `<link rel="canonical">` dalla shell CSR.
 *
 * ⚠️ PERCHE' SI TOGLIE, invece di lasciarlo com'era fino al 19/08/2026.
 * La shell nasce da `src/index.html`, che dichiara la HOME come canonica —
 * corretto per la home, sbagliato per le altre 13 rotte che ricevono lo stesso
 * file. Il risultato era che `/login`, `/account`, `/admin`… servivano insieme
 * due segnali che si contraddicono: «non indicizzarmi» (noindex) e «la pagina
 * buona e' la home» (canonical). Google sconsiglia esplicitamente la coppia, e
 * il modo in cui puo' finire male non e' che la rotta client resti in indice —
 * e' che il `noindex` venga CONSOLIDATO sul bersaglio del canonical, cioe'
 * sulla home. Probabilita' bassa, danno massimo: la home e' la pagina piu'
 * preziosa del sito.
 *
 * Senza canonical la shell dice una cosa sola e non ambigua. Le pagine
 * PRERENDERIZZATE non sono toccate: ognuna ha il suo canonical corretto,
 * scritto dal prerender, e `check-prerender-content.mjs` continua a
 * verificarlo una per una.
 *
 * Idempotente: se il canonical non c'e', restituisce l'HTML invariato.
 */
export function stripCanonical(html) {
  return html.replace(/[ \t]*<link[^>]+rel=["']canonical["'][^>]*>\s*\n?/gi, '');
}
