import { chromium } from 'playwright-core';

const BASE = 'http://localhost:1420/';
const OUT = 'C:/Users/nanda/OneDrive/Desktop/Tubify/e2e/shots/';
const log = (...a) => console.log('•', ...a);
const errors = [];

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('response', (r) => r.status() >= 400 && !r.url().includes('doubleclick') && errors.push(`http ${r.status()} ${r.url().slice(0, 120)}`));
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });
const wait = (ms) => page.waitForTimeout(ms);

async function videoState() {
  const f = page.frames().find((f) => f.url().includes('youtube.com/embed'));
  if (!f) return 'no-frame';
  return f.evaluate(() => {
    const v = document.querySelector('video');
    const p = document.querySelector('#movie_player');
    const err = document.querySelector('.ytp-error')?.textContent;
    return v ? { st: p?.getPlayerState?.(), vid: p?.getVideoData?.().video_id, t: +v.currentTime.toFixed(1), paused: v.paused, err } : { err: err || 'no-video' };
  }).catch((e) => 'eval-fail ' + e.message);
}
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('tubify') || '{}').state);
const hostRect = () => page.evaluate(() => {
  const h = document.querySelector('.video-host');
  const r = h.getBoundingClientRect();
  return { mode: h.dataset.mode, shown: h.classList.contains('shown'), x: r.x | 0, y: r.y | 0, w: r.width | 0, h: r.height | 0, clip: h.style.clipPath };
});

await page.goto(BASE + '#/home');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.card:not(.skeleton)', { timeout: 20000 });
await wait(1500);
await shot('01-home');
log('home ok');

// Play the first card
const card = page.locator('.shelf .card:not(.skeleton)').first();
await card.hover();
await card.locator('.card-play').click();
await wait(7000);
log('after card play', await videoState(), await page.locator('.playerbar .time').first().textContent());
await shot('02-playing');

// Now playing panel + video
await page.click('button[title="Now playing view"]');
await wait(600);
await page.click('.np-media-ctrls .seg button:nth-child(2)');
await wait(1200);
log('panel video host', await hostRect());
await shot('03-panel-video');
await page.locator('.np').evaluate((el) => (el.scrollTop = 200));
await wait(300);
log('panel scrolled host', await hostRect(), await page.locator('.np-media').evaluate((e) => { const r = e.getBoundingClientRect(); return { y: r.y | 0, h: r.height | 0 }; }));
await shot('04-panel-scrolled');
await page.locator('.np').evaluate((el) => (el.scrollTop = 0));

// Search
await page.keyboard.press('/');
await wait(300);
await page.keyboard.type('arijit singh');
await page.waitForSelector('.top-result', { timeout: 20000 });
await wait(1500);
await shot('05-search');
const row = page.locator('.search-songs .track').nth(1);
log('clicking', await row.locator('.t').textContent(), (await store())?.queue?.[(await store()).index]?.title);
await row.click();
for (let i = 0; i < 6; i++) {
  await wait(1000);
  log(i, await videoState(), await page.locator('.playerbar .pb-title').textContent());
}
log('after search click', await videoState(), (await store())?.context);
log('songs durations', await page.locator('.search-songs .dur').allTextContents());
await shot('06-search-playing');

// Skip tracks quickly — each must keep playing
for (let i = 0; i < 3; i++) {
  await page.click('button[title="Next"]');
  await wait(i === 2 ? 4000 : 800);
}
log('after 3x next', await videoState(), await page.locator('.playerbar .pb-title').textContent());
await page.click('button[title="Previous"]');
await wait(4000);
log('after prev', await videoState());
// Pause / resume via Space
await page.keyboard.press('Space');
await wait(800);
log('after space', (await videoState()).paused);
await page.keyboard.press('Space');
await wait(1500);
log('after space 2', (await videoState()).paused);

// Context menu -> new playlist
const r0 = page.locator('.section .track').first();
await r0.scrollIntoViewIfNeeded();
await wait(400);
await r0.click({ button: 'right' });
await wait(300);
await shot('07-ctx');
await page.hover('text=Add to playlist');
await wait(300);
await page.click('.ctx-sub >> text=New playlist');
await wait(1200);
await shot('08-playlist');
log('route', await page.evaluate(() => location.hash));

// Queue
await page.click('button[title="Queue"]');
await wait(600);
await shot('09-queue');

// Fullscreen
await page.keyboard.press('f');
await wait(1500);
log('full host', await hostRect());
await shot('10-full');
await page.keyboard.press('Escape');
await wait(600);
// Fullscreen API may have been granted; close via button if still open
if (await page.locator('.full').count()) await page.click('.full-head .icon-btn');
await wait(600);

// PiP
await page.keyboard.press('p');
await wait(1000);
log('pip host', await hostRect());
await shot('11-pip');
await page.keyboard.press('p');
await wait(500);

// Narrow + mobile
await page.setViewportSize({ width: 1100, height: 800 });
await wait(800);
await shot('12-narrow');
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + '#/home');
await wait(2500);
await shot('13-mobile');
await page.locator('.mini-player').click().catch(() => {});
await wait(1000);
await shot('14-mobile-full');

log('ERRORS', errors.length ? '\n' + errors.join('\n') : 'none');
await browser.close();
