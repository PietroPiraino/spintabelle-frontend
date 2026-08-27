// Screenshot MOBILE del canale YouTube BFF. Gestisce il banner consenso.
// Uso: node deck-shots-youtube.mjs
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'C:/Projects/poker-ranges/presentation/shots/';
mkdirSync(OUT, { recursive: true });
const URL = 'https://www.youtube.com/@Best_Fish_Forever';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'it-IT' });
// prova a pre-accettare il consenso così da evitare l'interstitial
await ctx.addCookies([
  { name: 'SOCS', value: 'CAESEwgDEgk0ODE3Nzk3MjQaAml0IAEaBgiA_LyaBg', domain: '.youtube.com', path: '/' },
]);
const page = await ctx.newPage();
const log = (m) => console.log(m);

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

// se siamo sulla pagina di consenso, clicca un bottone
const consentBtn = page.getByRole('button', { name: /Accetta tutto|Accept all|Rifiuta tutto|Reject all|Acconsenti/i }).first();
if (await consentBtn.count().catch(() => 0)) {
  await consentBtn.click().catch(() => log('  (consenso non cliccato)'));
  await page.waitForTimeout(3500);
}
// torna al canale se siamo stati reindirizzati
if (!page.url().includes('youtube.com/@') && !page.url().includes('/channel/')) {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
}

// attende l'header del canale (nome / iscritti)
await page.waitForSelector('text=/iscritti|subscribers/i', { timeout: 25000 }).catch(() => log('  (contatore iscritti non trovato)'));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}m-08-youtube.png` });
log('✓ m-08-youtube.png — url=' + page.url());

await browser.close();
