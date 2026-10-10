import { create } from 'zustand';
import { player, useStore } from './store';
import { toast } from './toast';
import { thumb } from './format';
import { searchTracks, inTauri } from './youtube';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Kept outside the main store so 4 ticks/sec only re-render the few components that show time. */
export const useProgress = create<{ time: number; duration: number; buffering: boolean }>(() => ({ time: 0, duration: 0, buffering: false }));

const POS_KEY = 'tubify:pos';
let yt: any = null;
let ready = false;
let started = false;
let loaded: { id: string; nonce: number } | null = null;
let loadedAt = 0;
let poll = 0;
let errors = 0;
let rescues = 0; // alternate uploads tried for the current track
let lastSave = 0;
const blocked = new Set<string>(); // ids that refused to embed this session

// The live iframe player can't be hot-swapped — a stale copy would keep the old one orphaned.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());

export const engine = {
  time: (): number => (ready ? yt.getCurrentTime() : useProgress.getState().time),
  seek(t: number) {
    useProgress.setState({ time: t });
    if (ready) yt.seekTo(t, true);
  },
  play: () => ready && yt.playVideo(),
};

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  return new Promise((resolve, reject) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(s);
  });
}

function tick() {
  if (!ready) return;
  const time = yt.getCurrentTime() || 0;
  const duration = yt.getDuration() || useProgress.getState().duration;
  useProgress.setState({ time, duration });

  const { sleepAt, queue, index } = useStore.getState();
  if (sleepAt && Date.now() >= sleepAt) {
    useStore.setState({ playing: false, sleepAt: null });
    toast('Sleep timer ended — paused');
  }
  if (Date.now() - lastSave > 5000 && queue[index]) {
    lastSave = Date.now();
    localStorage.setItem(POS_KEY, JSON.stringify({ id: queue[index].id, t: time }));
  }
}

const startPoll = () => {
  if (!poll) poll = window.setInterval(tick, 250);
};
const stopPoll = () => {
  clearInterval(poll);
  poll = 0;
};

function mediaSession() {
  // Desktop: lib/media.ts drives a native Windows session instead.
  if (inTauri || !('mediaSession' in navigator)) return;
  const s = useStore.getState();
  const t = s.queue[s.index];
  if (!t) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.title,
    artist: t.artist,
    album: s.context.name || 'Tubify',
    artwork: [{ src: thumb(t.id, 'hq'), sizes: '480x360', type: 'image/jpeg' }],
  });
  navigator.mediaSession.playbackState = s.playing ? 'playing' : 'paused';
}

function setTitle() {
  const s = useStore.getState();
  const t = s.queue[s.index];
  document.title = t && s.playing ? `${t.title} • ${t.artist}` : 'Tubify';
}

/** Sync YouTube player to store changes (track, play/pause, volume). */
function sync(s: ReturnType<typeof useStore.getState>, prev: ReturnType<typeof useStore.getState>) {
  if (s.playing !== prev.playing || s.index !== prev.index) setTitle();
  if (s.index !== prev.index || s.nonce !== prev.nonce) rescues = 0;
  if (!ready) return useProgress.setState({ buffering: s.playing }); // onReady picks it up
  const cur = s.queue[s.index];
  if (!cur) {
    if (loaded) yt.stopVideo();
    loaded = null;
    return;
  }
  if (!loaded || loaded.id !== cur.id || loaded.nonce !== s.nonce) {
    loaded = { id: cur.id, nonce: s.nonce };
    loadedAt = performance.now();
    useProgress.setState({ time: 0, duration: cur.duration, buffering: s.playing });
    if (s.playing) yt.loadVideoById(cur.id);
    else yt.cueVideoById(cur.id);
    mediaSession();
  } else if (s.playing !== prev.playing) {
    if (s.playing) yt.playVideo();
    else yt.pauseVideo();
    mediaSession();
  }
  if (s.volume !== prev.volume) yt.setVolume(s.volume);
  if (s.muted !== prev.muted) {
    if (s.muted) yt.mute();
    else yt.unMute();
  }
}

function onReady() {
  ready = true;
  const s = useStore.getState();
  yt.setVolume(s.volume);
  if (s.muted) yt.mute();
  const cur = s.queue[s.index];
  if (cur) {
    loaded = { id: cur.id, nonce: s.nonce };
    if (s.playing) {
      // The user hit play before the player finished loading.
      yt.loadVideoById(cur.id);
      useProgress.setState({ time: 0, duration: cur.duration, buffering: true });
    } else {
      // Resume where the user left off last session (cued, not auto-playing).
      let start = 0;
      try {
        const saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
        if (saved?.id === cur.id) start = Math.floor(saved.t);
      } catch {
        /* ignore */
      }
      yt.cueVideoById({ videoId: cur.id, startSeconds: start });
      useProgress.setState({ time: start, duration: cur.duration });
    }
    mediaSession();
  }
  setTitle();

  if (!inTauri && 'mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => useStore.setState({ playing: true }));
    ms.setActionHandler('pause', () => useStore.setState({ playing: false }));
    ms.setActionHandler('nexttrack', () => player.next());
    ms.setActionHandler('previoustrack', () => player.prev());
    ms.setActionHandler('seekto', (d) => d.seekTime != null && engine.seek(d.seekTime));
  }
}

function onStateChange({ data }: { data: number }) {
  const S = window.YT.PlayerState;
  const playing = useStore.getState().playing;
  // Switching videos can fire a late PAUSED/ENDED for the previous one — don't treat it as the user's.
  const vid: string | undefined = yt.getVideoData?.()?.video_id;
  const settling = performance.now() - loadedAt < 1500 || (!!vid && vid !== loaded?.id);
  if (data === S.PLAYING) {
    errors = 0;
    useProgress.setState({ buffering: false, duration: yt.getDuration() || useProgress.getState().duration });
    if (!playing) useStore.setState({ playing: true }); // started from the video itself
    startPoll();
  } else if (data === S.PAUSED) {
    stopPoll();
    tick();
    if (playing && settling) yt.playVideo();
    else if (playing) useStore.setState({ playing: false });
  } else if (data === S.BUFFERING) {
    useProgress.setState({ buffering: true });
  } else if (data === S.ENDED) {
    stopPoll();
    if (!settling) player.next(true);
  } else if (data === S.CUED) {
    useProgress.setState({ buffering: false });
  }
}

/**
 * Many labels block embedding on their official upload, but the same song almost always
 * exists as an embeddable "Artist - Topic" or lyric upload. Swap to one of those quietly.
 */
async function rescue(): Promise<boolean> {
  const s = useStore.getState();
  const cur = s.queue[s.index];
  if (!cur || rescues >= 3) return false;
  rescues++;
  blocked.add(cur.id);
  const { index, nonce } = s;
  let alt: typeof cur | undefined;
  try {
    const found = await searchTracks(`${cur.artist} ${cur.title} audio`);
    const max = Math.max(600, cur.duration * 1.4);
    alt = found.find((t) => !blocked.has(t.id) && t.duration <= max);
  } catch {
    return false;
  }
  const now = useStore.getState();
  if (!alt || now.index !== index || now.nonce !== nonce || now.queue[index]?.id !== cur.id) return false;
  const queue = now.queue.slice();
  queue[index] = { ...cur, id: alt.id, duration: alt.duration };
  useStore.setState({ queue, playing: true });
  return true;
}

async function onError({ data }: { data: number }) {
  useProgress.setState({ buffering: false });
  const embedBlocked = data === 101 || data === 150 || data === 100;
  if (embedBlocked && (await rescue())) return;

  const msg = embedBlocked ? 'Not available outside YouTube' : "This video can't be played";
  if (++errors > 4) {
    errors = 0;
    useStore.setState({ playing: false });
    return toast(msg);
  }
  toast(`${msg} — skipped`);
  const { index } = useStore.getState();
  setTimeout(() => {
    player.next();
    if (useStore.getState().index === index) useStore.setState({ playing: false });
  }, 500);
}

let subscribed = false;

export async function initEngine(host: HTMLElement) {
  if (started) return;
  started = true;
  if (!subscribed) {
    subscribed = true;
    useStore.subscribe(sync);
  }
  try {
    await loadApi();
  } catch {
    started = false;
    useStore.setState({ playing: false });
    useProgress.setState({ buffering: false });
    toast('Could not load the YouTube player — check your connection');
    // Try again once the network is back.
    const retry = () => initEngine(host);
    window.addEventListener('online', retry, { once: true });
    setTimeout(retry, 10_000);
    return;
  }
  // YT replaces the element it's given, so hand it a node React doesn't own.
  const el = document.createElement('div');
  host.appendChild(el);
  yt = new window.YT.Player(el, {
    width: '100%',
    height: '100%',
    playerVars: {
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      origin: location.origin,
    },
    events: { onReady, onStateChange, onError },
  });
}
