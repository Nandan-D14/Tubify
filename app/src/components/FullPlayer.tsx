import { useEffect, useState } from 'react';
import { ChevronDown, Clapperboard, House, Image as ImageIcon, Library, ListMusic, MicVocal, PictureInPicture2, Search } from 'lucide-react';
import { player, useStore } from '../lib/store';
import { useProgress } from '../lib/engine';
import { useColor } from '../lib/color';
import { thumb } from '../lib/format';
import { navigate, useRouter } from '../lib/router';
import { useIsMobile } from '../lib/hooks';
import { useUI } from '../lib/ui';
import { LikeButton, Marquee, PlayButton, Thumb } from './common';
import { Controls, ProgressRow, VolumeControl } from './PlayerBar';
import { Lyrics } from './Lyrics';

function closeFull() {
  player.setFullscreen(false);
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/** Fullscreen "Now Playing" — also the expanded player on mobile. */
export function FullPlayer() {
  const fullscreen = useStore((s) => s.fullscreen);
  const cur = useStore((s) => s.queue[s.index]);
  const context = useStore((s) => s.context);
  const videoMode = useStore((s) => s.videoMode);
  const pip = useStore((s) => s.pip);
  const mobile = useIsMobile();
  const color = useColor(cur?.id);
  const [lyrics, setLyrics] = useState(false);

  useEffect(() => {
    const h = () => !document.fullscreenElement && useStore.getState().fullscreen && player.setFullscreen(false);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  useEffect(() => {
    if (fullscreen && !cur) closeFull();
  }, [fullscreen, cur]);

  if (!fullscreen || !cur) return null;
  const showVideo = videoMode === 'video' && !pip && !lyrics;

  return (
    <div className="full" style={{ ['--page' as string]: color }}>
      <div className="full-bg" style={{ backgroundImage: `url(${thumb(cur.id, 'hq')})` }} />
      <header className="full-head">
        <button className="icon-btn round" onClick={closeFull} title="Close">
          <ChevronDown size={24} />
        </button>
        <div className="full-ctx">
          <small>Playing from</small>
          <strong>{context.name || 'Tubify'}</strong>
        </div>
        <div className="seg">
          <button className={!showVideo && !lyrics ? 'on' : ''} onClick={() => (setLyrics(false), player.setVideoMode('art'))} title="Cover art">
            <ImageIcon size={16} />
          </button>
          <button className={showVideo ? 'on' : ''} onClick={() => (setLyrics(false), pip && player.togglePip(), player.setVideoMode('video'))} title="Video">
            <Clapperboard size={16} />
          </button>
          <button
            className={lyrics ? 'on' : ''}
            onClick={() => {
              setLyrics(true);
              player.setVideoMode('art'); // the video can't sit behind the lyrics
            }}
            title="Lyrics"
          >
            <MicVocal size={16} />
          </button>
        </div>
      </header>

      <div className={`full-stage${showVideo ? ' video' : ''}${lyrics ? ' lyr' : ''}`}>
        {lyrics ? (
          <div className="full-lyrics">
            <Lyrics track={cur} size="full" />
          </div>
        ) : showVideo ? (
          <div className="full-video" data-video-slot="full" />
        ) : (
          <Thumb id={cur.id} className="full-art" />
        )}
      </div>

      <div className="full-bottom">
        <div className="full-meta">
          <div className="np-text">
            <Marquee className="full-title">{cur.title}</Marquee>
            <button
              className="link full-artist"
              onClick={() => {
                closeFull();
                navigate(`/search/${encodeURIComponent(cur.artist)}`);
              }}
            >
              {cur.artist}
            </button>
          </div>
          <LikeButton track={cur} size={24} />
        </div>
        <ProgressRow className="full-progress" />
        <Controls big />
        <div className="full-foot">
          <button
            className="icon-btn"
            onClick={() => {
              closeFull();
              if (!mobile) player.setPanel('queue');
            }}
            title="Queue"
          >
            <ListMusic size={20} />
          </button>
          {!mobile && <VolumeControl />}
          <button className={`icon-btn toggle${pip ? ' on' : ''}`} onClick={player.togglePip} title="Mini player">
            <PictureInPicture2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function MiniPlayer() {
  const cur = useStore((s) => s.queue[s.index]);
  const playing = useStore((s) => s.playing);
  const color = useColor(cur?.id, '#282828');
  const pct = useProgress((s) => (s.duration ? (s.time / s.duration) * 100 : 0));
  if (!cur) return null;
  return (
    <div className="mini-player" style={{ ['--page' as string]: color }} onClick={() => player.setFullscreen(true)}>
      <Thumb id={cur.id} size={40} />
      <div className="track-meta">
        <Marquee className="t">{cur.title}</Marquee>
        <span className="a">{cur.artist}</span>
      </div>
      <LikeButton track={cur} size={22} />
      <PlayButton playing={playing} onClick={player.togglePlay} size={36} className="bare" />
      <div className="mini-progress">
        <i style={{ transform: `translateX(${pct - 100}%)` }} />
      </div>
    </div>
  );
}

export function MobileNav() {
  const route = useRouter((s) => s.route);
  const items = [
    { name: 'home', label: 'Home', Icon: House, go: () => navigate('/home') },
    {
      name: 'search',
      label: 'Search',
      Icon: Search,
      go: () => {
        navigate('/search');
        useUI.setState((s) => ({ focusSearch: s.focusSearch + 1 }));
      },
    },
    { name: 'library', label: 'Your Library', Icon: Library, go: () => navigate('/library') },
  ] as const;
  return (
    <nav className="mobile-nav">
      {items.map(({ name, label, Icon, go }) => (
        <button key={name} className={route.name === name ? 'on' : ''} onClick={go}>
          <Icon size={24} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
