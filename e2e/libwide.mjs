// Expanded Your Library: list → wide grid → collapse, at a tight and a big window size.
import { chromium } from 'playwright-core';

const OUT = 'C:/Users/nanda/OneDrive/Desktop/Tubify/e2e/shots/';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const t = (id, title) => ({ id, title, artist: 'Artist ' + title, duration: 200 });
const tracks = ['rRjtTx49hkc', 'kJQP7kiw5Fk', 'JGwWNGJdvx8', 'fJ9rUzIMcZQ', 'OPf0YbXqDm0'].map((id, i) => t(id, 'Song ' + i));
const seed = {
  version: 1,
  state: {
    queue: [tracks[0]], index: 0, context: { key: 'playlist:p1', name: 'FEEL GOOD' }, panel: 'now', liked: tracks.slice(0, 2),
    playlists: ['FEEL GOOD', 'best office vibes', 'Syco Phonk', 'My Playlist #1', 'KANNADA BOOST'].map((name, i) => ({ id: 'p' + i, name, tracks: i % 2 ? tracks.slice(i) : tracks })),
  },
};
for (const [w, h] of [[870, 670], [1400, 850]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((s) => !localStorage.getItem('tubify') && localStorage.setItem('tubify', JSON.stringify(s)), seed);
  await page.goto('http://localhost:1420/');
  await page.waitForTimeout(1200);
  const st = () => page.evaluate(() => ({
    wide: document.querySelector('.app')?.classList.contains('lib-wide'),
    main: getComputedStyle(document.querySelector('.main')).display,
    rp: document.querySelector('.rpanel')?.className,
    sb: Math.round(document.querySelector('.sidebar').getBoundingClientRect().width),
  }));
  if (await page.locator('.sidebar.collapsed').count()) await page.click('.lib-toggle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}lw-${w}-list.png` });
  await page.click('[title="Expand Your Library"]');
  await page.waitForTimeout(600);
  console.log(w, 'wide', await st());
  await page.screenshot({ path: `${OUT}lw-${w}-wide.png` });
  await page.click('[title="Reduce Your Library"]');
  await page.waitForTimeout(500);
  console.log(w, 'reduced', await st());
  await page.click('[title="Expand Your Library"]');
  await page.waitForTimeout(400);
  await page.locator('.lib-item').nth(2).click();
  await page.waitForTimeout(500);
  console.log(w, 'opened item', await st(), page.url());
  await page.close();
}
console.log('errors', errors);
await browser.close();
