import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { isTight, useStore } from '../lib/store';

const SIDEBAR = { min: 240, max: 420, def: 280, collapseBelow: 180 };
const PANEL = { min: 280, max: 480, def: 320 };
const MAIN_MIN = 400;
const CHROME = 32; // shell padding + gutters

const clamp = (v: number, lo: number, hi: number) => Math.round(Math.min(Math.max(v, lo), Math.max(lo, hi)));

/** Applies a width for one side, keeping the main view at least MAIN_MIN wide. */
function apply(side: 'left' | 'right', w: number) {
  const s = useStore.getState();
  if (side === 'left') {
    if (w < SIDEBAR.collapseBelow) {
      if (!s.collapsed) useStore.setState({ collapsed: true });
      return;
    }
    const room = innerWidth - CHROME - MAIN_MIN - (s.panel && !isTight() ? s.panelW : 0);
    useStore.setState({ collapsed: false, sidebarW: clamp(w, SIDEBAR.min, Math.min(SIDEBAR.max, room)), ...(isTight() && { panel: null }) });
  } else {
    const room = innerWidth - CHROME - MAIN_MIN - (s.collapsed ? 72 : s.sidebarW);
    useStore.setState({ panelW: clamp(w, PANEL.min, Math.min(PANEL.max, room)) });
  }
}

const current = (side: 'left' | 'right') => {
  const s = useStore.getState();
  return side === 'left' ? (s.collapsed ? 72 : s.sidebarW) : s.panelW;
};

/** Drag handle living in the gutter next to the sidebar or the right panel. Double-click resets. */
export function Resizer({ side }: { side: 'left' | 'right' }) {
  const width = useStore((s) => (side === 'left' ? (s.collapsed ? 72 : s.sidebarW) : s.panelW));
  const drag = useRef<{ x: number; w: number } | null>(null);
  const dir = side === 'left' ? 1 : -1;

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, w: current(side) };
    document.documentElement.classList.add('resizing');
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (d) apply(side, d.w + (e.clientX - d.x) * dir);
  };
  const up = () => {
    drag.current = null;
    document.documentElement.classList.remove('resizing');
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    apply(side, current(side) + (e.key === 'ArrowRight' ? 16 : -16) * dir);
  };
  const reset = () =>
    side === 'left'
      ? useStore.setState({ collapsed: false, sidebarW: SIDEBAR.def, ...(isTight() && { panel: null }) })
      : useStore.setState({ panelW: PANEL.def });

  return (
    <div
      className={`rz rz-${side}`}
      role="separator"
      aria-orientation="vertical"
      aria-label={side === 'left' ? 'Resize Your Library' : 'Resize side panel'}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onDoubleClick={reset}
      onKeyDown={key}
    />
  );
}
