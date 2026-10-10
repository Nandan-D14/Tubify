import { useEffect, useState } from 'react';
import type { Track } from '../types';

export interface Line {
  t: number; // seconds into the song
  text: string;
}
export interface Lyrics {
  lines: Line[] | null; // time-synced, when available
  plain: string | null;
  instrumental: boolean;
}

const API = 'https://lrclib.net/api';
const DAY = 86_400_000;

/** "Song (From "Movie") [Remix] ft. X" -> "Song" — LRCLIB titles are bare. */
const bare = (s: string) => s.replace(/\s*[([{【][^)\]}】]*[)\]}】]/g, '').replace(/\s+(ft\.?|feat\.?|featuring)\s.*$/i, '').replace(/["“”]/g, '').trim() || s;
const firstArtist = (a: string) => a.split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?)\s*/i)[0].trim();

function parseLrc(lrc: string): Line[] {
  const out: Line[] = [];
  for (const row of lrc.split(/\r?\n/)) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];
    if (!stamps.length) continue;
    const text = row.replace(/\[[^\]]*\]/g, '').trim();
    for (const m of stamps) out.push({ t: +m[1] * 60 + +m[2], text });
  }
  return out.sort((a, b) => a.t - b.t);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function query(params: Record<string, string>): Promise<any[]> {
  const res = await fetch(`${API}/search?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`Lyrics lookup failed (${res.status})`);
  return res.json();
}

/** Best match: synced first, then closest length (music videos run a bit longer than the song). */
function pick(items: any[], duration: number) {
  const ok = items.filter((it) => (it.syncedLyrics || it.plainLyrics || it.instrumental) && (!duration || !it.duration || Math.abs(it.duration - duration) < Math.max(45, duration * 0.25)));
  ok.sort((a, b) => +!a.syncedLyrics - +!b.syncedLyrics || Math.abs((a.duration ?? 0) - duration) - Math.abs((b.duration ?? 0) - duration));
  return ok[0];
}

async function load(t: Track): Promise<Lyrics | null> {
  const title = bare(t.title);
  const artist = firstArtist(t.artist);
  let hit = pick(await query({ track_name: title, artist_name: artist }), t.duration);
  if (!hit) hit = pick(await query({ q: `${artist} ${title}` }), t.duration);
  if (!hit) return null;
  const lines = hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : null;
  return { lines: lines?.length ? lines : null, plain: hit.plainLyrics || null, instrumental: !!hit.instrumental };
}

const memory = new Map<string, Promise<Lyrics | null>>();

export function getLyrics(t: Track): Promise<Lyrics | null> {
  let p = memory.get(t.id);
  if (p) return p;
  const k = `lrc1:${t.id}`;
  try {
    const hit = JSON.parse(localStorage.getItem(k) || 'null');
    // Found lyrics keep for a month; "not found" is retried after a day.
    if (hit && Date.now() - hit.t < (hit.v ? 30 : 1) * DAY) return Promise.resolve(hit.v);
  } catch {
    /* ignore corrupt cache */
  }
  p = load(t).then((v) => {
    try {
      localStorage.setItem(k, JSON.stringify({ t: Date.now(), v }));
    } catch {
      /* storage full */
    }
    return v;
  });
  p.catch(() => memory.delete(t.id));
  memory.set(t.id, p);
  return p;
}

export type LyricsState = { status: 'loading' } | { status: 'ready'; data: Lyrics } | { status: 'none' } | { status: 'error' };

export function useLyrics(t: Track | undefined): LyricsState {
  const [state, setState] = useState<{ id?: string; s: LyricsState }>({ s: { status: 'loading' } });
  useEffect(() => {
    if (!t) return;
    let live = true;
    getLyrics(t)
      .then((data) => live && setState({ id: t.id, s: data ? { status: 'ready', data } : { status: 'none' } }))
      .catch(() => live && setState({ id: t.id, s: { status: 'error' } }));
    return () => {
      live = false;
    };
  }, [t?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state.id === t?.id ? state.s : { status: 'loading' };
}

/** Per-song timing nudge (music-video intros shift the lyrics). Positive = lyrics later. */
export function useLyricsOffset(id: string | undefined): [number, (v: number) => void] {
  const key = `lrcoff:${id}`;
  const [v, setV] = useState(0);
  useEffect(() => setV(Number(localStorage.getItem(key)) || 0), [key]);
  return [
    v,
    (n: number) => {
      const r = Math.round(n * 2) / 2;
      setV(r);
      if (r) localStorage.setItem(key, String(r));
      else localStorage.removeItem(key);
    },
  ];
}
