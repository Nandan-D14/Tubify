import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Track } from '../types';
import { useStore } from './store';
import { useProgress } from './engine';

export interface Stat {
  t: Track;
  n: number; // real listens (30s or half the song)
  skips: number; // left within the first 20s
  last: number; // last listen / skip time
}

/** Local listening history — the input to recommendations. Kept separate so the main store stays small. */
export const useStats = create<{ plays: Record<string, Stat> }>()(persist(() => ({ plays: {} }), { name: 'tubify:stats', version: 1 }));

const MAX = 600;
const DAY = 86_400_000;

/** How much a track says about current taste: plays, fading over ~2 weeks, minus skips. */
export const score = (s: Stat, now = Date.now()) => (s.n - s.skips * 0.6) * Math.pow(0.5, (now - s.last) / (14 * DAY));

let cur: Track | undefined;
let listened = 0;

function finish() {
  const t = cur;
  const secs = listened;
  listened = 0;
  if (!t || secs < 1) return;
  const played = secs >= Math.min(30, t.duration * 0.5);
  const skipped = !played && secs < 20;
  if (!played && !skipped) return;
  useStats.setState((s) => {
    const old = s.plays[t.id];
    const plays = { ...s.plays, [t.id]: { t: { id: t.id, title: t.title, artist: t.artist, duration: t.duration }, n: (old?.n ?? 0) + +played, skips: (old?.skips ?? 0) + +skipped, last: Date.now() } };
    const ids = Object.keys(plays);
    if (ids.length > MAX) {
      const now = Date.now();
      ids.sort((a, b) => score(plays[a], now) - score(plays[b], now));
      for (const id of ids.slice(0, ids.length - MAX)) delete plays[id];
    }
    return { plays };
  });
}

export function initStats() {
  const s = useStore.getState();
  cur = s.queue[s.index];
  useStore.subscribe((s, prev) => {
    const t = s.queue[s.index];
    if (t?.id === cur?.id && s.nonce === prev.nonce) return;
    finish();
    cur = t;
  });
  useProgress.subscribe((p, prev) => {
    const d = p.time - prev.time;
    if (d > 0 && d < 1.5 && useStore.getState().playing) listened += d;
    else if (cur && prev.time > cur.duration - 5 && p.time < 2) finish(); // repeat-one loop counts again
  });
  addEventListener('pagehide', finish);
}
