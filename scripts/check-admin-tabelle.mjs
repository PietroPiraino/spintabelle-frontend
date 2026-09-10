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

// Le larghezze contano quattro cose diverse, non quattro gusti:
//  1440 = un portatile largo, dove la tabella ha più spazio di quanto le serva;
//  1280 = la misura su cui è stato trovato il difetto;
//  1100 = ⚠️ la STRETTA VERA: la sidebar del pannello collassa a 1024, quindi
//         appena sopra quella soglia la colonna di contenuto è al minimo pur
//         restando affiancata alla sidebar — è lì che una tabella sfonda per
//         prima, e finché l'elenco saltava da 1280 a 1024 quella fascia non
//         veniva guardata da nessuno;
//  1024 = la soglia in cui la sidebar è ancora affiancata e lo spazio è minimo;
//   390 = sotto i 720 la tabella diventa blocchi impilati, quindi lì non si
//         misura la tabella ma la PAGINA: non deve scorrere in orizzontale.
const LARGHE = [1440, 1280, 1100, 1024];
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
  // ⚠️ Aggiunta l'08/09/2026: mancava dall'elenco, e per questo la sonda non
  // aveva mai visto che la sezione non era nemmeno una tabella — non importava
  // un solo foglio condiviso. Una sonda che non nomina una sezione non la
  // promuove: non la guarda affatto, che è peggio.
  'replayer',
  // ⚠️ Aggiunta il 10/09/2026 con la sezione. La sonda NON promuove ciò che non
  // nomina: non lo guarda affatto — è la lezione scritta due righe sopra su
  // `replayer`. Qui conta più che altrove, perché la tabella del rakeback ha
  // dieci colonne e due campi editabili per riga.
  'conteggi-mensili',
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

/**
 * Esegue `azione` una volta per SCHEDA, e una sola volta se la schermata non
 * ne ha (in quel caso il nome passato è `null`).
 *
 * ⚠️⚠️ Prima si fermava alla PRIMA scheda che conteneva una tabella, e su una
 * sezione a quattro schede questo vuol dire misurarne una e dichiararne
 * quattro. Su `/admin/conteggi-mensili` si fermava su «Rakeback» e non apriva
 * mai «Spese ed entrate» né le due tabelle di «Anagrafiche» — tre tabelle su
 * quattro non erano coperte da niente di committato. Ed è generico: qualunque
 * schermata a schede, oggi o domani, viene misurata su OGNI scheda.
 *
 * ⚠️ Gli handle si riprendono a ogni giro: cambiando scheda il pannello si
 * ridisegna, e un handle preso prima può puntare a un nodo staccato.
 */
async function perOgniScheda(page, azione) {
  const quante = (await page.$$('button[role="tab"]')).length;
  if (!quante) {
    await azione(null);
    return;
  }
  for (let i = 0; i < quante; i += 1) {
    const schede = await page.$$('button[role="tab"]');
    const s = schede[i];
    if (!s) break;
    const nome =
      (await s.textContent().catch(() => null))?.trim().split('\n')[0].trim() ??
      `scheda ${i + 1}`;
    await s.click().catch(() => undefined);
    await page
      .waitForSelector('table.admin-table tbody tr', { timeout: 4000 })
      .catch(() => undefined);
    await azione(nome);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// ⚠️ Le risposte fallite si RACCOLGONO, e non è pignoleria: il backend ha un
// limite globale di 120 richieste al minuto, e questa sonda ne fa quattro giri
// su tredici sezioni. Quando scatta, la pagina non popola l'elenco e la sonda
// la classificava fra le «senza tabella per progetto» — cioè annunciava come
// una scelta di design quello che era un 429. Un conteggio che oscilla senza
// spiegazione è il primo passo perché nessuno lo guardi più.
const risposteRotte = new Map();
page.on('response', (r) => {
  if (r.status() < 400) return;
  if (!r.url().includes('/admin/') && !r.url().includes('/api/')) return;
  const k = `${r.status()} ${new URL(r.url()).pathname}`;
  risposteRotte.set(k, (risposteRotte.get(k) ?? 0) + 1);
});

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
    // ⚠️ Una sezione a SCHEDE nasconde la tabella dietro un pannello, e senza
    // aprirle la sonda la classificava «senza tabella per progetto» — cioè
    // annunciava come una scelta di design una tabella che non aveva guardato.
    // È lo stesso falso negativo di `replayer`, in un'altra forma: là la
    // sezione non era nell'elenco, qui era la tabella a non essere in pagina.
    // Il ciclo è GENERICO e non nomina alcuna sezione: qualunque schermata a
    // schede, oggi o domani, viene misurata su ogni scheda.
    await perOgniScheda(page, async (nomeScheda) => {
      const tabelle = await misura(page);

      if (!tabelle.length) return;
      conTabella.add(sez);
      if (tabelle.every((t) => t.righe === 0)) return;
      conRighe.add(sez);

      for (const t of tabelle) {
        if (t.righe === 0) continue;
        misurate += 1;
        const dove =
          `/${sez}${nomeScheda ? ` · ${nomeScheda}` : ''}` +
          `${tabelle.length > 1 ? ` (tabella ${t.i + 1})` : ''} a ${larghezza}px`;
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
    });
  }
}

// Sotto i 720px non si misura la tabella — non è più una tabella — ma la pagina.
await page.setViewportSize({ width: STRETTO, height: 844 });
for (const sez of SEZIONI) {
  await page.goto(`${BASE}/admin/${sez}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1400);
  // ⚠️ Anche qui si passa da OGNI scheda, e non è una simmetria gratuita: il
  // giro stretto non ne apriva nessuna, quindi di una sezione a schede misurava
  // sempre e solo la prima — su `/admin/conteggi-mensili` il Riepilogo, che è
  // l'unico pannello senza tabella. Tutto il ramo a blocchi (le etichette per
  // riga, i campi a piena larghezza) non era coperto da niente.
  await perOgniScheda(page, async (nomeScheda) => {
    const scorre = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth > d.clientWidth + 1;
    });
    if (scorre) {
      guasti.push(
        `/${sez}${nomeScheda ? ` · ${nomeScheda}` : ''} a ${STRETTO}px: ` +
          'la PAGINA scorre in orizzontale. ' +
          'Sotto i 720px la tabella diventa blocchi impilati: se la pagina scorre, ' +
          'qualcosa è rimasto largo — di solito un `nowrap` non spento o un tetto in px.',
      );
    }
  });
}

await browser.close();

const senzaTabella = SEZIONI.filter((s) => !conTabella.has(s));
const senzaRighe = [...conTabella].filter((s) => !conRighe.has(s));

if (risposteRotte.size) {
  console.log('\n⚠️  L\'API ha rifiutato delle richieste durante il giro:');
  for (const [k, n] of risposteRotte) console.log(`   ${k} ×${n}`);
  console.log(
    '   Una sezione il cui elenco non arriva finisce fra le «senza tabella»,\n' +
      '   cioè viene scambiata per una scelta di progetto. Se ci sono dei 429 è\n' +
      '   il limite di 120 richieste al minuto: rilancia più lentamente.',
  );
}

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
