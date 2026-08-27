// Comprime gli screenshot del deck: PNG -> JPEG ridimensionato (via canvas Chromium).
// Desktop max 1500px, mobile (m-*) max 760px, qualità 0.82. Output: presentation/shots-min/
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';

const SRC = 'C:/Projects/poker-ranges/presentation/shots/';
const OUT = 'C:/Projects/poker-ranges/presentation/shots-min/';
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.png'));
const browser = await chromium.launch();
const page = await browser.newPage();

let totalIn = 0, totalOut = 0;
for (const f of files) {
  const b64 = readFileSync(SRC + f).toString('base64');
  const maxW = f.startsWith('m-') ? 760 : 1500;
  const dataUrl = await page.evaluate(async ({ b64, maxW, q }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  }, { b64, maxW, q: 0.82 });
  const out = f.replace(/\.png$/i, '.jpg');
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(OUT + out, buf);
  const inKb = statSync(SRC + f).size, outKb = buf.length;
  totalIn += inKb; totalOut += outKb;
  console.log(`${f} ${(inKb / 1024).toFixed(0)}KB -> ${out} ${(outKb / 1024).toFixed(0)}KB`);
}
await browser.close();
console.log(`TOT ${(totalIn / 1048576).toFixed(1)}MB -> ${(totalOut / 1048576).toFixed(1)}MB`);
