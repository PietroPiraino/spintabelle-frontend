// Cattura screenshot delle aree RISERVATE (login) del sito live per il deck.
// Uso: DECK_ID=... DECK_PW=... node deck-shots-gated.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.DECK_BASE ?? 'https://spintabelle.it';
const THEME = process.env.DECK_THEME ?? 'dark';
const ID = process.env.DECK_ID;
const PW = process.env.DECK_PW;
const OUT = 'C:/Projects/poker-ranges/presentation/shots/';
mkdirSync(OUT, { recursive: true });
if (!ID || !PW) { console.error('Mancano DECK_ID/DECK_PW'); process.exit(1); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
ctx.addInitScript((t) => localStorage.setItem('bff-theme', t), THEME);
// Deck = esperienza utente: nascondi la voce "Admin" dell'header.
const HIDE_ADMIN = '.header__link--admin{display:none!important;}';
const page = await ctx.newPage();
const log = (m) => console.log(m);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function shot(file) { await page.screenshot({ path: `${OUT}${file}` }); log(`✓ ${file}`); }
async function scrollBy(y) { await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), y); await page.waitForTimeout(1400); }
async function go(path, waitFor, wait = 2500) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 35000 }).catch(() => log(`  (selector ${waitFor} non trovato su ${path}; url=${page.url()})`));
  await page.addStyleTag({ content: HIDE_ADMIN }).catch(() => {});
  await page.waitForTimeout(wait);
}

// ---- LOGIN (Render free tier: il primo /auth/refresh può essere lento) ----
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('#identifier', ID);
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 45000 }).catch(() => {});
await page.waitForSelector('text=Esci', { timeout: 45000 }).catch(() => log('  (header "Esci" non trovato — login forse fallito)'));
await page.waitForTimeout(1500);
const role = await page.evaluate(() => document.body.innerText.includes('Esci'));
log(`login ${role ? 'OK' : 'INCERTO'} — url=${page.url()}`);

// ---- TABELLE GTO (cuore del prodotto) ----
await go('/tabelle', '.rg__cell', 3500);
const cells = await page.locator('.rg__cell').count();
log(`  matrice: ${cells} celle`);
await shot('gated-01-tabelle-root.png');
// dettaglio mano AA (hover → pannello EV/freq)
await page.locator('button[aria-label^="AA:"]').hover().catch(() => {});
await page.waitForTimeout(1200);
await shot('gated-02-tabelle-hand-AA.png');
// naviga dopo un Raise per mostrare timeline + nodo figlio
await page.locator('.pf__action', { hasText: 'Raise' }).first().click().catch(() => {});
await page.waitForTimeout(2500);
await shot('gated-03-tabelle-after-raise.png');

// ---- ALLENAMENTO (drill) ----
await go('/allenamento', '.dc__head', 3000);
await shot('gated-04-allenamento-config.png');
await scrollBy(700);
await shot('gated-05-allenamento-config2.png');
// avvia una sessione → tavolo di gioco (carte + azioni) e feedback GTO
await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await page.locator('button.btn--primary', { hasText: "Inizia l'allenamento" }).click().catch(() => log('  (start drill non cliccato)'));
await page.waitForURL(/allenamento\/sessione/, { timeout: 20000 }).catch(() => {});
await page.waitForSelector('app-poker-table', { timeout: 35000 }).catch(() => log('  (poker-table non trovato)'));
await page.waitForSelector('.dr__action', { timeout: 20000 }).catch(() => {});
await page.addStyleTag({ content: HIDE_ADMIN }).catch(() => {});
await page.waitForTimeout(1800);
await shot('gated-12-allenamento-tavolo.png');
await page.locator('.dr__action').first().click().catch(() => {});
await page.waitForSelector('app-drill-feedback', { timeout: 20000 }).catch(() => log('  (feedback non trovato)'));
await page.waitForTimeout(1800);
await shot('gated-13-allenamento-feedback.png');

// ---- LEZIONI ----
await go('/lezioni', '.section-head', 3500);
await shot('gated-06-lezioni.png');
await scrollBy(750);
await shot('gated-07-lezioni-more.png');

// ---- DOCS ----
await go('/docs', '.section-head', 3500);
await shot('gated-08-docs.png');

// ---- LIVE ----
await go('/live', '.section-head', 3000);
await shot('gated-09-live.png');

// ---- ACCOUNT ----
await go('/account', '.account__head', 3000);
await shot('gated-10-account.png');
await scrollBy(700);
await shot('gated-11-account-more.png');

await browser.close();
log(errors.length ? 'PAGEERROR: ' + errors.join(' | ') : 'FATTO — aree riservate (nessun errore di pagina)');
