import { chromium } from 'playwright';
const IN = 'file:///C:/Projects/poker-ranges/presentation/live-overlay/guida-artifact.html';
const OUT = 'C:/Projects/poker-ranges/presentation/live-overlay/out/';
const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
for (const scheme of ['dark', 'light']) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1, colorScheme: scheme });
  await page.goto(IN, { waitUntil: 'networkidle', timeout: 60000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}guide-${scheme}.png`, fullPage: true });
  console.log('OK guide-' + scheme + '.png');
  await page.close();
}
await browser.close();
