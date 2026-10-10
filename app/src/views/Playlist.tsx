import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Ellipsis, Pencil, Plus, Search, Shuffle, Trash2, User, X } from 'lucide-react';
import type { Track } from '../types';
import { player, useStore } from '../lib/store';
import { useColor } from '../lib/color';
import { fmtTotal, songs } from '../lib/format';
import { navigate } from '../lib/router';
import { usePage, useSearch } from '../lib/hooks';
import { exportPlaylist } from '../lib/io';
import { PlayButton, PlaylistCover } from '../components/common';
import { MiniRow, TrackTable } from '../components/TrackTable';
import { useOutside } from '../components/PlayerBar';

type Kind = 'playlist' | 'liked' | 'recent';

function EditableTitle({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const size = value.length > 28 ? ' sm' : value.length > 14 ? ' md' : '';
  if (!edit)
    return (
      <h1 className={`hero-title editable${size}`} onClick={() => setEdit(true)} title="Click to rename">
        {value}
      </h1>
    );
  const save = () => {
    setEdit(false);
    if (v.trim() && v.trim() !== value) onSave(v);
    else setV(value);
  };
  return (
    <input
      className={`hero-title hero-input${size}`}
      value={v}
      autoFocus
      maxLength={100}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setV(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') {
          setV(value);
          setEdit(false);
        }
      }}
    />
  );
}

/** "Let's find something for your playlist" — inline search with Add buttons. */
function Finder({ id, open: initial }: { id: string; open: boolean }) {
  const [open, setOpen] = useState(initial);
  const [v, setV] = useState('');
  const [q, setQ] = useState('');
  const playlist = useStore((s) => s.playlists.find((p) => p.id === id));
  const { data, loading } = useSearch(q);
  useEffect(() => {
    const t = setTimeout(() => setQ(v.trim()), 350);
    return () => clearTimeout(t);
  }, [v]);
  if (!open)
    return (
      <div className="finder-closed">
        <button className="link show-all" onClick={() => setOpen(true)}>Find more</button>
      </div>
    );
  const has = (t: Track) => playlist?.tracks.some((x) => x.id === t.id);
  return (
    <section className="finder">
      <header>
        <div>
          <h2>Let's find something for your playlist</h2>
          <label className="filter-input wide">
            <Search size={16} />
            <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Search for songs" />
            {v && (
              <button className="icon-btn" onClick={() => setV('')}>
                <X size={16} />
              </button>
            )}
          </label>
        </div>
        <button className="icon-btn round" onClick={() => setOpen(false)} title="Close">
          <X size={20} />
        </button>
      </header>
      {loading && <p className="muted">Searching…</p>}
      {data.slice(0, 10).map((t, i) => (
        <MiniRow
          key={t.id}
          t={t}
          onPlay={() => player.playList(data, i, { key: `search:${q}`, name: `“${q}”` })}
          right={
            has(t) ? (
              <span className="muted sm">Added</span>
            ) : (
              <button className="pill-btn outline sm" onClick={() => player.addToPlaylist(id, t)}>Add</button>
            )
          }
        />
      ))}
    </section>
  );
}

function MoreMenu({ id, name, onRename }: { id: string; name: string; onRename: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div className="popover-anchor" ref={ref}>
      <button className="icon-btn big" onClick={() => setOpen(!open)} title={`More options for ${name}`}>
        <Ellipsis size={28} />
      </button>
      {open && (
        <div className="popover down">
          <button className="menu-item" onClick={() => (setOpen(false), onRename())}>
            <Pencil size={16} /> Rename
          </button>
          <button
            className="menu-item"
            onClick={() => {
              setOpen(false);
              if (confirm(`Delete "${name}"? This can't be undone.`)) {
                player.deletePlaylist(id);
                navigate('/library', true);
              }
            }}
          >
            <Trash2 size={16} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function PlaylistView({ kind, id = '' }: { kind: Kind; id?: string }) {
  const playlist = useStore((s) => (kind === 'playlist' ? s.playlists.find((p) => p.id === id) : undefined));
  const liked = useStore((s) => s.liked);
  const recent = useStore((s) => s.recent);
  const shuffle = useStore((s) => s.shuffle);
  const tracks = kind === 'liked' ? liked : kind === 'recent' ? recent : (playlist?.tracks ?? []);
  const name = kind === 'liked' ? 'Liked Songs' : kind === 'recent' ? 'Recently Played' : (playlist?.name ?? '');
  const context = { key: kind === 'playlist' ? `playlist:${id}` : kind, name };
  const ctxPlaying = useStore((s) => s.playing && s.context.key === context.key);
  const art = useColor(tracks[0]?.id);
  const color = kind === 'liked' ? '#5038a0' : kind === 'recent' ? '#1e3264' : art;
  const [filter, setFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);

  usePage(color, name, ctxPlaying, () => player.toggleList(tracks, context));
  useEffect(() => setFilter(''), [id, kind]);

  const { shown, indexMap } = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const pairs = tracks.map((t, i) => [t, i] as const).filter(([t]) => !f || t.title.toLowerCase().includes(f) || t.artist.toLowerCase().includes(f));
    return { shown: pairs.map(([t]) => t), indexMap: pairs.map(([, i]) => i) };
  }, [tracks, filter]);

  if (kind === 'playlist' && !playlist)
    return (
      <div className="view">
        <div className="view-pad empty-state">
          <h2>Couldn't find that playlist</h2>
          <button className="pill-btn" onClick={() => navigate('/home')}>Go home</button>
        </div>
      </div>
    );

  const total = tracks.reduce((a, t) => a + t.duration, 0);
  const rename = () => titleRef.current?.querySelector<HTMLElement>('.editable')?.click();

  return (
    <div className="view" style={{ ['--page' as string]: color }}>
      <header className="hero">
        <PlaylistCover tracks={tracks} kind={kind === 'playlist' ? undefined : kind} size={232} className="hero-cover" />
        <div className="hero-text" ref={titleRef}>
          <span className="hero-type">Playlist</span>
          {kind === 'playlist' ? <EditableTitle value={name} onSave={(n) => player.renamePlaylist(id, n)} /> : <h1 className="hero-title">{name}</h1>}
          <div className="hero-sub">
            <span className="owner">
              <span className="mini-avatar">
                <User size={14} />
              </span>
              You
            </span>
            <span className="muted">
              {' '}• {songs(tracks.length)}
              {total > 0 && `, ${fmtTotal(total)}`}
            </span>
          </div>
        </div>
      </header>

      <div className="action-bar">
        <PlayButton size={56} playing={ctxPlaying} onClick={() => player.toggleList(tracks, context)} className={tracks.length ? '' : 'disabled'} />
        <button className={`icon-btn big toggle${shuffle ? ' on' : ''}`} onClick={player.toggleShuffle} title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}>
          <Shuffle size={28} />
        </button>
        {kind !== 'recent' && tracks.length > 0 && (
          <button className="icon-btn big" onClick={() => exportPlaylist(name, tracks, playlist?.description)} title="Export playlist (.json)">
            <Download size={26} />
          </button>
        )}
        {kind === 'playlist' && <MoreMenu id={id} name={name} onRename={rename} />}
        {kind === 'recent' && tracks.length > 0 && (
          <button className="pill-btn outline sm" onClick={player.clearRecent}>Clear history</button>
        )}
        <div className="action-right">
          {filterOpen || filter ? (
            <label className="filter-input">
              <Search size={16} />
              <input autoFocus value={filter} onChange={(e) => setFilter(e.target.value)} onBlur={() => !filter && setFilterOpen(false)} placeholder="Search in playlist" />
            </label>
          ) : (
            <button className="icon-btn" onClick={() => setFilterOpen(true)} title="Search in playlist">
              <Search size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="view-pad body">
        {tracks.length > 0 ? (
          <TrackTable
            tracks={shown}
            indexMap={indexMap}
            context={context}
            listId={`pl-${kind}-${id}`.toLowerCase()}
            playlistId={kind === 'playlist' ? id : undefined}
            third={kind === 'recent' ? 'views' : 'added'}
            onMove={kind === 'playlist' && !filter ? (from, to) => player.movePlaylistTrack(id, from, to) : undefined}
          />
        ) : kind !== 'playlist' ? (
          <div className="empty-state">
            <h2>{kind === 'liked' ? 'Songs you like will appear here' : 'Nothing played yet'}</h2>
            <p className="muted">{kind === 'liked' ? 'Save songs by tapping the heart icon.' : 'Start listening and your history shows up here.'}</p>
            <button className="pill-btn" onClick={() => navigate('/search')}>Find songs</button>
          </div>
        ) : null}
        {kind === 'playlist' && <Finder key={id} id={id} open={!tracks.length} />}
      </div>
    </div>
  );
}

export function LibraryView() {
  const liked = useStore((s) => s.liked);
  const recent = useStore((s) => s.recent);
  const playlists = useStore((s) => s.playlists);
  usePage('#2a2a2a', 'Your Library');
  const items = [
    { key: 'liked', name: 'Liked Songs', tracks: liked, kind: 'liked' as const, to: '/liked' },
    ...(recent.length ? [{ key: 'recent', name: 'Recently Played', tracks: recent, kind: 'recent' as const, to: '/recent' }] : []),
    ...playlists.map((p) => ({ key: p.id, name: p.name, tracks: p.tracks, kind: undefined, to: `/playlist/${p.id}` })),
  ];
  return (
    <div className="view">
      <div className="view-pad">
        <div className="library-head">
          <h1>Your Library</h1>
          <button className="pill-btn" onClick={() => navigate(`/playlist/${player.createPlaylist()}`)}>
            <Plus size={16} /> Create playlist
          </button>
        </div>
        <div className="library-grid">
          {items.map((it) => (
            <button key={it.key} className="lib-card" onClick={() => navigate(it.to)}>
              <PlaylistCover tracks={it.tracks} kind={it.kind} />
              <span className="card-title">{it.name}</span>
              <span className="card-sub">Playlist • {songs(it.tracks.length)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
