// L'HTML delle news, costruito all'edge — senza l'app Angular.
//
// PERCHE' QUESTO FILE ESISTE, cioe' perche' non c'e' piu' l'handler SSR.
// La Fase 1 del piano prescriveva che la Pages Function importasse l'handler
// SSR di Angular (`dist/frontend/server/server.mjs`). E' stato fatto, il build
// e' passato per intero e Cloudflare ha rifiutato la Function:
//     Your Worker exceeded the size limit of 3 MiB.
// Misurato dopo: `dist/frontend/server` pesa 11 MB non compressi / 2,84 MB
// gzip, e il pezzo piu' grosso e' un chunk lazy che con le notizie non c'entra
// niente. Il limite non e' aggirabile e non e' nemmeno il punto: mandare
// all'edge l'intera applicazione per stampare un titolo e un corpo Markdown e'
// sproporzionato. La superficie che serve davvero — titolo, description,
// canonical, OG, JSON-LD, corpo — e' questa, ed e' piccola.
//
// PERCHE' UN MODULO A PARTE E NON DENTRO LA FUNCTION. Qui dentro non si tocca
// ne' la rete ne' `Response`: sono funzioni pure, stringa in / stringa fuori.
// Cosi' `npm run test:scripts` puo' coprirle con `node --test` (vedi
// `scripts/lib/news-render.test.mjs`) senza inventare un finto Worker — ed e' lo
// stesso motivo per cui esistono `scripts/lib/redirects.mjs` e
// `scripts/lib/pages-functions.mjs`. La Function resta quello che era: la busta
// (cache di bordo, intestazioni, mai un 5xx, 404 vero).
//
// ⚠️ LO SCHELETRO E' `index.csr.html`, CHE NASCE `noindex`. Lo mette apposta
// `scripts/inject-csr-noindex.mjs`, perche' quella shell la ricevono tutte le
// rotte client (che in indice non devono finire). Un articolo invece deve
// ESSERCI: `applicaTesta` TOGLIE quel meta, e se un giorno smettesse di
// toglierlo ogni articolo reso all'edge nascerebbe fuori da Google **senza che
// nulla si rompa a vista** — `check-prerender-content.mjs` misura `dist/`, e
// questa risposta in `dist/` non esiste. Lo verificano un test qui accanto e la
// sonda dal vivo `scripts/check-news-live.mjs`. Il ripiego della Function
// (`shellFallback`) invece il `noindex` lo CONSERVA: un corpo degradato non
// deve entrare in indice.
//
// ⚠️ TITOLI, DESCRIZIONI E DATE DEVONO COMBACIARE CON QUELLO CHE FA L'APP dopo
// il montaggio (`SeoService` + `news-detail.component.ts`): questa e' la prima
// stesura della stessa pagina, non una seconda pagina. Dove i due possono
// divergere c'e' un ⚠️ sulla riga, e i punti numerici (il taglio dell'estratto,
// le stringhe dell'indice) sono fissati dal test.

import { renderMarkdown } from './markdown.mjs';

/** Dominio canonico. ⚠️ Sempre questo, anche servendo da un'anteprima di ramo:
 * un canonical verso `*.pages.dev` inviterebbe Google a indicizzare l'anteprima
 * al posto del sito. (Conseguenza dichiarata: lanciata su una preview, la sonda
 * `check-news-live.mjs` segnala il canonical "diverso dall'URL richiesto" — e'
 * atteso, non e' una deriva.) */
export const SITO = 'https://bestfishforever.it';

/** Il suffisso che `SeoService.setSeo` aggiunge a ogni titolo. */
export const SUFFISSO = ' — Best Fish Forever';

/** Immagine OG di riserva: la stessa `DEFAULT_IMAGE` di `seo.service.ts`. */
export const OG_PREDEFINITA = `${SITO}/og.png`;

// ⚠️ Le due stringhe dell'indice sono COPIATE dalla rotta `news` di
// `app.routes.ts` (`title` e `data.description`): li' le applica il listener di
// navigazione dopo il montaggio, qui servono prima. Se cambiano di la' e non di
// qua, la pagina cambia titolo sotto gli occhi del lettore un secondo dopo
// l'apertura — e cambia sotto uno scraper che il JS non lo esegue affatto. Un
// test in `scripts/lib/news-render.test.mjs` rilegge `app.routes.ts` e fallisce
// se le due copie divergono.
export const TITOLO_INDICE = 'News — Best Fish Forever';
export const DESCRIZIONE_INDICE =
  'News e aggiornamenti dalla scuola di poker Best Fish Forever: strategie per Spin & Go e Twister, novità e vita della community.';

// ---- Aiutanti di base ---------------------------------------------------

/**
 * Escape per testo E per attributi (le virgolette comprese): un titolo arriva
 * da una fonte esterna e finisce sia dentro un `<h1>` sia dentro un
 * `content="…"`. Una sola funzione per i due usi, cosi' non si puo' scegliere
 * quella sbagliata.
 */
export function escapeHtml(valore) {
  return String(valore ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * ⚠️ Dentro uno `<script>` il parser HTML non interpreta le entita' e chiude il
 * blocco al primo `</script`: un `</script>` nel titolo uscirebbe dal JSON-LD e
 * diventerebbe markup eseguito. `JSON.stringify` da solo NON scappa `<`.
 * Stessa riga di `seo.service.ts:137`, e per la stessa ragione.
 */
export function jsonLdSicuro(dati) {
  return JSON.stringify(dati).replace(/</g, '\\u003c');
}

/**
 * Estratto dal Markdown per description/OG. ⚠️ E' la COPIA di
 * `news-detail.component.ts#excerpt`: dopo il montaggio la description la
 * riscrive quel metodo, quindi due tagli diversi vorrebbero dire due
 * description diverse per la stessa pagina (una per gli scraper, una per
 * Google). I due numeri (155 / 152) sono fissati dal test.
 */
export function estratto(corpo) {
  const testo = String(corpo ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '') // immagini md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link md → testo
    .replace(/[#>*_`~|-]/g, ' ') // simboli md
    .replace(/\s+/g, ' ')
    .trim();
  return testo.length > 155 ? `${testo.slice(0, 152).trimEnd()}…` : testo;
}

/**
 * Data leggibile in italiano. ⚠️ Con il fuso di Roma e non con quello del colo
 * che sta rispondendo: un articolo pubblicato alle 23:30 italiane porterebbe la
 * data del giorno prima su meta' dei server del mondo. Se `Intl` non e'
 * disponibile o la data e' malformata si ripiega sulla parte `YYYY-MM-DD`
 * dell'ISO: una data brutta e' meglio di una pagina che non esce.
 */
export function dataLeggibile(iso) {
  const grezza = String(iso ?? '');
  if (!grezza) return '';
  try {
    const d = new Date(grezza);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Europe/Rome',
    }).format(d);
  } catch {
    return grezza.slice(0, 10);
  }
}

// ---- L'indirizzo buono di un articolo -----------------------------------
//
// ⚠️ LA REGOLA DEI 301 STA QUI, non nella Function, per la stessa ragione di
// tutto il resto di questo file: e' logica pura, quindi `npm run test:scripts`
// la prova senza inventare un Worker. La Function resta la busta (stato,
// intestazioni, cache).
//
// ⚠️ E IL BERSAGLIO DEL 301 ESCE DALLA STESSA FUNZIONE DEL CANONICAL. Se fossero
// due stringhe costruite in due punti, il giorno che una cambia forma (una
// barra, un encode) si otterrebbe un redirect verso una pagina il cui canonical
// dichiara un'ALTRA url: per un motore e' peggio del doppione che il redirect
// doveva chiudere.

/** L'indice ha una sola forma buona, ed e' quella con lo slash finale. */
export const PERCORSO_INDICE = '/news/';

/**
 * Il percorso canonico di una chiave — chiave vuota = l'indice. SEMPRE con lo
 * slash finale: e' la forma servita a 200, quella che canonical e sitemap
 * dichiarano e quella che un motore chiede (lezione Search Console 18/07/2026).
 */
export function percorsoCanonico(chiave) {
  const k = String(chiave ?? '').trim();
  return k ? `/news/${encodeURIComponent(k)}/` : PERCORSO_INDICE;
}

/** URL canonica = dominio di produzione + percorso canonico. */
export function urlCanonica(chiave) {
  return `${SITO}${percorsoCanonico(chiave)}`;
}

/**
 * La correzione da fare sull'indirizzo richiesto, o `null` quando non c'e'
 * niente da correggere. `chiaveCanonica` e' lo slug corrente dell'articolo —
 * oppure, quando quello slug non c'e', la chiave con cui e' stato chiesto.
 *
 * ⚠️ UN SOLO SALTO, SEMPRE, e non e' un auspicio: il bersaglio e'
 * `percorsoCanonico(k)`, e ripresentandolo `decodeURIComponent` lo riporta
 * esattamente a `k` — quindi alla seconda richiesta destinazione === pathname e
 * qui esce `null`. E' l'unica proprieta' che tiene lontano un ciclo di
 * redirect, ed e' fissata da un test.
 *
 * ⚠️ CON UNA CHIAVE VUOTA NON SI REINDIRIZZA UN ARTICOLO: il bersaglio sarebbe
 * `/news/`, cioe' l'INDICE, e un articolo senza slug verrebbe spedito su
 * un'altra pagina invece di essere reso. Chi chiama passa `slug || chiave`, e
 * la chiave a quel punto non e' mai vuota.
 *
 * ⚠️ IL BERSAGLIO E' UN PERCORSO, NON UNA URL ASSOLUTA. Un `Location` verso
 * bestfishforever.it butterebbe fuori dall'anteprima di ramo chiunque stia
 * verificando li', e la prova su preview e' obbligatoria prima di main. Il
 * canonical invece nomina sempre la produzione: sono due cose diverse, e questa
 * e' la sola in cui l'host di partenza va rispettato.
 */
export function redirezione(pathname, chiaveCanonica) {
  const destinazione = percorsoCanonico(chiaveCanonica);
  return destinazione === String(pathname ?? '') ? null : destinazione;
}

// ---- Chirurgia sullo scheletro -----------------------------------------
//
// Lo scheletro e' `index.csr.html`: i nomi dei chunk hanno l'hash del build,
// quindi una shell scritta a mano qui sarebbe da riscrivere a ogni deploy.
// Si riusa quella vera e si sostituiscono i pezzi che cambiano.
//
// ⚠️ Ogni `impostaX` SOSTITUISCE se il tag c'e' e INSERISCE se non c'e'. Non e'
// pignoleria: un `replace` che non trova nulla non fallisce, restituisce la
// stringa invariata — cioe' la pagina uscirebbe con i meta della HOME senza che
// niente segnali il problema. E' esattamente il difetto (canonical della home su
// ogni rotta) che il listener di navigazione ha chiuso il 12/07/2026.

/**
 * ⚠️ Lancia se lo scheletro non ha `</head>`: vuol dire che la forma
 * dell'artefatto e' cambiata sotto i piedi. La Function trasforma l'eccezione
 * nel ripiego sulla shell (200, la SPA si monta e carica la pagina da se'),
 * quindi il lettore non vede un errore — ma la pagina non esce reso, e la sonda
 * dal vivo se ne accorge.
 */
function inserisciNellaTesta(html, tag) {
  const i = html.search(/<\/head\s*>/i);
  if (i === -1) throw new Error('scheletro senza </head>: forma di index.csr.html cambiata?');
  return `${html.slice(0, i)}  ${tag}\n${html.slice(i)}`;
}

/**
 * ⚠️ La sostituzione passa SEMPRE da una funzione, mai da una stringa: in
 * `String.replace` una stringa di rimpiazzo interpreta `$&`, `$1`, `` $` `` —
 * e qui i rimpiazzi contengono il titolo e il corpo di un articolo, cioe' testo
 * di fonte esterna. Un titolo con dentro `$&` verrebbe riscritto in silenzio.
 */
function sostituisci(html, re, rimpiazzo) {
  return html.replace(re, () => rimpiazzo);
}

function impostaTitolo(html, titolo) {
  const tag = `<title>${escapeHtml(titolo)}</title>`;
  return /<title[^>]*>[\s\S]*?<\/title>/i.test(html)
    ? sostituisci(html, /<title[^>]*>[\s\S]*?<\/title>/i, tag)
    : inserisciNellaTesta(html, tag);
}

/**
 * `attributo` e' `name` o `property`, `nome` una costante di questo file (mai
 * un dato dell'articolo): la regex non puo' essere avvelenata da un titolo.
 */
function impostaMeta(html, attributo, nome, contenuto) {
  const re = new RegExp(`<meta[^>]+${attributo}=["']${nome}["'][^>]*>`, 'i');
  const tag = `<meta ${attributo}="${nome}" content="${escapeHtml(contenuto)}">`;
  return re.test(html) ? sostituisci(html, re, tag) : inserisciNellaTesta(html, tag);
}

function impostaCanonical(html, url) {
  const re = /<link[^>]+rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeHtml(url)}">`;
  return re.test(html) ? sostituisci(html, re, tag) : inserisciNellaTesta(html, tag);
}

/** ⚠️ Il meta che `inject-csr-noindex.mjs` ha messo nella shell: vedi l'intestazione. */
function togliNoindex(html) {
  return html.replace(/[ \t]*<meta[^>]+name=["']robots["'][^>]*>[ \t]*\r?\n?/gi, '');
}

/**
 * ⚠️ L'`id` e' lo stesso che usa `SeoService.setJsonLd` (`ld-news-article`), e
 * non e' un dettaglio: montandosi, l'app cerca l'elemento per id e ne riscrive
 * il contenuto invece di aggiungerne un secondo. Con un id diverso la pagina
 * finirebbe con due `NewsArticle` in testa.
 */
function impostaJsonLd(html, id, dati) {
  const re = new RegExp(`<script[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`, 'i');
  const tag =
    `<script type="application/ld+json" id="${id}">${jsonLdSicuro(dati)}</script>`;
  return re.test(html) ? sostituisci(html, re, tag) : inserisciNellaTesta(html, tag);
}

/**
 * Il contenuto va DENTRO `<app-root>`, al posto del loader di avvio (che e' in
 * `position: fixed` e coprirebbe l'articolo). Montandosi, Angular svuota il
 * proprio host e mette la pagina vera: qui dentro c'e' quello che il lettore
 * vede subito, e quello che leggono gli scraper e i motori.
 *
 * ⚠️ Lancia se `<app-root>` non c'e': senza, la pagina uscirebbe con il solo
 * `<head>` giusto e un corpo vuoto — 200, canonical perfetto, zero contenuto.
 * E' la trappola gia' pagata su `/tabelle` (prerenderizzata, in sitemap, tre
 * parole dentro).
 */
function impostaCorpo(html, corpo) {
  const re = /(<app-root[^>]*>)[\s\S]*?(<\/app-root>)/i;
  if (!re.test(html)) throw new Error('scheletro senza <app-root>: forma di index.csr.html cambiata?');
  return html.replace(re, (intero, apri, chiudi) => `${apri}\n${corpo}\n${chiudi}`);
}

/**
 * Tutta la testa in un colpo solo, nello stesso ordine e con le stesse chiavi
 * di `SeoService.applyMeta` — cosi' le due stesure della pagina non possono
 * dichiarare cose diverse.
 */
function applicaTesta(html, { titolo, descrizione, url, immagine, tipoOg }) {
  let out = togliNoindex(html);
  out = impostaTitolo(out, titolo);
  out = impostaMeta(out, 'name', 'description', descrizione);
  out = impostaMeta(out, 'property', 'og:type', tipoOg);
  out = impostaMeta(out, 'property', 'og:title', titolo);
  out = impostaMeta(out, 'property', 'og:description', descrizione);
  out = impostaMeta(out, 'property', 'og:url', url);
  out = impostaMeta(out, 'property', 'og:image', immagine);
  out = impostaMeta(out, 'name', 'twitter:title', titolo);
  out = impostaMeta(out, 'name', 'twitter:description', descrizione);
  out = impostaMeta(out, 'name', 'twitter:image', immagine);
  out = impostaCanonical(out, url);
  return out;
}

// ---- Le due pagine ------------------------------------------------------

/**
 * Un articolo. `chiave` e' quella chiesta nell'URL (slug o ObjectId): serve solo
 * come ripiego per il canonical, perche' la forma buona e' lo `slug`
 * dell'articolo — e' quella che la sitemap pubblica e quella su cui la Fase 4
 * costruira' i 301.
 *
 * ⚠️ `createdAt`/`updatedAt` e non `publishedAt`, anche se l'API espone tutti e
 * tre: sono i campi che usa `news-detail.component.ts` (data in pagina e
 * JSON-LD). Il giorno che quel componente passa a `publishedAt`, questa riga si
 * muove con lui — altrimenti la data cambia sotto gli occhi del lettore quando
 * l'app si monta.
 */
export function renderArticolo(scheletro, articolo, chiave) {
  const dati = articolo ?? {};
  const titolo = String(dati.title ?? '').trim();
  const titoloPagina = `${titolo || 'News'}${SUFFISSO}`;
  const descrizione = estratto(dati.body);
  const copertina = typeof dati.coverImageUrl === 'string' ? dati.coverImageUrl : '';
  const url = urlCanonica(typeof dati.slug === 'string' && dati.slug ? dati.slug : chiave);
  const iso = String(dati.createdAt ?? '');
  const quando = dataLeggibile(iso);

  const corpo = [
    '<main class="app-main">',
    '<section class="section"><div class="container news-detail">',
    '<article class="news-detail__article">',
    '<p><a href="/news/">← Tutte le news</a></p>',
    '<header class="news-detail__head">',
    quando
      ? `<time class="news-detail__date" datetime="${escapeHtml(iso)}">${escapeHtml(quando)}</time>`
      : '',
    `<h1>${escapeHtml(titolo || 'News')}</h1>`,
    '</header>',
    copertina
      ? `<img class="news-detail__cover" src="${escapeHtml(copertina)}" alt="">`
      : '',
    // ⚠️ NON passa da `escapeHtml`: e' HTML gia' reso. A difenderlo e' la
    // configurazione di `markdown.mjs`, che SCARTA l'HTML grezzo del Markdown —
    // fuori da Angular non c'e' nessun sanitizer di `[innerHTML]`.
    `<div class="prose">${renderMarkdown(dati.body)}</div>`,
    '</article>',
    '</div></section>',
    '</main>',
  ]
    .filter(Boolean)
    .join('\n');

  let html = applicaTesta(scheletro, {
    titolo: titoloPagina,
    descrizione,
    url,
    immagine: copertina || OG_PREDEFINITA,
    tipoOg: 'article',
  });
  // Stessa forma di `news-detail.component.ts#applySeo`: quando l'app si monta
  // riscrive QUESTO blocco (stesso id) con gli stessi valori.
  html = impostaJsonLd(html, 'ld-news-article', {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: titolo,
    description: descrizione,
    ...(copertina ? { image: [copertina] } : {}),
    datePublished: iso,
    dateModified: String(dati.updatedAt ?? iso),
    publisher: {
      '@type': 'Organization',
      name: 'Best Fish Forever',
      logo: {
        '@type': 'ImageObject',
        url: `${SITO}/logo-256.png`,
      },
    },
  });
  return impostaCorpo(html, corpo);
}

/**
 * L'indice `/news`. E' la parte che la prima stesura di questa Function non
 * copriva: l'indice era prerenderizzato, quindi congelato agli articoli
 * esistenti al momento del deploy — e le news si pubblicano dall'admin senza
 * deployare.
 */
export function renderIndice(scheletro, articoli) {
  const elenco = Array.isArray(articoli) ? articoli : [];

  const voci = elenco
    .map((a) => {
      const titolo = String(a?.title ?? '').trim();
      if (!titolo) return '';
      const chiave = typeof a?.slug === 'string' && a.slug ? a.slug : String(a?._id ?? '');
      if (!chiave) return '';
      const iso = String(a?.createdAt ?? '');
      const quando = dataLeggibile(iso);
      const sommario = estratto(a?.body);
      return [
        '<li class="news-list__voce">',
        '<article>',
        quando ? `<time datetime="${escapeHtml(iso)}">${escapeHtml(quando)}</time>` : '',
        `<h2><a href="/news/${encodeURIComponent(chiave)}/">${escapeHtml(titolo)}</a></h2>`,
        sommario ? `<p>${escapeHtml(sommario)}</p>` : '',
        '</article>',
        '</li>',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .filter(Boolean);

  const corpo = [
    '<main class="app-main">',
    '<section class="section"><div class="container">',
    '<div class="section-head">',
    '<span class="eyebrow">Dal tavolo</span>',
    // ⚠️ Un solo `<h1>` in tutta la pagina, e i titoli degli articoli sono
    // `<h2>`: e' la stessa regola che `check-prerender-content.mjs` impone alle
    // pagine statiche e che la sonda dal vivo verifica su queste.
    '<h1>News della scuola</h1>',
    '</div>',
    `<p>${escapeHtml(DESCRIZIONE_INDICE)}</p>`,
    voci.length
      ? `<ul class="news-list">\n${voci.join('\n')}\n</ul>`
      : '<p>Nessuna news pubblicata, torna a trovarci presto.</p>',
    '</div></section>',
    '</main>',
  ].join('\n');

  const html = applicaTesta(scheletro, {
    titolo: TITOLO_INDICE,
    descrizione: DESCRIZIONE_INDICE,
    url: urlCanonica(''),
    immagine: OG_PREDEFINITA,
    tipoOg: 'website',
  });
  return impostaCorpo(html, corpo);
}
