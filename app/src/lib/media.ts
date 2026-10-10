import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { inTauri } from './youtube';
import { player, useStore } from './store';
import { engine, useProgress } from './engine';
import { thumb } from './format';

/** Mirrors playback to the Windows media flyout / taskbar buttons and obeys their commands. */
export function initMedia() {
  if (!inTauri) return;
  const push = () => {
    const s = useStore.getState();
    const t = s.queue[s.index];
    const p = useProgress.getState();
    const np = t
      ? { id: t.id, title: t.title, artist: t.artist, album: s.context.name || 'Tubify', cover: thumb(t.id, 'hq'), duration: t.duration || p.duration, position: p.time, playing: s.playing }
      : { id: '', title: '', artist: '', album: '', cover: '', duration: 0, position: 0, playing: false };
    invoke('media_update', { np }).catch(() => {});
  };
  useStore.subscribe((s, prev) => {
    if (s.playing !== prev.playing || s.nonce !== prev.nonce || s.queue[s.index]?.id !== prev.queue[prev.index]?.id) push();
  });
  // Seeks (time jumps) keep the flyout's timeline in step; normal ticks don't need to.
  useProgress.subscribe((p, prev) => Math.abs(p.time - prev.time) > 2 && push());
  push();

  listen<string>('media-cmd', ({ payload: cmd }) => {
    const [name, arg] = cmd.split(':');
    const has = useStore.getState().queue.length > 0;
    switch (name) {
      case 'play': return has && useStore.setState({ playing: true });
      case 'pause': return useStore.setState({ playing: false });
      case 'toggle': return player.togglePlay();
      case 'next': return player.next();
      case 'prev': return player.prev();
      case 'seek': return player.seek(Math.max(0, Number(arg)));
      case 'seekby': return player.seek(Math.max(0, engine.time() + Number(arg)));
    }
  }).catch(() => {});
}
