// «Per approfondire»: il blocco che porta da un articolo alle guide.
//
// COSA SORVEGLIA QUESTO FILE, e perché ognuna delle tre cose è un modo diverso
// di rompersi in silenzio.
//
//  1. **La deriva fra le due copie.** La scelta delle guide vive due volte —
//     `src/app/features/guides/guide-links.ts` (canonica) e
//     `functions/lib/guide-links.mjs` (edge) — perché la Function e l'app sono
//     due build diverse e non possono importarsi a vicenda. Le due stesure della
//     pagina si sostituiscono: se divergono, il blocco cambia sotto gli occhi di
//     chi ha appena aperto l'articolo, e nessun compilatore se ne accorge.
//  2. **Lo slug che non esiste più.** `guide/:slug` usa `PrerenderFallback.None`,
//     quindi uno slug sbagliato non è un link brutto: è un **404 vero**, su tutto
//     l'archivio, per sempre. Qui si rilegge `guides.data.ts` e si confronta.
//  3. **Il titolo scritto a mano che invecchia.** Il testo del collegamento è
//     duplicato (l'edge `guides.data.ts` non può importarlo), quindi va
//     confrontato con la guida vera — o l'ancora promette una pagina e ne apre
//     un'altra.
//
// ⚠️ I casi di comportamento in fondo sono gli **stessi** di
// `guide-links.spec.ts` (Karma), e per una ragione: qui gira la copia dell'edge,
// là la canonica. Due suite sullo stesso contratto sono l'unico modo di
// accorgersi che una delle due implementazioni è cambiata da sola.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  GUIDE_CORRELABILI,
  MAX_GUIDE,
  RIPIEGO_CATEGORIA,
  RIPIEGO_PREDEFINITO,
  guideCorrelate,
  normalizzaTesto,
} from '../../functions/lib/guide-links.mjs';
import { injectNoindex } from './csr-noindex.mjs';
import { renderArticolo } from '../../functions/lib/render-news.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const CANONICO = join(REPO, 'src/app/features/guides/guide-links.ts');
const EDGE = join(REPO, 'functions/lib/guide-links.mjs');
const GUIDE_DATA = join(REPO, 'src/app/features/guides/guides.data.ts');
const INDEX = join(REPO, 'src/index.html');
const TEMPLATE = join(
  REPO,
  'src/app/features/news/news-detail/news-detail.component.html',
);

/**
 * Il letterale che segue `export const <nome> =`, bilanciando le parentesi.
 *
 * ⚠️ Si parte dall'`=` e non dal nome: nel sorgente TypeScript in mezzo c'è
 * l'annotazione di tipo, che contiene `[]` e `{}` suoi. Partendo dal nome si
 * estrarrebbe il tipo invece del valore — e il confronto passerebbe confrontando
 * due cose sbagliate, cioè il modo peggiore di fallire per una guardia.
 */
function letterale(sorgente, nome, apre) {
  const i = sorgente.indexOf(`export const ${nome}`);
  assert.ok(
    i >= 0,
    `${nome} non è più esportato: la guardia sta leggendo il file sbagliato.`,
  );
  const eq = sorgente.indexOf('=', i);
  const inizio = sorgente.indexOf(apre, eq);
  const chiude = apre === '[' ? ']' : '}';
  let profondita = 0;
  for (let k = inizio; k < sorgente.length; k++) {
    if (sorgente[k] === apre) profondita++;
    else if (sorgente[k] === chiude) {
      profondita--;
      if (profondita === 0) return sorgente.slice(inizio, k + 1);
    }
  }
  throw new Error(`letterale di ${nome} non chiuso`);
}

/**
 * Confrontabile: spazi collassati **e virgolette uniformate**.
 *
 * ⚠️ LE VIRGOLETTE NON SONO PEDANTERIA. Prettier senza configurazione esplicita
 * riscrive un `.mjs` a virgolette doppie e lascia il `.ts` a singole: basta un
 * `npx prettier --write` distratto e questi tre casi falliscono tutti insieme
 * annunciando una deriva che non c'è. Una guardia che grida al lupo è una
 * guardia che qualcuno spegne — e questa protegge il blocco che cambia sotto gli
 * occhi del lettore.
 */
const spazi = (t) => t.replace(/\s+/g, ' ').replace(/"/g, "'").trim();
const sorgenteCanonica = readFileSync(CANONICO, 'utf8');
const sorgenteEdge = readFileSync(EDGE, 'utf8');

/** slug -> titolo, letti da `guides.data.ts` (l'unica fonte delle guide vere). */
function guideVere() {
  const testo = readFileSync(GUIDE_DATA, 'utf8');
  const trovate = new Map();
  const re = /slug:\s*'([^']+)',\s*\n\s*titolo:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(testo))) trovate.set(m[1], m[2]);
  // Fail-loud: se il file cambia forma, questa guardia deve gridare, non
  // passare a vuoto. È la regola di `check-routes.mjs` (fail-safe sugli
  // artefatti, fail-loud sulle sorgenti).
  assert.ok(
    trovate.size >= 10,
    `guides.data.ts: lette ${trovate.size} guide, meno di 10. È cambiata la forma del file: aggiorna questa estrazione.`,
  );
  return trovate;
}

// ---- 1. Deriva fra le due copie -----------------------------------------

test('deriva: il letterale GUIDE_CORRELABILI è identico nelle due copie', () => {
  assert.equal(
    spazi(letterale(sorgenteEdge, 'GUIDE_CORRELABILI', '[')),
    spazi(letterale(sorgenteCanonica, 'GUIDE_CORRELABILI', '[')),
    'functions/lib/guide-links.mjs e src/app/features/guides/guide-links.ts propongono guide diverse: ' +
      "il blocco cambierebbe all'idratazione, sotto gli occhi di chi ha appena aperto l'articolo.",
  );
});

test('deriva: il letterale RIPIEGO_CATEGORIA è identico nelle due copie', () => {
  assert.equal(
    spazi(letterale(sorgenteEdge, 'RIPIEGO_CATEGORIA', '{')),
    spazi(letterale(sorgenteCanonica, 'RIPIEGO_CATEGORIA', '{')),
  );
});

test('deriva: anche il ripiego predefinito è lo stesso', () => {
  const daSorgente = (s) =>
    /RIPIEGO_PREDEFINITO\s*(?::\s*\w+)?\s*=\s*['"]([^'"]+)['"]/.exec(s)?.[1];
  assert.equal(daSorgente(sorgenteEdge), daSorgente(sorgenteCanonica));
  assert.equal(daSorgente(sorgenteEdge), RIPIEGO_PREDEFINITO);
});

// ---- 2. Gli slug esistono davvero ---------------------------------------

test('ogni slug proposto esiste in guides.data.ts', () => {
  const vere = guideVere();
  for (const g of GUIDE_CORRELABILI) {
    assert.ok(
      vere.has(g.slug),
      `«${g.slug}» non è una guida: /guide/${g.slug}/ risponde 404 (PrerenderFallback.None), ` +
        "e il link sarebbe morto su tutto l'archivio.",
    );
  }
});

test('ogni ripiego di categoria punta a una guida proponibile', () => {
  const proponibili = new Set(GUIDE_CORRELABILI.map((g) => g.slug));
  for (const [categoria, slug] of Object.entries(RIPIEGO_CATEGORIA)) {
    assert.ok(
      proponibili.has(slug),
      `ripiego di «${categoria}» verso «${slug}», che non è in elenco`,
    );
  }
  assert.ok(proponibili.has(RIPIEGO_PREDEFINITO));
});

// ---- 3. I titoli non invecchiano ----------------------------------------

test('il testo di ogni collegamento è ancora il titolo della guida', () => {
  const vere = guideVere();
  for (const g of GUIDE_CORRELABILI) {
    assert.equal(
      g.titolo,
      vere.get(g.slug),
      `il titolo di «${g.slug}» è cambiato in guides.data.ts: l'ancora promette una pagina e ne apre un'altra.`,
    );
  }
});

// ---- 4. La scelta ---------------------------------------------------------

test('una parola nel titolo pesa più della stessa nel corpo', () => {
  const scelte = guideCorrelate({
    titolo: 'Il downswing più lungo della stagione',
    corpo: 'Un accenno al preflop e nulla più.',
    categoria: 'online',
  });
  assert.equal(scelte[0].slug, 'varianza-spin-and-go');
});

test('al massimo due guide, mai di più', () => {
  const scelte = guideCorrelate({
    titolo: 'Downswing, bankroll, heads-up, preflop, twister e moltiplicatore',
    corpo: 'icm errori push fold',
    categoria: 'strategia',
  });
  assert.equal(scelte.length, MAX_GUIDE);
});

test('senza alcun aggancio si propone UNA sola guida, quella della categoria', () => {
  // ⚠️ Il verso che conta: due ripieghi sarebbero due link identici in coda a
  // ogni pezzo che non aggancia niente — cioè il boilerplate che il tetto di
  // due serve a evitare, per un'altra strada.
  const scelte = guideCorrelate({
    titolo: 'Notizia senza parole chiave',
    corpo: 'Testo neutro.',
    categoria: 'live',
  });
  assert.equal(scelte.length, 1);
  assert.equal(scelte[0].slug, RIPIEGO_CATEGORIA.live);
});

test('categoria assente: si ripiega sul predefinito, mai su zero guide', () => {
  // ⚠️ `.lean()` non applica i default di schema: una riga anteriore al campo
  // arriva senza `categoria`. Un accesso non guardato farebbe sparire il blocco.
  const scelte = guideCorrelate({
    titolo: 'Notizia neutra',
    corpo: 'Testo neutro.',
  });
  assert.equal(scelte.length, 1);
  assert.equal(scelte[0].slug, RIPIEGO_PREDEFINITO);
});

test('il confronto è per parola intera e regge accenti e Markdown', () => {
  assert.equal(normalizzaTesto('**Perché** l’ICM…'), 'perche l icm');
  // «icmizzare» non deve agganciare la guida sull'ICM.
  const scelte = guideCorrelate({
    titolo: 'Icmizzare non è una parola',
    corpo: 'Testo.',
    categoria: 'mtt',
  });
  assert.equal(scelte[0].slug, RIPIEGO_CATEGORIA.mtt);
  assert.equal(scelte.length, 1);
});

test('la scelta è deterministica: due chiamate uguali danno lo stesso ordine', () => {
  const articolo = {
    titolo: 'Bankroll e varianza',
    corpo: 'preflop',
    categoria: 'strategia',
  };
  assert.deepEqual(guideCorrelate(articolo), guideCorrelate(articolo));
});

// ---- 5. La resa all'edge --------------------------------------------------

const scheletro = injectNoindex(readFileSync(INDEX, 'utf8'));
const ARTICOLO = {
  title: 'Il downswing più lungo della stagione',
  body: 'Un pezzo qualunque.',
  slug: 'downswing-piu-lungo',
  categoria: 'online',
  publishedAt: '2026-08-23T10:00:00.000Z',
};
const dentroMain = (html) =>
  html.slice(html.indexOf('<main'), html.indexOf('</main>'));

test("l'edge stampa il blocco dentro <main>", () => {
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  assert.match(main, /<aside class="news-guide">/);
  assert.match(main, /Per approfondire/);
  assert.match(main, /href="\/guide\/varianza-spin-and-go\/"/);
});

test("⚠️ l'href dell'edge porta la barra finale (senza sarebbe un 308 per ogni scansione)", () => {
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  const href = [...main.matchAll(/href="(\/guide\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(href.length > 0, "nessun link a una guida nell'HTML dell'edge");
  for (const h of href) assert.match(h, /\/$/, `«${h}» senza barra finale`);
});

test('⚠️ e il template Angular usa routerLink SENZA barra: le due forme non vanno allineate', () => {
  // Con la barra `DefaultUrlSerializer` produce un segmento vuoto che la rotta
  // `guide/:slug` non consuma → la navigazione interna cadrebbe sul wildcard 404.
  const template = readFileSync(TEMPLATE, 'utf8');
  assert.match(
    template,
    /\[routerLink\]="\['\/guide', g\.slug\]"/,
    'news-detail.component.html non collega più le guide con un routerLink a due segmenti.',
  );
  assert.doesNotMatch(template, /routerLink[^>]*\/guide\/[^']*\//);
});

test('il blocco sta FRA il corpo e la condivisione', () => {
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  const corpo = main.indexOf('<div class="prose">');
  const guide = main.indexOf('<aside class="news-guide">');
  const share = main.indexOf('<footer class="news-share">');
  assert.ok(
    corpo < guide && guide < share,
    `ordine sbagliato: ${corpo} ${guide} ${share}`,
  );
});

test('⚠️ nessuna icona nel blocco: la trappola degli <svg> resta armata', () => {
  // `news-render.test.mjs` conta esattamente tre <svg> dentro <main> (i tre
  // canali di condivisione) e zero <img>. Un ornamento qui farebbe fallire una
  // guardia scritta per un'altra ragione — e la ragione è buona.
  const main = dentroMain(renderArticolo(scheletro, ARTICOLO, ARTICOLO.slug));
  const blocco = main.slice(
    main.indexOf('<aside class="news-guide">'),
    main.indexOf('</aside>'),
  );
  assert.doesNotMatch(blocco, /<svg|<img/);
});
