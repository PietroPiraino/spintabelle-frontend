// L'HTML delle news composto all'edge — `npm run test:scripts` (Node 24, zero
// dipendenze).
//
// PERCHE' ESISTE. `functions/lib/render-news.mjs` scrive la PRIMA stesura delle
// pagine `/news` e `/news/<chiave>`: e' quello che ricevono il lettore al primo
// colpo, gli scraper social e i motori. E' anche l'unico pezzo di questo sito
// che nessuna guardia di build puo' vedere — `check-prerender-content.mjs`
// misura `dist/`, e la risposta di una Pages Function in `dist/` non esiste. Ci
// arriva solo la sonda `check-news-live.mjs`, che pero' gira DOPO il deploy.
// Qui si prende quello che si puo' prendere prima: le funzioni sono pure, quindi
// si rendono con lo scheletro VERO e si guarda dentro.
//
// ⚠️ LO SCHELETRO E' `src/index.html` PIU' L'INIEZIONE DEL NOINDEX, cioe' com'e'
// davvero `index.csr.html` dopo il build. Non una finta shell scritta qui: e'
// proprio sulle FORME dei tag di quel file (`<meta property="og:title" …>`,
// `<link rel="canonical" …>`) che la sostituzione puo' mancare il bersaglio — e
// un `replace` che non trova nulla non fallisce, restituisce la stringa
// invariata. Il difetto sarebbe una pagina con i meta della HOME, a 200.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasNoindex, injectNoindex } from './csr-noindex.mjs';
import {
  DESCRIZIONE_INDICE,
  GLIFI_CONDIVISIONE,
  SITO,
  TITOLO_INDICE,
  estratto,
  linkCondivisione,
  percorsoCanonico,
  redirezione,
  renderArticolo,
  renderIndice,
  urlCanonica,
} from '../../functions/lib/render-news.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const INDEX = join(REPO, 'src/index.html');
const ROTTE = join(REPO, 'src/app/app.routes.ts');
const COMPONENTE = join(REPO, 'src/app/features/news/news-detail/news-detail.component.ts');
const TEMPLATE = join(REPO, 'src/app/features/news/news-detail/news-detail.component.html');
const ICONE = join(REPO, 'src/app/shared/ui/icon/icon.component.ts');
const STILI_COMPONENTE = join(
  REPO,
  'src/app/features/news/news-detail/news-detail.component.scss',
);
const STILI_GLOBALI = join(REPO, 'src/styles/_news-share.scss');
const FOGLIO_GLOBALE = join(REPO, 'src/styles.scss');

const scheletro = injectNoindex(readFileSync(INDEX, 'utf8'));

// ⚠️ `createdAt` e `publishedAt` sono DIVERSI di proposito: la bozza nasce il 17
// e il pezzo esce il 19. Con due date uguali i controlli sulla data in pagina e
// sul `datePublished` passerebbero anche leggendo il campo sbagliato — che e'
// esattamente lo stato in cui sono rimasti fino al 19/08/2026.
const ARTICOLO = {
  _id: '65f0000000000000000000aa',
  slug: 'come-si-gioca-il-bottone',
  title: 'Come si gioca il bottone',
  body: [
    'Primo paragrafo dell articolo, con **grassetto** e un [link](https://bestfishforever.it/).',
    '',
    '## Un sottotitolo',
    '',
    'Secondo paragrafo.',
    '',
  ].join('\n'),
  coverImageUrl: 'https://cdn.bestfishforever.it/news/copertina.jpg',
  autore: 'Pietro Piraino',
  publishedAt: '2026-08-19T09:30:00.000Z',
  createdAt: '2026-08-17T08:00:00.000Z',
  updatedAt: '2026-08-19T11:00:00.000Z',
};

// ⚠️ DIVERSA da `coverImageUrl` di proposito, e su un percorso riconoscibile:
// e' la targa social generata dal backend (`news/<slug>/cover.png` sulla zona
// pubblica). Con due URL uguali i test qui sotto passerebbero anche leggendo il
// campo sbagliato.
const TARGA = 'https://cdn.bestfishforever.it/news/come-si-gioca-il-bottone/cover.png';

/** Il pezzo che conta per un motore: quello dentro `<main>`. */
function dentroMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  assert.ok(m, 'la pagina composta all edge non ha un <main>');
  return m[1];
}

function conta(html, tag) {
  return (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
}

function contenutoMeta(html, attributo, nome) {
  const m = html.match(
    new RegExp(`<meta[^>]+${attributo}=["']${nome}["'][^>]+content=["']([^"']*)["']`, 'i'),
  );
  return m ? m[1] : null;
}

/** I dati strutturati dell'articolo, gia' riportati a oggetto. */
function jsonLd(html) {
  const m = html.match(
    /<script[^>]+id=["']ld-news-article["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  assert.ok(m, 'la pagina composta all edge non ha il blocco JSON-LD dell articolo');
  // ⚠️ `<` viaggia come escape unicode (vedi `jsonLdSicuro`): e' JSON valido, e
  // `JSON.parse` lo riporta al carattere. Se un giorno smettesse di esserlo,
  // qui non si romperebbe niente — lo tiene il test dell XSS memorizzato.
  return JSON.parse(m[1]);
}

// ---- L'articolo ---------------------------------------------------------

test('l articolo NON esce noindex: e il controllo per cui questo file esiste', () => {
  // Lo scheletro nasce deindicizzato apposta (`inject-csr-noindex.mjs`): quel
  // meta serve alle rotte client, non a un articolo. Se la rimozione smettesse
  // di funzionare, ogni articolo composto all'edge nascerebbe fuori da Google
  // senza che nulla si rompa a vista.
  assert.ok(hasNoindex(scheletro), 'lo scheletro di partenza deve avere il noindex');
  assert.ok(!hasNoindex(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug)));
});

test('un solo <h1>, dentro <main>, ed e il titolo dell articolo', () => {
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.equal(conta(main, 'h1'), 1);
  assert.match(main, /<h1>Come si gioca il bottone<\/h1>/);
});

test('canonical e og:url sono la forma CON lo slash finale, e sullo slug', () => {
  // Lezione Search Console del 18/07/2026: l'SSG serve a 200 la forma con lo
  // slash, e canonical/sitemap devono dichiarare quella. ⚠️ Sullo SLUG anche
  // quando la richiesta e' arrivata con l'ObjectId, altrimenti lo stesso
  // articolo ha due URL canoniche.
  const html = renderArticolo(scheletro, ARTICOLO, ARTICOLO._id);
  const atteso = `${SITO}/news/come-si-gioca-il-bottone/`;
  assert.match(html, new RegExp(`<link rel="canonical" href="${atteso}">`));
  assert.equal(contenutoMeta(html, 'property', 'og:url'), atteso);
  // Un solo canonical: quello della home non deve restare in pagina.
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
});

test('titolo, description e OG sono quelli dell articolo, non quelli della home', () => {
  const html = renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug);
  assert.match(html, /<title>Come si gioca il bottone — Best Fish Forever<\/title>/);
  assert.equal(
    contenutoMeta(html, 'property', 'og:title'),
    'Come si gioca il bottone — Best Fish Forever',
  );
  assert.equal(contenutoMeta(html, 'property', 'og:type'), 'article');
  assert.equal(contenutoMeta(html, 'property', 'og:image'), ARTICOLO.coverImageUrl);
  assert.equal(contenutoMeta(html, 'name', 'twitter:image'), ARTICOLO.coverImageUrl);
  const descrizione = contenutoMeta(html, 'name', 'description');
  assert.match(descrizione, /^Primo paragrafo dell articolo/);
  assert.equal(contenutoMeta(html, 'property', 'og:description'), descrizione);
  // Nessun residuo dei meta della home.
  assert.doesNotMatch(html, /Scuola di poker Spin & Go e Twister — Best Fish Forever/);
});

test('senza copertina l immagine OG e quella predefinita del sito', () => {
  const { coverImageUrl, ...senzaCopertina } = ARTICOLO;
  const html = renderArticolo(scheletro, senzaCopertina, senzaCopertina.slug);
  assert.equal(contenutoMeta(html, 'property', 'og:image'), `${SITO}/og.png`);
  assert.doesNotMatch(dentroMain(html), /<img/);
});

test('il corpo Markdown e reso, e l HTML grezzo dentro il Markdown viene scartato', () => {
  // ⚠️ Senza copertina, cosi' l'unico `<img>` possibile sarebbe quello iniettato
  // dal Markdown: fuori da Angular non c'e' il sanitizer di `[innerHTML]`, e
  // l'unica difesa e' non emettere affatto l'HTML grezzo dell'articolo.
  const { coverImageUrl, ...senzaCopertina } = ARTICOLO;
  const main = dentroMain(
    renderArticolo(
      scheletro,
      { ...senzaCopertina, body: '## Sottotitolo\n\ntesto <img src=x onerror=alert(1)>\n' },
      ARTICOLO.slug,
    ),
  );
  assert.match(main, /<h3>Sottotitolo<\/h3>/); // `##` -> h3 (offset del loader)
  assert.match(main, /testo/);
  assert.doesNotMatch(main, /<img/);
  assert.doesNotMatch(main, /onerror/);
});

test('il loader di avvio sparisce: il lettore vede l articolo, non lo spinner', () => {
  // Il loader di `index.html` e' in `position: fixed; inset: 0`: lasciarlo
  // vorrebbe dire coprire con un velo la pagina appena composta.
  const html = renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug);
  assert.doesNotMatch(html, /class="boot-loader"/);
  assert.match(html, /<app-root>[\s\S]*<main/i);
});

test('un `</script>` nel titolo non esce dal blocco JSON-LD (XSS memorizzato)', () => {
  const html = renderArticolo(
    scheletro,
    { ...ARTICOLO, title: 'Titolo con </script><script>alert(1)</script> dentro' },
    ARTICOLO.slug,
  );
  // Il `<` va scritto come escape unicode: dentro uno <script> il parser HTML
  // non interpreta le entita' e chiuderebbe il blocco al primo `</script`.
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script>/);
  // E nel testo visibile il titolo e' scappato come HTML.
  assert.match(dentroMain(html), /&lt;\/script&gt;/);
});

test('un titolo con `$&` resta identico (la trappola di String.replace)', () => {
  // ⚠️ In `replace` una STRINGA di rimpiazzo interpreta `$&`, `$1`, `` $` ``:
  // con un rimpiazzo-stringa questo titolo verrebbe riscritto in silenzio.
  const html = renderArticolo(scheletro, { ...ARTICOLO, title: 'Spot $& fold $1' }, ARTICOLO.slug);
  assert.match(dentroMain(html), /<h1>Spot \$&amp; fold \$1<\/h1>/);
});

test('titolo e virgolette non spezzano gli attributi dei meta', () => {
  const html = renderArticolo(scheletro, { ...ARTICOLO, title: 'Il "bottone" e il fold' }, 'x');
  assert.match(html, /<title>Il &quot;bottone&quot; e il fold — Best Fish Forever<\/title>/);
  assert.equal(
    contenutoMeta(html, 'property', 'og:title'),
    'Il &quot;bottone&quot; e il fold — Best Fish Forever',
  );
});

test('la data e in italiano e nel fuso di Roma', () => {
  // 19 agosto 2026, 23:30 UTC = 20 agosto a Roma: con il fuso del colo che
  // risponde, meta' del mondo leggerebbe il giorno prima.
  const main = dentroMain(
    renderArticolo(scheletro, { ...ARTICOLO, publishedAt: '2026-08-19T23:30:00.000Z' }, 'x'),
  );
  assert.match(main, /20 agosto 2026/);
});

// ---- Identita' editoriale: data, firma, rettifiche (Fase 4) -------------

test('la data in pagina e publishedAt, non createdAt', () => {
  // ⚠️ Fra la bozza e l'uscita passano giorni: la data di una notizia e' quella
  // in cui e' uscita. Fino al 19/08/2026 qui c'era `createdAt`, e con le due
  // date coincidenti sui tre articoli storici nessuno se ne sarebbe accorto.
  const html = renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug);
  const main = dentroMain(html);
  assert.match(main, /19 agosto 2026/);
  assert.doesNotMatch(main, /17 agosto 2026/);
  assert.match(main, new RegExp(`datetime="${ARTICOLO.publishedAt}"`));
});

test('senza publishedAt si ripiega su createdAt invece di lasciare il vuoto', () => {
  const { publishedAt, ...senzaData } = ARTICOLO;
  const main = dentroMain(renderArticolo(scheletro, senzaData, ARTICOLO.slug));
  assert.match(main, /17 agosto 2026/);
});

test('la firma e in pagina ed e un collegamento a /redazione', () => {
  // ⚠️ Deve stare QUI e non solo nel componente Angular: chi legge questa
  // stesura e' il crawler, e una firma che compare dopo l'idratazione per un
  // motore non esiste. Ed e' un collegamento perche' e' li' che si trova chi
  // risponde degli articoli: e' la seconda gamba dell'esonero art. 50(4).
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.match(main, /di <a href="\/redazione\/">Pietro Piraino<\/a>/);
});

test('senza autore non si stampa una firma vuota', () => {
  const { autore, ...anonimo } = ARTICOLO;
  const main = dentroMain(renderArticolo(scheletro, anonimo, ARTICOLO.slug));
  assert.doesNotMatch(main, /news-detail__byline/);
  assert.doesNotMatch(main, /\/redazione\//);
});

test('la nota di rettifica sta fra l intestazione e il corpo', () => {
  // Una correzione che il lettore trova solo dopo aver letto l'articolo
  // sbagliato non e' una correzione: la posizione fa parte del contenuto.
  const main = dentroMain(
    renderArticolo(
      scheletro,
      {
        ...ARTICOLO,
        rettifiche: [{ at: '2026-08-20T07:00:00.000Z', nota: 'Il montepremi era 5.000, non 50.000.' }],
        ultimaRettificaAt: '2026-08-20T07:00:00.000Z',
      },
      ARTICOLO.slug,
    ),
  );
  assert.match(main, /Nota di rettifica \(20 agosto 2026\):/);
  assert.match(main, /Il montepremi era 5\.000, non 50\.000\./);
  assert.ok(main.indexOf('</header>') < main.indexOf('news-detail__rettifica'));
  assert.ok(main.indexOf('news-detail__rettifica') < main.indexOf('class="prose"'));
});

test('piu rettifiche si stampano tutte, nell ordine in cui sono uscite', () => {
  // La policy editoriale promette che la correzione «si aggiunge, non cancella
  // la traccia dell'errore»: tenerne solo l'ultima sarebbe cancellarla.
  const main = dentroMain(
    renderArticolo(
      scheletro,
      {
        ...ARTICOLO,
        rettifiche: [
          { at: '2026-08-20T07:00:00.000Z', nota: 'Prima correzione.' },
          { at: '2026-08-21T07:00:00.000Z', nota: 'Seconda correzione.' },
        ],
      },
      ARTICOLO.slug,
    ),
  );
  assert.ok(main.indexOf('Prima correzione.') < main.indexOf('Seconda correzione.'));
});

test('una rettifica malformata non stampa un riquadro vuoto e non fa saltare l articolo', () => {
  // Meglio un articolo senza una nota che un articolo che non esce: un errore
  // qui diventerebbe il ripiego sulla shell, cioe' una pagina senza contenuto
  // per gli scraper.
  for (const rettifiche of [null, undefined, [], [{}], [{ at: 'boh', nota: '' }]]) {
    const html = renderArticolo(scheletro, { ...ARTICOLO, rettifiche }, ARTICOLO.slug);
    assert.doesNotMatch(dentroMain(html), /news-detail__rettifica/);
  }
  // Una nota senza data resta leggibile: si perde la data, non il testo.
  const main = dentroMain(
    renderArticolo(scheletro, { ...ARTICOLO, rettifiche: [{ nota: 'Corretto.' }] }, ARTICOLO.slug),
  );
  assert.match(main, /Nota di rettifica:<\/strong> Corretto\./);
});

test('il testo di una rettifica e scappato come HTML', () => {
  // Lo scrive l'admin, ma passa dalla stessa strada di un dato esterno: qui non
  // c'e' nessun sanitizer di Angular.
  const main = dentroMain(
    renderArticolo(
      scheletro,
      { ...ARTICOLO, rettifiche: [{ at: ARTICOLO.publishedAt, nota: '<img src=x onerror=alert(1)>' }] },
      ARTICOLO.slug,
    ),
  );
  assert.doesNotMatch(main, /<img src=x/);
  assert.match(main, /&lt;img src=x/);
});

// ---- Dati strutturati ---------------------------------------------------

test('datePublished e publishedAt, dateModified NON e updatedAt', () => {
  // ⚠️ D45: con `updatedAt` qualunque salvataggio dell'admin — un refuso, un
  // tag — alzava la data e la pagina si dichiarava aggiornata senza esserlo.
  // Per un motore e' freschezza gonfiata.
  const dati = jsonLd(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.equal(dati.datePublished, ARTICOLO.publishedAt);
  assert.equal(dati.dateModified, ARTICOLO.publishedAt);
  assert.notEqual(dati.dateModified, ARTICOLO.updatedAt);
});

test('dateModified si muove SOLO con una rettifica pubblicata', () => {
  const dati = jsonLd(
    renderArticolo(
      scheletro,
      { ...ARTICOLO, ultimaRettificaAt: '2026-08-20T07:00:00.000Z' },
      ARTICOLO.slug,
    ),
  );
  assert.equal(dati.dateModified, '2026-08-20T07:00:00.000Z');
  assert.equal(dati.datePublished, ARTICOLO.publishedAt);
});

test('l autore dei dati strutturati e una Person, e punta a /redazione', () => {
  // ⚠️ `Person` e non `Organization` (D40): una byline umana in chiaro
  // accoppiata a un autore-azienda e' la discrepanza che le linee guida sulla
  // reputazione del sito leggono come una maschera.
  const dati = jsonLd(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.equal(dati.author['@type'], 'Person');
  assert.equal(dati.author.name, 'Pietro Piraino');
  assert.equal(dati.author.url, `${SITO}/redazione/`);
  // Il publisher resta l'organizzazione: sono due cose diverse.
  assert.equal(dati.publisher['@type'], 'Organization');
});

test('senza autore il JSON-LD non dichiara un author vuoto', () => {
  const { autore, ...anonimo } = ARTICOLO;
  assert.equal(jsonLd(renderArticolo(scheletro, anonimo, ARTICOLO.slug)).author, undefined);
});

// ---- La copertina social (A2) -------------------------------------------
//
// ⚠️ DUE campi e non uno: `ogImageUrl` e' la targa 1200x675 generata dal
// backend alla pubblicazione, e serve SOLO alle anteprime social;
// `coverImageUrl` resta l'immagine VISIBILE. La catena e'
// `ogImageUrl ?? coverImageUrl ?? og.png`, ed e' scritta due volte — qui e in
// `news-detail.component.ts` — perche' le due rese si SOSTITUISCONO. Aggiornarne
// una sola vorrebbe dire un'anteprima diversa a seconda di chi guarda.

test('og:image e la targa generata quando c e, e la pagina mostra comunque la foto', () => {
  const html = renderArticolo(
    scheletro,
    { ...ARTICOLO, ogImageUrl: TARGA },
    ARTICOLO.slug,
  );
  assert.equal(contenutoMeta(html, 'property', 'og:image'), TARGA);
  assert.equal(contenutoMeta(html, 'name', 'twitter:image'), TARGA);
  // ⚠️ La targa NON entra in pagina: l'`<img>` resta la copertina vera, e i tre
  // articoli storici devono continuare a mostrare le loro foto.
  const main = dentroMain(html);
  assert.match(main, new RegExp(`<img class="news-detail__cover" src="${ARTICOLO.coverImageUrl}"`));
  assert.doesNotMatch(main, new RegExp(TARGA));
});

test('senza targa l og:image ricade sulla copertina, poi sul predefinito', () => {
  // I due gradini della catena, uno per riga.
  const conFoto = renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug);
  assert.equal(contenutoMeta(conFoto, 'property', 'og:image'), ARTICOLO.coverImageUrl);

  const { coverImageUrl, ...nudo } = ARTICOLO;
  const senzaNiente = renderArticolo(scheletro, nudo, nudo.slug);
  assert.equal(contenutoMeta(senzaNiente, 'property', 'og:image'), `${SITO}/og.png`);
});

test('la targa da sola basta: nessuna copertina in pagina, ma l anteprima c e', () => {
  // ⚠️ E' il caso NORMALE di un articolo generato dalla redazione automatica:
  // nessuna foto scelta a mano, solo la targa. La pagina resta senza `<img>` —
  // la trappola di `news-render.test.mjs` sul caso senza copertina resta armata.
  const { coverImageUrl, ...senzaFoto } = ARTICOLO;
  const html = renderArticolo(scheletro, { ...senzaFoto, ogImageUrl: TARGA }, senzaFoto.slug);
  assert.equal(contenutoMeta(html, 'property', 'og:image'), TARGA);
  assert.doesNotMatch(dentroMain(html), /<img/);
});

test('una targa VUOTA non scavalca la foto: la catena usa `||`, non `??`', () => {
  // ⚠️ Il caso su cui i due operatori divergono, ed e' l'unico che distingue le
  // due rese: con `??` la stringa vuota vincerebbe e l og:image sarebbe `''`,
  // che nel componente Angular diventa poi l og.png predefinito. Stesso
  // articolo, due anteprime diverse a seconda di chi guarda. Lo schema del
  // backend ha `trim: true`, quindi `'  '` arriva qui come `''`.
  const html = renderArticolo(scheletro, { ...ARTICOLO, ogImageUrl: '' }, ARTICOLO.slug);
  assert.equal(contenutoMeta(html, 'property', 'og:image'), ARTICOLO.coverImageUrl);
});

test('i dati strutturati descrivono l articolo: `image` resta la foto, non la targa', () => {
  // La targa e' un'insegna per le chat, non un'illustrazione del pezzo.
  const dati = jsonLd(renderArticolo(scheletro, { ...ARTICOLO, ogImageUrl: TARGA }, ARTICOLO.slug));
  assert.deepEqual(dati.image, [ARTICOLO.coverImageUrl]);
});

test('deriva: il componente Angular usa la STESSA catena per l og:image', () => {
  // ⚠️ Il controllo che smaschera la meta' dimenticata: le due rese si
  // sostituiscono, quindi una catena aggiornata solo qui darebbe la targa allo
  // scraper e la foto (o il predefinito) a chi apre il link nel browser.
  const sorgente = readFileSync(COMPONENTE, 'utf8');
  // ⚠️ `||`, NON `??`: e' lo stesso operatore che usa `renderArticolo` qui
  // sopra (`ogImage || copertina || OG_PREDEFINITA`), e i due si comportano in
  // modo diverso su un valore che il campo puo' davvero avere — la stringa
  // vuota. Con `??` di la' vincerebbe la foto e di qua l og.png predefinito:
  // stesso articolo, due anteprime. Il test PRIMA fissava `??`, cioe' cementava
  // la divergenza invece di intercettarla.
  assert.match(
    sorgente,
    /image:\s*news\.ogImageUrl \|\| news\.coverImageUrl/,
    "news-detail.component.ts non compone piu' l'og:image come " +
      '`ogImageUrl || coverImageUrl`: allinea `renderArticolo` in ' +
      'functions/lib/render-news.mjs, o l anteprima cambia a seconda di chi guarda.',
  );
  // E il verso opposto: la targa non deve finire nell'`<img>` del template.
  const template = readFileSync(TEMPLATE, 'utf8');
  assert.doesNotMatch(
    template,
    /ogImageUrl/,
    'news-detail.component.html rende `ogImageUrl`: la targa e solo per le ' +
      'anteprime social, in pagina va `coverImageUrl`.',
  );
});

// ---- La condivisione (B) ------------------------------------------------
//
// ⚠️ IL BLOCCO E' ASIMMETRICO DI PROPOSITO, e l'asimmetria va pinnata NEI DUE
// VERSI. I tre collegamenti stanno in entrambe le rese (sono `<a href>`:
// funzionano senza JavaScript, quindi valgono per chi legge questa prima stesura
// e per un motore); il «Copia link» sta SOLO nel componente Angular, perche' qui
// sarebbe un bottone morto — il codice che lo farebbe funzionare arriva insieme
// all'app, che questo HTML lo cancella. Senza il caso che nega, qualcuno
// "allineerebbe" le rese aggiungendo il bottone morto; senza quello che afferma,
// lo toglierebbe per simmetria.

/**
 * Il sorgente senza i suoi commenti.
 *
 * ⚠️ SERVE PER LE ASSERZIONI CHE NEGANO. Un `doesNotMatch(/location\.href/)`
 * sul file intero fallisce anche quando la stringa compare in un commento che
 * SPIEGA perche' non si usa — cioe' il testo che documenta la regola fa cadere
 * la regola. Si tolgono i blocchi `/* … *\/` e le righe che cominciano con `//`,
 * non i `//` a meta' riga: quelli stanno dentro le URL (`https://…`).
 */
function codiceSenzaCommenti(sorgente) {
  return sorgente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** Gli `href` dei tre canali dentro `<main>`, gia' riportati a testo. */
function hrefCondivisione(html) {
  const main = dentroMain(html);
  const trovati = {};
  for (const [nome, host] of [
    ['whatsapp', 'wa\\.me'],
    ['telegram', 't\\.me'],
    ['facebook', 'facebook\\.com'],
  ]) {
    const m = main.match(new RegExp(`href="(https://[^"]*${host}[^"]*)"`, 'i'));
    // ⚠️ Nell'attributo l'`&` viaggia come `&amp;` (lo scrive `escapeHtml`, ed e'
    // corretto): qui si legge come lo leggerebbe un parser HTML, cioe' decodificando.
    trovati[nome] = m ? m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'") : null;
  }
  return trovati;
}

test('i tre canali ci sono nella resa all edge, ed e li che devono stare', () => {
  // Sono `<a href>`: chi riceve questa stesura puo' condividerli senza che una
  // riga di JavaScript sia mai arrivata.
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.match(main, /class="news-share"/);
  assert.match(main, /https:\/\/wa\.me\/\?text=/);
  assert.match(main, /https:\/\/t\.me\/share\/url\?url=/);
  assert.match(main, /https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);
  // Convenzione della casa per ogni link che esce dal sito.
  assert.equal((main.match(/target="_blank" rel="noopener"/g) || []).length, 3);
  // ⚠️ Ogni `aria-label` contiene il testo visibile del suo collegamento (WCAG
  // 2.5.3 «Label in Name»): chi comanda a voce legge l'etichetta scritta e dice
  // «clicca WhatsApp». Vale anche qui, ed e' l'unica stesura che riceve chi non
  // ha JavaScript. Il gemello sta in `news-detail.component.spec.ts`.
  const voci = [...main.matchAll(/aria-label="([^"]+)"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/g)];
  assert.equal(voci.length, 3, 'i tre collegamenti con etichetta e testo visibile');
  for (const [, nome, visibile] of voci)
    assert.ok(nome.includes(visibile), `aria-label "${nome}" non contiene "${visibile}"`);
});

test('il blocco e l ULTIMO figlio dell articolo, non un intermezzo', () => {
  // ⚠️ Dentro l'`<article>` e in fondo: la condivisione si offre a chi ha finito
  // di leggere, e la colonna di lettura (max-width, gap) vive su
  // `.news-detail__article` — un blocco fuori vorrebbe dire un secondo
  // contenitore con le stesse misure.
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.ok(main.indexOf('class="prose"') < main.indexOf('class="news-share"'));
  assert.match(main, /<\/footer>\s*<\/article>/);
});

test('⚠️ l edge NON emette il controllo di copia: sarebbe un bottone morto', () => {
  // Qui non c'e' nessun gestore che possa ascoltarlo: il codice che lo fa
  // funzionare arriva con l'app, e l'app questo HTML lo cancella. Un pulsante
  // che non fa niente e' peggio di un pulsante che non c'e'.
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.doesNotMatch(main, /<button/i);
  assert.doesNotMatch(main, /news-share__copy/);
  assert.doesNotMatch(main, /Copia link/i);
});

test('⚠️ UN SOLO INDIRIZZO: il `u=` di Facebook decodificato E il canonical', () => {
  // ⚠️ E' la forma piu' stretta in cui si puo' fissare «una sola fonte»: se
  // l'indirizzo condiviso e quello che la pagina dichiara canonico divergessero,
  // si diffonderebbero link permanenti verso un URL che il sito stesso dichiara
  // non buono. Vale anche quando la richiesta e' arrivata con l'ObjectId: la
  // condivisione si costruisce sullo SLUG, come il canonical.
  for (const chiave of [ARTICOLO.slug, ARTICOLO._id, 'vecchio-slug-di-due-mesi-fa']) {
    const html = renderArticolo(scheletro, ARTICOLO, chiave);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)">/)[1];
    const u = hrefCondivisione(html).facebook.split('u=')[1];
    assert.equal(decodeURIComponent(u), canonical, `chiave "${chiave}"`);
    assert.equal(canonical, `${SITO}/news/come-si-gioca-il-bottone/`);
  }
});

test('l URL condivisa e la stessa per tutti e tre i canali', () => {
  const link = hrefCondivisione(renderArticolo(scheletro, ARTICOLO, ARTICOLO._id));
  const attesa = urlCanonica(ARTICOLO.slug);
  assert.ok(link.whatsapp.endsWith(encodeURIComponent(attesa)));
  assert.equal(decodeURIComponent(link.telegram.split('url=')[1].split('&')[0]), attesa);
  assert.equal(decodeURIComponent(link.facebook.split('u=')[1]), attesa);
});

test('⚠️ un titolo con &, virgolette e apostrofo non spezza l href', () => {
  // Due passaggi in quest'ordine: `encodeURIComponent` PRIMA (il titolo finisce
  // dentro un valore di query), `escapeHtml` DOPO (il valore finisce dentro un
  // attributo). Invertendoli l'`&amp;` prodotto dall'escape verrebbe
  // percent-encodato dentro il testo, e Telegram riceverebbe UN PARAMETRO SOLO —
  // con il titolo appiccicato all'indirizzo da condividere.
  const titolo = 'Bottone & "fold": l\'errore';
  const html = renderArticolo(scheletro, { ...ARTICOLO, title: titolo }, ARTICOLO.slug);
  const link = hrefCondivisione(html);
  // Nessun href e' stato troncato: tutti e tre ci sono e arrivano interi.
  for (const nome of ['whatsapp', 'telegram', 'facebook'])
    assert.ok(link[nome], `href di ${nome} spezzato o assente`);
  // Telegram ha DUE parametri, e il titolo sta tutto dentro `text=`.
  const [, query] = link.telegram.split('?');
  const p = new URLSearchParams(query);
  assert.equal(p.get('url'), urlCanonica(ARTICOLO.slug));
  assert.equal(p.get('text'), titolo);
  // WhatsApp porta titolo e indirizzo in un testo solo.
  assert.equal(
    decodeURIComponent(link.whatsapp.split('text=')[1]),
    `${titolo} ${urlCanonica(ARTICOLO.slug)}`,
  );
  // ⚠️ E l'`&` del titolo non e' rimasto crudo nell'attributo: sarebbe un
  // attributo valido per sbaglio, e domani un `&text` nel titolo diventerebbe un
  // parametro vero.
  assert.doesNotMatch(dentroMain(html), /href="[^"]*&(?!amp;|#39;)/);
});

test('⚠️ nessun <img> dentro <main>, blocco di condivisione compreso', () => {
  // La trappola gia' armata sul caso senza copertina vale anche adesso che in
  // fondo alla pagina ci sono tre icone: sono `<svg>` inline, non immagini.
  const { coverImageUrl, ...senzaCopertina } = ARTICOLO;
  const main = dentroMain(renderArticolo(scheletro, senzaCopertina, senzaCopertina.slug));
  assert.match(main, /class="news-share"/);
  assert.doesNotMatch(main, /<img/);
  assert.equal((main.match(/<svg/g) || []).length, 3);
});

test('deriva: i tre glifi sono la copia esatta di icon.component.ts', () => {
  // ⚠️ La Function e l'app sono due build diverse e non possono importarsi a
  // vicenda (stessa ragione di `functions/lib/markdown.mjs`), quindi i tracciati
  // sono duplicati. A tenerli allineati c'e' solo questo caso: senza, i due
  // renderer possono finire per disegnare due marchi diversi sulla stessa pagina.
  const sorgente = readFileSync(ICONE, 'utf8');
  for (const [nome, d] of Object.entries(GLIFI_CONDIVISIONE)) {
    const i = sorgente.indexOf(`@case ('${nome}')`);
    assert.ok(i > -1, `icon.component.ts non ha piu' il ramo @case '${nome}'`);
    const m = /d="([^"]+)"/.exec(sorgente.slice(i));
    assert.ok(m, `il ramo '${nome}' di icon.component.ts non ha piu' un <path d="…">`);
    assert.equal(
      m[1],
      d,
      `il glifo '${nome}' e' diverso fra icon.component.ts e ` +
        'functions/lib/render-news.mjs: le due rese disegnerebbero due marchi diversi.',
    );
  }
});

test('linkCondivisione regge titolo e url assenti senza produrre `undefined`', () => {
  // Un articolo senza titolo non deve diffondere la parola "undefined" in una
  // chat: meglio un testo povero che una condivisione sbagliata.
  const link = linkCondivisione(undefined, undefined);
  for (const href of Object.values(link)) assert.doesNotMatch(href, /undefined/);
});

test('deriva: il componente Angular ha i tre canali E il controllo di copia', () => {
  // ⚠️ Il verso che AFFERMA. Senza, il giorno che qualcuno "allinea" le due rese
  // il «Copia link» sparirebbe per simmetria — e sparirebbe dalla resa in cui e'
  // l'unico che puo' funzionare.
  const template = readFileSync(TEMPLATE, 'utf8');
  for (const canale of ['whatsapp', 'telegram', 'facebook'])
    assert.match(
      template,
      new RegExp(`condivisione\\(\\)\\.${canale}`),
      `news-detail.component.html non porta piu' il collegamento ${canale}: ` +
        'i tre canali stanno in ENTRAMBE le rese.',
    );
  assert.match(
    template,
    /\(click\)="copiaLink\(\)"/,
    "news-detail.component.html non porta piu' il «Copia link»: e' l'unica resa " +
      'in cui puo' + " funzionare, e all'edge non c'e' apposta.",
  );
  // ⚠️ Il campo d'appoggio deve essere RENDERIZZATO (fuori schermo), altrimenti
  // il ripiego di `copiaLink()` non ha niente da selezionare.
  assert.match(template, /#copyFallback/);
});

test('⚠️ gli stili del blocco sono GLOBALI: l edge non ha l incapsulamento', () => {
  // ⚠️ E' LA META' DEL BLOCCO CHE UNA SPEC ANGULAR NON PUO' VEDERE. In Karma i
  // fogli globali e quelli del componente sono caricati tutti e due, quindi un
  // controllo sul colore o sull'altezza calcolata passa in entrambi i casi: dove
  // quelle regole VIVONO si puo' misurare solo leggendo i sorgenti, ed e' qui.
  //
  // La ragione, in una riga: un foglio di componente e' compilato con
  // l'incapsulamento (`.news-share__btn[_ngcontent-…]`) e questo HTML
  // quell'attributo non ce l'ha. Messe li', quelle regole non toccherebbero MAI
  // la stesura dell'edge — che per chi ha il JavaScript disattivato non e' un
  // istante prima dell'idratazione, e' la pagina definitiva. I tre collegamenti
  // stanno all'edge proprio perche' sono l'unica meta' che funziona senza JS:
  // lasciarli con bersagli da ~38px vorrebbe dire mancare il minimo tattile
  // della casa esattamente dove contano di piu'. Il precedente e' `.prose`,
  // globale per lo stesso motivo.
  const globale = readFileSync(STILI_GLOBALI, 'utf8');
  assert.match(
    globale,
    /\.news-share\b/,
    'src/styles/_news-share.scss non definisce piu il blocco.',
  );
  assert.match(
    globale,
    /\.news-share__btn\s*\{[^}]*min-height:\s*44px/,
    'i 44px del bersaglio tattile non sono piu dichiarati nel foglio globale: un ' +
      '`.btn--sm` nudo sta sui 38px, e all edge non c e nient altro che li alzi.',
  );
  assert.match(
    readFileSync(FOGLIO_GLOBALE, 'utf8'),
    /@use 'styles\/news-share'/,
    'src/styles.scss non importa piu styles/news-share: il foglio esiste e non ' +
      'viene servito a nessuna delle due rese.',
  );
  // E il verso opposto: nel foglio del COMPONENTE non deve tornarci nulla.
  // ⚠️ Si legge SENZA i commenti (stesso aiutante del caso su `location.href`,
  // e le due sintassi di commento coincidono): la nota che spiega perche' quelle
  // regole non stanno li' nomina le classi, e sul file intero farebbe fallire
  // proprio il caso che quella nota difende.
  assert.doesNotMatch(
    codiceSenzaCommenti(readFileSync(STILI_COMPONENTE, 'utf8')),
    /\.news-share/,
    'news-detail.component.scss e tornato a stilare `.news-share*`: con ' +
      "l'incapsulamento quelle regole valgono solo per la resa Angular, e la " +
      'stesura che riceve chi non ha JavaScript resterebbe senza.',
  );
});

test('deriva: la condivisione si costruisce sullo SLUG, mai su location.href', () => {
  // ⚠️ `location.href` porterebbe query string, frammento e — su un'anteprima di
  // ramo — l'host `*.pages.dev`. E il parametro di rotta non basta: chi arriva da
  // un ObjectId condividerebbe un indirizzo che il sito dichiara non canonico.
  const sorgente = codiceSenzaCommenti(readFileSync(COMPONENTE, 'utf8'));
  assert.match(
    sorgente,
    /news\(\)\?\.slug/,
    "news-detail.component.ts non costruisce piu' l'indirizzo di condivisione " +
      'sullo slug: allinea `urlCondivisione` a `percorsoCanonico` in ' +
      'functions/lib/render-news.mjs.',
  );
  assert.doesNotMatch(
    sorgente,
    /location\.href/,
    'news-detail.component.ts usa `location.href`: la condivisione va costruita ' +
      "sull'URL canonica, non sull'indirizzo della finestra.",
  );
});

// ---- L'indice -----------------------------------------------------------

test('l indice ha un solo <h1> e i titoli degli articoli come <h2> collegati', () => {
  const html = renderIndice(scheletro, [
    ARTICOLO,
    { _id: '65f0000000000000000000bb', title: 'Secondo pezzo', body: 'Corpo.' },
  ]);
  const main = dentroMain(html);
  assert.equal(conta(main, 'h1'), 1);
  assert.equal(conta(main, 'h2'), 2);
  assert.match(main, /href="\/news\/come-si-gioca-il-bottone\/"/);
  // Senza slug si ripiega sull'_id, altrimenti l'articolo non e' raggiungibile.
  assert.match(main, /href="\/news\/65f0000000000000000000bb\/"/);
  assert.ok(!hasNoindex(html));
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITO}/news/">`));
  assert.match(html, /<title>News — Best Fish Forever<\/title>/);
});

test('indice vuoto: lo dice, invece di restare una pagina bianca', () => {
  const main = dentroMain(renderIndice(scheletro, []));
  assert.match(main, /Nessuna news pubblicata/);
  assert.equal(conta(main, 'h1'), 1);
});

test('l indice regge una risposta di forma inattesa senza lanciare', () => {
  // Se l'API cambiasse forma, meglio un indice povero che una pagina che non
  // esce: la Function trasformerebbe l'eccezione in un ripiego sulla shell.
  for (const dati of [null, undefined, [{}], [{ title: '' }], [{ title: 'x' }]])
    assert.doesNotThrow(() => renderIndice(scheletro, dati));
});

// ---- L'indirizzo buono: i 301 ------------------------------------------
//
// ⚠️ PERCHE' QUESTI CASI SONO QUI E NON NELLA FUNCTION. La decisione "questo
// indirizzo va corretto, e verso dove" e' una funzione pura di due stringhe:
// tenerla dentro la Function vorrebbe dire poterla provare solo montando un
// finto Worker. La Function fa il resto (stato 301, Location, cache), ed e' la
// parte che un errore lo mostra subito.

test('un ObjectId e uno slug storico portano allo slug corrente', () => {
  // Sono LO STESSO problema: un indirizzo che non e' piu' quello buono. L'API
  // li risolve tutti e due, quindi tutti e due rispondevano 200 — tre URL per
  // un contenuto solo.
  const attuale = 'come-si-gioca-il-bottone';
  assert.equal(redirezione(`/news/${ARTICOLO._id}/`, attuale), '/news/come-si-gioca-il-bottone/');
  assert.equal(redirezione('/news/vecchio-titolo-di-due-mesi-fa/', attuale), '/news/come-si-gioca-il-bottone/');
});

test('lo slug corrente con lo slash finale non si tocca', () => {
  assert.equal(redirezione('/news/come-si-gioca-il-bottone/', 'come-si-gioca-il-bottone'), null);
  assert.equal(redirezione('/news/', ''), null);
});

test('la forma SENZA slash finale e un doppione, e si normalizza', () => {
  // ⚠️ Misurato in produzione il 19/08/2026, non dedotto: `/news/<slug>`
  // rispondeva 200 con lo stesso HTML di `/news/<slug>/`. Quando una richiesta
  // la prende una Pages Function, Cloudflare non normalizza niente — la
  // normalizzazione degli asset statici non c'entra e non la vede nessuno.
  assert.equal(
    redirezione('/news/come-si-gioca-il-bottone', 'come-si-gioca-il-bottone'),
    '/news/come-si-gioca-il-bottone/',
  );
  // E vale per l'indice, che aveva esattamente lo stesso doppione.
  assert.equal(redirezione('/news', ''), '/news/');
});

test('un solo salto: il bersaglio di un 301 non si reindirizza a sua volta', () => {
  // ⚠️ E' l'invariante che tiene lontano un ciclo, e regge su una proprieta'
  // sola: `decodeURIComponent(encodeURIComponent(k)) === k`. La Function
  // ri-decodifica il segmento, quindi alla seconda richiesta la chiave e'
  // identica e il bersaglio coincide con il percorso chiesto.
  for (const k of [
    'come-si-gioca-il-bottone',
    ARTICOLO._id,
    'accenti-è-e-spazi vari',
    'con/una/barra',
    'con%20una%20percentuale',
  ])
    assert.equal(redirezione(percorsoCanonico(k), k), null, `ciclo di redirect su "${k}"`);
});

test('senza slug corrente non si reindirizza: si rende e basta', () => {
  // Chi chiama passa `slug || chiave`: con lo slug vuoto il bersaglio ridiventa
  // la chiave richiesta, quindi non c'e' nessun salto da fare.
  assert.equal(redirezione(`/news/${ARTICOLO._id}/`, ARTICOLO._id), null);
  // ⚠️ E una chiave vuota non deve MAI diventare il bersaglio di un articolo:
  // `percorsoCanonico('')` e' l'INDICE, cioe' un'altra pagina.
  assert.equal(percorsoCanonico(''), '/news/');
  assert.equal(percorsoCanonico('   '), '/news/');
  assert.equal(percorsoCanonico(null), '/news/');
});

test('il bersaglio del 301 e il canonical sono la stessa stringa', () => {
  // ⚠️ Se divergessero, il 301 porterebbe su una pagina il cui canonical
  // dichiara un'altra URL: per un motore e' peggio del doppione da chiudere.
  // Non e' un auspicio: `urlCanonica` E' `SITO + percorsoCanonico`.
  for (const k of ['come-si-gioca-il-bottone', ARTICOLO._id, 'titolo-con-è', ''])
    assert.equal(urlCanonica(k), `${SITO}${percorsoCanonico(k)}`);
});

test('il bersaglio e un PERCORSO, mai una URL assoluta', () => {
  // Un Location verso bestfishforever.it butterebbe fuori dall'anteprima di ramo
  // chiunque stia verificando li' — e la prova su preview e' obbligatoria prima
  // di main. Il canonical, al contrario, nomina sempre la produzione.
  const dest = redirezione(`/news/${ARTICOLO._id}/`, 'come-si-gioca-il-bottone');
  assert.equal(dest, '/news/come-si-gioca-il-bottone/');
  assert.doesNotMatch(dest, /^https?:/);
  assert.doesNotMatch(dest, /bestfishforever/);
});

// ---- Estratto -----------------------------------------------------------

test('l estratto taglia a 152 caratteri piu i puntini, e pulisce il Markdown', () => {
  assert.equal(estratto('# Titolo\n\ntesto **grasso**'), 'Titolo testo grasso');
  assert.equal(estratto('![alt](img.png) solo testo'), 'solo testo');
  assert.equal(estratto('[etichetta](https://x.it)'), 'etichetta');
  const lungo = 'a'.repeat(400);
  const tagliato = estratto(lungo);
  assert.equal(tagliato.length, 153); // 152 + il carattere dei puntini
  assert.ok(tagliato.endsWith('…'));
  assert.equal(estratto(''), '');
  assert.equal(estratto(null), '');
});

// ---- Deriva rispetto ai sorgenti dell app -------------------------------
//
// Le stesse due stesure della stessa pagina devono dire le stesse cose: la
// prima la scrive l'edge, la seconda l'app quando si monta. Dove il valore e'
// per forza duplicato (build diverse, vedi l'intestazione di
// functions/lib/markdown.mjs) la copia va sorvegliata, o diverge in silenzio e
// la pagina cambia titolo un secondo dopo essere stata aperta.
// ⚠️ Se una di queste estrazioni non trova piu' niente il test FALLISCE invece
// di saltare: e' la filosofia di `nonCapisco` in check-routes.mjs.

test('deriva: titolo e description dell indice combaciano con app.routes.ts', () => {
  const sorgente = readFileSync(ROTTE, 'utf8');
  assert.ok(
    sorgente.includes(`title: '${TITOLO_INDICE}'`),
    `app.routes.ts non dichiara piu' \`title: '${TITOLO_INDICE}'\` per la rotta news. ` +
      'Aggiorna TITOLO_INDICE in functions/lib/render-news.mjs insieme alla rotta.',
  );
  assert.ok(
    sorgente.includes(DESCRIZIONE_INDICE),
    "app.routes.ts non contiene piu' la description dell'indice news. " +
      'Aggiorna DESCRIZIONE_INDICE in functions/lib/render-news.mjs insieme alla rotta.',
  );
});

test('deriva: la data in pagina e publishedAt anche nel componente Angular', () => {
  // ⚠️ Se il componente tornasse a `createdAt`, la data cambierebbe sotto gli
  // occhi del lettore un secondo dopo l'apertura — e i tre articoli storici,
  // dove le due date coincidono, non lo mostrerebbero.
  const sorgente = readFileSync(COMPONENTE, 'utf8');
  assert.match(
    sorgente,
    /publishedAt \?\? news\.createdAt|n\.publishedAt \?\? n\.createdAt/,
    "news-detail.component.ts non legge piu' `publishedAt`: allinea `renderArticolo` " +
      'in functions/lib/render-news.mjs, o la data cambia al montaggio.',
  );
});

test('deriva: la byline e la nota di rettifica hanno la stessa forma nel template', () => {
  // Sono la STESSA pagina scritta due volte. Qui si sorveglia la forma delle
  // due frasi che il lettore vede: se una delle due sparisse dal template,
  // l'articolo direbbe una cosa prima dell'idratazione e un'altra dopo.
  const template = readFileSync(TEMPLATE, 'utf8');
  assert.match(
    template,
    /di <a routerLink="\/redazione">/,
    "news-detail.component.html non porta piu' la firma linkata a /redazione: " +
      'la byline esiste in `renderArticolo` e deve esistere in entrambi.',
  );
  assert.match(
    template,
    /Nota di rettifica \(/,
    "news-detail.component.html non porta piu' la nota di rettifica: " +
      'e\' contenuto della pagina, e sta in entrambi i renderer.',
  );
});

test('deriva: il taglio dell estratto combacia con news-detail.component.ts', () => {
  const sorgente = readFileSync(COMPONENTE, 'utf8');
  assert.match(
    sorgente,
    /text\.length > 155/,
    "news-detail.component.ts non taglia piu' a 155: allinea `estratto` in " +
      'functions/lib/render-news.mjs, o la description cambia al montaggio.',
  );
  assert.match(
    sorgente,
    /slice\(0, 152\)/,
    "news-detail.component.ts non taglia piu' a 152: vedi sopra.",
  );
});
