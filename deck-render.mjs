// Renderizza un deck HTML in PDF (una slide 16:9 per pagina).
// Uso: node deck-render.mjs <inputHtml> <outputPdf> [min]
//   min = riscrive i path immagine su shots-min/*.jpg (versione compressa)
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const base = 'C:/Projects/poker-ranges/presentation/';
const inHtml = process.argv[2] ?? base + 'deck.html';
const outPdf = process.argv[3] ?? base + 'Best-Fish-Forever-Overview.pdf';
const mode = process.argv[4];

let htmlPath = inHtml;
if (mode === 'min') {
  const html = readFileSync(inHtml, 'utf8').split('shots/').join('shots-min/').split('.png').join('.jpg');
  htmlPath = inHtml.replace(/\.html$/, '.min.html');
  writeFileSync(htmlPath, html);
}
const fileUrl = 'file:///' + htmlPath.replace(/\\/g, '/');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts?.ready);
await page.waitForTimeout(500);
await page.pdf({ path: outPdf, width: '1280px', height: '720px', printBackground: true });
await browser.close();
console.log('PDF:', outPdf);
