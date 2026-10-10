// Read-only: sample player + UI state twice in the running Tauri WebView.
import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const page = browser.contexts()[0].pages().find((p) => p.url().includes('1420'));
const sample = async () => {
  const f = page.frames().find((f) => f.url().includes('youtube.com/embed'));
  const v = f ? await f.evaluate(() => {
    const v = document.querySelector('video');
    const p = document.querySelector('#movie_player');
    return { st: p?.getPlayerState?.(), vid: p?.getVideoData?.().video_id, t: v?.currentTime?.toFixed(1), paused: v?.paused, muted: v?.muted, vol: v?.volume?.toFixed(2), pvol: p?.getVolume?.(), pmuted: p?.isMuted?.() } ;
  }) : 'no frame';
  const ui = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tubify') || '{}').state || {};
    const bar = document.querySelector('.player-bar');
    return { playing: s.playing, vol: s.volume, muted: s.muted, cur: s.queue?.[s.index]?.title, id: s.queue?.[s.index]?.id, text: bar?.innerText.replace(/\s+/g, ' ').slice(0, 160) };
  });
  return { v, ui };
};
console.log(JSON.stringify(await sample()));
await page.waitForTimeout(3000);
console.log(JSON.stringify(await sample()));
process.exit(0);
