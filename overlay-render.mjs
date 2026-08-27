// Render an overlay HTML element to a native-resolution PNG.
// Deve stare in frontend/ per risolvere 'playwright' da frontend/node_modules.
// Uso: node overlay-render.mjs <html> <selector> <out.png> [transparent] [vw] [vh]
//   transparent = "true"  -> omitBackground (per l'overlay reale, fori trasparenti)
//               = "false" -> cattura lo sfondo (per l'anteprima con mock dietro)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const IN = process.argv[2];
const SEL = process.argv[3] ?? '.overlay';
const OUT = process.argv[4] ?? 'out.png';
const TRANSPARENT = (process.argv[5] ?? 'true') === 'true';
const VW = Number(process.argv[6] ?? 1920);
const VH = Number(process.argv[7] ?? 1080);

mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ args: ['--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
await page.goto('file:///' + IN.replace(/\\/g, '/'), { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(() => document.fonts?.ready);
await page.addStyleTag({ content: `${SEL}{flex:0 0 auto !important}` });
await page.waitForTimeout(400);

const count = await page.locator(SEL).count();
if (count === 0) { console.error('NESSUN elemento per il selettore ' + SEL); process.exit(2); }
await page.locator(SEL).first().screenshot({ path: OUT, omitBackground: TRANSPARENT });
console.log('OK ' + OUT + (TRANSPARENT ? ' (trasparente)' : ' (con sfondo)'));
await browser.close();
