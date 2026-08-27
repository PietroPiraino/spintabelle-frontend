// Cattura i frame della timeline reel e li salva come PNG sequenziali.
import { chromium } from 'playwright';
import { rmSync, mkdirSync } from 'node:fs';
const P = 'C:/Projects/poker-ranges/presentation/';
const FRAMES = P + 'video/frames/';
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const FPS = 30, TOTAL = 21.0, N = Math.round(FPS * TOTAL);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto('file:///' + (P + 'video-reel.html'), { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForFunction(() => window.__ready && [...document.images].every((i) => i.complete && i.naturalWidth > 0), { timeout: 30000 });
const clip = { x: 0, y: 0, width: 1080, height: 1920 };
for (let i = 0; i < N; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  await page.screenshot({ path: `${FRAMES}frame-${String(i).padStart(4, '0')}.png`, clip });
}
await browser.close();
console.log('frame catturati:', N);
