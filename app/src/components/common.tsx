import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type SyntheticEvent } from 'react';
import { Clock, Heart, Music, Pause, Play } from 'lucide-react';
import type { Track } from '../types';
import { thumb } from '../lib/format';
import { player, useStore } from '../lib/store';
import { useColor } from '../lib/color';
import type { Mix } from '../lib/recs';

/** Fade images in once decoded instead of popping in line by line. */
export const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add('ld');

export function Thumb({ id, size, wide, className = '' }: { id: string; size?: number; wide?: boolean; className?: string }) {
  // mq (320x180) has no letterbox; hq (480x360) does, so square hq crops are scaled to hide the bars.
  const big = wide || !size || size > 72;
  return (
    <div className={`thumb${wide ? ' wide' : ''}${big && !wide ? ' crop' : ''} ${className}`} style={size ? { width: size, height: size } : undefined}>
      <img src={thumb(id, big ? 'hq' : 'mq')} alt="" loading="lazy" decoding="async" draggable={false} onLoad={onImgLoad} />
    </div>
  );
}

export function PlaylistCover({ tracks, kind, size, className = '' }: { tracks: Track[]; kind?: 'liked' | 'recent'; size?: number; className?: string }) {
  const style = size ? { width: size, height: size } : undefined;
  const icon = size && size < 64 ? 16 : 40;
  if (kind === 'liked')
    return (
      <div className={`cover liked ${className}`} style={style}>
        <Heart size={icon} fill="currentColor" />
      </div>
    );
  if (kind === 'recent')
    return (
      <div className={`cover recent ${className}`} style={style}>
        <Clock size={icon} />
      </div>
    );
  if (tracks.length >= 4)
    return (
      <div className={`cover mosaic ${className}`} style={style}>
        {tracks.slice(0, 4).map((t) => (
          <img key={t.id} src={thumb(t.id, 'mq')} alt="" loading="lazy" draggable={false} onLoad={onImgLoad} />
        ))}
      </div>
    );
  if (tracks.length) return <Thumb id={tracks[0].id} size={size} className={className} />;
  return (
    <div className={`cover empty ${className}`} style={style}>
      <Music size={icon} />
    </div>
  );
}

const MIX_COLORS = ['#1ed7c3', '#f5d23f', '#f2603f', '#7aa7ff', '#c98bf7', '#7ed86a'];

/** Spotify-style mix art. Daily Mixes get the colored "Daily Mix 01" tags; the rest a name over a band of color. */
export function MixCover({ mix, size, className = '' }: { mix: Mix; size?: number; className?: string }) {
  const color = useColor(mix.seed.id);
  const n = /^daily-(\d+)$/.exec(mix.id)?.[1];
  const kind = n ? 'daily' : mix.id;
  const accent = n ? MIX_COLORS[(+n - 1) % MIX_COLORS.length] : color;
  return (
    <div className={`cover mix ${kind} ${className}`} style={{ ...(size ? { width: size, height: size } : null), ['--mix' as string]: accent }}>
      <img src={thumb(mix.seed.id, 'hq')} alt="" loading="lazy" draggable={false} />
      {n ? (
        <>
          <span className="mix-logo" />
          <span className="mix-tag">Daily Mix</span>
          <span className="mix-num">{n.padStart(2, '0')}</span>
        </>
      ) : (
        <span className="mix-label">{mix.name}</span>
      )}
    </div>
  );
}

export const Equalizer = ({ paused }: { paused?: boolean }) => (
  <span className={`eq${paused ? ' paused' : ''}`} aria-hidden>
    <i />
    <i />
    <i />
    <i />
  </span>
);

export function PlayButton({ playing, onClick, size = 48, className = '' }: { playing?: boolean; onClick: () => void; size?: number; className?: string }) {
  const icon = Math.round(size * 0.42);
  return (
    <button
      className={`play-btn ${className}`}
      style={{ width: size, height: size }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={playing ? 'Pause' : 'Play'}
    >
      {playing ? <Pause size={icon} fill="currentColor" strokeWidth={0} /> : <Play size={icon} fill="currentColor" strokeWidth={0} className="nudge" />}
    </button>
  );
}

const AddIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
    <path d="M11.75 8a.75.75 0 0 1-.75.75H8.75V11a.75.75 0 0 1-1.5 0V8.75H5a.75.75 0 0 1 0-1.5h2.25V5a.75.75 0 0 1 1.5 0v2.25H11a.75.75 0 0 1 .75.75z" />
  </svg>
);

const SavedIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
    <circle cx="8" cy="8" r="8" fill="currentColor" />
    <path d="M11.53 5.47a.75.75 0 0 1 0 1.06l-4 4a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 1 1 1.06-1.06L7 8.94l3.47-3.47a.75.75 0 0 1 1.06 0z" fill="#000" />
  </svg>
);

export function LikeButton({ track, size = 16, className = '' }: { track: Track; size?: number; className?: string }) {
  const liked = useStore((s) => s.liked.some((t) => t.id === track.id));
  const [pop, setPop] = useState(false);
  return (
    <button
      className={`icon-btn like${liked ? ' on' : ''}${pop ? ' pop' : ''} ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        setPop(true);
        player.toggleLike(track);
      }}
      onAnimationEnd={() => setPop(false)}
      aria-label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
      title={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
    >
      {liked ? <SavedIcon size={size} /> : <AddIcon size={size} />}
    </button>
  );
}

/** Scrolls its text back and forth only when it overflows. */
export function Marquee({ children, className = '' }: { children: ReactNode; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [dist, setDist] = useState(0);
  useLayoutEffect(() => {
    const o = outer.current!;
    const i = inner.current!;
    const measure = () => setDist(Math.max(0, Math.ceil(i.scrollWidth - o.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [children]);
  return (
    <div
      ref={outer}
      className={`marquee${dist ? ' on' : ''} ${className}`}
      style={{ ['--dist' as string]: `-${dist}px`, ['--dur' as string]: `${Math.max(7, dist / 18)}s` }}
    >
      <span ref={inner}>{children}</span>
    </div>
  );
}

/** Pointer-driven slider; fill and knob move with transforms only (no layout per tick). */
export function Slider({ value, max, onCommit, onScrub, label, step, smooth, className = '' }: {
  value: number;
  max: number;
  onCommit: (v: number) => void;
  onScrub?: (v: number | null) => void;
  label: string;
  step?: number;
  smooth?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const v = drag ?? value;
  const pct = max > 0 ? Math.min(100, Math.max(0, (v / max) * 100)) : 0;
  const at = (x: number) => {
    const r = ref.current!.getBoundingClientRect();
    return Math.min(max, Math.max(0, ((x - r.left) / r.width) * max));
  };
  const update = (n: number | null) => {
    setDrag(n);
    onScrub?.(n);
  };
  const down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    update(at(e.clientX));
  };
  const moveP = (e: PointerEvent) => drag !== null && update(at(e.clientX));
  const up = (e: PointerEvent) => {
    if (drag === null) return;
    const n = at(e.clientX);
    update(null);
    onCommit(n);
  };
  const key = (e: KeyboardEvent) => {
    const d = step ?? max / 20;
    const k = e.key;
    if (k !== 'ArrowRight' && k !== 'ArrowLeft' && k !== 'ArrowUp' && k !== 'ArrowDown') return;
    e.preventDefault();
    e.stopPropagation();
    onCommit(Math.min(max, Math.max(0, value + (k === 'ArrowRight' || k === 'ArrowUp' ? d : -d))));
  };
  const tf = { transform: `translateX(${pct - 100}%)` };
  return (
    <div
      ref={ref}
      className={`slider${drag !== null ? ' dragging' : ''}${smooth ? ' smooth' : ''} ${className}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(v)}
      onPointerDown={down}
      onPointerMove={moveP}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <div className="slider-track">
        <div className="slider-fill" style={tf} />
      </div>
      <div className="slider-knob" style={tf}>
        <span />
      </div>
    </div>
  );
}
