// Il lint del glossario, da lanciare mentre si SCRIVONO le voci.
//
// Volutamente FUORI da `npm run build` (la catena e' pinnata da
// `catena-build.test.mjs`): il build ha gia' `check-prerender-content.mjs`, e
// le stesse regole girano su ogni `npm run test:scripts` tramite
// `scripts/lib/glossario-lint.test.mjs`, che pretende zero rilievi sui dati
// veri. Questo CLI serve prima: su un lotto di voci in scratchpad, o per
// stampare la tabella «slug · query · parole» che l'owner approva.
//
// Uso:
//   node scripts/check-glossario.mjs                       # i dati veri
//   node scripts/check-glossario.mjs --file C:/…/voci-03.ts  # un lotto (export const VOCI)
//   node scripts/check-glossario.mjs --tabella             # solo la tabella, niente rilievi
//
// Esce 1 se c'e' almeno un rilievo. Node 24 importa i `.ts` di sole costanti
// senza build: il lotto in scratchpad deve avere solo `import type`.

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { lintTermini, lintVoci, riepilogoVoce } from './lib/glossario-lint.mjs';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '..');
const url = (p) => pathToFileURL(resolve(REPO, p)).href;

function argValue(nome) {
  const i = process.argv.indexOf(nome);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const file = argValue('--file');
const soloTabella = process.argv.includes('--tabella');

const art9 = await import(url('src/app/core/art9.constants.ts'));
const glossario = await import(url('src/app/features/glossario/glossario.data.ts'));
const guide = await import(url('src/app/features/guides/guides.data.ts'));

let voci = glossario.VOCI;
let tutteLeVoci = glossario.VOCI;
if (file) {
  const lotto = await import(pathToFileURL(resolve(file)).href);
  if (!Array.isArray(lotto.VOCI)) {
    console.error(`${file}: non esporta \`VOCI\``);
    process.exit(1);
  }
  voci = lotto.VOCI;
  const gia = new Set(glossario.VOCI.map((v) => v.slug));
  tutteLeVoci = [...glossario.VOCI, ...lotto.VOCI.filter((v) => !gia.has(v.slug))];
  for (const v of lotto.VOCI) {
    if (gia.has(v.slug)) console.warn(`⚠️ «${v.slug}» esiste gia' nei dati veri: il lotto la sovrascriverebbe`);
  }
}

const righe = voci.map(riepilogoVoce);
const larg = (k) => Math.max(k.length, ...righe.map((r) => String(r[k]).length));
const colonne = ['slug', 'query', 'parole', 'def', 'titolo'];
console.log(colonne.map((c) => c.padEnd(larg(c))).join('  '));
console.log(colonne.map((c) => '─'.repeat(larg(c))).join('  '));
for (const r of righe) {
  console.log(
    colonne
      .map((c) => (typeof r[c] === 'number' ? String(r[c]).padStart(larg(c)) : String(r[c]).padEnd(larg(c))))
      .join('  '),
  );
}
const parole = righe.map((r) => r.parole);
console.log(
  `\n${righe.length} voci · parole: min ${Math.min(...parole)} · media ${Math.round(parole.reduce((a, b) => a + b, 0) / parole.length)} · max ${Math.max(...parole)}`,
);
if (soloTabella) process.exit(0);

const rilievi = [
  ...lintVoci(voci, {
    slugGuide: guide.slugGuide(),
    tutteLeVoci,
    art9: {
      liste: [
        { nome: 'sala affiliata', termini: art9.SALE_AFFILIATE },
        { nome: 'parola non pubblicabile', termini: art9.PAROLE_NON_PUBBLICABILI },
        { nome: 'promessa', termini: art9.PROMESSE_VIETATE },
      ],
      terminiPresenti: art9.terminiPresenti,
    },
  }),
  ...(file ? [] : lintTermini(guide.GUIDE, glossario.VOCI)),
];
if (rilievi.length) {
  console.log(`\n✗ ${rilievi.length} rilievi:`);
  for (const r of rilievi) console.log(`  ${r.slug} · ${r.campo} · ${r.motivo}`);
  process.exit(1);
}
console.log('\n✓ nessun rilievo');
