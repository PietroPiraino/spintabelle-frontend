// Screenshot MOBILE (iPhone 13) delle pagine chiave per il deck.
// Uso: DECK_ID=... DECK_PW=... node deck-shots-mobile.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.DECK_BASE ?? 'https://spintabelle.it';
const THEME = process.env.DECK_THEME ?? 'dark';
const ID = process.env.DECK_ID, PW = process.env.DECK_PW;
const OUT = 'C:/Projects/poker-ranges/presentation/shots/';
mkdirSync(OUT, { recursive: true });
if (!ID || !PW) { console.error('Mancano DECK_ID/DECK_PW'); process.exit(1); }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
ctx.addInitScript((t) => localStorage.setItem('bff-theme', t), THEME);
const HIDE_ADMIN = '.header__link--admin{display:none!important;}';
const page = await ctx.newPage();
const log = (m) => console.log(m);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function shot(file) { await page.addStyleTag({ content: HIDE_ADMIN }).catch(() => {}); await page.screenshot({ path: `${OUT}${file}` }); log(`✓ ${file}`); }
async function go(path, waitFor, wait = 2500) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 35000 }).catch(() => log(`  (selector ${waitFor} non trovato su ${path})`));
  await page.waitForTimeout(wait);
}

// home (hero) — non serve login
await go('/', 'canvas.hero3d__canvas', 4000);
await shot('m-01-home.png');

// login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('#identifier', ID);
await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);
log('login mobile fatto — url=' + page.url());

// tabelle
await go('/tabelle', '.rg__cell', 3500);
await shot('m-02-tabelle.png');

// allenamento config
await go('/allenamento', '.dc__head', 3000);
await shot('m-03-allenamento-config.png');
// avvia sessione → tavolo
await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await page.locator('button.btn--primary', { hasText: "Inizia l'allenamento" }).click().catch(() => log('  (start drill non cliccato)'));
await page.waitForURL(/allenamento\/sessione/, { timeout: 20000 }).catch(() => {});
await page.waitForSelector('app-poker-table', { timeout: 35000 }).catch(() => log('  (poker-table non trovato)'));
await page.waitForSelector('.dr__action', { timeout: 20000 }).catch(() => {});
await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(2000);
await shot('m-04-allenamento-tavolo.png');

// lezioni
await go('/lezioni', '.section-head', 3500);
await shot('m-05-lezioni.png');

// abbonati
await go('/abbonati', null, 5000);
await shot('m-06-abbonati.png');

// docs
await go('/docs', '.section-head', 3000);
await shot('m-07-docs.png');

await browser.close();
log(errors.length ? 'PAGEERROR: ' + errors.join(' | ') : 'FATTO — mobile');
