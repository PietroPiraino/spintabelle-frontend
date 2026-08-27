// Verifica visiva: screenshotta ogni .slide di un deck HTML.
// Uso: node deck-verify.mjs [inputHtml] [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const IN = process.argv[2] ?? 'C:/Projects/poker-ranges/presentation/deck.html';
const OUT = process.argv[3] ?? 'C:/Projects/poker-ranges/presentation/verify/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.goto('file:///' + IN.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 60000 });
const slides = page.locator('.slide');
const n = await slides.count();
console.log('slides:', n);
for (let i = 0; i < n; i++) {
  await slides.nth(i).screenshot({ path: `${OUT}slide-${String(i + 1).padStart(2, '0')}.png` });
}
await browser.close();
console.log('done', OUT);
