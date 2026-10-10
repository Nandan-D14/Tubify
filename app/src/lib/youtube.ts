import { invoke } from '@tauri-apps/api/core';
import type { Track } from '../types';
import { parseDuration } from './format';

export const inTauri = '__TAURI_INTERNALS__' in window;

/* eslint-disable @typescript-eslint/no-explicit-any */
const CLIENT = { client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en' } };
const requestBody = (query: string) =>
  JSON.stringify({
    context: CLIENT,
    query,
    params: 'EgIQAQ==', // "Videos only" filter
  });

async function call(endpoint: 'search' | 'next', body: string): Promise<any> {
  if (inTauri) return JSON.parse(await invoke<string>('yt', { endpoint, body }));
  const res = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`YouTube request failed (${res.status})`);
  return res.json();
}

const fetchRaw = (query: string) => call('search', requestBody(query));

// Walk the response instead of hard-coding paths — YouTube reshuffles its layout often.
function collect(node: any, out: any[], key = 'videoRenderer') {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const n of node) collect(n, out, key);
    return;
  }
  if (node[key]) {
    out.push(node[key]);
    return;
  }
  for (const k in node) collect(node[k], out, key);
}

const text = (t: any): string => t?.simpleText ?? t?.runs?.map((r: any) => r.text).join('') ?? '';

const NOISE = /\s*[([【][^)\]】]*\b(official|lyrics?|audio|video|visuali[sz]er|hd|hq|4k|explicit|full song|mv|remaster(ed)?)\b[^)\]】]*[)\]】]/gi;
// "Song - Video Song", "Song :Official Video", "Song | Full Audio"
const TRAIL = /\s*[:\-–—|]\s*(official\b|full (video|audio|song)\b|lyric(al)?\b|(video|audio) song\b).*$/i; // keeps "Lana Del Rey - Video Games"
// "Song 8K Full Video Song", "Song Lyrical Video" (no separator)
const LEAD = /^\s*((full|official|lyrical|lyric) (video|audio )?(song|video)s?|full song)\s*[:\-–—|]\s*/i;
const TAIL = /\s+((4|8)k|hd)?\s*(full (video|audio) song|full song|video song|lyrical video|lyric video|official (music )?video)\s*$/i;

/** "Artist - Song (Official Video) | Label" -> { title: "Song", artist: "Artist" } */
export function cleanMeta(rawTitle: string, channel: string) {
  let title = rawTitle.split(/\s+[|｜]\s+/)[0].replace(NOISE, '').replace(LEAD, '').replace(TRAIL, '').replace(TAIL, '').replace(/\s{2,}/g, ' ').trim();
  let artist = channel.replace(/\s+and\s+\d+\s+more$/i, '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  const dash = title.match(/^(.{1,40}?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    artist = dash[1].trim();
    title = dash[2].trim();
  }
  return { title: title || rawTitle, artist: artist || channel };
}

function parse(json: any): Track[] {
  const raw: any[] = [];
  collect(json, raw);
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const v of raw) {
    const len = text(v.lengthText);
    if (!v.videoId || !len || seen.has(v.videoId)) continue; // skips live streams
    const duration = parseDuration(len);
    if (duration < 60) continue; // skips Shorts
    seen.add(v.videoId);
    const { title, artist } = cleanMeta(text(v.title), text(v.ownerText));
    out.push({ id: v.videoId, title, artist, duration, views: text(v.shortViewCountText), published: text(v.publishedTimeText) });
  }
  return out;
}

const memory = new Map<string, Promise<Track[]>>();

export function searchTracks(query: string): Promise<Track[]> {
  const key = query.trim().toLowerCase();
  if (!key) return Promise.resolve([]);
  let p = memory.get(key);
  if (!p) {
    p = fetchRaw(key).then(parse);
    p.catch(() => memory.delete(key));
    memory.set(key, p);
  }
  return p;
}

const TTL = 6 * 3_600_000;
for (const k of Object.keys(localStorage)) {
  if (/^yt[23]?:/.test(k)) localStorage.removeItem(k); // old cache formats
  else if (/^(yt4|yr1|lrc1):/.test(k)) {
    try {
      if (Date.now() - JSON.parse(localStorage.getItem(k)!).t > 30 * 86_400_000) localStorage.removeItem(k);
    } catch {
      localStorage.removeItem(k);
    }
  }
}

async function withCache(k: string, ttl: number, load: () => Promise<Track[]>): Promise<Track[]> {
  try {
    const hit = JSON.parse(localStorage.getItem(k) || 'null');
    if (hit && Date.now() - hit.t < ttl) return hit.items;
  } catch {
    /* ignore corrupt cache */
  }
  const items = await load();
  try {
    localStorage.setItem(k, JSON.stringify({ t: Date.now(), items }));
  } catch {
    /* storage full — still return the result */
  }
  return items;
}

/** Search with a 6h localStorage cache — used for Home rows so launch is instant. */
export const cachedSearch = (query: string) => withCache(`yt4:${query}`, TTL, () => searchTracks(query)); // bump yt4 when parsing changes

function parseRadio(json: any): Track[] {
  const raw: any[] = [];
  collect(json?.contents?.twoColumnWatchNextResults?.playlist ?? json, raw, 'playlistPanelVideoRenderer');
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const v of raw) {
    const len = text(v.lengthText);
    if (!v.videoId || !len || seen.has(v.videoId)) continue;
    const duration = parseDuration(len);
    if (duration < 60 || duration > 900) continue; // no Shorts or hour-long mixes
    seen.add(v.videoId);
    const { title, artist } = cleanMeta(text(v.title), text(v.shortBylineText) || text(v.longBylineText));
    out.push({ id: v.videoId, title, artist, duration });
  }
  return out;
}

const radios = new Map<string, Promise<Track[]>>();

/** YouTube's "Mix" for a song (~25 similar tracks, seed first). Cached 12h. */
export function radio(id: string): Promise<Track[]> {
  let p = radios.get(id);
  if (!p) {
    const body = JSON.stringify({ context: CLIENT, videoId: id, playlistId: `RD${id}` });
    p = withCache(`yr1:${id}`, 2 * TTL, () => call('next', body).then(parseRadio));
    p.catch(() => radios.delete(id));
    radios.set(id, p);
  }
  return p;
}
