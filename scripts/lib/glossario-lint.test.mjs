// Il glossario (/glossario): tre cose che si rompono in silenzio.
//
//  1. **Una voce sbagliata nei dati veri.** Troppo corta (la guardia del build
//     la boccerebbe a deploy pronto), un `correlati` verso uno slug inesistente
//     (`PrerenderFallback.None` → 404 vero), una parola che l'art. 9 DL 87/2018
//     vieta in un testo pubblico. Qui si importano i DATI VERI — Node 24 legge
//     un `.ts` di sole costanti — e si pretende zero rilievi.
//  2. **La deriva delle liste art. 9.** `src/app/core/art9.constants.ts` e' la
//     COPIA di `backend/src/news/news.constants.ts` (due repo, niente import):
//     si confrontano i valori e il comportamento di `terminiPresenti` sulla
//     stessa fixture. Se il checkout del backend non c'e' (Cloudflare) il caso
//     SALTA avvisando: fail-safe sull'assenza, fail-loud sulla differenza.
//  3. **Le regole del lint stesse.** Fixture minime per ogni rilievo, cosi'
//     una regola tolta per sbaglio si vede qui e non in produzione.
//
// ⚠️ `testiDiVoce` vive due volte (data.ts e lint.mjs) per lo stesso motivo
// di `guide-links`: un campo aggiunto di la' deve entrare anche di qua, e il
// caso 4 lo confronta.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  HREF_AMMESSI,
  contaParole,
  lintTermini,
  lintVoci,
  paroleDiVoce,
  riepilogoVoce,
  testiDiVoce,
} from './glossario-lint.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const url = (p) => pathToFileURL(resolve(REPO, p)).href;

const art9 = await import(url('src/app/core/art9.constants.ts'));
const glossario = await import(url('src/app/features/glossario/glossario.data.ts'));
const guide = await import(url('src/app/features/guides/guides.data.ts'));

const LISTE = [
  { nome: 'sala affiliata', termini: art9.SALE_AFFILIATE },
  { nome: 'parola non pubblicabile', termini: art9.PAROLE_NON_PUBBLICABILI },
  { nome: 'promessa', termini: art9.PROMESSE_VIETATE },
];
const OPZ = {
  slugGuide: guide.slugGuide(),
  art9: { liste: LISTE, terminiPresenti: art9.terminiPresenti },
};

/** Una voce corretta, da cui ogni fixture parte togliendo o rompendo una cosa. */
function voceBuona(extra = {}) {
  const paragrafo =
    'Frase di prova che serve solo a raggiungere il numero di parole richiesto dal pavimento della guardia del build, ripetuta quanto basta. ';
  return {
    slug: 'voce-buona',
    termine: 'Voce buona',
    query: 'voce buona poker significato',
    titolo: 'Voce buona nel poker: significato',
    definizione: 'Una definizione breve che chiude con il punto.',
    spiegazione: [paragrafo.repeat(4), paragrafo.repeat(3)],
    esempio: 'Un esempio.',
    guida: { testo: 'la guida', href: '/guide/push-fold-spin-and-go' },
    strumento: { testo: 'le tabelle', href: '/tabelle' },
    correlati: ['altra-voce', 'terza-voce'],
    aggiornata: '2026-09-20',
    ...extra,
  };
}
const ALTRE = [
  voceBuona({ slug: 'altra-voce', termine: 'Altra', correlati: ['voce-buona', 'terza-voce'] }),
  voceBuona({ slug: 'terza-voce', termine: 'Terza', correlati: ['voce-buona', 'altra-voce'] }),
];
const motivi = (rilievi, campo) => rilievi.filter((r) => r.campo === campo).map((r) => r.motivo);

test('una voce corretta non produce rilievi', () => {
  assert.deepEqual(lintVoci([voceBuona(), ...ALTRE], OPZ), []);
});

test('le regole di forma: slug, titolo, definizione, paragrafi, parole, correlati, data', () => {
  const r = lintVoci(
    [
      voceBuona({ slug: 'Slug Sbagliato', titolo: 'x'.repeat(61), definizione: 'senza punto finale', spiegazione: ['uno'], correlati: ['voce-buona'], aggiornata: '20/09/2026' }),
      ...ALTRE,
    ],
    OPZ,
  );
  assert.ok(motivi(r, 'slug').some((m) => /kebab/.test(m)));
  assert.ok(motivi(r, 'titolo').some((m) => /61 caratteri/.test(m)));
  assert.ok(motivi(r, 'definizione').some((m) => /punto/.test(m)));
  assert.ok(motivi(r, 'spiegazione').some((m) => /1 paragrafi/.test(m)));
  assert.ok(motivi(r, 'parole').some((m) => /minimo 120/.test(m)));
  assert.ok(motivi(r, 'correlati').some((m) => /1 voci/.test(m)));
  assert.ok(motivi(r, 'aggiornata').length === 1);
});

test('correlati: inesistente, se stessa, doppione; guida inesistente; href esterno o con slash', () => {
  const r = lintVoci(
    [
      voceBuona({
        correlati: ['voce-buona', 'non-esiste', 'altra-voce', 'altra-voce'],
        guida: { testo: 'g', href: '/guide/guida-che-non-esiste' },
        strumento: { testo: 's', href: 'https://esempio.it/' },
      }),
      ...ALTRE,
    ],
    OPZ,
  );
  const c = motivi(r, 'correlati');
  assert.ok(c.some((m) => /se stessa/.test(m)));
  assert.ok(c.some((m) => /«non-esiste» non esiste/.test(m)));
  assert.ok(c.some((m) => /doppioni/.test(m)));
  assert.ok(motivi(r, 'guida.href').some((m) => /non esiste/.test(m)));
  assert.ok(motivi(r, 'strumento.href').some((m) => /non e' un link interno/.test(m)));
  const conSlash = lintVoci([voceBuona({ strumento: { testo: 's', href: '/tabelle/' } }), ...ALTRE], OPZ);
  assert.ok(motivi(conSlash, 'strumento.href').length === 1, 'lo slash finale non e\' ammesso (routerLink)');
  assert.ok(HREF_AMMESSI.includes('/glossario/'));
});

test('art. 9: una sala affiliata, una parola non pubblicabile e una promessa sono rilievi; il verbo nudo «guadagna» e «888.000» no', () => {
  const r = lintVoci(
    [
      voceBuona({
        spiegazione: [
          voceBuona().spiegazione[0] + ' Su Sisal si trova questo. Un bonus di benvenuto. Puoi guadagnare tanto.',
          voceBuona().spiegazione[1],
        ],
      }),
      ...ALTRE,
    ],
    OPZ,
  );
  const a = motivi(r, 'art9');
  assert.ok(a.some((m) => /sala affiliata: «sisal»/.test(m)), a.join(' | '));
  assert.ok(a.some((m) => /parola non pubblicabile: «bonus»/.test(m)));
  assert.ok(a.some((m) => /promessa: «puoi guadagnare»/.test(m)));

  const ok = lintVoci(
    [
      voceBuona({
        spiegazione: [
          voceBuona().spiegazione[0] + ' Questa linea guadagna 0,3 big blind. Un montepremi da 888.000 euro.',
          voceBuona().spiegazione[1],
        ],
      }),
      ...ALTRE,
    ],
    OPZ,
  );
  assert.deepEqual(motivi(ok, 'art9'), []);
});

test('testo: entita\' HTML, tag, Markdown, seme e URL assoluto sono rilievi', () => {
  const r = lintVoci(
    [
      voceBuona({
        spiegazione: [
          voceBuona().spiegazione[0] + ' Spin &amp; Go <b>x</b> **grassetto** e un asso di \u2660 su https://x.it',
          voceBuona().spiegazione[1],
        ],
      }),
      ...ALTRE,
    ],
    OPZ,
  );
  const t = motivi(r, 'testo');
  assert.ok(t.some((m) => /entita' HTML/.test(m)));
  assert.ok(t.some((m) => /tag HTML/.test(m)));
  assert.ok(t.some((m) => /Markdown/.test(m)));
  assert.ok(t.some((m) => /seme/.test(m)));
  assert.ok(t.some((m) => /URL assoluto/.test(m)));
});

test('un lotto in scratchpad risolve i correlati contro l\'insieme completo (tutteLeVoci)', () => {
  const lotto = [voceBuona({ correlati: ['altra-voce', 'terza-voce'] })];
  assert.deepEqual(lintVoci(lotto, { ...OPZ, tutteLeVoci: [...lotto, ...ALTRE] }), []);
  assert.ok(lintVoci(lotto, OPZ).some((r) => r.campo === 'correlati'));
});

test('testiDiVoce: la copia in lint.mjs e l\'originale in glossario.data.ts dicono la stessa cosa', () => {
  const v = voceBuona({ varianti: ['sinonimo'] });
  assert.deepEqual(testiDiVoce(v), glossario.testiDiVoce(v));
  assert.equal(contaParole('  due  parole '), 2);
  assert.ok(paroleDiVoce(v) > 120);
  assert.deepEqual(Object.keys(riepilogoVoce(v)), ['slug', 'query', 'parole', 'def', 'titolo']);
});

test('lintTermini: un rimando guida → glossario con slug ignoto o termine vecchio e\' un rilievo', () => {
  const voci = [voceBuona(), ...ALTRE];
  const guide = [
    { slug: 'g1', termini: [{ slug: 'voce-buona', termine: 'Voce buona' }] },
    { slug: 'g2', termini: [{ slug: 'fantasma', termine: 'x' }, { slug: 'altra-voce', termine: 'Vecchio nome' }] },
  ];
  const r = lintTermini(guide, voci);
  assert.equal(r.filter((x) => x.slug === 'g1').length, 0);
  assert.ok(r.some((x) => x.slug === 'g2' && /fantasma/.test(x.motivo)));
  assert.ok(r.some((x) => x.slug === 'g2' && /Vecchio nome/.test(x.motivo)));
});

// ── I DATI VERI ──

test('i dati veri del glossario passano il lint (zero rilievi)', () => {
  const rilievi = lintVoci(glossario.VOCI, OPZ);
  assert.deepEqual(
    rilievi,
    [],
    rilievi.map((r) => `${r.slug} · ${r.campo} · ${r.motivo}`).join('\n'),
  );
});

test('i rimandi delle guide al glossario (Guide.termini) esistono e portano il termine giusto', () => {
  assert.deepEqual(lintTermini(guide.GUIDE, glossario.VOCI), []);
});

test('anti-guardia-vuota: il glossario ha almeno 40 voci e slug unici', () => {
  // ⚠️ Da alzare a 90 con la seconda ondata: una guardia che passa su zero
  // voci non ha guardato niente.
  assert.ok(glossario.VOCI.length >= 40, `solo ${glossario.VOCI.length} voci`);
  assert.equal(new Set(glossario.slugGlossario()).size, glossario.VOCI.length);
});

// ── DERIVA delle liste art. 9 contro il backend ──

const BACKEND = resolve(REPO, '../backend/src/news/news.constants.ts');
test('art9.constants.ts e\' la copia fedele delle liste del backend (valori e comportamento)', async (t) => {
  if (!existsSync(BACKEND)) {
    console.warn(`⚠️ backend non trovato in ${BACKEND}: la deriva delle liste art. 9 non e' verificabile qui`);
    t.skip('checkout del backend assente');
    return;
  }
  const be = await import(pathToFileURL(BACKEND).href);
  assert.deepEqual([...art9.SALE_AFFILIATE], [...be.SALE_AFFILIATE]);
  assert.deepEqual([...art9.PAROLE_NON_PUBBLICABILI], [...be.PAROLE_NON_PUBBLICABILI]);
  const fixture = [
    'Un torneo da 888.000 euro',
    'su 888poker e su Sisal',
    'giri  gratis con un a capo',
    'casinò con l\'accento',
    'lo snaiper non e\' snai',
    '',
  ];
  for (const testo of fixture) {
    for (const lista of [art9.SALE_AFFILIATE, art9.PAROLE_NON_PUBBLICABILI]) {
      assert.deepEqual(
        art9.terminiPresenti(testo, lista),
        be.terminiPresenti(testo, lista),
        `«${testo}» giudicato diversamente dalle due copie`,
      );
    }
  }
});
