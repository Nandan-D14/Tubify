import { chromium } from 'playwright-core';

// Browser-mode smoke test of the email/password login dialog (needs vite dev on 1420).
const OUT = 'C:/Users/nanda/OneDrive/Desktop/Tubify/e2e/shots/';
const errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

await page.goto('http://localhost:1420/');
await page.waitForTimeout(1500);
await page.click('.globalbar .avatar');
await page.getByText('Log in to sync').click();
await page.fill('.modal.auth input[type=email]', 'nobody@example.com');
await page.fill('.modal.auth input[type=password]', 'wrongpass123');
await page.click('.modal.auth .pill-btn');
await page.waitForSelector('.auth-err', { timeout: 10000 }).catch(() => {});
console.log('error shown:', await page.locator('.auth-err').textContent().catch(() => '(none)'));
await page.screenshot({ path: `${OUT}auth-dialog.png` });
console.log(errors.length ? errors.join('\n') : 'no page errors');
await browser.close();
