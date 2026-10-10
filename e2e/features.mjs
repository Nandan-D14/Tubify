// Checks the new features in browser mode: Made For You, mix page, lyrics panel/card, song radio menu.
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:1420/';
const OUT = 'C:/Users/nanda/OneDrive/Desktop/Tubify/e2e/shots/';
const errors = [];
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()} ${r.url().slice(0, 140)}`));
const wait = (ms) => page.waitForTimeout(ms);
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png` });

const T = (id, title, artist, duration) => ({ id, title, artist, duration });
const shape = T('JGwWNGJdvx8', 'Shape of You', 'Ed Sheeran', 264);
const now = Date.now();
const plays = Object.fromEntries(
  [
    [shape, 6],
    [T('kJQP7kiw5Fk', 'Despacito', 'Luis Fonsi', 282), 3],
    [T('PT2_F-1esPk', 'Closer', 'The Chainsmokers', 262), 4],
    [T('31crA53Dgu0', 'Cheap Thrills', 'Sia', 218), 2],
  ].map(([t, n], i) => [t.id, { t, n, skips: 0, last: now - i * 3_600_000 }]),
);

await page.goto(BASE + '#/home');
await page.evaluate(({ plays, shape }) => {
  localStorage.clear();
  localStorage.setItem('tubify:stats', JSON.stringify({ state: { plays }, version: 1 }));
  localStorage.setItem('tubify', JSON.stringify({ state: { queue: [shape], index: 0, panel: 'lyrics', muted: true, volume: 0 }, version: 1 }));
}, { plays, shape });
await page.reload();
await page.waitForSelector('.cover.mix', { timeout: 30000 }).catch(() => errors.push('no mix covers'));
await wait(2500);
const shelf = page.locator('.shelf', { hasText: 'Made For You' });
await shelf.scrollIntoViewIfNeeded().catch(() => {});
console.log('mixes:', await page.locator('.cover.mix .mix-label').allTextContents());
console.log('because:', await page.locator('.shelf h2', { hasText: 'Because you listened' }).allTextContents());
console.log('lyrics lines:', await page.locator('.lyr-panel .lyrics p').count());
await shot('f1-home');

// Play and watch the active lyric line move.
await page.locator('.playerbar .play-btn').click();
await wait(16000);
console.log('active line:', await page.locator('.lyr-panel .lyrics p.on').textContent().catch(() => null));
await shot('f2-lyrics');

// Now Playing panel with its lyrics card.
await page.locator('.pb-right button[title="Now playing view"]').click();
await wait(1500);
console.log('lyrics card:', await page.locator('.lyr-card').count());
await shot('f3-nowplaying');

// Mix page.
await page.locator('.cover.mix').first().click();
await wait(2000);
console.log('mix rows:', await page.locator('.tracks .track').count(), '|', await page.locator('.hero-title').textContent());
await shot('f4-mix');

// Context menu has song radio.
await page.locator('.tracks .track').nth(2).click({ button: 'right' });
console.log('radio item:', await page.locator('.ctx .menu-item', { hasText: 'Go to song radio' }).count());
await page.locator('.ctx .menu-item', { hasText: 'Go to song radio' }).click();
await wait(3000);
console.log('context after radio:', await page.evaluate(() => JSON.parse(localStorage.getItem('tubify')).state.context));

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
