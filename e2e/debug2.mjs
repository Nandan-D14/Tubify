import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
await page.goto('http://localhost:1420/#/search/arijit%20singh');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('.search-songs .track', { timeout: 20000 }); await page.waitForTimeout(3000);
const t0 = Date.now();
const frameInfo = async () => {
  const f = page.frames().find((f) => f.url().includes('youtube.com/embed'));
  if (!f) return 'no-frame';
  return f.evaluate(() => {
    const p = document.querySelector('#movie_player');
    const v = document.querySelector('video');
    return { st: p?.getPlayerState?.(), vid: p?.getVideoData?.().video_id, t: v?.currentTime, err: document.querySelector('.ytp-error-content-wrap-reason')?.textContent };
  }).catch((e) => e.message);
};
console.log('before click', Date.now() - t0, await frameInfo());
const row = page.locator('.search-songs .track').nth(1); console.log('ROW', await row.locator('.t').textContent(), await row.locator('.dur').textContent()); await row.click();
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(1000);
  const s = await page.evaluate(() => ({ title: document.title, btn: document.querySelector('.playerbar .play-btn')?.getAttribute('aria-label') }));
  console.log(i, s, await frameInfo());
}
await browser.close();


