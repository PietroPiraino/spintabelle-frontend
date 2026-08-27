// Ri-cattura le 2 schermate che mostrano il nome coach: chi-siamo + lezioni.
import { chromium } from 'playwright';
const BASE = 'https://spintabelle.it';
const OUT = 'C:/Projects/poker-ranges/presentation/shots/';
const ID = process.env.DECK_ID, PW = process.env.DECK_PW;
const HIDE = '.header__link--admin{display:none!important;}';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
ctx.addInitScript(() => localStorage.setItem('bff-theme', 'dark'));
const page = await ctx.newPage();

// public-06 — chi-siamo (pannello coach Exivezzz), stessa inquadratura di prima
await page.goto(`${BASE}/chi-siamo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4000);
await page.evaluate(() => scrollTo({ top: 900, behavior: 'instant' }));
await page.waitForTimeout(2200);
await page.screenshot({ path: OUT + 'public-06-chisiamo-coach.png' });
console.log('✓ public-06 chi-siamo');

// login → gated-06 lezioni (titoli/tag aggiornati nel DB)
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.fill('#identifier', ID); await page.fill('input[type="password"]', PW);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes('login'), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2000);
await page.goto(`${BASE}/lezioni`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.section-head', { timeout: 35000 }).catch(() => {});
await page.addStyleTag({ content: HIDE }).catch(() => {});
await page.waitForTimeout(3500);
await page.screenshot({ path: OUT + 'gated-06-lezioni.png' });
console.log('✓ gated-06 lezioni');

await browser.close();
