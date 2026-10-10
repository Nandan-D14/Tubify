import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Route } from './types';
import { navigate, useRouter } from './lib/router';
import { isTight, player, useStore } from './lib/store';
import { engine } from './lib/engine';
import { useUI } from './lib/ui';
import { useIsMobile } from './lib/hooks';
import { Sidebar } from './components/Sidebar';
import { GlobalBar, TopBar } from './components/TopBar';
import { PlayerBar, enterFullscreen } from './components/PlayerBar';
import { RightPanel } from './components/RightPanel';
import { ExpandedView } from './components/Expanded';
import { VideoHost } from './components/VideoHost';
import { Resizer } from './components/Resizer';
import { WindowControls, isTauri } from './components/TitleBar';
import { FullPlayer, MiniPlayer, MobileNav } from './components/FullPlayer';
import { AuthDialog, ContextMenu, Shortcuts, StatsOverlay, Toasts } from './components/Overlays';
import { Home } from './views/Home';
import { Search } from './views/Search';
import { LibraryView, PlaylistView } from './views/Playlist';
import { MixView } from './views/Mix';

function View({ route }: { route: Route }) {
  switch (route.name) {
    case 'search': return <Search q={route.q} />;
    case 'playlist': return <PlaylistView kind="playlist" id={route.id} />;
    case 'mix': return <MixView id={route.id} />;
    case 'liked': return <PlaylistView kind="liked" />;
    case 'recent': return <PlaylistView kind="recent" />;
    case 'library': return <LibraryView />;
    default: return <Home />;
  }
}

function Main() {
  const route = useRouter((s) => s.route);
  const color = useUI((s) => s.page.color);
  const ref = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const pageKey = route.name === 'search' ? 'search' : JSON.stringify(route); // typing a query keeps scroll

  useLayoutEffect(() => {
    ref.current!.scrollTop = 0;
    ref.current!.style.setProperty('--hdr', '0');
    setScrolled(false);
  }, [pageKey]);

  // Top bar fades in its color as you scroll; title + play button appear past the hero.
  const onScroll = () => {
    const y = ref.current!.scrollTop;
    ref.current!.style.setProperty('--hdr', String(Math.min(1, y / 240)));
    const s = y > 260;
    setScrolled((p) => (p === s ? p : s));
  };

  return (
    <main ref={ref} className="main block scroll" onScroll={onScroll} style={{ ['--page' as string]: color }}>
      <TopBar scrolled={scrolled} />
      <View route={route} />
    </main>
  );
}

function useShortcuts() {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const s = useStore.getState();
      if (e.key === 'Escape') {
        if (useUI.getState().auth) useUI.setState({ auth: false });
        else if (useUI.getState().shortcuts) useUI.setState({ shortcuts: false });
        else if (s.fullscreen && !document.fullscreenElement) player.setFullscreen(false);
        else if (s.expanded && !t.closest('input, textarea')) player.expand(null);
        else if (s.libWide && !t.closest('input, textarea')) player.toggleLibWide();
        return;
      }
      if (t.closest('input, textarea, [contenteditable="true"]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        return player.togglePlay();
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (t.closest('[role="slider"], [role="separator"]')) return;
        e.preventDefault();
        const d = e.key === 'ArrowRight' ? 1 : -1;
        if (mod) return d > 0 ? player.next() : player.prev();
        return player.seek(Math.max(0, engine.time() + d * 5));
      }
      if (mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        return player.setVolume(s.volume + (e.key === 'ArrowUp' ? 10 : -10));
      }
      if ((mod && k === 'k') || e.key === '/') {
        e.preventDefault();
        navigate('/search');
        return useUI.setState((u) => ({ focusSearch: u.focusSearch + 1 }));
      }
      if (mod && e.shiftKey && k === 'p') {
        e.preventDefault();
        return useUI.setState((u) => ({ stats: !u.stats }));
      }
      if (mod || e.altKey) return;
      const cur = s.queue[s.index];
      switch (e.key === '?' ? '?' : k) {
        case 'm': return player.toggleMute();
        case 'l': return cur && player.toggleLike(cur);
        case 's': return player.toggleShuffle();
        case 'r': return player.cycleRepeat();
        case 'q': return player.setPanel('queue');
        case 'n': return cur && player.setPanel('now');
        case 'v': return player.setVideoMode(s.videoMode === 'video' ? 'art' : 'video');
        case 'p': return cur && player.togglePip();
        case 'f':
          if (!cur) return;
          if (s.fullscreen) {
            player.setFullscreen(false);
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          } else enterFullscreen();
          return;
        case '?': return useUI.setState({ shortcuts: true });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}

/** Shrinking the window with both sides expanded folds Your Library to its icon rail. */
function useSideFit() {
  useEffect(() => {
    const fit = () => {
      const s = useStore.getState();
      if (s.panel && !s.collapsed && isTight()) useStore.setState({ collapsed: true });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
}

export default function App() {
  const mobile = useIsMobile();
  const panel = useStore((s) => s.panel);
  const expanded = useStore((s) => s.expanded);
  const libWide = useStore((s) => s.libWide);
  const has = useStore((s) => s.queue.length > 0);
  const route = useRouter((s) => s.route);
  const sidebarW = useStore((s) => s.sidebarW);
  const panelW = useStore((s) => s.panelW);
  useShortcuts();
  useSideFit();
  // Going anywhere else (search, an artist link, a playlist) leaves the expanded views.
  useEffect(() => {
    const s = useStore.getState();
    if (s.expanded || s.libWide) useStore.setState({ expanded: null, libWide: false });
  }, [route]);
  const xp = !mobile && !!expanded && has;

  return (
    <div
      className={`app${mobile ? ' mobile' : ''}${panel ? ' panel-open' : ''}${xp ? ' xp-on' : ''}${libWide && !mobile ? ' lib-wide' : ''}`}
      style={{ ['--sb-w' as string]: `${sidebarW}px`, ['--rp-w' as string]: `${panelW}px` }}
      onContextMenu={(e) => !(e.target as HTMLElement).closest('input') && e.preventDefault()}
    >
      {!mobile ? (
        <GlobalBar />
      ) : (
        isTauri && (
          <header className="titlebar" data-tauri-drag-region>
            <WindowControls />
          </header>
        )
      )}
      <div className="shell">
        {!mobile && <Sidebar />}
        {!mobile && <Resizer side="left" />}
        <Main />
        {!mobile && <Resizer side="right" />}
        {!mobile && <RightPanel />}
        {xp && <ExpandedView />}
      </div>
      {mobile ? (
        <div className="mobile-dock">
          <MiniPlayer />
          <MobileNav />
        </div>
      ) : (
        <PlayerBar />
      )}
      <VideoHost />
      <FullPlayer />
      <ContextMenu />
      <Toasts />
      <Shortcuts />
      <AuthDialog />
      <StatsOverlay />
    </div>
  );
}
