import { create } from 'zustand';
import type { Playlist, Track } from '../types';
import { supabase } from './supabase';
import { useStore } from './store';
import { useStats, score, type Stat } from './stats';
import { buildRecs } from './recs';
import { toast } from './toast';

/**
 * Cloud sync (Supabase). The local stores stay the source of truth so the app works offline:
 * every library change is diffed into a persisted outbox, pushed in the background,
 * and on sign-in / focus the account's library is pulled and the still-pending outbox replayed on top.
 */

export const configured = !!supabase;

interface Auth {
  user: { id: string; email: string } | null;
  status: 'idle' | 'syncing' | 'offline';
}
export const useAuth = create<Auth>(() => ({ user: null, status: 'idle' }));

interface PlayRow { cid: string; track_id: string; title: string; artist: string; duration: number; played: number; skipped: number; at: string }
interface Outbox {
  linked: string | null; // account the local library mirrors; changes are only recorded while set
  likes: Record<string, Track | null>; // null = unliked
  playlists: Record<string, Playlist | null>; // null = deleted
  plays: PlayRow[];
  prefs: boolean;
}

const KEY = 'tubify:outbox';
const MAX_STATS = 600; // same cap as stats.ts
const empty = (linked: string | null): Outbox => ({ linked, likes: {}, playlists: {}, plays: [], prefs: false });

let ob: Outbox = (() => {
  try {
    return { ...empty(null), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return empty(null);
  }
})();
const save = () => localStorage.setItem(KEY, JSON.stringify(ob));
const pending = (o = ob) => Object.keys(o.likes).length + Object.keys(o.playlists).length + o.plays.length > 0 || o.prefs;

let applying = false; // true while writing pulled data into the stores — not a user change
let merging = false; // first sync of this device with the account: merge prefs instead of overwriting
let lastSync = 0;

const iso = (ms?: number) => new Date(ms ?? Date.now()).toISOString();
const prefsOf = () => {
  const s = useStore.getState();
  return { searches: s.searches, recent: s.recent, autoplay: s.autoplay };
};
const playRow = (t: Track, played: number, skipped: number, at?: number): PlayRow => ({
  cid: crypto.randomUUID(), track_id: t.id, title: t.title, artist: t.artist ?? '', duration: Math.round(t.duration || 0), played, skipped, at: iso(at),
});

// ---------- record local changes ----------

function record() {
  useStore.subscribe((s, p) => {
    if (applying || !ob.linked) return;
    let dirty = false;
    if (s.liked !== p.liked) {
      const before = new Set(p.liked);
      const now = new Set(s.liked.map((t) => t.id));
      for (const t of s.liked) if (!before.has(t)) ob.likes[t.id] = t;
      for (const t of p.liked) if (!now.has(t.id)) ob.likes[t.id] = null;
      dirty = true;
    }
    if (s.playlists !== p.playlists) {
      const before = new Set(p.playlists);
      const now = new Set(s.playlists.map((x) => x.id));
      for (const x of s.playlists) if (!before.has(x)) ob.playlists[x.id] = x;
      for (const x of p.playlists) if (!now.has(x.id)) ob.playlists[x.id] = null;
      dirty = true;
    }
    if (s.searches !== p.searches || s.recent !== p.recent || s.autoplay !== p.autoplay) dirty = ob.prefs = true;
    if (dirty) {
      save();
      schedule();
    }
  });
  useStats.subscribe((s, p) => {
    if (applying || !ob.linked) return;
    let dirty = false;
    for (const id in s.plays) {
      const a = s.plays[id];
      const b = p.plays[id];
      if (a === b) continue;
      const dn = a.n - (b?.n ?? 0);
      const ds = a.skips - (b?.skips ?? 0);
      if (dn > 0 || ds > 0) {
        ob.plays.push(playRow(a.t, Math.max(0, dn), Math.max(0, ds), a.last));
        dirty = true;
      }
    }
    if (dirty) {
      save();
      schedule();
    }
  });
}

/** First sync on this device: queue the whole local library so it's merged into the account. */
function link(uid: string) {
  const s = useStore.getState();
  ob = {
    linked: uid,
    likes: Object.fromEntries(s.liked.map((t) => [t.id, t])),
    playlists: Object.fromEntries(s.playlists.map((p) => [p.id, p])),
    plays: Object.values(useStats.getState().plays).filter((x) => x.n || x.skips).map((x) => playRow(x.t, x.n, x.skips, x.last)),
    prefs: false,
  };
  merging = true;
  save();
}

// ---------- push ----------

const check = <T extends { error: unknown }>(r: T) => {
  if (r.error) throw r.error;
  return r;
};
const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

async function send(uid: string, o: Outbox) {
  const db = supabase!;
  const likes = Object.entries(o.likes);
  const upLikes = likes.flatMap(([, t]) => (t ? [{ user_id: uid, track_id: t.id, title: t.title, artist: t.artist ?? '', duration: Math.round(t.duration || 0), added_at: iso(t.addedAt) }] : []));
  const delLikes = likes.filter(([, t]) => !t).map(([id]) => id);
  for (const c of chunks(upLikes, 500)) check(await db.from('likes').upsert(c));
  for (const c of chunks(delLikes, 100)) check(await db.from('likes').delete().eq('user_id', uid).in('track_id', c));

  const lists = Object.entries(o.playlists);
  const upLists = lists.flatMap(([, p]) => (p ? [{ user_id: uid, id: p.id, name: p.name, description: p.description, tracks: p.tracks, created_at: iso(p.createdAt), updated_at: iso() }] : []));
  const delLists = lists.filter(([, p]) => !p).map(([id]) => id);
  for (const c of chunks(upLists, 100)) check(await db.from('playlists').upsert(c));
  for (const c of chunks(delLists, 100)) check(await db.from('playlists').delete().eq('user_id', uid).in('id', c));

  if (o.prefs) check(await db.from('user_prefs').upsert({ user_id: uid, data: prefsOf(), updated_at: iso() }));
  // Last: everything above is idempotent, so a failure here never re-sends non-idempotent rows twice (cid dedupes anyway).
  for (const c of chunks(o.plays, 500)) check(await db.from('plays').upsert(c.map((r) => ({ ...r, user_id: uid })), { onConflict: 'user_id,cid', ignoreDuplicates: true }));
}

let timer: ReturnType<typeof setTimeout> | undefined;
const schedule = (ms = 1500) => {
  clearTimeout(timer);
  timer = setTimeout(() => flush().then(() => useAuth.setState({ status: 'idle' }), () => useAuth.setState({ status: 'offline' })), ms);
};

let flushing: Promise<void> | null = null;
const flush = () => (flushing ??= push().finally(() => (flushing = null)));

async function push() {
  const uid = useAuth.getState().user?.id;
  if (!supabase || !uid || ob.linked !== uid || !pending()) return;
  const snap = ob;
  ob = empty(uid);
  save();
  try {
    await send(uid, snap);
  } catch (e) {
    // Put the batch back underneath anything recorded since.
    ob = { linked: ob.linked, likes: { ...snap.likes, ...ob.likes }, playlists: { ...snap.playlists, ...ob.playlists }, plays: [...snap.plays, ...ob.plays], prefs: snap.prefs || ob.prefs };
    save();
    throw e;
  }
  if (pending()) schedule(0);
}

// ---------- pull ----------

interface LikeRow { track_id: string; title: string; artist: string; duration: number; added_at: string }
interface PlaylistRow { id: string; name: string; description: string; tracks: Track[]; created_at: string }
interface StatRow { track_id: string; title: string; artist: string; duration: number; n: number; skips: number; last: string }
type Prefs = Partial<ReturnType<typeof prefsOf>>;

async function fetchAll<T>(table: string, uid: string, order: string) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase!.from(table).select('*').eq('user_id', uid).order(order, { ascending: false }).range(from, from + 999);
    if (error) throw error;
    out.push(...(data as T[]));
    if (data.length < 1000) return out;
  }
}

async function pull(uid: string) {
  const [likes, lists, stats, prefs] = await Promise.all([
    fetchAll<LikeRow>('likes', uid, 'added_at'),
    fetchAll<PlaylistRow>('playlists', uid, 'created_at'),
    supabase!.from('track_stats').select('*').eq('user_id', uid).order('last', { ascending: false }).limit(1000).then(check),
    supabase!.from('user_prefs').select('data').eq('user_id', uid).maybeSingle().then(check),
  ]);
  return {
    liked: likes.map((r): Track => ({ id: r.track_id, title: r.title, artist: r.artist, duration: r.duration, addedAt: Date.parse(r.added_at) })),
    playlists: lists.map((r): Playlist => ({ id: r.id, name: r.name, description: r.description, tracks: r.tracks, createdAt: Date.parse(r.created_at) })),
    stats: (stats.data as StatRow[]).map((r): Stat => ({ t: { id: r.track_id, title: r.title, artist: r.artist, duration: r.duration }, n: r.n, skips: r.skips, last: Date.parse(r.last) })),
    prefs: (prefs.data?.data ?? null) as Prefs | null,
  };
}

const union = <T,>(a: T[], b: T[], key: (x: T) => string, max: number) => {
  const seen = new Set<string>();
  return [...a, ...b].filter((x) => !seen.has(key(x)) && !!seen.add(key(x))).slice(0, max);
};

/** Write the account's library into the stores, replaying changes that haven't reached the server yet. */
function apply(r: Awaited<ReturnType<typeof pull>>) {
  if (useAuth.getState().user?.id !== ob.linked) return; // signed out meanwhile

  let liked = r.liked;
  let playlists = r.playlists;
  for (const [id, t] of Object.entries(ob.likes)) liked = t ? [t, ...liked.filter((x) => x.id !== id)] : liked.filter((x) => x.id !== id);
  liked.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0));
  for (const [id, p] of Object.entries(ob.playlists)) {
    if (!p) playlists = playlists.filter((x) => x.id !== id);
    else if (playlists.some((x) => x.id === id)) playlists = playlists.map((x) => (x.id === id ? p : x));
    else playlists = [p, ...playlists];
  }

  const plays: Record<string, Stat> = {};
  for (const s of r.stats) plays[s.t.id] = s;
  for (const row of ob.plays) {
    const s = plays[row.track_id];
    const at = Date.parse(row.at);
    plays[row.track_id] = s
      ? { ...s, n: s.n + row.played, skips: s.skips + row.skipped, last: Math.max(s.last, at) }
      : { t: { id: row.track_id, title: row.title, artist: row.artist, duration: row.duration }, n: row.played, skips: row.skipped, last: at };
  }
  const now = Date.now();
  const kept = Object.values(plays).sort((a, b) => score(b, now) - score(a, now)).slice(0, MAX_STATS);

  const local = useStore.getState();
  const rp = r.prefs ?? {};
  let prefs: Prefs = {};
  if (merging) {
    prefs = {
      searches: union(local.searches, rp.searches ?? [], (q) => q.toLowerCase(), 8),
      recent: union(local.recent, rp.recent ?? [], (t) => t.id, 50),
    };
    merging = false;
    ob.prefs = true;
    save();
    schedule();
  } else if (r.prefs && !ob.prefs) {
    prefs = { searches: rp.searches ?? local.searches, recent: rp.recent ?? local.recent, autoplay: rp.autoplay ?? local.autoplay };
  }

  const sig = (p: Record<string, Stat>) => Object.values(p).reduce((a, s) => a + s.n * 3 + s.skips, 0) + ':' + Object.keys(p).length;
  const before = sig(useStats.getState().plays);
  applying = true;
  try {
    useStore.setState({ liked, playlists, ...prefs });
    useStats.setState({ plays: Object.fromEntries(kept.map((s) => [s.t.id, s])) });
  } finally {
    applying = false;
  }
  if (sig(useStats.getState().plays) !== before) buildRecs(true);
}

// ---------- public ----------

let syncing: Promise<boolean> | null = null;

/** Push pending changes, then pull the account's library. Resolves false when offline / failed. */
export const sync = () => (syncing ??= run().finally(() => (syncing = null)));

async function run() {
  const uid = useAuth.getState().user?.id;
  if (!supabase || !uid) return false;
  useAuth.setState({ status: 'syncing' });
  try {
    if (ob.linked !== uid) link(uid);
    await flush();
    apply(await pull(uid));
    lastSync = Date.now();
    useAuth.setState({ status: 'idle' });
    return true;
  } catch (e) {
    console.warn('[sync]', e);
    useAuth.setState({ status: 'offline' });
    return false;
  }
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Resolves true when signed in right away, false when the account still needs email confirmation. */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) throw error;
  return !!data.session;
}

/** Upload anything pending, then sign out and clear this device's copy of the library. */
export async function signOut() {
  try {
    await flush();
  } catch {
    return toast("Can't reach the server — your latest changes aren't saved yet. Try again when online.");
  }
  await supabase!.auth.signOut({ scope: 'local' });
  clearTimeout(timer);
  ob = empty(null);
  save();
  applying = true;
  try {
    useStore.setState({ liked: [], playlists: [], recent: [], searches: [], hits: [] });
    useStats.setState({ plays: {} });
  } finally {
    applying = false;
  }
  buildRecs(true);
  toast('Logged out');
}

export function initSync() {
  if (!supabase) return;
  record();
  supabase.auth.onAuthStateChange((_event, session) => {
    const u = session?.user;
    const next = u ? { id: u.id, email: u.email ?? '' } : null;
    if (useAuth.getState().user?.id === next?.id) return; // token refresh etc.
    useAuth.setState({ user: next, status: 'idle' });
    // Don't call Supabase inside this callback (it can deadlock the auth lock) — defer.
    if (next) setTimeout(sync, 0);
  });
  addEventListener('online', () => sync());
  addEventListener('focus', () => Date.now() - lastSync > 5 * 60_000 && sync());
}
