// Ritaglia la zona "carte" dall'hero (niente header/testo) -> shots/hero-cards.png
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const SRC = 'C:/Projects/poker-ranges/presentation/shots/public-01-landing-hero.png';
const OUT = 'C:/Projects/poker-ranges/presentation/shots/hero-cards.png';
const b64 = readFileSync(SRC).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight; // atteso 2880x1800
  // ritaglio porzione destra con le carte, evita header (alto) e testo (sinistra)
  const sx = Math.round(W * 0.44), sy = Math.round(H * 0.10);
  const sw = W - sx, sh = Math.round(H * 0.86) - sy;
  const c = document.createElement('canvas'); c.width = sw; c.height = sh;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return c.toDataURL('image/png');
}, b64);
writeFileSync(OUT, Buffer.from(dataUrl.split(',')[1], 'base64'));
await browser.close();
console.log('OK', OUT);
