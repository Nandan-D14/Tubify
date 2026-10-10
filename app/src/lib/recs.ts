import { create } from 'zustand';
import type { Track } from '../types';
import { useStore } from './store';
import { useStats, score, type Stat } from './stats';
import { radio } from './youtube';

export interface Mix {
  id: string; // route id: daily-1, repeat, discover
  name: string;
  desc: string;
  seed: Track;
  tracks: Track[];
}

interface Recs {
  mixes: Mix[];
  because: { seed: Track; tracks: Track[] } | null;
  status: 'idle' | 'loading' | 'ready';
  builtFor: string; // day the mixes were made for — they refresh daily
  builtAt: number;
}

export const useRecs = create<Recs>(() => ({ mixes: [], because: null, status: 'idle', builtFor: '', builtAt: 0 }));

const DAY = 86_400_000;
const today = () => new Date().toDateString();
const dayNo = () => Math.floor(Date.now() / DAY);

/** "Arijit Singh, Shreya Ghoshal" / "A ft. B" / "A & B" -> "arijit singh" */
export const mainArtist = (a: string) => a.split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)[0].trim().toLowerCase();
const songKey = (t: Track) => `${mainArtist(t.artist)}|${t.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')}`;

/** Drop repeats — same video or the same song under another upload. */
function uniq(tracks: Track[], skip = new Set<string>()) {
  const seen = new Set(skip);
  return tracks.filter((t) => {
    const k = songKey(t);
    if (seen.has(t.id) || seen.has(k)) return false;
    seen.add(t.id).add(k);
    return true;
  });
}

/** Everything known about taste: listening stats plus liked songs (a like counts as two plays). */
function taste(): Stat[] {
  const plays = { ...useStats.getState().plays };
  for (const t of useStore.getState().liked) {
    const s = plays[t.id];
    plays[t.id] = s ? { ...s, n: s.n + 2 } : { t, n: 2, skips: 0, last: t.addedAt ?? Date.now() };
  }
  return Object.values(plays).filter((s) => s.n > 0);
}

const safeRadio = (id: string) => radio(id).catch(() => [] as Track[]);

/** Round-robin merge so no single seed dominates. */
function interleave(lists: Track[][]) {
  const out: Track[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) out.push(l[i]);
  return out;
}

function describe(tracks: Track[], lead: string) {
  const names = [lead];
  for (const t of tracks) {
    const a = t.artist.split(/\s*,\s*/)[0];
    if (names.length >= 3) break;
    if (!names.some((n) => mainArtist(n) === mainArtist(a))) names.push(a);
  }
  return `${names.join(', ')} and more`;
}

let building: Promise<void> | null = null;

/** (Re)build recommendations; cheap to call — radios are cached, and fresh results are reused for 15 min. */
export function buildRecs(force = false) {
  const r = useRecs.getState();
  if (building) return building;
  if (!force && r.status === 'ready' && r.builtFor === today() && Date.now() - r.builtAt < 15 * 60_000) return Promise.resolve();
  useRecs.setState({ status: r.mixes.length ? 'ready' : 'loading' });
  building = build().finally(() => (building = null));
  return building;
}

async function build() {
  const now = Date.now();
  const stats = taste().sort((a, b) => score(b, now) - score(a, now));
  const known = new Set(Object.keys(useStats.getState().plays));
  const skipped = new Set(Object.values(useStats.getState().plays).filter((s) => s.skips >= 2 && s.skips > s.n).map((s) => s.t.id));
  const day = dayNo();

  // Group favourite tracks by artist.
  const byArtist = new Map<string, { name: string; score: number; tracks: Track[] }>();
  for (const s of stats) {
    const k = mainArtist(s.t.artist);
    const g = byArtist.get(k) ?? { name: s.t.artist.split(/\s*,\s*/)[0], score: 0, tracks: [] };
    g.score += Math.max(0, score(s, now));
    g.tracks.push(s.t);
    byArtist.set(k, g);
  }
  const artists = [...byArtist.values()].sort((a, b) => b.score - a.score).slice(0, 4);

  // Daily Mixes: a familiar seed (rotates daily) + its YouTube radio, with your favourites sprinkled in.
  const daily = await Promise.all(
    artists.map(async (a, i): Promise<Mix | null> => {
      const seed = a.tracks[(day + i) % Math.min(3, a.tracks.length)];
      const similar = (await safeRadio(seed.id)).filter((t) => !skipped.has(t.id));
      if (similar.length < 5) return null;
      const mine = a.tracks.slice(0, 6);
      const mixed: Track[] = [];
      similar.forEach((t, j) => {
        if (j % 4 === 0 && mine.length) mixed.push(mine.shift()!);
        mixed.push(t);
      });
      const tracks = uniq([seed, ...mixed, ...mine]).slice(0, 40);
      return { id: '', name: '', desc: describe(tracks, a.name), seed, tracks };
    }),
  );
  const mixes: Mix[] = daily.filter((m): m is Mix => !!m).map((m, i) => ({ ...m, id: `daily-${i + 1}`, name: `Daily Mix ${i + 1}` }));

  // On Repeat: what you keep coming back to lately.
  const repeat = stats.filter((s) => s.n >= 2 && now - s.last < 30 * DAY).map((s) => s.t);
  if (repeat.length >= 5) mixes.push({ id: 'repeat', name: 'On Repeat', desc: "Songs you can't stop playing.", seed: repeat[0], tracks: uniq(repeat).slice(0, 30) });

  // Discover Weekly: radios of a weekly-rotating set of favourites, only songs you haven't played.
  const top = stats.slice(0, 15).map((s) => s.t);
  const disc: Track[] = [];
  let because: Recs['because'] = null;
  if (top.length >= 3) {
    const week = Math.floor(day / 7);
    const seeds = Array.from({ length: Math.min(5, top.length) }, (_, i) => top[(week * 5 + i) % top.length]);
    const lists = await Promise.all(seeds.map((s) => safeRadio(s.id).then((l) => l.slice(1))));
    const exclude = new Set([...known, ...useStore.getState().liked.map((t) => t.id)]);
    disc.push(...uniq(interleave(lists).filter((t) => !exclude.has(t.id) && !skipped.has(t.id)), exclude).slice(0, 30));
    if (disc.length >= 10) mixes.push({ id: 'discover', name: 'Discover Weekly', desc: 'Your weekly mixtape of fresh music. Enjoy new music picked for you.', seed: disc[0], tracks: disc });
  }

  // "Because you listened to …": the latest song you actually listened to.
  const lastPlayed = Object.values(useStats.getState().plays).filter((s) => s.n > 0).sort((a, b) => b.last - a.last)[0];
  if (lastPlayed) {
    const used = new Set(disc.map((t) => t.id));
    const tracks = uniq((await safeRadio(lastPlayed.t.id)).slice(1).filter((t) => !used.has(t.id) && !skipped.has(t.id))).slice(0, 15);
    if (tracks.length >= 4) because = { seed: lastPlayed.t, tracks };
  }

  useRecs.setState({ mixes, because, status: 'ready', builtFor: today(), builtAt: Date.now() });
}

/** Spotify-style "Go to song radio": the song followed by similar ones. */
export async function songRadio(t: Track): Promise<Track[]> {
  const list = await radio(t.id);
  return uniq([t, ...list.filter((x) => x.id !== t.id)]);
}
