import { Disc3, Ellipsis, Maximize, MicVocal, Minimize2, SquarePlay, UserRound } from 'lucide-react';
import { player, useStore, type Expanded as Tab } from '../lib/store';
import { thumb } from '../lib/format';
import { navigate } from '../lib/router';
import { useSearch } from '../lib/hooks';
import { useColor } from '../lib/color';
import { openMenu } from '../lib/ui';
import { LikeButton, Marquee, Thumb } from './common';
import { MiniRow } from './TrackTable';
import { Lyrics } from './Lyrics';
import { enterFullscreen } from './PlayerBar';

const TABS = [
  { id: 'now', title: 'Now playing', Icon: Disc3 },
  { id: 'video', title: 'Video', Icon: SquarePlay },
  { id: 'artist', title: 'About the artist', Icon: UserRound },
  { id: 'lyrics', title: 'Lyrics', Icon: MicVocal },
] as const;

/** Spotify's expanded Now Playing view: takes over the main area, collapses back into the side panel. */
export function ExpandedView() {
  const tab = useStore((s) => s.expanded)!;
  const cur = useStore((s) => s.queue[s.index]);
  const context = useStore((s) => s.context);
  const pip = useStore((s) => s.pip);
  const color = useColor(cur?.id);
  if (!cur) return null;

  return (
    <section className={`xp block is-${tab}`} style={{ ['--page' as string]: color }}>
      <header className="xp-head">
        <h2 className="xp-title">{tab === 'lyrics' ? cur.title : context.name || 'Now playing'}</h2>
        <nav className="xp-tabs">
          {TABS.map(({ id, title, Icon }) => (
            <button key={id} className={`icon-btn xp-tab${tab === id ? ' on' : ''}`} onClick={() => tab !== id && player.expand(id as Tab)} title={title}>
              <Icon size={20} />
            </button>
          ))}
        </nav>
        <i className="xp-div" />
        <button className="icon-btn" onClick={(e) => openMenu(e, cur)} title={`More options for ${cur.title}`}>
          <Ellipsis size={20} />
        </button>
        <button className="icon-btn" onClick={enterFullscreen} title="Full screen">
          <Maximize size={18} />
        </button>
        <button className="icon-btn" onClick={() => player.expand(null)} title="Collapse">
          <Minimize2 size={18} />
        </button>
      </header>

      {tab === 'lyrics' ? (
        <div className="xp-lyrics">
          <Lyrics track={cur} size="full" />
        </div>
      ) : (
        <div key={tab} className="xp-body scroll">{/* key: each tab starts at the top */}
          {tab === 'artist' ? (
            <ArtistTab />
          ) : (
            <>
              <div className="xp-stage">
                {tab === 'video' ? (
                  <div className="xp-video" data-video-slot="main">
                    {pip && <div className="np-note">Playing in mini player</div>}
                  </div>
                ) : (
                  <Thumb id={cur.id} className="xp-art" />
                )}
              </div>
              <div className="xp-info">
                <div className="np-text">
                  <Marquee className="xp-name">{cur.title}</Marquee>
                  <button className="link np-artist" onClick={() => navigate(`/search/${encodeURIComponent(cur.artist)}`)}>
                    {cur.artist}
                  </button>
                </div>
                <LikeButton track={cur} size={24} />
              </div>
              <div className="xp-cards">
                <AboutCard />
                <CreditsCard />
                <NextCard />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function AboutCard() {
  const cur = useStore((s) => s.queue[s.index])!;
  return (
    <button className="xp-card xp-about" onClick={() => player.expand('artist')}>
      <span className="xp-about-bg" style={{ backgroundImage: `url(${thumb(cur.id, 'hq')})` }} />
      <strong className="xp-card-title">About the artist</strong>
      <span className="xp-about-name">{cur.artist}</span>
    </button>
  );
}

function CreditsCard() {
  const cur = useStore((s) => s.queue[s.index])!;
  return (
    <section className="xp-card">
      <div className="np-card-head">
        <strong className="xp-card-title">Credits</strong>
        <button className="link sm" onClick={() => navigate(`/search/${encodeURIComponent(cur.artist)}`)}>
          Show all
        </button>
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
  );
}

function NextCard() {
  const next = useStore((s) => s.queue[s.index + 1]);
  return (
    <section className="xp-card">
      <div className="np-card-head">
        <strong className="xp-card-title">Next in queue</strong>
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
  );
}

function ArtistTab() {
  const cur = useStore((s) => s.queue[s.index])!;
  const more = useSearch(cur.artist);
  const others = more.data.filter((t) => t.id !== cur.id).slice(0, 10);
  return (
    <>
      <div className="xp-hero" style={{ backgroundImage: `url(${thumb(cur.id, 'hq')})` }}>
        <small>About the artist</small>
        <h1>{cur.artist}</h1>
        <button className="pill-btn" onClick={() => navigate(`/search/${encodeURIComponent(cur.artist)}`)}>
          Go to artist
        </button>
      </div>
      <section className="xp-card xp-more">
        <div className="np-card-head">
          <strong className="xp-card-title">More by {cur.artist}</strong>
        </div>
        {others.length ? (
          others.map((t, i) => <MiniRow key={t.id} t={t} onPlay={() => player.playList(others, i, { key: `search:${cur.artist}`, name: cur.artist })} />)
        ) : (
          <p className="muted sm">{more.loading ? 'Loading…' : 'Nothing else found.'}</p>
        )}
      </section>
    </>
  );
}
