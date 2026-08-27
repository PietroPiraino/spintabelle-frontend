// Poll del sito live finché la fix "Studio guidato" (no ICM) non è deployata.
import { chromium } from 'playwright';
const BASE = 'https://spintabelle.it';
const DEADLINE = Date.now() + 10 * 60 * 1000;
const browser = await chromium.launch();

async function check() {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('text=Studio guidato', { timeout: 30000 });
    await page.waitForTimeout(800);
    const txt = await page.evaluate(() => document.body.innerText);
    const hasPostflop = txt.includes('postflop');
    const hasICM = /spot ICM/.test(txt);
    return { hasPostflop, hasICM };
  } catch (e) {
    return { error: String(e).slice(0, 80) };
  } finally {
    await ctx.close();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let attempt = 0;
while (Date.now() < DEADLINE) {
  attempt++;
  const r = await check();
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] tentativo ${attempt}:`, JSON.stringify(r));
  if (r.hasPostflop && !r.hasICM) {
    console.log('LIVE ✓ — fix deployata');
    await browser.close();
    process.exit(0);
  }
  await sleep(30000);
}
console.log('TIMEOUT — non ancora live dopo 10 min');
await browser.close();
process.exit(1);
