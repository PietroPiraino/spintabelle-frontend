// Renderizza card (opache) e overlay (trasparenti) per il reel.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const P = 'C:/Projects/poker-ranges/presentation/';
const OUT = P + 'video/';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

// cards (opache)
await page.goto('file:///' + (P + 'video-cards.html'), { waitUntil: 'networkidle', timeout: 60000 });
const cards = page.locator('.card');
const names = ['intro', 'outro'];
for (let i = 0; i < await cards.count(); i++) {
  await cards.nth(i).screenshot({ path: `${OUT}${names[i]}.png` });
  console.log('✓ ' + names[i]);
}
// overlays (trasparenti)
await page.goto('file:///' + (P + 'video-overlays.html'), { waitUntil: 'networkidle', timeout: 60000 });
const ovs = page.locator('.ov');
for (let i = 0; i < await ovs.count(); i++) {
  await ovs.nth(i).screenshot({ path: `${OUT}ov-${i + 1}.png`, omitBackground: true });
  console.log('✓ ov-' + (i + 1));
}
await browser.close();
