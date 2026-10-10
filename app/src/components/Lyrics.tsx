import { useEffect, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { Track } from '../types';
import { useLyrics, useLyricsOffset, type Line } from '../lib/lyrics';
import { useProgress } from '../lib/engine';
import { player, useStore } from '../lib/store';

/** Last line that has started at time t (binary search). */
function lineAt(lines: Line[], t: number) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].t <= t) (ans = mid), (lo = mid + 1);
    else hi = mid - 1;
  }
  return ans;
}

/**
 * Time-synced lyrics: the current line lights up and stays in view; click a line to jump there.
 * `card` is the small preview in the Now Playing panel (renders nothing if there are no lyrics).
 */
export function Lyrics({ track, size = 'panel' }: { track: Track; size?: 'panel' | 'card' | 'full' }) {
  const state = useLyrics(track);
  const [off, setOff] = useLyricsOffset(track.id);
  const time = useProgress((s) => s.time);
  const box = useRef<HTMLDivElement>(null);
  const touched = useRef(0); // user scrolled — pause auto-follow for a moment
  const lines = state.status === 'ready' ? state.data.lines : null;
  const active = lines ? lineAt(lines, time - off + 0.25) : -1;

  useEffect(() => {
    const el = box.current;
    if (!el || active < 0 || performance.now() - touched.current < 3000) return;
    const row = el.querySelector<HTMLElement>(`[data-i="${active}"]`);
    if (row) el.scrollTo({ top: row.offsetTop - el.clientHeight * 0.35, behavior: 'smooth' });
  }, [active]);

  useEffect(() => {
    box.current?.scrollTo({ top: 0 });
    touched.current = 0;
  }, [track.id]);

  if (state.status === 'loading')
    return (
      <div className={`lyrics is-${size}`} aria-busy>
        {[70, 90, 55, 80, 65].map((w, i) => (
          <i key={i} className="lyr-sk" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  if (state.status !== 'ready') {
    if (size === 'card') return null;
    return (
      <div className={`lyrics is-${size}`}>
        <p className="lyr-msg">{state.status === 'none' ? "Looks like we don't have lyrics for this song." : "Couldn't load lyrics — check your connection."}</p>
      </div>
    );
  }
  const { plain, instrumental } = state.data;
  if (instrumental && !lines && !plain)
    return size === 'card' ? null : (
      <div className={`lyrics is-${size}`}>
        <p className="lyr-msg">♪ Instrumental</p>
      </div>
    );

  const seek = (l: Line) => {
    player.seek(Math.max(0, l.t + off));
    if (!useStore.getState().playing) useStore.setState({ playing: true });
  };
  const mark = () => (touched.current = performance.now());

  return (
    <>
      <div ref={box} className={`lyrics is-${size}${lines ? '' : ' plain'}`} onWheel={mark} onTouchMove={mark}>
        {lines
          ? lines.map((l, i) => (
              <p key={i} data-i={i} className={i === active ? 'on' : i < active ? 'past' : ''} onClick={() => seek(l)}>
                {l.text || '♪'}
              </p>
            ))
          : plain!.split(/\r?\n/).map((l, i) => <p key={i}>{l || '\u00a0'}</p>)}
      </div>
      {size !== 'card' && (
        <footer className="lyr-foot">
          {lines ? (
            <span className="lyr-sync" title="Nudge if the lyrics run early or late (saved for this song)">
              Sync
              <button className="icon-btn" onClick={() => setOff(off - 0.5)} aria-label="Lyrics earlier">
                <Minus size={14} />
              </button>
              <span className="lyr-off">{off > 0 ? '+' : ''}{off.toFixed(1)}s</span>
              <button className="icon-btn" onClick={() => setOff(off + 0.5)} aria-label="Lyrics later">
                <Plus size={14} />
              </button>
            </span>
          ) : (
            <span>These lyrics aren't synced to the song yet.</span>
          )}
          <span>Lyrics from LRCLIB</span>
        </footer>
      )}
    </>
  );
}
