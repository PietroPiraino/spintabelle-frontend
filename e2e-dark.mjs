import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:4200', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'dk1-light.png' });
// toggle al tema scuro
await page.click('.header__theme');
await page.waitForTimeout(800);
await page.screenshot({ path: 'dk2-dark-landing.png' });
console.log('[e2e] data-theme:', await page.evaluate(() => document.documentElement.dataset.theme));
console.log('[e2e] localStorage:', await page.evaluate(() => localStorage.getItem('bff-theme')));
// persistenza al reload
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
console.log('[e2e] dopo reload:', await page.evaluate(() => document.documentElement.dataset.theme));
// login + lezioni in dark
await page.goto('http://localhost:4200/login');
await page.waitForTimeout(600);
await page.screenshot({ path: 'dk3-dark-login.png' });
await page.fill('#email', 'altro@spintabelle.it');
await page.fill('#password', 'password123');
await page.click('button[type=submit]');
await page.waitForURL('http://localhost:4200/');
await page.goto('http://localhost:4200/lezioni');
await page.waitForSelector('.lesson-card');
await page.waitForTimeout(1500);
await page.screenshot({ path: 'dk4-dark-lezioni.png' });
await browser.close();
console.log('[e2e] done');
