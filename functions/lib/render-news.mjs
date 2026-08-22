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
 * Le note di rettifica, o stringa vuota se non ce ne sono (§4.4).
 *
 * ⚠️ La forma della frase — «Nota di rettifica ({data}): {nota}» — e' la stessa
 * del componente Angular, e un test di deriva rilegge quel template per
 * assicurarsene: e' la stessa pagina scritta due volte, non due pagine.
 *
 * ⚠️ Regge una riga malformata invece di lanciare: una rettifica senza data o
 * senza testo non deve poter togliere dalla rete l'intero articolo (la Function
 * trasformerebbe l'eccezione nel ripiego sulla shell, cioe' una pagina senza
 * contenuto per gli scraper).
 */
function rettificheHtml(note) {
  const voci = (Array.isArray(note) ? note : [])
    .map((r) => {
      const testo = String(r?.nota ?? '').trim();
      if (!testo) return '';
      const quando = dataLeggibile(r?.at);
      const etichetta = quando ? `Nota di rettifica (${quando}):` : 'Nota di rettifica:';
      return `<p class="news-detail__rettifica"><strong>${escapeHtml(etichetta)}</strong> ${escapeHtml(testo)}</p>`;
    })
    .filter(Boolean);
  return voci.length ? `<div class="news-detail__rettifiche">\n${voci.join('\n')}\n</div>` : '';
}

// ---- Condivisione (in fondo all'articolo) -------------------------------
//
// ⚠️ QUESTO BLOCCO ESISTE IN ENTRAMBE LE RESE, E NON PER INTERO. Le due stesure
// della pagina si SOSTITUISCONO (Angular svuota il proprio host montandosi), non
// si fondono: quello che deve esserci in tutte e due va scritto due volte. Qui
// stanno **solo i tre collegamenti**, che sono `<a href>` e funzionano senza una
// riga di JavaScript — quindi valgono anche per chi legge questa prima stesura e
// per un motore. Il quarto controllo, «Copia link», sta **solo** nel componente
// Angular: all'edge sarebbe un bottone morto (nessun gestore lo ascolterebbe mai,
// perche' il codice che lo farebbe funzionare arriva insieme all'app che
// cancella questo HTML). L'asimmetria e' una decisione, ed e' pinnata NEI DUE
// VERSI da `scripts/lib/news-render.test.mjs`: un caso verifica che qui il
// controllo di copia NON ci sia, un altro che nel template Angular ci sia.
// Senza il primo qualcuno "allineerebbe" le rese aggiungendo il bottone morto;
// senza il secondo lo toglierebbe per simmetria.

/**
 * I tre glifi, in forma piena, da **Simple Icons (CC0 1.0)** — non dai brand
 * center dei tre servizi, che hanno termini d'uso propri.
 *
 * ⚠️ SONO LA COPIA ESATTA dei rami `@case` di
 * `src/app/shared/ui/icon/icon.component.ts`: la Function e l'app sono due
 * build diverse e non possono importarsi a vicenda (stessa ragione per cui
 * `functions/lib/markdown.mjs` duplica il renderer del Markdown). A tenere le
 * due copie allineate e' un test che rilegge quel sorgente e confronta le
 * stringhe carattere per carattere.
 *
 * ⚠️ SVG INLINE, MAI UN `<img>`: `news-render.test.mjs` asserisce che dentro
 * `<main>` non ci sia alcun `<img>` quando l'articolo non ha copertina — e quella
 * trappola vale anche con questo blocco in pagina. Un'icona servita come
 * immagine sarebbe una richiesta di rete in piu' e, soprattutto, un `<img>` di
 * troppo dove la spec ne conta zero.
 */
export const GLIFI_CONDIVISIONE = {
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z',
  telegram: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0Zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212-.07-.062-.174-.041-.249-.024-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635Z',
  facebook: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z',
};

/**
 * ⚠️ Qui il root `<svg>` porta gia' `fill="currentColor"`, mentre nel componente
 * Angular il root e' `fill="none" stroke-width="2"` (e' condiviso con le icone a
 * tratto) e l'override sta su ogni `<path>`. Il disegno che ne esce e' lo stesso:
 * a divergere sarebbe solo il `d`, ed e' quello che il test sorveglia.
 */
function iconaCondivisione(nome) {
  return (
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" ' +
    `aria-hidden="true" focusable="false"><path d="${GLIFI_CONDIVISIONE[nome]}"/></svg>`
  );
}

/**
 * I tre indirizzi di condivisione, da **una sola fonte**: `url`, che e' la
 * STESSA stringa del canonical della pagina (`urlCanonica(slug)`).
 *
 * ⚠️ COSTRUITA SULLO SLUG, MAI SULLA CHIAVE CHIESTA. Chi arriva da un ObjectId o
 * da uno slug storico riceve un 301 verso lo slug corrente, ma lo scraper legge
 * comunque questa pagina: condividere `/news/65f0…aa/` vorrebbe dire diffondere
 * link permanenti su un indirizzo che il sito stesso dichiara non canonico. Un
 * test lo fissa nella forma piu' stretta possibile — il parametro `u=` di
 * Facebook, decodificato, e' **identico** all'href del canonical della stessa
 * pagina.
 *
 * ⚠️ `encodeURIComponent` PRIMA, `escapeHtml` DOPO (l'escape lo fa chi scrive
 * l'attributo, qui sotto). Invertendoli, l'`&amp;` prodotto dall'escape verrebbe
 * percent-encodato dentro il valore e Telegram riceverebbe **un parametro solo**:
 * il titolo finirebbe dentro l'URL da condividere.
 */
export function linkCondivisione(url, titolo) {
  const u = encodeURIComponent(String(url ?? ''));
  const t = encodeURIComponent(String(titolo ?? ''));
  return {
    // WhatsApp non ha un campo separato per l'URL: titolo e indirizzo viaggiano
    // in un unico testo, quindi si codificano insieme.
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${String(titolo ?? '')} ${String(url ?? '')}`)}`,
    telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
  };
}

/** Le tre etichette, in un posto solo: sono anche gli `aria-label`. */
const CANALI_CONDIVISIONE = [
  ['whatsapp', 'WhatsApp'],
  ['telegram', 'Telegram'],
  ['facebook', 'Facebook'],
];

/**
 * Il blocco di condivisione, ultimo figlio dell'`<article>`.
 *
 * ⚠️ DENTRO L'ARTICOLO E NON FUORI: `max-width` e `gap` della colonna di lettura
 * vivono su `.news-detail__article`, quindi un blocco fuori vorrebbe dire un
 * secondo contenitore con le stesse misure — cioe' una seconda fonte di verita'
 * per la larghezza del testo.
 *
 * ⚠️ `target="_blank" rel="noopener"`: convenzione della casa per ogni link che
 * esce dal sito (17 occorrenze nel repo).
 *
 * ⚠️ LE CLASSI QUI SOTTO SONO SERVITE DAVVERO, e per una ragione che va detta:
 * gli stili di `.news-share*` stanno in `src/styles/_news-share.scss`, cioè fra
 * i fogli GLOBALI (come `.prose` e `.btn`), NON nel foglio del componente. Un
 * foglio di componente e' compilato con l'incapsulamento
 * (`.news-share__btn[_ngcontent-…]`) e questo HTML quell'attributo non ce l'ha:
 * lì dentro le regole non toccherebbero mai questa stesura, che per chi ha il
 * JavaScript disattivato e' **definitiva**. E' anche cio' che tiene i bersagli
 * tattili a 44px qui e non solo di la'. Chi sposta quelle regole dentro il
 * componente spegne meta' del lavoro senza rompere niente a vista.
 */
function condivisioneHtml(url, titolo) {
  const link = linkCondivisione(url, titolo);
  const voci = CANALI_CONDIVISIONE.map(
    ([nome, etichetta]) =>
      `<a class="news-share__btn btn btn--ghost btn--sm" href="${escapeHtml(link[nome])}"` +
      ` target="_blank" rel="noopener" aria-label="Condividi su ${escapeHtml(etichetta)}">` +
      `${iconaCondivisione(nome)}<span>${escapeHtml(etichetta)}</span></a>`,
  );
  return [
    '<footer class="news-share">',
    '<p class="news-share__label">Condividi l\'articolo</p>',
    `<div class="news-share__row">\n${voci.join('\n')}\n</div>`,
    '</footer>',
  ].join('\n');
}

/**
 * Un articolo. `chiave` e' quella chiesta nell'URL (slug o ObjectId): serve solo
 * come ripiego per il canonical, perche' la forma buona e' lo `slug`
 * dell'articolo — e' quella che la sitemap pubblica e quella su cui la Fase 4
 * costruira' i 301.
 *
 * ⚠️ LA DATA E' `publishedAt` (dal 19/08/2026, §4.2), non piu' `createdAt`: fra
 * la creazione di una bozza e la sua pubblicazione possono passare giorni, e la
 * data di una notizia e' quella in cui e' uscita. `createdAt` resta come rete
 * per i pezzi anteriori al campo — sui tre articoli storici la migrazione ha
 * fatto ereditare l'uno dall'altro, quindi oggi il valore e' lo stesso.
 *
 * ⚠️ BYLINE E NOTE DI RETTIFICA STANNO QUI, non solo nel componente Angular: chi
 * legge questa stesura e' il crawler, e una firma che compare solo dopo
 * l'idratazione — per un motore — non esiste. L'etichetta IA del TESTO invece
 * non c'e', ed e' voluto: e' volontaria, e la ragione per esteso sta in
 * `src/app/core/news.constants.ts` (⚠️ quella dell'IMMAGINE, quando arrivera',
 * dovra' stare anche qui: e' l'obbligo in se', non una cortesia).
 */
export function renderArticolo(scheletro, articolo, chiave) {
  const dati = articolo ?? {};
  const titolo = String(dati.title ?? '').trim();
  const titoloPagina = `${titolo || 'News'}${SUFFISSO}`;
  const descrizione = estratto(dati.body);
  const copertina = typeof dati.coverImageUrl === 'string' ? dati.coverImageUrl : '';
  // ⚠️ DUE campi, e non uno. `ogImageUrl` e' la targa 1200x675 generata da noi:
  // esiste SOLO per le anteprime social (WhatsApp, Telegram, Facebook), e in
  // pagina non si vede mai — l'`<img>` qui sotto resta `coverImageUrl`, cioe' la
  // foto vera, che i tre articoli storici hanno e un pezzo generato no.
  // Sono separati perche' `coverImageUrl` pilotava DUE cose insieme (anteprima e
  // immagine in pagina), e riconoscere la targa sniffando l'URL sarebbe
  // un'euristica che si rompe in silenzio al primo rinomino. La stessa catena,
  // nello stesso ordine, sta in `news-detail.component.ts#applySeo`.
  const ogImage = typeof dati.ogImageUrl === 'string' ? dati.ogImageUrl : '';
  const url = urlCanonica(typeof dati.slug === 'string' && dati.slug ? dati.slug : chiave);
  const iso = String(dati.publishedAt ?? dati.createdAt ?? '');
  const quando = dataLeggibile(iso);
  const autore = String(dati.autore ?? '').trim();
  const note = Array.isArray(dati.rettifiche) ? dati.rettifiche : [];

  const corpo = [
    '<main class="app-main">',
    '<section class="section"><div class="container news-detail">',
    '<article class="news-detail__article">',
    '<p><a href="/news/">← Tutte le news</a></p>',
    '<header class="news-detail__head">',
    '<p class="news-detail__meta">',
    quando
      ? `<time class="news-detail__date" datetime="${escapeHtml(iso)}">${escapeHtml(quando)}</time>`
      : '',
    // ⚠️ La firma e' un COLLEGAMENTO a /redazione, come nel componente: e' li'
    // che si trova chi risponde degli articoli, ed e' la seconda gamba
    // dell'esonero art. 50(4). Senza quella pagina raggiungibile e' un ornamento.
    // ⚠️ CON LO SLASH FINALE, e nel componente Angular no: non e' una svista.
    // Qui l'indirizzo lo segue un crawler, e `/redazione/` e' la forma servita a
    // 200 dall'SSG (quella senza slash prende un 308); di la' e' un `routerLink`,
    // cioe' una navigazione interna che non passa dalla rete. Allinearli
    // "per coerenza" vorrebbe dire regalare un salto in piu' a ogni scansione.
    autore
      ? `<span class="news-detail__byline">di <a href="/redazione/">${escapeHtml(autore)}</a></span>`
      : '',
    '</p>',
    `<h1>${escapeHtml(titolo || 'News')}</h1>`,
    '</header>',
    copertina
      ? `<img class="news-detail__cover" src="${escapeHtml(copertina)}" alt="">`
      : '',
    // Note di rettifica PRIMA del corpo: una correzione che il lettore trova
    // solo dopo aver letto l'articolo sbagliato non e' una correzione.
    rettificheHtml(note),
    // ⚠️ NON passa da `escapeHtml`: e' HTML gia' reso. A difenderlo e' la
    // configurazione di `markdown.mjs`, che SCARTA l'HTML grezzo del Markdown —
    // fuori da Angular non c'e' nessun sanitizer di `[innerHTML]`.
    `<div class="prose">${renderMarkdown(dati.body)}</div>`,
    // ⚠️ ULTIMO figlio dell'`<article>`, come nel componente Angular: la
    // condivisione si offre a chi ha finito di leggere, non a chi deve ancora
    // cominciare. I tre collegamenti stanno anche qui perche' sono `<a href>` e
    // non hanno bisogno di JavaScript; il «Copia link» no — vedi l'intestazione
    // di `condivisioneHtml`.
    condivisioneHtml(url, titolo),
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
    immagine: ogImage || copertina || OG_PREDEFINITA,
    tipoOg: 'article',
  });
  // Stessa forma di `news-detail.component.ts#applySeo`: quando l'app si monta
  // riscrive QUESTO blocco (stesso id) con gli stessi valori.
  html = impostaJsonLd(html, 'ld-news-article', {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: titolo,
    description: descrizione,
    // ⚠️ Qui resta `coverImageUrl` e NON la targa: i dati strutturati descrivono
    // l'articolo, e l'immagine dell'articolo e' quella che il lettore vede in
    // pagina. La targa e' un'insegna per le chat, non un'illustrazione del
    // pezzo. Il gemello Angular fa lo stesso (`news-detail.component.ts`).
    ...(copertina ? { image: [copertina] } : {}),
    datePublished: iso,
    // ⚠️ `ultimaRettificaAt`, MAI `updatedAt` (D45, ed e' un cambio del
    // 19/08/2026): con `updatedAt` qualunque salvataggio dell'admin — un
    // refuso, un tag — alzava questa data e la pagina si dichiarava aggiornata
    // senza esserlo. Solo una rettifica pubblicata la muove.
    dateModified: String(dati.ultimaRettificaAt ?? iso),
    // ⚠️ `Person` e non `Organization` (D40): i dati strutturati devono dire
    // quello che dice la pagina, e una byline umana in chiaro con un
    // autore-azienda e' la discrepanza che le linee guida sulla reputazione del
    // sito leggono come una maschera.
    ...(autore
      ? {
          author: {
            '@type': 'Person',
            name: autore,
            url: `${SITO}/redazione/`,
          },
        }
      : {}),
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
 *
 * ⚠️ QUI LA DATA RESTA `createdAt`, mentre nell'articolo e' passata a
 * `publishedAt`: non e' una dimenticanza. Ogni stesura all'edge deve dire le
 * stesse cose del suo gemello Angular, e il gemello di QUESTA e'
 * `shared/ui/news-card` (che serve indice e home) — la quale stampa ancora
 * `createdAt`. Cambiare solo qui vorrebbe dire una data che si muove sotto gli
 * occhi del lettore un secondo dopo l'apertura. Le due si spostano insieme, ed
 * e' il lotto degli slug sulle card (§4.5). Oggi la differenza non si vede: sui
 * tre articoli storici `publishedAt` ha ereditato `createdAt`.
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
