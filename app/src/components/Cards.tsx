import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useColor } from '../lib/color';
import { PlayButton } from './common';

export function Shelf({ title, onShowAll, children }: { title: string; onShowAll?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    const l = el.scrollLeft > 4;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  };
  useLayoutEffect(() => {
    update();
    const ro = new ResizeObserver(update);
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, [children]);
  const scroll = (d: number) => ref.current!.scrollBy({ left: d * ref.current!.clientWidth * 0.8, behavior: 'smooth' });

  return (
    <section className="shelf">
      <header>
        <h2>{onShowAll ? <button className="link" onClick={onShowAll}>{title}</button> : title}</h2>
        {onShowAll && (
          <button className="link show-all" onClick={onShowAll}>
            Show all
          </button>
        )}
      </header>
      <div className="shelf-wrap">
        {edges.l && (
          <button className="shelf-arrow prev" onClick={() => scroll(-1)} aria-label="Scroll left">
            <ChevronLeft size={20} />
          </button>
        )}
        <div ref={ref} className="shelf-row" onScroll={update}>
          {children}
        </div>
        {edges.r && (
          <button className="shelf-arrow next" onClick={() => scroll(1)} aria-label="Scroll right">
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </section>
  );
}

export function Card({ title, sub, cover, onOpen, onPlay, playing, onContextMenu }: {
  title: string;
  sub: string;
  cover: ReactNode;
  onOpen: () => void;
  onPlay: () => void;
  playing?: boolean;
  onContextMenu?: (e: MouseEvent) => void;
}) {
  return (
    <div className={`card${playing ? ' playing' : ''}`} onClick={onOpen} onContextMenu={onContextMenu} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpen()}>
      <div className="card-cover">
        {cover}
        <PlayButton className="card-play" playing={playing} onClick={onPlay} />
      </div>
      <div className="card-title" title={title}>
        {title}
      </div>
      <div className="card-sub">{sub}</div>
    </div>
  );
}

export const SkeletonCards = ({ n = 6 }: { n?: number }) => (
  <>
    {Array.from({ length: n }, (_, i) => (
      <div key={i} className="card skeleton" aria-hidden>
        <div className="card-cover sk" />
        <div className="sk-line" />
        <div className="sk-line short" />
      </div>
    ))}
  </>
);

/** Compact home "quick access" tile — hovering tints the page gradient with its art color. */
export function QuickCard({ title, cover, colorId, fixedColor, onOpen, onPlay, playing, onHover }: {
  title: string;
  cover: ReactNode;
  colorId?: string;
  fixedColor?: string;
  onOpen: () => void;
  onPlay: () => void;
  playing?: boolean;
  onHover: (c: string | null) => void;
}) {
  const color = useColor(colorId);
  return (
    <div
      className={`quick${playing ? ' playing' : ''}`}
      onClick={onOpen}
      onMouseEnter={() => onHover(fixedColor ?? color)}
      onMouseLeave={() => onHover(null)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      {cover}
      <span className="quick-title">{title}</span>
      <PlayButton className="quick-play" size={32} playing={playing} onClick={onPlay} />
    </div>
  );
}
