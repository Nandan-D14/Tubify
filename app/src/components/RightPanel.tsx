import { useRef, useState } from 'react';
import { ChevronLeft, Clapperboard, Ellipsis, Link2, Maximize2, X } from 'lucide-react';
import { player, useStore } from '../lib/store';
import { thumb } from '../lib/format';
import { navigate } from '../lib/router';
import { useSearch, useReorder } from '../lib/hooks';
import { useColor } from '../lib/color';
import { toast } from '../lib/toast';
import { openMenu } from '../lib/ui';
import { LikeButton, Marquee } from './common';
import { MiniRow } from './TrackTable';
import { Lyrics } from './Lyrics';

export function RightPanel() {
  const panel = useStore((s) => s.panel);
  const has = useStore((s) => s.queue.length > 0);
  const last = useRef(panel);
  if (panel) last.current = panel; // keep content while the drawer animates closed
  const view = panel ?? last.current;
  // Closed with something playing: a slim rail with a chevron to bring the panel back (like Spotify)
  if (!panel && has)
    return (
      <aside className="rpanel rail">
        <div className="rp-rail block">
          <button className="icon-btn round" onClick={() => player.setPanel(last.current ?? 'now')} title="Show Now Playing view">
            <ChevronLeft size={18} />
          </button>
        </div>
      </aside>
    );
  return (
    <aside className={`rpanel${panel ? ' open' : ''}`} aria-hidden={!panel}>
      <div className="right-inner block">{view === 'queue' || !has ? <QueuePanel /> : view === 'lyrics' ? <LyricsPanel /> : <NowPlaying />}</div>
    </aside>
  );
}

function LyricsPanel() {
  const cur = useStore((s) => s.queue[s.index])!;
  const color = useColor(cur.id);
  return (
    <div className="lyr-panel" style={{ ['--page' as string]: color }}>
      <header className="panel-head">
        <div className="np-text">
          <span className="panel-title">{cur.title}</span>
          <small className="lyr-artist">{cur.artist}</small>
        </div>
        <div className="panel-acts">
          <button className="icon-btn round" onClick={() => player.expand('lyrics')} title="Expand lyrics">
            <Maximize2 size={16} />
          </button>
          <button className="icon-btn round" onClick={() => player.setPanel('lyrics')} title="Close">
            <X size={18} />
          </button>
        </div>
      </header>
      <Lyrics track={cur} />
    </div>
  );
}

function NowPlaying() {
  const cur = useStore((s) => s.queue[s.index])!;
  const next = useStore((s) => s.queue[s.index + 1]);
  const context = useStore((s) => s.context);
  const videoMode = useStore((s) => s.videoMode);
  const pip = useStore((s) => s.pip);
  const panel = useStore((s) => s.panel);
  const color = useColor(cur.id);
  const more = useSearch(panel === 'now' ? cur.artist : '');
  const showVideo = videoMode === 'video' && !pip;
  const others = more.data.filter((t) => t.id !== cur.id).slice(0, 5);

  return (
    <div className="np scroll" style={{ ['--page' as string]: color }}>
      <header className="panel-head">
        <span className="panel-title">{context.name || 'Now playing'}</span>
        <div className="panel-acts">
          <button
            className={`icon-btn round${showVideo ? ' on' : ''}`}
            onClick={() => (showVideo ? player.setVideoMode('art') : (pip && player.togglePip(), player.setVideoMode('video')))}
            title={showVideo ? 'Switch to audio' : 'Switch to video'}
          >
            <Clapperboard size={18} />
          </button>
          <button className="icon-btn round" onClick={(e) => openMenu(e, cur)} title={`More options for ${cur.title}`}>
            <Ellipsis size={18} />
          </button>
          <button className="icon-btn round" onClick={() => player.expand(showVideo ? 'video' : 'now')} title="Expand Now Playing view">
            <Maximize2 size={16} />
          </button>
          <button className="icon-btn round" onClick={() => player.setPanel('now')} title="Close">
            <X size={18} />
          </button>
        </div>
      </header>

      <div className={`np-media${showVideo ? ' video' : ''}`}>
        <img className={`np-art${showVideo ? ' hide' : ''}`} src={thumb(cur.id, 'hq')} alt="" />
        <div className="np-slot" data-video-slot="panel" />
        {pip && <div className="np-note">Playing in mini player</div>}
      </div>

      <div className="np-info">
        <div className="np-text">
          <Marquee className="np-title">{cur.title}</Marquee>
          <button className="link np-artist" onClick={() => navigate(`/search/${encodeURIComponent(cur.artist)}`)}>
            {cur.artist}
          </button>
        </div>
        <button
          className="icon-btn"
          onClick={() => navigator.clipboard.writeText(`https://youtu.be/${cur.id}`).then(() => toast('Link copied to clipboard'))}
          title="Copy link"
        >
          <Link2 size={20} />
        </button>
        <LikeButton track={cur} size={22} />
      </div>

      <LyricsCard key={cur.id} />

      <section className="np-card">
        <div className="np-card-head">
          <strong>Credits</strong>
        </div>
        <div className="credit">
          <span>{cur.artist}</span>
          <small>Main Artist</small>
        </div>
        <div className="credit">
          <span>YouTube</span>
          <small>{[cur.views && `${cur.views}`, cur.published].filter(Boolean).join(' • ') || 'Source'}</small>
        </div>
      </section>

      <section className="np-card">
        <div className="np-card-head">
          <strong>Next in queue</strong>
          <button className="link sm" onClick={() => player.setPanel('queue')}>
            Open queue
          </button>
        </div>
        {next ? (
          <MiniRow t={next} onPlay={() => player.playAt(useStore.getState().index + 1)} />
        ) : (
          <p className="muted sm">Nothing up next. Add songs from search or a playlist.</p>
        )}
      </section>

      {others.length > 0 && (
        <section className="np-card">
          <div className="np-card-head">
            <strong>More by {cur.artist}</strong>
          </div>
          {others.map((t, i) => (
            <MiniRow key={t.id} t={t} onPlay={() => player.playList(others, i, { key: `search:${cur.artist}`, name: cur.artist })} />
          ))}
        </section>
      )}
    </div>
  );
}

function LyricsCard() {
  const cur = useStore((s) => s.queue[s.index])!;
  const color = useColor(cur.id);
  return (
    <section className="np-card lyr-card" style={{ ['--page' as string]: color }}>
      <div className="np-card-head">
        <strong>Lyrics preview</strong>
      </div>
      <Lyrics track={cur} size="card" />
      <button className="pill-btn sm lyr-more" onClick={() => player.setPanel('lyrics')}>
        Show lyrics
      </button>
    </section>
  );
}

function QueuePanel() {
  const queue = useStore((s) => s.queue);
  const index = useStore((s) => s.index);
  const recent = useStore((s) => s.recent);
  const context = useStore((s) => s.context);
  const autoplay = useStore((s) => s.autoplay);
  const [tab, setTab] = useState<'queue' | 'recent'>('queue');
  const cur = queue[index];
  const upNext = queue.slice(index + 1);
  const { rowProps, over } = useReorder('queue', (from, to) => player.moveQueue(from + index + 1, to + index + 1));

  return (
    <div className="np scroll">
      <header className="panel-head">
        <div className="tabs">
          <button className={tab === 'queue' ? 'on' : ''} onClick={() => setTab('queue')}>Queue</button>
          <button className={tab === 'recent' ? 'on' : ''} onClick={() => setTab('recent')}>Recently played</button>
        </div>
        <button className="icon-btn round" onClick={() => player.setPanel('queue')} title="Close">
          <X size={18} />
        </button>
      </header>

      {tab === 'queue' ? (
        <>
          {cur ? (
            <>
              <h4 className="q-label">Now playing</h4>
              <MiniRow t={cur} active onPlay={player.togglePlay} />
              {upNext.length > 0 && (
                <h4 className="q-label">
                  Next from: <span className="link">{context.name || 'Queue'}</span>
                  <button className="link sm q-clear" onClick={player.clearQueue}>Clear queue</button>
                </h4>
              )}
              {upNext.map((t, i) => {
                const drop = over?.i === i ? (over.after ? ' drop-after' : ' drop-before') : '';
                return (
                  <MiniRow
                    key={`${t.id}-${i}`}
                    t={t}
                    className={drop}
                    onPlay={() => player.playAt(index + 1 + i)}
                    dragProps={rowProps(i, t)}
                    right={
                      <button className="icon-btn row-x" onClick={() => player.removeFromQueue(index + 1 + i)} title="Remove from queue">
                        <X size={16} />
                      </button>
                    }
                  />
                );
              })}
              <div className="autoplay-row">
                <div>
                  <strong>Autoplay</strong>
                  <small>When your queue ends, keep listening to similar songs</small>
                </div>
                <button className={`switch${autoplay ? ' on' : ''}`} role="switch" aria-checked={autoplay} aria-label="Autoplay" onClick={player.toggleAutoplay} />
              </div>
            </>
          ) : (
            <div className="empty-panel">
              <strong>Add to your queue</strong>
              <p className="muted">Tap "Add to queue" on any song's menu to see it here.</p>
              <button className="pill-btn" onClick={() => navigate('/search')}>Find something to play</button>
            </div>
          )}
        </>
      ) : (
        recent.map((t, i) => <MiniRow key={t.id} t={t} active={t.id === cur?.id} onPlay={() => player.playList(recent, i, { key: 'recent', name: 'Recently Played' })} />)
      )}
    </div>
  );
}
