import type { Track } from '../types';
import { navigate } from './router';
import { player } from './store';
import { toast } from './toast';
import { songs } from './format';

export function exportPlaylist(name: string, tracks: Track[], description = '') {
  const data = { app: 'tubify', version: 1, name, description, tracks: tracks.map(({ id, title, artist, duration }) => ({ id, title, artist, duration })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^\w\s-]/g, '').trim() || 'playlist'}.tubify.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Playlist exported');
}

const valid = (t: unknown): t is Track => {
  const x = t as Track;
  return !!x && typeof x.id === 'string' && /^[\w-]{11}$/.test(x.id) && typeof x.title === 'string';
};

export function importPlaylist() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const tracks = (Array.isArray(data.tracks) ? data.tracks : []).filter(valid).map((t: Track) => ({
        id: t.id,
        title: String(t.title).slice(0, 200),
        artist: String(t.artist ?? '').slice(0, 120),
        duration: Number(t.duration) || 0,
      }));
      if (!tracks.length) throw new Error('empty');
      const id = player.createPlaylist(String(data.name || file.name).slice(0, 100), tracks);
      navigate(`/playlist/${id}`);
      toast(`Imported ${songs(tracks.length)}`);
    } catch {
      toast("That file isn't a valid Tubify playlist");
    }
  };
  input.click();
}
