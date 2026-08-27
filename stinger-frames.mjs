// Cattura N frame PNG trasparenti dello stinger (guidato da window.render(p)).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const IN = 'file:///C:/Projects/poker-ranges/presentation/live-overlay/stinger.html';
const OUTDIR = 'C:/Projects/poker-ranges/presentation/live-overlay/out/stinger/';
const N = Number(process.argv[2] ?? 48);
mkdirSync(OUTDIR, { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(IN, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts?.ready);
const stg = page.locator('.stg');
for (let i = 0; i < N; i++) {
  const p = i / (N - 1);
  await page.evaluate((p) => window.render(p), p);
  await page.waitForTimeout(16);
  const f = `${OUTDIR}frame-${String(i).padStart(3, '0')}.png`;
  await stg.screenshot({ path: f, omitBackground: true });
}
console.log(`OK ${N} frame in ${OUTDIR}`);
await browser.close();
