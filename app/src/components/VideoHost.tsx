import { useEffect, useLayoutEffect, useRef, type PointerEvent } from 'react';
import { Maximize2, X } from 'lucide-react';
import { initEngine } from '../lib/engine';
import { player, useStore } from '../lib/store';
import { useIsMobile } from '../lib/hooks';
import { enterFullscreen } from './PlayerBar';

type Target = 'panel' | 'main' | 'full' | 'pip' | 'hidden';

/**
 * The YouTube iframe lives here for the app's whole lifetime — moving an iframe in the
 * DOM reloads it, so instead this fixed box is positioned over whichever "slot" should
 * show the video (right panel, fullscreen) or floats as a mini player.
 */
export function VideoHost() {
  const hostRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const panel = useStore((s) => s.panel);
  const videoMode = useStore((s) => s.videoMode);
  const pip = useStore((s) => s.pip);
  const fullscreen = useStore((s) => s.fullscreen);
  const expanded = useStore((s) => s.expanded);
  const has = useStore((s) => s.queue.length > 0);
  const mobile = useIsMobile();

  const target: Target = !has
    ? 'hidden'
    : pip
      ? 'pip'
      : fullscreen
        ? videoMode === 'video' ? 'full' : 'hidden'
        : mobile ? 'hidden'
          : expanded ? expanded === 'video' ? 'main' : 'hidden'
            : panel === 'now' && videoMode === 'video' ? 'panel' : 'hidden';

  useEffect(() => {
    initEngine(mountRef.current!);
  }, []);

  useLayoutEffect(() => {
    const host = hostRef.current!;
    const clear = () => ['left', 'top', 'width', 'height', 'clip-path'].forEach((p) => host.style.removeProperty(p));

    if (target === 'hidden') {
      // Fade out where it is, then park it.
      host.classList.remove('shown');
      const t = setTimeout(() => {
        clear();
        host.dataset.mode = 'hidden';
      }, 300);
      return () => clearTimeout(t);
    }
    if (target === 'pip') {
      clear();
      host.dataset.mode = 'pip';
      host.classList.add('shown');
      return;
    }

    host.dataset.mode = target;
    // Track the slot's size too, so the video follows gutter drags.
    let seen: Element | null = null;
    const ro = new ResizeObserver(() => place());
    const place = () => {
      const slot = document.querySelector<HTMLElement>(`[data-video-slot="${target}"]`);
      if (!slot) return;
      if (slot !== seen) {
        if (seen) ro.unobserve(seen);
        ro.observe((seen = slot));
      }
      const r = slot.getBoundingClientRect();
      host.style.left = `${r.left}px`;
      host.style.top = `${r.top}px`;
      host.style.width = `${r.width}px`;
      host.style.height = `${r.height}px`;
      // The host is fixed, so clip it to the slot's scroll area or it would float over the header.
      const box = slot.closest('.scroll')?.getBoundingClientRect();
      const t = box ? Math.max(0, box.top - r.top) : 0;
      const b = box ? Math.max(0, r.bottom - box.bottom) : 0;
      host.style.clipPath = t || b ? `inset(${t}px 0 ${b}px 0 round ${t ? 0 : 8}px ${t ? 0 : 8}px ${b ? 0 : 8}px ${b ? 0 : 8}px)` : '';
      host.classList.add('shown');
    };
    // Follow the slot through panel slide-in / layout transitions, then only on scroll/resize.
    let raf = 0;
    const until = performance.now() + 800;
    const loop = () => {
      place();
      if (performance.now() < until) raf = requestAnimationFrame(loop);
    };
    loop();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [target]);

  // Drag the mini player around by its top bar.
  const drag = useRef<{ x: number; y: number; r: number; b: number } | null>(null);
  const down = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const host = hostRef.current!;
    const cs = getComputedStyle(host);
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, r: parseFloat(cs.right), b: parseFloat(cs.bottom) };
  };
  const moveP = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const host = hostRef.current!;
    const r = Math.min(window.innerWidth - host.offsetWidth - 8, Math.max(8, d.r - (e.clientX - d.x)));
    const b = Math.min(window.innerHeight - host.offsetHeight - 8, Math.max(8, d.b - (e.clientY - d.y)));
    host.style.setProperty('--pip-r', `${r}px`);
    host.style.setProperty('--pip-b', `${b}px`);
  };
  const up = () => (drag.current = null);

  return (
    <div ref={hostRef} className="video-host" data-mode="hidden">
      <div ref={mountRef} className="video-mount" />
      <div className="video-shield" onClick={player.togglePlay} onDoubleClick={() => target !== 'full' && enterFullscreen()} />
      <div className="pip-bar" onPointerDown={down} onPointerMove={moveP} onPointerUp={up} onPointerCancel={up}>
        <button
          className="icon-btn glass"
          onClick={() => {
            player.togglePip();
            player.setVideoMode('video');
            enterFullscreen();
          }}
          title="Expand"
        >
          <Maximize2 size={14} />
        </button>
        <button className="icon-btn glass" onClick={player.togglePip} title="Close mini player">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
