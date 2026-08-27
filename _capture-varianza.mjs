// Cattura screenshot REALI e CONFORMI dal simulatore di varianza live.
// Solo elementi senza testo vietato: grafico a ventaglio + sezione "Rischio di rovina".
// (L'hero contiene "Spin&Go/Twister" e le card money hanno €: ESCLUSI.)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = 'C:/Projects/poker-ranges/presentation/Simulatore-Varianza/screens/';
mkdirSync(OUT, { recursive: true });

const URL = 'https://bestfishforever.it/simulatore-varianza'
  + '?modalita=money&games=8000&sim=2000&edge=40&buyin=10&bankroll=30&seed=7';

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({
  viewport: { width: 860, height: 1600 },
  deviceScaleFactor: 2,
});
// Boota in tema Notte (dark) — l'anti-flash script legge bff-theme dal localStorage.
await page.addInitScript(() => localStorage.setItem('bff-theme', 'dark'));

console.log('→ goto', URL);
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('button.vz__run', { timeout: 30000 });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(600);

async function runAndWait(label) {
  await page.click('button.vz__run');
  await page.waitForFunction(() => {
    const btn = document.querySelector('button.vz__run');
    const cv = document.querySelector('app-varianza-graph canvas');
    return btn && !btn.disabled && cv && cv.width > 0;
  }, { timeout: 60000 });
  await page.waitForTimeout(1200);
  console.log('✓ run done:', label);
}

// --- RUN 1 (seed 7) ---
await runAndWait('run1');
await page.locator('app-varianza-graph').screenshot({ path: OUT + 'fan-1.png' });
console.log('✓ fan-1.png');
await page.locator('section.vz__bust').screenshot({ path: OUT + 'bust.png' });
console.log('✓ bust.png');

// --- RUN 2 (seed random → ventaglio diverso) ---
await runAndWait('run2');
await page.locator('app-varianza-graph').screenshot({ path: OUT + 'fan-2.png' });
console.log('✓ fan-2.png');

await browser.close();
console.log('DONE');
