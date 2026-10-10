import { useMemo, useState, type DragEvent, type ReactNode } from 'react';
import { LayoutGrid, Library, List, Maximize2, Minimize2, Plus, Search, X, Pin, Volume2 } from 'lucide-react';
import { navigate, useRouter } from '../lib/router';
import { player, useStore } from '../lib/store';
import { dropTrack, TRACK_MIME, useMedia } from '../lib/hooks';
import { PlaylistCover, onImgLoad } from './common';
import { songs } from '../lib/format';
import type { Track } from '../types';

type Filter = 'playlists' | 'artists' | null;

interface ItemProps {
  k: string;
  active: boolean;
  onClick: () => void;
  cover: ReactNode;
  title: string;
  sub: string;
  pinned?: boolean;
  nowPlaying?: boolean;
  dropOn: string | null;
  collapsed: boolean;
  dropProps?: Record<string, (e: DragEvent) => void>;
}

function LibItem({ k, active, onClick, cover, title, sub, pinned, nowPlaying, dropOn, collapsed, dropProps }: ItemProps) {
  return (
    <button className={`lib-item${active ? ' active' : ''}${dropOn === k ? ' drop' : ''}`} onClick={onClick} title={collapsed ? title : undefined} {...dropProps}>
      {cover}
      <span className="lib-meta">
        <span className={`lib-title${nowPlaying ? ' green' : ''}`}>{title}</span>
        <span className="lib-sub">
          {pinned && <Pin size={12} className="green" fill="currentColor" />}
          {sub}
        </span>
      </span>
      {nowPlaying && <Volume2 size={16} className="green lib-np" />}
    </button>
  );
}

export function Sidebar() {
  const narrow = useMedia('(max-width: 719px)');
  const route = useRouter((s) => s.route);
  const playlists = useStore((s) => s.playlists);
  const liked = useStore((s) => s.liked);
  const recent = useStore((s) => s.recent);
  const wide = useStore((s) => s.libWide) && !narrow;
  const collapsed = (useStore((s) => s.collapsed) || narrow) && !wide;
  const sz = wide ? undefined : 48; // grid cards size their covers to the column
  const ctxKey = useStore((s) => s.context.key);
  const playing = useStore((s) => s.playing);
  const [filter, setFilter] = useState<Filter>(null);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [alpha, setAlpha] = useState(false);
  const [dropOn, setDropOn] = useState<string | null>(null);

  // Artists the user actually listens to, ranked by how often they show up in the library.
  const artists = useMemo(() => {
    const count = new Map<string, { n: number; id: string }>();
    for (const t of [...liked, ...playlists.flatMap((p) => p.tracks), ...recent]) {
      const c = count.get(t.artist);
      count.set(t.artist, { n: (c?.n ?? 0) + 1, id: c?.id ?? t.id });
    }
    const top = [...count.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 20);
    return alpha ? top.sort((a, b) => a[0].localeCompare(b[0])) : top;
  }, [liked, playlists, recent, alpha]);
  const lists = useMemo(() => (alpha ? [...playlists].sort((a, b) => a.name.localeCompare(b.name)) : playlists), [playlists, alpha]);

  // Opening anything from the wide grid drops back to the normal layout.
  const go = (path: string) => {
    if (wide) player.toggleLibWide();
    navigate(path);
  };
  const create = () => go(`/playlist/${player.createPlaylist()}`);
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase());
  const isRoute = (name: string, id?: string) => route.name === name && (!id || (route.name === 'playlist' && route.id === id));

  const drop = (key: string, onTrack: (t: Track) => void) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(TRACK_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDropOn(key);
    },
    onDragLeave: () => setDropOn(null),
    onDrop: (e: DragEvent) => {
      setDropOn(null);
      const t = dropTrack(e);
      if (t) onTrack(t);
    },
  });

  const showPlaylists = filter !== 'artists';
  const showArtists = filter !== 'playlists';

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${wide ? ' wide' : ''}`}>
      <section className="block lib-block">
        <header className="lib-head">
          <button className="nav-link lib-toggle" onClick={player.toggleCollapsed} title={collapsed ? 'Expand Your Library' : 'Collapse Your Library'}>
            <Library size={24} />
            <span>Your Library</span>
          </button>
          <div className="lib-actions">
            {wide ? (
              <button className="pill-btn lib-create-pill" onClick={create}>
                <Plus size={18} /> Create
              </button>
            ) : (
              <button className="icon-btn round lib-create" onClick={create} title="Create playlist">
                <Plus size={20} />
              </button>
            )}
            <button className="icon-btn round lib-all" onClick={player.toggleLibWide} title={wide ? 'Reduce Your Library' : 'Expand Your Library'}>
              {wide ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </header>

        <div className="chips">
          {(['playlists', 'artists'] as const).map((f) => (
            <button key={f} className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(filter === f ? null : f)}>
              {filter === f && <X size={14} />}
              {f === 'playlists' ? 'Playlists' : 'Artists'}
            </button>
          ))}
        </div>

        <div className="lib-search">
          <button className={`icon-btn${searchOpen ? ' hidden' : ''}`} onClick={() => setSearchOpen(true)} title="Search in Your Library">
            <Search size={16} />
          </button>
          {searchOpen && (
            <label className="lib-input">
              <Search size={14} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => !q && setSearchOpen(false)} placeholder="Search in Your Library" />
            </label>
          )}
          <button className="lib-sort" onClick={() => setAlpha(!alpha)} title="Sort by">
            {alpha ? 'Alphabetical' : 'Recents'}
            {wide ? <LayoutGrid size={16} /> : <List size={16} />}
          </button>
        </div>

        <div className="lib-list scroll">
          {showPlaylists && (
            <>
              {match('Liked Songs') && (
                <LibItem dropOn={dropOn} collapsed={collapsed}
                  k="liked"
                  active={isRoute('liked')}
                  onClick={() => go('/liked')}
                  cover={<PlaylistCover tracks={[]} kind="liked" size={sz} />}
                  title="Liked Songs"
                  sub={`Playlist • ${songs(liked.length)}`}
                  pinned
                  nowPlaying={playing && ctxKey === 'liked'}
                  dropProps={drop('liked', (t) => !liked.some((x) => x.id === t.id) && player.toggleLike(t))}
                />
              )}
              {match('Recently Played') && recent.length > 0 && (
                <LibItem dropOn={dropOn} collapsed={collapsed}
                  k="recent"
                  active={isRoute('recent')}
                  onClick={() => go('/recent')}
                  cover={<PlaylistCover tracks={[]} kind="recent" size={sz} />}
                  title="Recently Played"
                  sub={`Playlist • ${songs(recent.length)}`}
                  nowPlaying={playing && ctxKey === 'recent'}
                />
              )}
              {lists.filter((p) => match(p.name)).map((p) => (
                <LibItem dropOn={dropOn} collapsed={collapsed}
                  key={p.id}
                  k={p.id}
                  active={isRoute('playlist', p.id)}
                  onClick={() => go(`/playlist/${p.id}`)}
                  cover={<PlaylistCover tracks={p.tracks} size={sz} />}
                  title={p.name}
                  sub={`Playlist • ${songs(p.tracks.length)}`}
                  nowPlaying={playing && ctxKey === `playlist:${p.id}`}
                  dropProps={drop(p.id, (t) => player.addToPlaylist(p.id, t))}
                />
              ))}
            </>
          )}
          {showArtists &&
            artists.filter(([a]) => match(a)).map(([a, { id }]) => (
              <LibItem dropOn={dropOn} collapsed={collapsed}
                key={a}
                k={`artist:${a}`}
                active={route.name === 'search' && route.q === a}
                onClick={() => go(`/search/${encodeURIComponent(a)}`)}
                cover={<img className="artist-img" src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" loading="lazy" onLoad={onImgLoad} />}
                title={a}
                sub="Artist"
              />
            ))}
          {!playlists.length && !collapsed && filter !== 'artists' && (
            <div className="lib-cta">
              <strong>Create your first playlist</strong>
              <span>It's easy, we'll help you</span>
              <button className="pill-btn" onClick={create}>Create playlist</button>
            </div>
          )}
        </div>
      </section>
    </aside>
  );
}
