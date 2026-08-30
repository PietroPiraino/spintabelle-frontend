// Il foglio globale INLINE nella shell CSR, in un posto solo.
//
// PERCHE' ESISTE QUESTO FILE. Beasties (dipendenza transitiva di
// `@angular/build`, si riconosce dall'attributo `data-beasties-container` su
// `<html>`) calcola la critical CSS dall'HTML **reso**. In `index.csr.html`
// `<app-root>` contiene soltanto i 447 byte del boot-loader: ha inlinato,
// correttamente e inutilmente, la critical CSS dell'ANIMAZIONE DI CARICAMENTO.
// Misurato il 30/08/2026: due blocchi `<style>` per 9.279 byte, e `h1{`,
// `.container{`, `.section{`, `.page-hero` **assenti** — contro i 37-44 kB
// delle pagine prerenderizzate, che quelle regole ce le hanno tutte.
//
// Quella shell non e' una pagina vuota: e' il corpo di 12 rotte client
// (`public/_redirects`) e delle pagine composte all'edge (`/replayer/*`,
// `/news`, `/news/*`), dove le Pages Function SOSTITUISCONO il boot-loader con
// un articolo intero (`<h1>`, `<h2>`, `<p>`, `<ul>`, `.prose`). Quell'articolo
// viene dipinto senza CSS e riflowato quando il `<link media="print">` — che e'
// a priorita' Lowest, dietro dieci `modulepreload` di JS — finalmente atterra.
// E' il 12% di CLS «insufficiente» del report Cloudflare del 29-30/08/2026:
// `div.rp__barra`, `span.rp__volo`, `#nav-principale` (l'header porta la classe
// GLOBALE `.container`) e `section.overview__block`.
//
// Come `csr-noindex.mjs`, le funzioni qui sono PURE (stringa in, stringa
// fuori): cosi' `npm run test:scripts` puo' coprirle con `node --test`, senza
// dist e senza mock. L'unico I/O e' iniettato dal chiamante (`leggiFoglio`).
//
// ⚠️ SI INLINA IL FOGLIO INTERO, non un nucleo di selettori scelto a mano. In
// questo repo le liste mantenute a mano che divergono in silenzio si sono gia'
// pagate piu' volte: un nucleo curato smetterebbe di bastare al primo
// primitivo nuovo, e nessuna guardia potrebbe accorgersene.

/**
 * Il marcatore sul blocco iniettato. Vive qui e in nessun altro posto: lo
 * scrive `inject-csr-noindex.mjs` e lo cerca `check-prerender-content.mjs`.
 */
export const ATTR_MARCATORE = 'data-bff-css-inline';

/**
 * ⚠️ Chiede `rel="stylesheet"` ESPLICITO. `rel="icon"`, `rel="preload"
 * as="style"`, `rel="modulepreload"`, `rel="apple-touch-icon"` e
 * `rel="canonical"` non devono entrare mai — e' lo stesso verso del caso
 * «stripCanonical NON tocca gli altri <link>» in `csr-noindex.test.mjs`.
 */
const RE_LINK_FOGLIO = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;

/**
 * Il blocco iniettato, riconosciuto per MARCATORE e non per href (vedi sotto).
 *
 * ⚠️ NON consuma spazi attorno, e l'inserimento non ne aggiunge: rimozione e
 * inserimento sono ESATTAMENTE simmetrici, quindi l'operazione e' idempotente
 * byte per byte. Ci sono voluti due tentativi: prima la coda era `\s*\n?` e la
 * rimozione si mangiava l'indentazione della riga seguente; poi `[ \t]*\n?`, e
 * sull'artefatto VERO — dove Beasties emette `</style><link…>` senza uno
 * spazio in mezzo — i due spazi che l'inserimento aggiungeva MIGRAVANO a ogni
 * passata. Un file che cambia a ogni build senza che nulla sia cambiato e' un
 * commit fantasma a ogni deploy: la simmetria non e' eleganza, e' la
 * proprieta'. (La fixture dei test aveva l'indentazione e l'artefatto no: e'
 * per questo che il primo giro passava i test e falliva in dist.)
 */
const RE_BLOCCO = new RegExp(
  `<style\\b[^>]*\\b${ATTR_MARCATORE}=["'][^"']*["'][^>]*>[\\s\\S]*?<\\/style>`,
  'gi',
);

/**
 * Gli `href` dei fogli globali dichiarati dall'HTML, in ordine di prima
 * comparsa e senza duplicati.
 *
 * ⚠️ L'href si LEGGE DALL'HTML, non si cabla: il nome porta l'hash del build
 * (`styles-5RJ67FKS.css`) e cambia a ogni compilazione, e `outputHashing`
 * potrebbe diventare `none` domani. Il dedup serve perche' Beasties emette lo
 * stesso foglio due volte: una col `media="print" onload`, una dentro
 * `<noscript>`.
 */
export function fogliDichiarati(html) {
  const visti = new Set();
  const fuori = [];
  for (const [tag] of html.matchAll(RE_LINK_FOGLIO)) {
    const href = (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1];
    if (!href || visti.has(href)) continue;
    visti.add(href);
    fuori.push(href);
  }
  return fuori;
}

/**
 * Da `href` del `<link>` a percorso relativo dentro `dist/frontend/browser`.
 *
 * ⚠️ LANCIA se l'href non e' un file locale (URL assoluta, protocol-relative,
 * `data:`, o un percorso che risale). Un href non locale letto «al meglio»
 * produrrebbe un blocco vuoto iniettato in silenzio: cioe' esattamente niente,
 * senza dirlo.
 */
export function percorsoDelFoglio(href) {
  const pulito = String(href).split('#')[0].split('?')[0].trim();
  if (!pulito) throw new Error('href del foglio vuoto');
  if (/^[a-z][a-z0-9+.-]*:/i.test(pulito) || pulito.startsWith('//')) {
    throw new Error(`il foglio ${href} non e' locale: non posso inlinarlo`);
  }
  const relativo = pulito.replace(/^\/+/, '');
  if (!relativo || relativo.split('/').includes('..')) {
    throw new Error(`percorso del foglio non valido: ${href}`);
  }
  return relativo;
}

/**
 * Offset in cui inserire i blocchi: subito PRIMA del primo
 * `<link rel="stylesheet">`.
 *
 * ⚠️ QUI CI SI DISCOSTA DA `injectNoindex`, ED E' LA DECISIONE PORTANTE.
 * Un `<link>` partecipa alla cascata NELLA SUA POSIZIONE NEL DOCUMENTO, non
 * nel momento in cui carica: quando `onload` ribalta `media` da `print` ad
 * `all`, le sue regole entrano al punto in cui il tag e' scritto. Quindi:
 *   - blocco PRIMA del <link>  -> a parita' di specificita' vince il FOGLIO
 *     (la build corrente). Se la copia inline fosse stantia, il foglio la
 *     corregge all'atterraggio: divergenza rumorosa, visibile.
 *   - blocco DOPO (cioe' prima di `</head>`, come fa injectNoindex) -> vince
 *     la COPIA INLINE, che sopprimerebbe il foglio vero IN SILENZIO, per
 *     sempre.
 * Le due copie dovrebbero essere identiche per costruzione. La domanda giusta
 * non e' «lo saranno?» ma «quale posizione perdona meglio quando non lo sono?».
 * E' anche il punto in cui Beasties mette la propria critical CSS, quindi il
 * documento resta con un ordine solo e leggibile.
 *
 * ⚠️ LANCIA se non c'e' nessun foglio: e' l'unico modo di sapere QUALE file
 * inlinare, e «non fa niente e va avanti» e' come una rete si stacca in
 * silenzio.
 */
export function puntoDiInserimento(html) {
  RE_LINK_FOGLIO.lastIndex = 0;
  const m = RE_LINK_FOGLIO.exec(html);
  RE_LINK_FOGLIO.lastIndex = 0;
  if (!m) throw new Error('nessun <link rel="stylesheet"> nella shell CSR');
  return m.index;
}

/** Toglie tutti i blocchi marcati. Idempotente, e non tocca gli altri `<style>`. */
export function togliCssInline(html) {
  return html.replace(RE_BLOCCO, '');
}

/**
 * ⚠️ Un `</style` DENTRO il CSS chiude il blocco: il resto del foglio finisce
 * come TESTO nella pagina, e da li' in poi il parser legge CSS come HTML. E'
 * catastrofico, visibilissimo per un umano e completamente invisibile a uno
 * script che ha appena scritto il file «con successo». Il contenuto di
 * `<style>` e' RAWTEXT: `</style` e' l'unica sequenza che lo termina, e va
 * cercata cosi' — senza `>`, perche' `</style ` e `</style\t` chiudono uguale.
 * Verificato il 30/08/2026: `styles-5RJ67FKS.css` non contiene nessun `<`.
 */
function assertNoChiusura(css, href) {
  if (/<\/style/i.test(css)) {
    throw new Error(`il foglio ${href} contiene "</style": non e' inlinabile`);
  }
}

/**
 * ⚠️ In un foglio ESTERNO `url(...)` si risolve contro l'URL DEL FOGLIO;
 * dentro `<style>` si risolve contro la BASE DEL DOCUMENTO. Oggi coincidono
 * (`deployUrl: "/"` + `<base href="/">`, e le sei `url()` non-`data:` sono
 * tutte `/fonts/…woff2`), ma il giorno in cui una diventasse relativa
 * l'iniezione la romperebbe SENZA rompere il foglio esterno: le due copie
 * divergerebbero e il difetto sarebbe un font che non carica.
 *
 * ⚠️ Le `data:` vanno riconosciute PRIMA: dentro una SVG percent-encodata c'e'
 * `url(%23n)` (cioe' `url(#n)`), che sembra relativa e non lo e'.
 */
function assertUrlAssolute(css, href) {
  for (const [, , dentro] of css.matchAll(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi)) {
    const v = dentro.trim();
    if (!v) continue;
    if (/^data:/i.test(v)) continue;
    if (v.startsWith('/') || v.startsWith('#') || v.startsWith('%23')) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) continue;
    throw new Error(
      `il foglio ${href} contiene una url() relativa (${v}): inline si ` +
        'risolverebbe contro la base del documento invece che contro il foglio',
    );
  }
}

/**
 * Inserisce (o RIMPIAZZA) i blocchi inline. `fogli` = `[{ href, css }]`
 * nell'ordine di `fogliDichiarati`.
 *
 * ⚠️ UN BLOCCO PER FOGLIO, non uno concatenato: un `@import` in testa al
 * secondo foglio, concatenato, finirebbe a meta' blocco e verrebbe scartato
 * IN SILENZIO (le `@import` valgono solo in testa). Oggi `@import` non c'e' —
 * la robustezza costa zero.
 *
 * ⚠️ RIMPIAZZA invece di «salta se c'e' gia'»: il blocco si riconosce per
 * MARCATORE, non per href, quindi una dist non pulita viene corretta invece
 * che lasciata col CSS della build precedente.
 */
export function inserisciCssInline(html, fogli) {
  if (!Array.isArray(fogli) || !fogli.length) {
    throw new Error('nessun foglio da inlinare');
  }
  const pulito = togliCssInline(html);
  const i = puntoDiInserimento(pulito);
  const blocchi = fogli
    .map(({ href, css }) => {
      assertNoChiusura(css, href);
      assertUrlAssolute(css, href);
      const nome = percorsoDelFoglio(href);
      // ⚠️ Nessuno spazio attorno: vedi RE_BLOCCO. Inserimento e rimozione
      // devono essere simmetrici o l'operazione non e' idempotente.
      return `<style ${ATTR_MARCATORE}="${nome}">${css}</style>`;
    })
    .join('');
  // ⚠️ Terza ragione per un blocco per foglio, oltre alle `@import`: avvolti
  // separatamente, un `</styl` in coda al primo e un `e>` in testa al secondo
  // NON formano un `</style` a cavallo della giunzione — un difetto che nessuno
  // dei due fogli contiene e che nessun controllo per-foglio potrebbe vedere.
  // Concatenandoli, invece, si formerebbe. Pinnato nei due versi dai test.
  return pulito.slice(0, i) + blocchi + pulito.slice(i);
}

/**
 * La post-condizione, CONDIVISA fra l'iniettore e `check-prerender-content.mjs`.
 * Due copie del predicato in due file sono una divergenza che aspetta solo di
 * succedere: la guardia continuerebbe a verificare una forma che l'iniettore
 * non produce piu'.
 *
 * `leggiFoglio(percorso) -> string | null` e' iniettata dal chiamante, cosi'
 * questo modulo resta puro e testabile senza dist.
 *
 * ⚠️ E' un CONTENIMENTO BYTE A BYTE (il blocco contiene esattamente il file su
 * disco), non una lista di selettori-canarino: cosi' non invecchia quando
 * nasce una classe nuova, e non va aggiornata mai.
 *
 * Ritorna `[]` se tutto a posto, altrimenti l'elenco dei problemi in italiano.
 */
export function verificaCssInline(html, leggiFoglio) {
  const guai = [];
  let hrefs;
  try {
    hrefs = fogliDichiarati(html);
  } catch (e) {
    return [`non riesco a leggere i <link rel="stylesheet">: ${e.message}`];
  }
  // ⚠️ Anti-guardia-vuota: senza nessun foglio dichiarato NON si risponde «tutto
  // a posto». Zero fogli significa che la forma dell'artefatto e' cambiata.
  if (!hrefs.length) {
    return ['nessun <link rel="stylesheet"> dichiarato: la forma della shell e\' cambiata'];
  }
  for (const href of hrefs) {
    let percorso;
    try {
      percorso = percorsoDelFoglio(href);
    } catch (e) {
      guai.push(e.message);
      continue;
    }
    const css = leggiFoglio(percorso);
    if (css == null) {
      guai.push(`il foglio ${href} e' dichiarato ma non lo trovo su disco`);
      continue;
    }
    if (!html.includes(css)) {
      guai.push(
        `il contenuto di ${href} non e' inline nella <head> (o e' una copia ` +
          'stantia: il blocco marcato non combacia con il file su disco)',
      );
    }
  }
  return guai;
}
