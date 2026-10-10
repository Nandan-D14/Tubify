// Expanded Now Playing view: panel → expand → tabs → collapse.
import { chromium } from 'playwright-core';

const OUT = 'C:/Users/nanda/OneDrive/Desktop/Tubify/e2e/shots/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const track = { id: 'rRjtTx49hkc', title: 'B4 B4', artist: 'Davido, Mayorkun, FOLA', duration: 186 };
await page.addInitScript((t) => {
  if (!localStorage.getItem('tubify'))
    localStorage.setItem('tubify', JSON.stringify({ version: 1, state: { queue: [t], index: 0, context: { key: 'x', name: 'VIRAL SONGS | Trending Now' }, panel: 'now' } }));
}, track);
await page.goto('http://localhost:1420/');
await page.waitForTimeout(1500);
const st = () => page.evaluate(() => ({ xp: !!document.querySelector('.xp'), panel: document.querySelector('.rpanel')?.className, side: getComputedStyle(document.querySelector('.sidebar') ?? document.body).display }));

await page.click('[title="Expand Now Playing view"]');
await page.waitForTimeout(800);
console.log('expanded', await st());
await page.screenshot({ path: `${OUT}xp-now.png` });
await page.locator('.xp-body').evaluate((e) => e.scrollTo(0, 400));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}xp-cards.png` });
for (const t of ['Video', 'About the artist', 'Lyrics']) {
  await page.click(`.xp-tabs [title="${t}"]`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}xp-${t.split(' ')[0].toLowerCase()}.png` });
}
await page.click('[title="Collapse"]');
await page.waitForTimeout(600);
console.log('collapsed', await st());
await page.click('[title="Expand lyrics"]');
await page.waitForTimeout(400);
console.log('lyrics expand', await st());
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
console.log('esc', await st());
console.log('errors', errors);
await browser.close();
