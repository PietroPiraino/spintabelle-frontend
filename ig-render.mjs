// Renderizza ogni post/storia di un HTML IG in PNG nativo.
// Uso: node ig-render.mjs <html> <selector> <prefix> <vw> <vh>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const IN = process.argv[2];
const SEL = process.argv[3];
const PREFIX = process.argv[4];
const VW = Number(process.argv[5] ?? 1080);
const VH = Number(process.argv[6] ?? 1920);
const OUT = 'C:/Projects/poker-ranges/presentation/ig/';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
await page.goto('file:///' + IN.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts?.ready);
// La slide ha width fissa (es. 1080) ma il body ha padding+flex: senza questo
// flex-shrink la rimpicciolisce (es. a 1000px). flex:none preserva la width reale.
await page.addStyleTag({ content: '.slide{flex:0 0 auto !important}' });
await page.waitForTimeout(400);
const els = page.locator(SEL);
const n = await els.count();
console.log(`${PREFIX}: ${n} elementi`);
for (let i = 0; i < n; i++) {
  const f = `${OUT}${PREFIX}-${String(i + 1).padStart(2, '0')}.png`;
  await els.nth(i).screenshot({ path: f });
  console.log('✓ ' + f);
}
await browser.close();
