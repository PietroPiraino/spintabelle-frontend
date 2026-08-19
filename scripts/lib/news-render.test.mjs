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
  SITO,
  TITOLO_INDICE,
  estratto,
  renderArticolo,
  renderIndice,
} from '../../functions/lib/render-news.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const INDEX = join(REPO, 'src/index.html');
const ROTTE = join(REPO, 'src/app/app.routes.ts');
const COMPONENTE = join(REPO, 'src/app/features/news/news-detail/news-detail.component.ts');

const scheletro = injectNoindex(readFileSync(INDEX, 'utf8'));

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
  createdAt: '2026-08-19T09:30:00.000Z',
  updatedAt: '2026-08-19T11:00:00.000Z',
};

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
    renderArticolo(scheletro, { ...ARTICOLO, createdAt: '2026-08-19T23:30:00.000Z' }, 'x'),
  );
  assert.match(main, /20 agosto 2026/);
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
