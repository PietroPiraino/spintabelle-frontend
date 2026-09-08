// Le tabelle del pannello admin non devono sfondare la colonna che le contiene.
//
// ⚠️ PERCHÉ ESISTE. L'08/09/2026 `/admin/lezioni` è arrivato in produzione con
// una barra di scorrimento orizzontale: la tabella era larga 1241px in 968
// disponibili, la colonna «Lezione» ne prendeva 818 da sola e «Categoria»
// restava tagliata a metà parola sotto la colonna dei comandi, che è `sticky` e
// le passava sopra. Non se n'era accorto niente — non il build, non le guardie
// delle rotte, non i 40 test Karma del pannello — perché la larghezza di una
// tabella non si legge dal sorgente: la decide il browser, sul contenuto vero,
// alla larghezza vera. Questa sonda è l'unica cosa del repo che la guarda.
//
// ⚠️ NON STA IN `npm run build`, ed è deliberato: gli stessi motivi di
// `check-news-live.mjs` e `check-hands-live.mjs`. Le serve uno stack acceso
// (backend + frontend + Mongo) e delle righe vere in tabella; in catena farebbe
// fallire un deploy perché un Mongo locale è spento, cioè per una ragione che
// col deploy non c'entra. Si lancia a mano dopo ogni modifica ad
// `admin-table.scss` o alla prima cella di una tabella.
//
// ⚠️ E VUOLE DEI DATI. Una tabella vuota non sfonda mai: se una sezione non ha
// righe la sonda la SALTA e lo dice, invece di contarla come promossa — il
// verde di un elenco vuoto è il modo più rapido per credersi a posto.
//
// Uso:
//   npx playwright install chromium      (una volta)
//   node scripts/check-admin-tabelle.mjs
//   BASE=http://localhost:4300 ADMIN_EMAIL=… ADMIN_PASS=… node scripts/check-admin-tabelle.mjs

import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:4200';
const EMAIL = process.env.ADMIN_EMAIL ?? 'qa@bff.local';
const PASS = process.env.ADMIN_PASS ?? 'password123';

// Le larghezze contano tre cose diverse, non tre gusti:
//  1440 = un portatile largo, dove la tabella ha più spazio di quanto le serva;
//  1280 = la misura su cui è stato trovato il difetto;
//  1024 = la soglia in cui la sidebar è ancora affiancata e lo spazio è minimo;
//   390 = sotto i 720 la tabella diventa blocchi impilati, quindi lì non si
//         misura la tabella ma la PAGINA: non deve scorrere in orizzontale.
const LARGHE = [1440, 1280, 1024];
const STRETTO = 390;

// ⚠️ L'altezza è un tetto, non un valore atteso: 44px sono dichiarati su
// `th, td`, e il 45 che si misura è l'arrotondamento del bordo. Sopra i 46 vuol
// dire che qualcosa nella cella è cresciuto — un'immagine, un badge col padding
// verticale, un'interlinea tornata a 1.6 — e la tabella ha smesso di essere
// densa, che è l'unica ragione per cui non è un elenco di card.
const RIGA_MAX = 46;

const SEZIONI = [
  'lezioni',
  'live',
  'news',
  'documenti',
  'richieste',
  'sconti',
  'negozio',
  'affiliazioni',
  'partecipazione',
  'log',
  'iscritti',
  'stakings',
];

/** Misura ogni `.admin-table__scroll` presente nella pagina. */
const misura = (page) =>
  page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.admin-table__scroll').forEach((box, i) => {
      const t = box.querySelector('table.admin-table');
      if (!t) return;
      const righe = [...t.querySelectorAll('tbody tr')];
      // Una riga «nessun risultato» non è un dato: `.admin-table__vuota`.
      const vere = righe.filter((r) => !r.querySelector('.admin-table__vuota'));
      out.push({
        i,
        righe: vere.length,
        over: box.scrollWidth - box.clientWidth,
        alta: vere.length
          ? Math.max(...vere.map((r) => Math.round(r.getBoundingClientRect().height)))
          : 0,
        colonne: [...t.querySelectorAll('thead th')].map((h) => ({
          nome: (h.textContent ?? '').trim().slice(0, 12) || '·',
          w: Math.round(h.getBoundingClientRect().width),
        })),
      });
    });
    return out;
  });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const guasti = [];
// ⚠️ Le sezioni non misurate si raccolgono su TUTTE le larghezze e si giudicano
// alla fine, mai alla prima: la prima navigazione dopo il login è la più lenta
// del giro (bootstrap di Angular + prima chiamata all'API), e prendendo lì la
// decisione la sonda annunciava «senza tabella per progetto» due sezioni che
// una tabella ce l'hanno e che infatti misurava alle larghezze successive. Una
// sonda che spiega male è peggio di una che tace.
const conRighe = new Set();
const conTabella = new Set();
let misurate = 0;

try {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[type="email"], #identifier', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
} catch {
  console.error(
    `\n✗ Login fallito su ${BASE} con ${EMAIL}.\n` +
      '  Serve uno stack locale acceso e un utente ADMIN. Non è un difetto del pannello.\n',
  );
  await browser.close();
  process.exitCode = 1;
  // eslint-disable-next-line no-process-exit
  throw new Error('login');
}

for (const larghezza of LARGHE) {
  await page.setViewportSize({ width: larghezza, height: 900 });
  for (const sez of SEZIONI) {
    await page.goto(`${BASE}/admin/${sez}`, { waitUntil: 'domcontentloaded' });
    // Si aspetta la RIGA, non un tempo: una sezione che ha davvero una tabella
    // la mostra appena l'API risponde, e una che non ce l'ha esaurisce l'attesa
    // senza costare niente al giro (le altre sono già passate).
    await page
      .waitForSelector('table.admin-table tbody tr', { timeout: 6000 })
      .catch(() => undefined);
    const tabelle = await misura(page);

    if (!tabelle.length) continue;
    conTabella.add(sez);
    if (tabelle.every((t) => t.righe === 0)) continue;
    conRighe.add(sez);

    for (const t of tabelle) {
      if (t.righe === 0) continue;
      misurate += 1;
      const dove = `/${sez}${tabelle.length > 1 ? ` (tabella ${t.i + 1})` : ''} a ${larghezza}px`;
      if (t.over > 0) {
        const larga = t.colonne.reduce((a, c) => (c.w > a.w ? c : a), t.colonne[0]);
        guasti.push(
          `${dove}: la tabella sfonda di ${t.over}px. ` +
            `La colonna più larga è «${larga.nome}» con ${larga.w}px. ` +
            'Il tetto va su un elemento INTERNO alla cella, mai sulla cella: ' +
            'su un <td> limita la scatola e lascia uscire il testo.',
        );
      }
      if (t.alta > RIGA_MAX) {
        guasti.push(
          `${dove}: una riga è alta ${t.alta}px (massimo ${RIGA_MAX}). ` +
            'Di solito è l\'interlinea della cella d\'identità tornata a quella del ' +
            'body, un badge che ha ripreso il padding verticale, o un\'immagine ' +
            'più alta della riga.',
        );
      }
    }
  }
}

// Sotto i 720px non si misura la tabella — non è più una tabella — ma la pagina.
await page.setViewportSize({ width: STRETTO, height: 844 });
for (const sez of SEZIONI) {
  await page.goto(`${BASE}/admin/${sez}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  const scorre = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth > d.clientWidth + 1;
  });
  if (scorre) {
    guasti.push(
      `/${sez} a ${STRETTO}px: la PAGINA scorre in orizzontale. ` +
        'Sotto i 720px la tabella diventa blocchi impilati: se la pagina scorre, ' +
        'qualcosa è rimasto largo — di solito un `nowrap` non spento o un tetto in px.',
    );
  }
}

await browser.close();

const senzaTabella = SEZIONI.filter((s) => !conTabella.has(s));
const senzaRighe = [...conTabella].filter((s) => !conRighe.has(s));

if (senzaTabella.length) {
  console.log(`\n·  Senza tabella (card o cruscotto): ${senzaTabella.join(', ')}.`);
}
if (senzaRighe.length) {
  console.log(
    `\n⚠️  Tabella VUOTA: ${senzaRighe.join(', ')}.\n` +
      '   Una tabella senza righe non sfonda mai — qui non è stato verificato\n' +
      '   niente. Semina qualche riga con contenuti lunghi e rilancia.',
  );
}

if (guasti.length) {
  console.error(`\n✗ ${guasti.length} problemi:\n`);
  for (const g of guasti) console.error(`  • ${g}`);
  console.error('');
  process.exitCode = 1;
} else if (misurate === 0) {
  // Il verso anti-sonda-vuota: zero misurazioni e zero guasti si legge come un
  // successo, ed è il contrario.
  console.error('\n✗ Nessuna tabella misurata: la sonda non ha controllato niente.\n');
  process.exitCode = 1;
} else {
  console.log(`\n✓ ${misurate} tabelle misurate: nessuno sfondamento, righe entro ${RIGA_MAX}px.\n`);
}
