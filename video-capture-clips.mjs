// Cattura 3 clip reali verticali del sito (tabelle, allenamento, lezioni).
import { chromium } from 'playwright';
import { mkdirSync, renameSync } from 'node:fs';
const BASE = 'https://spintabelle.it';
const ID = process.env.DECK_ID, PW = process.env.DECK_PW;
const RAW = 'C:/Projects/poker-ranges/presentation/video/raw/';
mkdirSync(RAW, { recursive: true });
const VP = { width: 540, height: 960 };
const REC = { dir: RAW, size: { width: 1080, height: 1920 } };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });

// login una volta -> storageState
const c0 = await browser.newContext({ viewport: VP });
const p0 = await c0.newPage();
await p0.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await p0.fill('#identifier', ID); await p0.fill('input[type="password"]', PW);
await p0.click('button[type="submit"]');
await p0.waitForURL((u) => !u.pathname.includes('login'), { timeout: 45000 }).catch(() => {});
await p0.waitForTimeout(2500);
const storageState = await c0.storageState();
await c0.close();
console.log('login ok');

const sleep = (p, ms) => p.waitForTimeout(ms);
async function smoothScroll(page, total, steps) {
  for (let i = 0; i < steps; i++) { await page.evaluate((y) => scrollBy({ top: y, behavior: 'instant' }), total / steps); await page.waitForTimeout(140); }
}

async function clip(name, fn) {
  const ctx = await browser.newContext({ storageState, viewport: VP, deviceScaleFactor: 2, recordVideo: REC });
  ctx.addInitScript(() => localStorage.setItem('bff-theme', 'dark'));
  const page = await ctx.newPage();
  await fn(page);
  const vid = page.video();
  await ctx.close();
  const p = await vid.path();
  renameSync(p, RAW + name + '.webm');
  console.log('✓ clip', name);
}

// TABELLE: scroll dolce alla matrice + tap su una mano
await clip('tabelle', async (page) => {
  await page.goto(`${BASE}/tabelle`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.rg__cell', { timeout: 35000 }).catch(() => {});
  await sleep(page, 1200);
  await smoothScroll(page, 760, 14);
  await sleep(page, 600);
  await page.locator('button[aria-label^="AA:"]').first().click().catch(() => {});
  await sleep(page, 1800);
});

// ALLENAMENTO: avvia sessione -> tavolo -> rispondi -> feedback
await clip('allenamento', async (page) => {
  await page.goto(`${BASE}/allenamento`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.dc__head', { timeout: 35000 }).catch(() => {});
  await sleep(page, 1400);
  await page.locator('button.btn--primary', { hasText: "Inizia l'allenamento" }).click().catch(() => {});
  await page.waitForSelector('app-poker-table', { timeout: 35000 }).catch(() => {});
  await page.waitForSelector('.dr__action', { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await sleep(page, 2200);
  await page.locator('.dr__action').first().click().catch(() => {});
  await page.waitForSelector('app-drill-feedback', { timeout: 20000 }).catch(() => {});
  await sleep(page, 2200);
});

// LEZIONI: scroll dolce lungo la griglia
await clip('lezioni', async (page) => {
  await page.goto(`${BASE}/lezioni`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.section-head', { timeout: 35000 }).catch(() => {});
  await sleep(page, 1400);
  await smoothScroll(page, 1100, 22);
  await sleep(page, 500);
});

await browser.close();
console.log('FATTO clip');
