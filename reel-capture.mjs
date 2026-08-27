// Cattura frame-accurate del reel animato (HTML timeline -> PNG sequenza).
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
const OUT = 'C:/Projects/poker-ranges/presentation/reel-frames/';
try { rmSync(OUT, { recursive: true, force: true }); } catch {}
mkdirSync(OUT, { recursive: true });
const fps = 30;
const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file:///C:/Projects/poker-ranges/presentation/reel-video.html', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const dur = await page.evaluate(() => window.__DURATION);
const n = Math.ceil(dur * fps);
const stage = page.locator('#stage');
console.log('duration', dur.toFixed(2), 's ->', n, 'frames @', fps, 'fps');
for (let i = 0; i < n; i++) {
  const t = i / fps;
  await page.evaluate((tt) => window.seek(tt), t);
  await stage.screenshot({ path: `${OUT}f-${String(i).padStart(5, '0')}.png` });
  if (i % 60 === 0) console.log('  frame', i);
}
await browser.close();
console.log('DONE', n, 'frames in', OUT);
