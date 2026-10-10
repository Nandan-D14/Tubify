// Search bar dropdown: recent picks when empty, library matches while typing, remove + keyboard pick.
import { chromium } from 'playwright-core';

const OUT = 'C:/Users/nanda/OneDrive/Desktop/Tubify/e2e/shots/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const t = (id, title, artist) => ({ id, title, artist, duration: 200 });
const tracks = [t('rRjtTx49hkc', 'Hungry Cheetah', 'Thaman S'), t('kJQP7kiw5Fk', 'Despacito', 'Luis Fonsi'), t('JGwWNGJdvx8', 'Shape of You', 'Ed Sheeran'), t('fJ9rUzIMcZQ', 'Bohemian Rhapsody', 'Queen')];
const seed = {
  version: 1,
  state: {
    queue: [tracks[0]], index: 0, panel: 'now', liked: tracks.slice(0, 2),
    playlists: [{ id: 'p1', name: 'Popular Hollywood songs', tracks }, { id: 'p2', name: 'Crew Girl', tracks: tracks.slice(1) }],
    hits: [
      { kind: 'playlist', id: 'p1' }, { kind: 'track', track: tracks[0] }, { kind: 'artist', name: 'Queen', id: tracks[3].id },
      { kind: 'query', q: 'brazilian phonk' }, { kind: 'playlist', id: 'gone' }, { kind: 'track', track: tracks[2] },
    ],
  },
};
await page.addInitScript((s) => !localStorage.getItem('tubify') && localStorage.setItem('tubify', JSON.stringify(s)), seed);
await page.goto('http://localhost:1420/');
await page.waitForTimeout(1200);
const rows = () => page.locator('.search-drop .sd-title').allInnerTexts();

await page.click('.globalbar .search-pill input');
await page.waitForTimeout(500);
console.log('recent', await rows());
await page.screenshot({ path: `${OUT}sd-recent.png` });

await page.locator('.sd-row').nth(1).hover();
await page.locator('.sd-row').nth(1).locator('.sd-x').click();
console.log('after remove', await rows(), 'focused', await page.evaluate(() => document.activeElement?.tagName));

await page.keyboard.type('que');
await page.waitForTimeout(600);
console.log('typed', await rows());
await page.screenshot({ path: `${OUT}sd-typed.png` });

await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
await page.waitForTimeout(600);
console.log('picked ->', page.url(), 'open', await page.locator('.search-drop').count());

await page.mouse.click(600, 400);
await page.click('.globalbar .search-pill input');
await page.keyboard.press('Escape');
console.log('esc open', await page.locator('.search-drop').count());
console.log('errors', errors);
await browser.close();
