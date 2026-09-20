// Il JSON-LD statico di `src/index.html` (EducationalOrganization): e' su OGNI
// pagina del sito, prerenderizzate e shell CSR comprese, e nessun test Karma
// lo vede (Karma monta i componenti, non l'index).
//
// Due cose si rompono in silenzio:
//  1. **`sameAs` che deriva dai link social veri.** I profili ufficiali vivono
//     in `src/app/core/social-links.ts` (unica fonte di verita', dichiarata);
//     il JSON-LD e' HTML statico e non puo' importarli. Se un URL cambia di la'
//     e non di qua, il pannello di conoscenza del marchio punta a un profilo
//     morto — e per un anno c'era il solo YouTube.
//  2. **JSON non valido.** Una virgola in piu' in un blocco `ld+json` non rompe
//     la pagina: Google lo ignora e basta, senza dirlo a nessuno.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUI = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(QUI, '../..');
const html = readFileSync(resolve(REPO, 'src/index.html'), 'utf8');
const { SOCIAL_LINKS } = await import(
  pathToFileURL(resolve(REPO, 'src/app/core/social-links.ts')).href
);

function blocchi() {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(JSON.parse(m[1]));
  return out;
}

test('index.html ha un solo blocco JSON-LD statico, valido, di tipo EducationalOrganization', () => {
  const b = blocchi();
  assert.equal(b.length, 1);
  assert.equal(b[0]['@type'], 'EducationalOrganization');
  assert.equal(b[0]['url'], 'https://bestfishforever.it/');
});

test('sameAs elenca esattamente i tre profili di social-links.ts (youtube, instagram, discord)', () => {
  const [org] = blocchi();
  assert.deepEqual(
    [...org.sameAs].sort(),
    [SOCIAL_LINKS.youtube, SOCIAL_LINKS.instagram, SOCIAL_LINKS.discord].sort(),
  );
});

test('il fondatore e\' dichiarato come Person con nome e nickname', () => {
  const [org] = blocchi();
  assert.equal(org.founder?.['@type'], 'Person');
  assert.equal(org.founder?.name, 'Pietro Piraino');
  assert.ok(org.founder?.alternateName);
  assert.equal(org.founder?.url, 'https://bestfishforever.it/chi-siamo/');
});
