import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, Archive, ChevronLeft, ChevronRight, Ellipsis, Heart, History, House, Keyboard, Library, LogIn, LogOut, RefreshCw, Search, Upload, User, X } from 'lucide-react';
import { back, forward, navigate, useRouter } from '../lib/router';
import { useUI } from '../lib/ui';
import { hitKey, player, useStore, type Hit } from '../lib/store';
import { importPlaylist } from '../lib/io';
import { configured, signOut, sync, useAuth } from '../lib/sync';
import { toast } from '../lib/toast';
import { inTauri } from '../lib/youtube';
import { useIsMobile } from '../lib/hooks';
import { HomeChips } from '../views/Home';
import { PlayButton, PlaylistCover, Thumb, onImgLoad } from './common';
import { songs } from '../lib/format';
import { useOutside } from './PlayerBar';
import { WindowControls, isTauri } from './TitleBar';

const drag = isTauri ? { 'data-tauri-drag-region': true } : {};

/** Spotify's top strip: app menu + history on the left, Home + search centered, profile + caption buttons on the right. */
export function GlobalBar() {
  const route = useRouter((s) => s.route);
  const idx = useRouter((s) => s.idx);
  const max = useRouter((s) => s.max);
  return (
    <header className="globalbar" {...drag}>
      <div className="gb-side" {...drag}>
        <AppMenu />
        <button className="icon-btn gb-nav" onClick={back} disabled={idx <= 0} title="Go back">
          <ChevronLeft size={22} />
        </button>
        <button className="icon-btn gb-nav" onClick={forward} disabled={idx >= max} title="Go forward">
          <ChevronRight size={22} />
        </button>
      </div>
      <div className="gb-center" {...drag}>
        <button className={`gb-home${route.name === 'home' ? ' on' : ''}`} onClick={() => navigate('/home')} title="Home">
          <House size={24} fill={route.name === 'home' ? 'currentColor' : 'none'} />
        </button>
        <SearchInput q={route.name === 'search' ? route.q : ''} browse />
      </div>
      <div className="gb-side end" {...drag}>
        <ProfileMenu />
        {isTauri && <WindowControls />}
      </div>
    </header>
  );
}

/** Sticky header inside the main view: home filter chips, or the page title + play button once scrolled. */
export function TopBar({ scrolled }: { scrolled: boolean }) {
  const route = useRouter((s) => s.route);
  const page = useUI((s) => s.page);
  const mobile = useIsMobile();
  return (
    <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
      <div className="topbar-bg" />
      {route.name === 'home' ? (
        <HomeChips />
      ) : (
        <div className={`topbar-title${scrolled && page.title ? ' show' : ''}`}>
          {page.onPlay && <PlayButton size={40} playing={page.playing} onClick={page.onPlay} />}
          <span>{page.title}</span>
        </div>
      )}
      {mobile && <ProfileMenu />}
    </header>
  );
}

export function SearchInput({ q, browse, mountFocus }: { q: string; browse?: boolean; mountFocus?: boolean }) {
  const [v, setV] = useState(q);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const ref = useRef<HTMLInputElement>(null);
  const wrap = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const focus = useUI((s) => s.focusSearch);
  const onBrowse = useRouter((s) => s.route.name === 'search' && !s.route.q);
  const go = (s: string) => navigate(`/search/${encodeURIComponent(s)}`, useRouter.getState().route.name === 'search');
  const items = useDropItems(v.trim(), !!browse && open);
  const show = open && items.length > 0;

  useEffect(() => setSel(-1), [v, open]);
  useEffect(() => {
    if (focus || mountFocus) ref.current?.focus();
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setV((cur) => (cur.trim() === q ? cur : q)); // external change (genre tile, artist link, leaving search)
  }, [q]);
  useEffect(() => {
    const t = setTimeout(() => v.trim() !== q && go(v.trim()), 350);
    return () => clearTimeout(t);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (h: Hit) => {
    setOpen(false);
    ref.current?.blur();
    if (h.kind === 'query') {
      setV(h.q);
      go(h.q);
      return player.addHit(h);
    }
    if (h.kind === 'track') return player.playList([h.track], 0, { key: `search:${h.track.title}`, name: h.track.title });
    player.addHit(h);
    if (h.kind === 'artist') navigate(`/search/${encodeURIComponent(h.name)}`);
    else navigate(h.id === 'liked' || h.id === 'recent' ? `/${h.id}` : `/playlist/${h.id}`);
  };

  return (
    <div className="search-wrap popover-anchor" ref={wrap}>
    <label className={`search-pill${show ? ' dropped' : ''}`}>
      <Search size={browse ? 24 : 20} />
      <input
        ref={ref}
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onMouseDown={() => setOpen(true)}
        onKeyDown={(e) => {
          if (show && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            const d = e.key === 'ArrowDown' ? 1 : -1;
            return setSel((i) => {
              const j = i + d; // -1 = back in the input
              return j < -1 ? items.length - 1 : j >= items.length ? -1 : j;
            });
          }
          if (e.key === 'Enter') {
            if (show && sel >= 0 && sel < items.length) return pick(items[sel].hit);
            setOpen(false);
            if (v.trim()) {
              go(v.trim());
              player.addSearch(v.trim());
              player.addHit({ kind: 'query', q: v.trim() });
            }
          }
          if (e.key === 'Escape') {
            if (show) return setOpen(false);
            ref.current?.blur();
          }
        }}
        placeholder="What do you want to play?"
        spellCheck={false}
        role="combobox"
        aria-expanded={show}
      />
      {v && (
        <button
          className="icon-btn"
          onClick={(e) => {
            e.preventDefault();
            setV('');
            ref.current?.focus();
          }}
          title="Clear search"
        >
          <X size={20} />
        </button>
      )}
      {browse && (
        <>
          <span className="sp-div" />
          <button
            className={`icon-btn sp-browse${onBrowse ? ' on' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              setV('');
              navigate('/search');
            }}
            title="Browse"
          >
            <Archive size={22} />
          </button>
        </>
      )}
    </label>
    {show && (
      <div className="popover down search-drop" role="listbox" onMouseDown={(e) => e.preventDefault()}>
        <div className="popover-title">{v.trim() ? 'From your library' : 'Recent searches'}</div>
        {items.map((it, i) => (
          <div key={it.key} className={`sd-row${i === sel ? ' sel' : ''}`} role="option" aria-selected={i === sel} onClick={() => pick(it.hit)} onMouseEnter={() => setSel(i)}>
            {it.art}
            <span className="sd-meta">
              <span className="sd-title">{it.title}</span>
              {it.sub && <span className="sd-sub">{it.sub}</span>}
            </span>
            {it.recent && (
              <button
                className="icon-btn sd-x"
                onClick={(e) => {
                  e.stopPropagation();
                  player.removeHit(it.key);
                }}
                title="Remove"
              >
                <X size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    )}
    </div>
  );
}

interface DropItem {
  key: string;
  hit: Hit;
  art: ReactNode;
  title: string;
  sub?: string;
  recent?: boolean; // removable history row
}

/** Rows for the search dropdown: recent picks when empty, matches from the library while typing. */
function useDropItems(q: string, on: boolean): DropItem[] {
  const hits = useStore((s) => s.hits);
  const playlists = useStore((s) => s.playlists);
  const liked = useStore((s) => s.liked);
  const recent = useStore((s) => s.recent);
  return useMemo(() => {
    if (!on) return [];
    const list = (id: string) =>
      id === 'liked' ? { name: 'Liked Songs', tracks: liked, kind: 'liked' as const }
        : id === 'recent' ? { name: 'Recently Played', tracks: recent, kind: 'recent' as const }
        : (() => {
          const p = playlists.find((x) => x.id === id);
          return p && { name: p.name, tracks: p.tracks, kind: undefined };
        })();
    const row = (h: Hit, isRecent: boolean): DropItem | null => {
      const key = hitKey(h);
      if (h.kind === 'track')
        return { key, hit: h, recent: isRecent, art: <Thumb id={h.track.id} size={48} />, title: h.track.title, sub: `Song • ${h.track.artist}` };
      if (h.kind === 'artist')
        return {
          key, hit: h, recent: isRecent, title: h.name, sub: 'Artist',
          art: <img className="artist-img" src={`https://i.ytimg.com/vi/${h.id}/mqdefault.jpg`} alt="" onLoad={onImgLoad} />,
        };
      if (h.kind === 'query')
        return { key, hit: h, recent: isRecent, title: h.q, art: <span className="sd-icon"><Search size={20} /></span> };
      const p = list(h.id);
      return p ? { key, hit: h, recent: isRecent, title: p.name, sub: `Playlist • ${songs(p.tracks.length)}`, art: <PlaylistCover tracks={p.tracks} kind={p.kind} size={48} /> } : null;
    };
    if (!q) return hits.map((h) => row(h, true)).filter((x): x is DropItem => !!x).slice(0, 8);

    const m = (s: string) => s.toLowerCase().includes(q.toLowerCase());
    const out: Hit[] = [];
    for (const h of hits) if (h.kind === 'query' && m(h.q) && h.q.toLowerCase() !== q.toLowerCase()) out.push(h);
    if (m('Liked Songs')) out.push({ kind: 'playlist', id: 'liked' });
    for (const p of playlists) if (m(p.name)) out.push({ kind: 'playlist', id: p.id });
    const seenA = new Set<string>();
    const seenT = new Set<string>();
    for (const t of [...liked, ...recent, ...playlists.flatMap((p) => p.tracks)]) {
      if (m(t.artist) && !seenA.has(t.artist)) {
        seenA.add(t.artist);
        out.push({ kind: 'artist', name: t.artist, id: t.id });
      }
      if (m(t.title) && !seenT.has(t.id)) {
        seenT.add(t.id);
        out.push({ kind: 'track', track: t });
      }
    }
    return out.slice(0, 7).map((h) => row(h, false)).filter((x): x is DropItem => !!x);
  }, [on, q, hits, playlists, liked, recent]);
}

function useMenu() {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return { open, setOpen, ref, act };
}

function AppMenu() {
  const { open, setOpen, ref, act } = useMenu();
  return (
    <div className="popover-anchor" ref={ref}>
      <button className={`icon-btn gb-nav${open ? ' lit' : ''}`} onClick={() => setOpen(!open)} title="Menu">
        <Ellipsis size={22} />
      </button>
      {open && (
        <div className="popover down">
          <button className="menu-item" onClick={act(() => useUI.setState({ shortcuts: true }))}>
            <Keyboard size={16} /> Keyboard shortcuts
          </button>
          <button className="menu-item" onClick={act(importPlaylist)}>
            <Upload size={16} /> Import playlist…
          </button>
          {inTauri && (
            <button className="menu-item" onClick={act(() => useUI.setState((s) => ({ stats: !s.stats })))}>
              <Activity size={16} /> Performance stats
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const { open, setOpen, ref, act } = useMenu();
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const syncNow = () => sync().then((ok) => toast(ok ? 'Library synced' : "Couldn't sync — check your connection"));
  return (
    <div className="popover-anchor profile" ref={ref}>
      <button className={`avatar${user ? ' in' : ''}`} onClick={() => setOpen(!open)} title={user?.email || 'Profile'}>
        {user ? (user.email[0] ?? '?').toUpperCase() : <User size={18} strokeWidth={2.5} />}
      </button>
      {open && (
        <div className="popover down end">
          {user && <div className="popover-title">{user.email}</div>}
          <button className="menu-item" onClick={act(() => navigate('/library'))}>
            <Library size={16} /> Your Library
          </button>
          <button className="menu-item" onClick={act(() => navigate('/liked'))}>
            <Heart size={16} /> Liked Songs
          </button>
          <button className="menu-item" onClick={act(() => navigate('/recent'))}>
            <History size={16} /> Recently played
          </button>
          <hr />
          <button className="menu-item" onClick={act(importPlaylist)}>
            <Upload size={16} /> Import playlist…
          </button>
          <button className="menu-item" onClick={act(player.clearRecent)}>
            <X size={16} /> Clear listening history
          </button>
          {configured && <hr />}
          {configured &&
            (user ? (
              <>
                <button className="menu-item" onClick={act(syncNow)} disabled={status === 'syncing'}>
                  <RefreshCw size={16} className={status === 'syncing' ? 'spin' : ''} />
                  {status === 'syncing' ? 'Syncing…' : status === 'offline' ? 'Offline — retry sync' : 'Sync now'}
                </button>
                <button className="menu-item" onClick={act(signOut)}>
                  <LogOut size={16} /> Log out
                </button>
              </>
            ) : (
              <button className="menu-item" onClick={act(() => useUI.setState({ auth: true }))}>
                <LogIn size={16} /> Log in to sync
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
