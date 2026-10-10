import { useEffect, useMemo, useState } from 'react';
import type { Track } from '../types';
import { cachedSearch } from '../lib/youtube';
import { songs } from '../lib/format';
import { navigate } from '../lib/router';
import { player, useStore, type Context } from '../lib/store';
import { usePage } from '../lib/hooks';
import { openMenu, useUI, type HomeFilter } from '../lib/ui';
import { buildRecs, useRecs } from '../lib/recs';
import { useStats } from '../lib/stats';
import { Card, QuickCard, Shelf, SkeletonCards } from '../components/Cards';
import { MixCover, PlaylistCover, Thumb } from '../components/common';

const FEEDS = [
  { title: 'Top Music Videos', q: 'top hits official music video 2026' },
  { title: 'Trending Now', q: 'trending songs this week official video' },
  { title: 'Bollywood Hits', q: 'latest bollywood songs 2026 official video' },
  { title: 'Chill Vibes', q: 'chill pop songs official audio' },
  { title: 'Workout Energy', q: 'workout motivation songs official video' },
];

/** All home feeds; each song shows up in one shelf only (earlier shelves win). */
function useFeeds() {
  const [lists, setLists] = useState<(Track[] | null)[]>(() => FEEDS.map(() => null));
  useEffect(() => {
    let live = true;
    FEEDS.forEach((f, i) =>
      cachedSearch(f.q)
        .then((r) => r.filter((t) => t.duration <= 600)) // songs, not hour-long mixes
        .catch(() => [])
        .then((r) => live && setLists((s) => s.map((x, j) => (j === i ? r : x)))),
    );
    return () => {
      live = false;
    };
  }, []);
  return useMemo(() => {
    const seen = new Set<string>();
    let ready = true;
    return lists.map((list) => {
      ready &&= list !== null;
      if (!ready) return null; // wait for earlier shelves so items don't vanish later
      return list!.filter((t) => !seen.has(t.id) && !!seen.add(t.id));
    });
  }, [lists]);
}

function TrackShelf({ title, items, context, onShowAll }: { title: string; items: Track[] | null; context: Context; onShowAll?: () => void }) {
  const curId = useStore((s) => s.queue[s.index]?.id);
  const playing = useStore((s) => s.playing);
  const ctxKey = useStore((s) => s.context.key);
  if (items && !items.length) return null;
  const play = (i: number) => {
    if (items![i].id === curId && ctxKey === context.key) player.togglePlay();
    else player.playList(items!, i, context);
  };
  return (
    <Shelf title={title} onShowAll={onShowAll}>
      {items ? (
        items.map((t, i) => (
          <Card
            key={t.id}
            title={t.title}
            sub={t.artist}
            cover={<Thumb id={t.id} />}
            onOpen={() => play(i)}
            onPlay={() => play(i)}
            playing={playing && curId === t.id && ctxKey === context.key}
            onContextMenu={(e) => openMenu(e, t)}
          />
        ))
      ) : (
        <SkeletonCards />
      )}
    </Shelf>
  );
}

function FeedShelf({ title, q, items }: { title: string; q: string; items: Track[] | null }) {
  return <TrackShelf title={title} items={items} context={{ key: `feed:${q}`, name: title }} onShowAll={() => navigate(`/search/${encodeURIComponent(q)}`)} />;
}

/** Daily Mixes, On Repeat, Discover Weekly — built from your own listening. */
function MadeForYou() {
  const mixes = useRecs((s) => s.mixes);
  const status = useRecs((s) => s.status);
  const hasTaste = useStats((s) => Object.keys(s.plays).length) + useStore((s) => s.liked.length) > 0;
  const ctxKey = useStore((s) => s.context.key);
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    buildRecs();
  }, []);
  if (!mixes.length) return status !== 'ready' && hasTaste ? <Shelf title="Made For You"><SkeletonCards n={4} /></Shelf> : null;
  return (
    <Shelf title="Made For You">
      {mixes.map((m) => {
        const ctx = { key: `mix:${m.id}`, name: m.name };
        return (
          <Card
            key={m.id}
            title={m.name}
            sub={m.desc}
            cover={<MixCover mix={m} />}
            onOpen={() => navigate(`/mix/${m.id}`)}
            onPlay={() => player.toggleList(m.tracks, ctx)}
            playing={playing && ctxKey === ctx.key}
          />
        );
      })}
    </Shelf>
  );
}

function BecauseShelf() {
  const because = useRecs((s) => s.because);
  if (!because) return null;
  return <TrackShelf title={`Because you listened to ${because.seed.title}`} items={because.tracks} context={{ key: `because:${because.seed.id}`, name: `More like ${because.seed.title}` }} />;
}

/** Spotify's filter pills, shown in the sticky header of Home. */
export function HomeChips() {
  const f = useUI((s) => s.homeFilter);
  const hasMixes = useRecs((s) => s.mixes.length > 0);
  const hasLists = useStore((s) => s.liked.length > 0 || s.playlists.length > 0);
  const chips: [HomeFilter, string][] = [['all', 'All'], ['music', 'Music']];
  if (hasMixes) chips.push(['mixes', 'Mixes']);
  if (hasLists) chips.push(['playlists', 'Playlists']);
  const pick = (k: HomeFilter) => {
    useUI.setState({ homeFilter: k === f ? 'all' : k });
    document.querySelector('.main')?.scrollTo({ top: 0 });
  };
  return (
    <div className="chips home-chips">
      {chips.map(([k, label]) => (
        <button key={k} className={`chip${f === k ? ' on' : ''}`} onClick={() => pick(k)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Home() {
  const liked = useStore((s) => s.liked);
  const live = useStore((s) => s.recent);
  // Snapshot history on mount so tiles don't reshuffle under the cursor every time a song starts.
  const [snap] = useState(live);
  const recent = snap.length ? snap : live;
  const playlists = useStore((s) => s.playlists);
  const mixes = useRecs((s) => s.mixes);
  const ctxKey = useStore((s) => s.context.key);
  const playing = useStore((s) => s.playing);
  const filter = useUI((s) => s.homeFilter);
  const show = (k: HomeFilter) => filter === 'all' || filter === k;
  const feeds = useFeeds();
  const top = feeds[0];
  const [hover, setHover] = useState<string | null>(null);

  // Eight quick-access tiles: library, a couple of mixes, then recent songs, topped up with top videos.
  const quick = useMemo(() => {
    const out: { key: string; title: string; cover: React.ReactNode; colorId?: string; fixedColor?: string; open: () => void; play: () => void; ctx: string }[] = [];
    if (liked.length) {
      const ctx = { key: 'liked', name: 'Liked Songs' };
      out.push({ key: 'liked', title: 'Liked Songs', cover: <PlaylistCover tracks={[]} kind="liked" size={48} />, fixedColor: '#5038a0', open: () => navigate('/liked'), play: () => player.toggleList(liked, ctx), ctx: ctx.key });
    }
    for (const p of playlists.filter((p) => p.tracks.length).slice(0, 3)) {
      const ctx = { key: `playlist:${p.id}`, name: p.name };
      out.push({ key: p.id, title: p.name, cover: <PlaylistCover tracks={p.tracks} size={48} />, colorId: p.tracks[0].id, open: () => navigate(`/playlist/${p.id}`), play: () => player.toggleList(p.tracks, ctx), ctx: ctx.key });
    }
    for (const m of mixes.slice(0, 2)) {
      const ctx = { key: `mix:${m.id}`, name: m.name };
      out.push({ key: m.id, title: m.name, cover: <MixCover mix={m} size={48} />, colorId: m.seed.id, open: () => navigate(`/mix/${m.id}`), play: () => player.toggleList(m.tracks, ctx), ctx: ctx.key });
    }
    const seen = new Set<string>();
    for (const t of [...recent, ...(top ?? [])]) {
      if (out.length >= 8) break;
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const ctx = { key: `track:${t.id}`, name: t.title };
      out.push({ key: t.id, title: t.title, cover: <Thumb id={t.id} size={48} />, colorId: t.id, open: () => player.toggleList([t], ctx), play: () => player.toggleList([t], ctx), ctx: ctx.key });
    }
    return out.slice(0, 8);
  }, [liked, playlists, mixes, recent, top]);

  const color = hover ?? '#3b3b5a';
  usePage(color, '');

  const jump = [
    ...(liked.length ? [{ id: 'liked', name: 'Liked Songs', tracks: liked, kind: 'liked' as const }] : []),
    ...playlists.map((p) => ({ id: p.id, name: p.name, tracks: p.tracks, kind: undefined })),
  ];

  return (
    <div className="view home" style={{ ['--page' as string]: color }}>
      <div className="view-pad">
        {filter === 'all' && (
          <div className="quick-grid">
            {quick.map((q) => (
              <QuickCard key={q.key} title={q.title} cover={q.cover} colorId={q.colorId} fixedColor={q.fixedColor} onOpen={q.open} onPlay={q.play} playing={playing && ctxKey === q.ctx} onHover={setHover} />
            ))}
            {!quick.length && top === null && Array.from({ length: 8 }, (_, i) => <div key={i} className="quick skeleton" />)}
          </div>
        )}

        {show('mixes') && <MadeForYou />}

        {show('music') && recent.length > 0 && <TrackShelf title="Recently Played" items={recent.slice(0, 20)} context={{ key: 'recent', name: 'Recently Played' }} onShowAll={() => navigate('/recent')} />}

        {show('music') && <BecauseShelf />}

        {show('playlists') && jump.length > 0 && (
          <Shelf title="Jump Back In" onShowAll={() => navigate('/library')}>
            {jump.map((p) => {
              const ctx = { key: p.kind === 'liked' ? 'liked' : `playlist:${p.id}`, name: p.name };
              return (
                <Card
                  key={p.id}
                  title={p.name}
                  sub={`Playlist • ${songs(p.tracks.length)}`}
                  cover={<PlaylistCover tracks={p.tracks} kind={p.kind} />}
                  onOpen={() => navigate(p.kind === 'liked' ? '/liked' : `/playlist/${p.id}`)}
                  onPlay={() => player.toggleList(p.tracks, ctx)}
                  playing={playing && ctxKey === ctx.key}
                />
              );
            })}
          </Shelf>
        )}

        {show('music') && FEEDS.map((f, i) => (
          <FeedShelf key={f.q} title={f.title} q={f.q} items={feeds[i]} />
        ))}
      </div>
    </div>
  );
}
