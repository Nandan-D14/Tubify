import { useEffect } from 'react';
import { Download, Plus, Shuffle } from 'lucide-react';
import { player, useStore } from '../lib/store';
import { buildRecs, useRecs } from '../lib/recs';
import { useColor } from '../lib/color';
import { fmtTotal, songs } from '../lib/format';
import { navigate } from '../lib/router';
import { usePage } from '../lib/hooks';
import { exportPlaylist } from '../lib/io';
import { toast } from '../lib/toast';
import { MixCover, PlayButton } from '../components/common';
import { TrackTable } from '../components/TrackTable';

/** A "Made For You" mix — like a playlist page, but generated and read-only. */
export function MixView({ id }: { id: string }) {
  const mix = useRecs((s) => s.mixes.find((m) => m.id === id));
  const status = useRecs((s) => s.status);
  const shuffle = useStore((s) => s.shuffle);
  const context = { key: `mix:${id}`, name: mix?.name ?? '' };
  const ctxPlaying = useStore((s) => s.playing && s.context.key === context.key);
  const color = useColor(mix?.seed.id);
  const tracks = mix?.tracks ?? [];

  useEffect(() => {
    buildRecs();
  }, []);
  usePage(color, mix?.name ?? '', ctxPlaying, () => player.toggleList(tracks, context));

  if (!mix)
    return (
      <div className="view">
        <div className="view-pad empty-state">
          {status === 'ready' ? (
            <>
              <h2>This mix isn't around anymore</h2>
              <p className="muted">Mixes refresh daily as your taste changes.</p>
              <button className="pill-btn" onClick={() => navigate('/home')}>Go home</button>
            </>
          ) : (
            <h2>Making your mix…</h2>
          )}
        </div>
      </div>
    );

  const total = tracks.reduce((a, t) => a + t.duration, 0);
  return (
    <div className="view" style={{ ['--page' as string]: color }}>
      <header className="hero">
        <MixCover mix={mix} size={232} className="hero-cover" />
        <div className="hero-text">
          <span className="hero-type">Made For You</span>
          <h1 className={`hero-title${mix.name.length > 14 ? ' md' : ''}`}>{mix.name}</h1>
          <p className="hero-desc">{mix.desc}</p>
          <div className="hero-sub">
            <span className="owner">Tubify</span>
            <span className="muted">
              {' '}• {songs(tracks.length)}
              {total > 0 && `, about ${fmtTotal(total)}`}
            </span>
          </div>
        </div>
      </header>

      <div className="action-bar">
        <PlayButton size={56} playing={ctxPlaying} onClick={() => player.toggleList(tracks, context)} />
        <button className={`icon-btn big toggle${shuffle ? ' on' : ''}`} onClick={player.toggleShuffle} title={shuffle ? 'Disable shuffle' : 'Enable shuffle'}>
          <Shuffle size={28} />
        </button>
        <button
          className="icon-btn big"
          onClick={() => {
            navigate(`/playlist/${player.createPlaylist(mix.name, tracks)}`);
            toast(`Saved to Your Library`);
          }}
          title="Save as a playlist"
        >
          <Plus size={28} />
        </button>
        <button className="icon-btn big" onClick={() => exportPlaylist(mix.name, tracks, mix.desc)} title="Export playlist (.json)">
          <Download size={26} />
        </button>
      </div>

      <div className="view-pad body">
        <TrackTable tracks={tracks} context={context} listId={`mix-${id}`} />
      </div>
    </div>
  );
}
