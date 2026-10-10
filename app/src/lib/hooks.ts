import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from 'react';
import type { Track } from '../types';
import { searchTracks } from './youtube';
import { useUI } from './ui';

export function useMedia(query: string) {
  const [m] = useState(() => window.matchMedia(query));
  return useSyncExternalStore(
    (cb) => (m.addEventListener('change', cb), () => m.removeEventListener('change', cb)),
    () => m.matches,
  );
}

// The desktop app keeps the desktop layout at any window size (like Spotify); only the web build goes mobile.
const desktopApp = '__TAURI_INTERNALS__' in window;
const mq = window.matchMedia('(max-width: 767px)');
export const useIsMobile = () =>
  useSyncExternalStore(
    (cb) => (mq.addEventListener('change', cb), () => mq.removeEventListener('change', cb)),
    () => !desktopApp && mq.matches,
  );

export function useSearch(query: string) {
  const [state, setState] = useState<{ data: Track[]; loading: boolean; error: string }>({ data: [], loading: false, error: '' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const q = query.trim();
    if (!q) return setState({ data: [], loading: false, error: '' });
    let live = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    searchTracks(q)
      .then((data) => live && setState({ data, loading: false, error: '' }))
      .catch((e) => live && setState({ data: [], loading: false, error: String(e?.message ?? e) }));
    return () => {
      live = false;
    };
  }, [query, retry]);
  return { ...state, retry: () => setRetry((n) => n + 1) };
}

/** Lets a view drive the top bar (gradient color, scrolled title, play button). */
export function usePage(color: string, title: string, playing = false, onPlay?: () => void) {
  const ref = useRef(onPlay);
  ref.current = onPlay;
  useEffect(() => {
    useUI.setState({ page: { color, title, playing, onPlay: onPlay ? () => ref.current?.() : null } });
  }, [color, title, playing, !!onPlay]); // eslint-disable-line react-hooks/exhaustive-deps
}

export const TRACK_MIME = 'application/x-tubify-track';
const LIST_MIME = 'application/x-tubify-list';

/** HTML5 drag & drop: reorder within a list, and drag tracks onto sidebar playlists. */
export function useReorder(listId: string, onMove?: (from: number, to: number) => void) {
  const [over, setOver] = useState<{ i: number; after: boolean } | null>(null);
  const rowProps = (i: number, track: Track) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData(TRACK_MIME, JSON.stringify(track));
      e.dataTransfer.setData(`${LIST_MIME}:${listId}`, String(i));
      e.dataTransfer.setData('text/plain', `https://youtu.be/${track.id}`);
    },
    onDragOver: (e: DragEvent) => {
      if (!onMove || !e.dataTransfer.types.includes(`${LIST_MIME}:${listId}`)) return;
      e.preventDefault();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const after = e.clientY > r.top + r.height / 2;
      if (over?.i !== i || over.after !== after) setOver({ i, after });
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      const raw = e.dataTransfer.getData(`${LIST_MIME}:${listId}`);
      setOver(null);
      if (!onMove || raw === '') return;
      e.preventDefault();
      const from = Number(raw);
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      let to = e.clientY > r.top + r.height / 2 ? i + 1 : i;
      if (from < to) to--;
      if (from !== to) onMove(from, to);
    },
    onDragEnd: () => setOver(null),
  });
  return { rowProps, over };
}

export function dropTrack(e: DragEvent): Track | null {
  try {
    return JSON.parse(e.dataTransfer.getData(TRACK_MIME));
  } catch {
    return null;
  }
}
