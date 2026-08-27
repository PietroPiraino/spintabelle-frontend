// Poll finché /chi-siamo mostra "Exivezzz" (deploy live).
import { chromium } from 'playwright';
const BASE = 'https://spintabelle.it';
const DEADLINE = Date.now() + 10 * 60 * 1000;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let attempt = 0;
while (Date.now() < DEADLINE) {
  attempt++;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let res = { err: 'n/a' };
  try {
    await page.goto(`${BASE}/chi-siamo`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);
    const txt = await page.evaluate(() => document.body.innerText);
    res = { triple: txt.includes('Exivezzz'), doubleOnly: /Exivezz(?!z)/.test(txt) };
  } catch (e) { res = { err: String(e).slice(0, 70) }; }
  await ctx.close();
  console.log(`[${new Date().toISOString().slice(11, 19)}] #${attempt}`, JSON.stringify(res));
  if (res.triple && !res.doubleOnly) { console.log('LIVE ✓ Exivezzz'); await browser.close(); process.exit(0); }
  await sleep(30000);
}
console.log('TIMEOUT'); await browser.close(); process.exit(1);
