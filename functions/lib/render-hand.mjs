/**
 * La pagina di una MANO resa all'edge: funzioni pure, nessuna dipendenza.
 *
 * ⚠️ **È una COPIA STRUTTURALE di `render-news.mjs`, e resta una copia.** Il
 * renderer delle news è in produzione sul percorso degli articoli, e
 * parametrizzarlo per due contenuti diversi vorrebbe dire poter rompere gli
 * articoli correggendo una mano. È la stessa scelta già fatta due volte in
 * questo repo (`wrapTitle` contro `DiscordBannerService`, `renderStoria` contro
 * `render`): si condividono gli **strumenti**, non il disegno.
 *
 * ⚠️⚠️ **LA DIFFERENZA PORTANTE, E VA LETTA PRIMA DI TOCCARE QUALSIASI COSA.**
 * `render-news.mjs` **toglie** il `<meta name="robots" content="noindex">` che
 * `inject-csr-noindex.mjs` mette nello scheletro, perché un articolo deve
 * essere indicizzabile. **Qui NON si toglie**: le pagine delle mani sono
 * `noindex` per decisione D2, e su quel `noindex` poggia la difendibilità
 * dell'intero trattamento — i nickname di terzi sono accettabili perché
 * raggiungibili da chi ha il collegamento e **non cercabili per nome**.
 * Togliere quella riga «per uniformità con le news» non è un refuso di stile: è
 * la caduta della misura principale della valutazione GDPR, e non si vede a
 * schermo. Due test la pinnano nei due versi.
 */

// ---- Utilità di base ---------------------------------------------------

export function escapeHtml(valore) {
  return String(valore ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** L'origine dichiarata dal canonical: sempre la produzione. */
const ORIGINE = 'https://bestfishforever.it';

/** L'anteprima social di ripiego, finché la targa della mano non esiste. */
const OG_DEFAULT = `${ORIGINE}/og.png`;

/**
 * ⚠️ **Un solo indirizzo buono per ogni mano**, con la barra finale — la stessa
 * forma che il canonical dichiara. Senza, `/replayer/<id>` e `/replayer/<id>/`
 * rispondono entrambe 200 con la stessa pagina: due indirizzi per un contenuto
 * solo. E quando una richiesta la prende una Function, **Cloudflare non
 * normalizza niente** (misurato in produzione sulle news il 19/08/2026).
 */
export function percorsoCanonico(publicId) {
  return `/replayer/${encodeURIComponent(String(publicId ?? ''))}/`;
}

export function urlCanonica(publicId) {
  return ORIGINE + percorsoCanonico(publicId);
}

/**
 * Il percorso verso cui reindirizzare, oppure `null` se siamo già
 * sull'indirizzo buono.
 *
 * ⚠️ Il bersaglio è un **percorso**, non una URL assoluta: un `Location` verso
 * la produzione butterebbe fuori dall'anteprima di ramo chiunque stia
 * verificando lì, e la prova su preview è obbligatoria prima di `main`.
 */
export function redirezione(pathname, publicId) {
  const destinazione = percorsoCanonico(publicId);
  return destinazione === String(pathname ?? '') ? null : destinazione;
}

// ---- Lettura della mano ------------------------------------------------

/** L'etichetta del formato: è la stringa che va in evidenza (decisione owner). */
export function titoloMano(mano) {
  const f = String(mano?.gameTypeLabel ?? '').trim() || 'poker';
  return `Mano di ${f}`;
}

/**
 * La descrizione.
 *
 * ⚠️ **Nessun nickname e nessun nome di sala qui dentro.** Questa stringa
 * diventa `og:description`, cioè finisce nell'anteprima che WhatsApp e Telegram
 * mostrano in chat di gruppo e che le piattaforme cachano: è la superficie meno
 * controllabile di tutta la funzione. Il nome della sala, in più, non deve
 * comparire in un'anteprima per l'art. 9 DL 87/2018.
 */
export function descrizioneMano(mano) {
  const f = String(mano?.gameTypeLabel ?? 'poker');
  const n = Number(mano?.tableSize) || 0;
  const giocatori = n ? ` a ${n} giocatori` : '';
  return `Una mano di ${f}${giocatori}, rivista azione per azione: fiche, posizioni e piatto a ogni decisione.`;
}

/**
 * La catena dell'immagine di anteprima.
 * ⚠️ `||` e non `??`: i campi arrivano dallo schema con `trim: true` e possono
 * essere **stringa vuota** — con `??` la stringa vuota vincerebbe. È la stessa
 * trappola già scritta per le copertine delle news.
 */
export function immagineMano(mano) {
  return String(mano?.ogImageUrl || '') || OG_DEFAULT;
}

/** Il numero di azioni della mano: serve al riassunto testuale. */
function contaAzioni(mano) {
  const streets = Array.isArray(mano?.streets) ? mano.streets : [];
  return streets.reduce(
    (t, s) => t + (Array.isArray(s?.azioni) ? s.azioni.length : 0),
    0,
  );
}

/** Le carte comuni finali, in forma leggibile. */
function boardTesto(mano) {
  const b = Array.isArray(mano?.board) ? mano.board : [];
  return b.filter((c) => typeof c === 'string').join(' ');
}

// ---- Chirurgia sullo scheletro ------------------------------------------
//
// ⚠️ Ogni `impostaX` SOSTITUISCE se il tag c'è e INSERISCE se non c'è. Un
// `replace` che non trova nulla non fallisce: restituisce la stringa invariata,
// cioè la pagina uscirebbe con i meta della HOME senza che niente lo segnali.

function inserisciNellaTesta(html, tag) {
  const i = html.search(/<\/head\s*>/i);
  if (i === -1) {
    throw new Error('scheletro senza </head>: forma di index.csr.html cambiata?');
  }
  return `${html.slice(0, i)}  ${tag}\n${html.slice(i)}`;
}

/**
 * ⚠️ La sostituzione passa **sempre** da una funzione, mai da una stringa: in
 * `String.replace` una stringa di rimpiazzo interpreta `$&`, `$1`, `` $` `` — e
 * qui i rimpiazzi contengono **nickname scritti da estranei**. Un nome con
 * dentro `$&` riscriverebbe la pagina in silenzio.
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

/**
 * ⚠️ **Il `noindex` dello scheletro si CONFERMA, non si toglie.** È l'inverso
 * esatto di `render-news.mjs`, ed è la misura da cui dipende il bilanciamento
 * della valutazione GDPR (vedi l'intestazione di questo file). La funzione
 * *impone* il valore invece di limitarsi a lasciarlo: se un domani lo scheletro
 * smettesse di portarlo, la pagina di una mano resterebbe comunque `noindex`.
 */
function imponiNoindex(html) {
  return impostaMeta(html, 'name', 'robots', 'noindex, follow');
}

function impostaCorpo(html, corpo) {
  const re = /(<app-root[^>]*>)[\s\S]*?(<\/app-root>)/i;
  if (!re.test(html)) {
    throw new Error('scheletro senza <app-root>: forma di index.csr.html cambiata?');
  }
  return html.replace(re, (intero, apri, chiudi) => `${apri}\n${corpo}\n${chiudi}`);
}

function applicaTesta(html, { titolo, descrizione, url, immagine }) {
  let out = impostaTitolo(html, titolo);
  out = impostaMeta(out, 'name', 'description', descrizione);
  out = impostaMeta(out, 'property', 'og:type', 'article');
  out = impostaMeta(out, 'property', 'og:title', titolo);
  out = impostaMeta(out, 'property', 'og:description', descrizione);
  out = impostaMeta(out, 'property', 'og:url', url);
  out = impostaMeta(out, 'property', 'og:image', immagine);
  out = impostaMeta(out, 'name', 'twitter:card', 'summary_large_image');
  out = impostaMeta(out, 'name', 'twitter:title', titolo);
  out = impostaMeta(out, 'name', 'twitter:description', descrizione);
  out = impostaMeta(out, 'name', 'twitter:image', immagine);
  out = impostaCanonical(out, url);
  // ⚠️ ULTIMO, così nessun passaggio precedente può averlo tolto.
  out = imponiNoindex(out);
  return out;
}

// ---- Il corpo ------------------------------------------------------------

/**
 * Il corpo che vede chi non ha JavaScript, e che leggono gli scraper.
 *
 * ⚠️ **NON è il replayer**: quello è un'applicazione, e riprodurla qui vorrebbe
 * dire mantenerne due. Qui c'è il **riassunto leggibile** della mano — formato,
 * tavolo, board, esito — che è ciò che serve a un'anteprima e a chi arriva
 * senza JavaScript. All'idratazione Angular sostituisce tutto col replayer vero.
 *
 * ⚠️ E qui i nickname **ci sono**, perché sono nel corpo della pagina: è la
 * riga di A16 che dice «nel corpo sì, in titolo e indirizzo mai». Sono anche
 * l'unica ragione per cui la pagina è `noindex`.
 */
export function corpoMano(mano) {
  const titolo = titoloMano(mano);
  const nAzioni = contaAzioni(mano);
  const board = boardTesto(mano);
  const players = Array.isArray(mano?.players) ? mano.players : [];
  const risultati = Array.isArray(mano?.risultati) ? mano.risultati : [];

  const righe = players
    .map((p) => {
      const carte = Array.isArray(p?.carte) && p.carte.length ? ` — ${p.carte.join(' ')}` : '';
      const eroe = p?.isHero ? ' (chi ha caricato la mano)' : '';
      return `<li>${escapeHtml(p?.posizione ?? '')} · ${escapeHtml(p?.nome ?? '')}${escapeHtml(carte)}${eroe}</li>`;
    })
    .join('\n');

  const esito = risultati
    .map((r) => `<li>Posto ${escapeHtml(r?.seat ?? '')}: vince ${escapeHtml(r?.vinto ?? 0)}</li>`)
    .join('\n');

  return `<main>
  <article class="hand-static">
    <h1>${escapeHtml(titolo)}</h1>
    <p>${escapeHtml(descrizioneMano(mano))}</p>
    <p>La mano si compone di ${escapeHtml(nAzioni)} azioni${
      board ? ` e finisce con il board ${escapeHtml(board)}` : ''
    }.</p>
    <h2>Al tavolo</h2>
    <ul>
${righe}
    </ul>
    ${esito ? `<h2>Esito</h2>\n    <ul>\n${esito}\n    </ul>` : ''}
    <p><a href="/replayer/">Rivedi le mani sul Replayer di Best Fish Forever</a></p>
  </article>
</main>`;
}

/**
 * La pagina completa di una mano.
 *
 * ⚠️ **Nessun JSON-LD.** Le news ne hanno (`NewsArticle`) perché vogliono essere
 * capite dai motori; una mano è `noindex`, quindi dati strutturati sarebbero
 * lavoro per un pubblico che per costruzione non arriverà mai — e una cosa in
 * più da tenere allineata.
 */
export function renderMano(scheletro, mano) {
  const url = urlCanonica(mano?.publicId);
  let html = applicaTesta(scheletro, {
    titolo: titoloMano(mano),
    descrizione: descrizioneMano(mano),
    url,
    immagine: immagineMano(mano),
  });
  return impostaCorpo(html, corpoMano(mano));
}
