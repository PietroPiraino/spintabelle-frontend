// Renderizza un HTML in PDF A4 con Playwright. Tooling locale (untracked).
// Uso: node render-pdf.mjs <input.html> <output.pdf>
import { chromium } from 'playwright';
const IN = process.argv[2];
const OUT = process.argv[3];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///' + IN.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(400);
await page.pdf({ path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('OK', OUT);
