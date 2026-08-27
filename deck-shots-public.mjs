// Cattura screenshot delle pagine PUBBLICHE del sito live per il deck investitori.
// Uso: node deck-shots-public.mjs
// Output: C:\Projects\poker-ranges\presentation\shots\*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.DECK_BASE ?? 'https://spintabelle.it';
const THEME = process.env.DECK_THEME ?? 'dark';
const OUT = 'C:/Projects/poker-ranges/presentation/shots/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
ctx.addInitScript((t) => localStorage.setItem('bff-theme', t), THEME);
const page = await ctx.newPage();
const log = (m) => console.log(m);

async function go(path, { wait = 2500, waitFor } = {}) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 25000 }).catch(() => log(`  (selector ${waitFor} non trovato)`));
  await page.waitForTimeout(wait);
}

async function shotViewport(file) {
  await page.screenshot({ path: `${OUT}${file}` });
  log(`✓ ${file}`);
}

async function scrollToSel(sel) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return;
    const r = el.getBoundingClientRect();
    scrollTo({ top: scrollY + r.top - 80, behavior: 'instant' });
  }, sel);
  await page.waitForTimeout(1800);
}

async function scrollBy(y) {
  await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), y);
  await page.waitForTimeout(1500);
}

// ---- 1) LANDING / HERO 3D ----
await go('/', { waitFor: 'canvas.hero3d__canvas', wait: 4000 });
await shotViewport('public-01-landing-hero.png');
await scrollBy(820);
await shotViewport('public-02-landing-valueprops.png');
await scrollBy(1700);
await shotViewport('public-03-landing-offer.png');
await scrollBy(2600);
await shotViewport('public-04-landing-community.png');

// ---- 2) CHI SIAMO (banco particellare) ----
await go('/chi-siamo', { wait: 4000 });
await shotViewport('public-05-chisiamo-top.png');
await scrollBy(900);
await shotViewport('public-06-chisiamo-coach.png');
await scrollBy(1900);
await shotViewport('public-07-chisiamo-coach2.png');

// ---- 3) ABBONATI (mascotte 3D + prezzi) ----
await go('/abbonati', { wait: 5000 });
await shotViewport('public-08-abbonati-top.png');
await scrollBy(700);
await shotViewport('public-09-abbonati-cards.png');
await scrollBy(1500);
await shotViewport('public-10-abbonati-more.png');

// ---- 4) NEWS ----
await go('/news', { wait: 3500 });
await shotViewport('public-11-news.png');

// ---- 5) AFFILIAZIONI ----
await go('/affiliazioni', { wait: 2500 });
await shotViewport('public-12-affiliazioni.png');

await browser.close();
log('FATTO — pagine pubbliche');
