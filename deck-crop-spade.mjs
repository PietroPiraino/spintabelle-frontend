// Ritaglia l'emblema a picca (Exivezzz) da public-06 -> shots/exivezzz-spade.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'C:/Projects/poker-ranges/presentation/shots/public-06-chisiamo-coach.png';
const OUT = 'C:/Projects/poker-ranges/presentation/shots/exivezzz-spade.png';
const b64 = readFileSync(SRC).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const sx = Math.round(W * 0.05), sy = Math.round(H * 0.22);
  const sw = Math.round(W * 0.40), sh = Math.round(H * 0.62);
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL('image/png');
}, b64);
writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('OK', OUT);
