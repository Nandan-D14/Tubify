import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Playlist, Repeat, Track } from '../types';
import { uid } from './format';
import { engine } from './engine';
import { toast } from './toast';
import { radio } from './youtube';

export type Panel = 'now' | 'queue' | 'lyrics' | null;
export type Expanded = 'now' | 'video' | 'artist' | 'lyrics' | null;
/** Something picked from search — shown in the search bar's "Recent searches" dropdown. */
export type Hit =
  | { kind: 'track'; track: Track }
  | { kind: 'playlist'; id: string } // 'liked' | 'recent' | playlist id
  | { kind: 'artist'; name: string; id: string } // id = a video id for the avatar
  | { kind: 'query'; q: string };
export const hitKey = (h: Hit) =>
  h.kind === 'track' ? `t:${h.track.id}` : h.kind === 'playlist' ? `p:${h.id}` : h.kind === 'artist' ? `a:${h.name.toLowerCase()}` : `q:${h.q.toLowerCase()}`;
export interface Context {
  key: string; // e.g. "playlist:abc", "liked", "search:arijit"
  name: string; // shown as "Playing from …"
}

interface State {
  // playback
  queue: Track[];
  index: number;
  original: Track[] | null; // un-shuffled order, restored when shuffle is turned off
  context: Context;
  playing: boolean;
  nonce: number; // bumps on every explicit play so re-playing the same track restarts it
  shuffle: boolean;
  repeat: Repeat;
  autoplay: boolean; // keep going with similar songs when the queue runs out
  volume: number;
  muted: boolean;
  // library
  liked: Track[];
  recent: Track[];
  playlists: Playlist[];
  searches: string[];
  hits: Hit[];
  // layout
  panel: Panel;
  expanded: Expanded; // Now Playing blown up into the main area (Spotify's "expand")
  videoMode: 'art' | 'video';
  pip: boolean;
  fullscreen: boolean;
  collapsed: boolean;
  libWide: boolean; // Your Library blown up into the main area as a grid
  sidebarW: number;
  panelW: number;
  sleepAt: number | null;
  sleepEnd: boolean;
}

export const useStore = create<State>()(
  persist(
    (): State => ({
      queue: [],
      index: 0,
      original: null,
      context: { key: '', name: '' },
      playing: false,
      nonce: 0,
      shuffle: false,
      repeat: 'off',
      autoplay: true,
      volume: 70,
      muted: false,
      liked: [],
      recent: [],
      playlists: [],
      searches: [],
      hits: [],
      panel: null,
      expanded: null,
      videoMode: 'art',
      pip: false,
      fullscreen: false,
      collapsed: false,
      libWide: false,
      sidebarW: 280,
      panelW: 320,
      sleepAt: null,
      sleepEnd: false,
    }),
    {
      name: 'tubify',
      version: 1,
      partialize: (s) => ({
        queue: s.queue, index: s.index, original: s.original, context: s.context,
        shuffle: s.shuffle, repeat: s.repeat, autoplay: s.autoplay, volume: s.volume, muted: s.muted,
        liked: s.liked, recent: s.recent, playlists: s.playlists, searches: s.searches, hits: s.hits,
        panel: s.panel, videoMode: s.videoMode, collapsed: s.collapsed,
        sidebarW: s.sidebarW, panelW: s.panelW,
      }),
    },
  ),
);

const get = useStore.getState;
const set = useStore.setState;

/** Window width below which Your Library and the side panel can't both be expanded. */
export const TIGHT_W = 1100;
export const isTight = () => window.innerWidth < TIGHT_W;

const strip = ({ id, title, artist, duration, views, published }: Track): Track => ({ id, title, artist, duration, views, published });

function shuffled<T>(a: T[]) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

function move<T>(a: T[], from: number, to: number) {
  const r = a.slice();
  const [x] = r.splice(from, 1);
  r.splice(to, 0, x);
  return r;
}

/** State for starting `queue[index]` — applied in a single set() so the engine sees one change. */
function begin(s: State, queue: Track[], index: number): Partial<State> {
  const t = queue[index];
  return { index, playing: true, nonce: s.nonce + 1, recent: [t, ...s.recent.filter((r) => r.id !== t.id)].slice(0, 50) };
}

function go(index: number) {
  if (!get().queue[index]) return;
  set((s) => begin(s, s.queue, index));
}

const updatePlaylist = (id: string, fn: (p: Playlist) => Playlist) =>
  set((s) => ({ playlists: s.playlists.map((p) => (p.id === id ? fn(p) : p)) }));

let extending = false;

/** Queue ran out: append the current song's radio and carry on (Spotify "Autoplay"). */
async function autoplay() {
  const s = get();
  const cur = s.queue[s.index];
  if (!cur || extending) return;
  extending = true;
  try {
    const have = new Set(s.queue.map((t) => t.id));
    const more = (await radio(cur.id)).filter((t) => !have.has(t.id)).slice(0, 20).map(strip);
    const now = get();
    if (now.queue[now.index]?.id !== cur.id) return; // user moved on meanwhile
    if (!more.length) return set({ playing: false });
    set((st) => {
      const queue = [...st.queue, ...more];
      return { queue, original: st.original && [...st.original, ...more], ...begin(st, queue, st.index + 1) };
    });
    toast('Autoplaying similar songs');
  } catch {
    set({ playing: false });
  } finally {
    extending = false;
  }
}

export const current = () => {
  const s = get();
  return s.queue[s.index] as Track | undefined;
};

export const player = {
  playList(tracks: Track[], start = 0, context: Context = { key: '', name: '' }) {
    if (!tracks.length) return;
    let queue = tracks.map(strip);
    let index = start;
    let original: Track[] | null = null;
    if (get().shuffle) {
      original = queue;
      queue = [queue[start], ...shuffled(queue.filter((_, i) => i !== start))];
      index = 0;
    }
    set((s) => ({ queue, original, context, ...begin(s, queue, index) }));
    if (context.key.startsWith('search:')) player.addHit({ kind: 'track', track: tracks[start] });
  },
  /** Play/pause toggle for a whole list (green Play buttons). */
  toggleList(tracks: Track[], context: Context) {
    const s = get();
    if (s.context.key === context.key && s.queue.length) set({ playing: !s.playing });
    else player.playList(tracks, 0, context);
  },
  playAt: (i: number) => go(i),
  togglePlay() {
    const s = get();
    if (s.queue[s.index]) set({ playing: !s.playing });
  },
  next(auto = false) {
    const { queue, index, repeat, sleepEnd } = get();
    if (auto && sleepEnd) {
      set({ playing: false, sleepEnd: false });
      toast('Sleep timer ended — paused');
      return;
    }
    if (auto && repeat === 'one') {
      engine.seek(0);
      engine.play();
      return;
    }
    if (index < queue.length - 1) go(index + 1);
    else if (repeat !== 'off' && queue.length) go(0);
    else if (get().autoplay && queue.length) autoplay();
    else if (auto) set({ playing: false });
  },
  prev() {
    const { index } = get();
    if (engine.time() > 3 || index === 0) engine.seek(0);
    else go(index - 1);
  },
  seek: (t: number) => engine.seek(t),
  toggleShuffle() {
    const s = get();
    if (!s.shuffle) {
      set({ shuffle: true, original: s.queue, queue: [...s.queue.slice(0, s.index + 1), ...shuffled(s.queue.slice(s.index + 1))] });
    } else {
      const cur = s.queue[s.index];
      const orig = s.original ?? s.queue;
      set({ shuffle: false, original: null, queue: orig, index: Math.max(0, orig.findIndex((t) => t.id === cur?.id)) });
    }
  },
  cycleRepeat: () => set((s) => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),
  toggleAutoplay: () => set((s) => ({ autoplay: !s.autoplay })),
  async startRadio(t: Track) {
    try {
      const list = (await radio(t.id)).filter((x) => x.id !== t.id);
      if (!list.length) return toast("Couldn't find similar songs");
      player.playList([t, ...list], 0, { key: `radio:${t.id}`, name: `${t.title} Radio` });
    } catch {
      toast("Couldn't load song radio — check your connection");
    }
  },
  setVolume: (v: number) => set({ volume: Math.round(Math.min(100, Math.max(0, v))), muted: v <= 0 }),
  toggleMute: () => set((s) => ({ muted: !s.muted, volume: s.muted && s.volume === 0 ? 50 : s.volume })),

  // queue
  playNext(t: Track) {
    const s = get();
    if (!s.queue.length) return player.playList([t]);
    const queue = s.queue.slice();
    queue.splice(s.index + 1, 0, strip(t));
    set({ queue, original: s.original && [...s.original, strip(t)] });
    toast('Will play next');
  },
  addToQueue(t: Track) {
    const s = get();
    if (!s.queue.length) return player.playList([t]);
    set({ queue: [...s.queue, strip(t)], original: s.original && [...s.original, strip(t)] });
    toast('Added to queue');
  },
  removeFromQueue(i: number) {
    const s = get();
    if (i === s.index) return;
    set({ queue: s.queue.filter((_, j) => j !== i), index: i < s.index ? s.index - 1 : s.index });
  },
  moveQueue(from: number, to: number) {
    const s = get();
    const cur = s.queue[s.index];
    const queue = move(s.queue, from, to);
    set({ queue, index: queue.indexOf(cur) });
  },
  clearQueue() {
    const cur = current();
    set({ queue: cur ? [cur] : [], index: 0, original: null });
  },

  // library
  toggleLike(t: Track) {
    const has = get().liked.some((x) => x.id === t.id);
    set((s) => ({ liked: has ? s.liked.filter((x) => x.id !== t.id) : [{ ...strip(t), addedAt: Date.now() }, ...s.liked] }));
    toast(has ? 'Removed from Liked Songs' : 'Added to Liked Songs');
  },
  createPlaylist(name?: string, tracks: Track[] = []) {
    const id = uid();
    const n = get().playlists.length + 1;
    const p: Playlist = { id, name: name || `My Playlist #${n}`, description: '', createdAt: Date.now(), tracks: tracks.map((t) => ({ ...strip(t), addedAt: Date.now() })) };
    set((s) => ({ playlists: [p, ...s.playlists] }));
    return id;
  },
  renamePlaylist: (id: string, name: string) => name.trim() && updatePlaylist(id, (p) => ({ ...p, name: name.trim() })),
  deletePlaylist(id: string) {
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
    toast('Playlist deleted');
  },
  addToPlaylist(id: string, t: Track) {
    const p = get().playlists.find((x) => x.id === id);
    if (!p) return;
    if (p.tracks.some((x) => x.id === t.id)) return toast(`Already in ${p.name}`);
    updatePlaylist(id, (q) => ({ ...q, tracks: [...q.tracks, { ...strip(t), addedAt: Date.now() }] }));
    toast(`Added to ${p.name}`);
  },
  removeFromPlaylist: (id: string, i: number) => updatePlaylist(id, (p) => ({ ...p, tracks: p.tracks.filter((_, j) => j !== i) })),
  movePlaylistTrack: (id: string, from: number, to: number) => updatePlaylist(id, (p) => ({ ...p, tracks: move(p.tracks, from, to) })),
  addSearch: (q: string) => set((s) => ({ searches: [q, ...s.searches.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8) })),
  removeSearch: (q: string) => set((s) => ({ searches: s.searches.filter((x) => x !== q) })),
  addHit: (h: Hit) => {
    const k = hitKey(h);
    const hit = h.kind === 'track' ? { kind: 'track' as const, track: strip(h.track) } : h;
    set((s) => ({ hits: [hit, ...s.hits.filter((x) => hitKey(x) !== k)].slice(0, 12) }));
  },
  removeHit: (k: string) => set((s) => ({ hits: s.hits.filter((x) => hitKey(x) !== k) })),
  clearRecent: () => set({ recent: [] }),

  // layout — below TIGHT_W only one of Your Library / the side panel can be expanded at a time (like Spotify)
  setPanel: (p: Panel) =>
    set((s) => {
      if (s.expanded && p === 'lyrics') return s.expanded === 'lyrics' ? { expanded: null } : { expanded: 'lyrics' };
      if (s.expanded === 'lyrics' && p === 'now') return { expanded: 'now' };
      const panel = s.expanded ? p : s.panel === p ? null : p;
      return { expanded: null, libWide: false, ...(panel && isTight() ? { panel, collapsed: true } : { panel }) };
    }),
  /** Open the expanded view on a tab; null folds it back into the side panel. */
  expand: (tab: Expanded) =>
    set((s) => {
      if (!tab) {
        const panel: Panel = s.expanded === 'lyrics' ? 'lyrics' : 'now';
        return { expanded: null, ...(isTight() ? { panel, collapsed: true } : { panel }) };
      }
      const video = tab === 'video' ? { videoMode: 'video' as const, pip: false } : tab === 'now' ? { videoMode: 'art' as const } : {};
      return { expanded: tab, panel: null, libWide: false, ...video };
    }),
  setVideoMode: (m: 'art' | 'video') => set({ videoMode: m }),
  togglePip: () => set((s) => ({ pip: !s.pip })),
  setFullscreen: (on: boolean) => set({ fullscreen: on }),
  toggleCollapsed: () =>
    set((s) => (s.libWide ? { libWide: false } : s.collapsed && isTight() ? { collapsed: false, panel: null } : { collapsed: !s.collapsed })),
  /** Expand Your Library over the main area (side panel folds to its rail); toggles back. */
  toggleLibWide: () => set((s) => (s.libWide ? { libWide: false } : { libWide: true, collapsed: false, expanded: null, panel: null })),
  setSleep(min: number | 'end' | null) {
    if (min === 'end') set({ sleepEnd: true, sleepAt: null });
    else set({ sleepEnd: false, sleepAt: min ? Date.now() + min * 60_000 : null });
    toast(min === null ? 'Sleep timer off' : min === 'end' ? 'Pausing at end of track' : `Pausing in ${min} min`);
  },
};
