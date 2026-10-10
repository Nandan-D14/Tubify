import { useEffect, useRef, useState } from 'react';
import {
  ListMusic, Maximize2, MicVocal, Moon, PictureInPicture2, Repeat, Repeat1, Shuffle,
  SkipBack, SkipForward, SquarePlay, Volume, Volume1, Volume2, VolumeX,
} from 'lucide-react';
import { player, useStore } from '../lib/store';
import { useProgress } from '../lib/engine';
import { fmtTime } from '../lib/format';
import { navigate } from '../lib/router';
import { LikeButton, Marquee, PlayButton, Slider, Thumb } from './common';

export function useOutside<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', h);
    document.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('pointerdown', h);
      document.removeEventListener('keydown', k);
    };
  }, [open, close]);
  return ref;
}

export function enterFullscreen() {
  player.setFullscreen(true);
  if (!window.matchMedia('(max-width: 767px)').matches) document.documentElement.requestFullscreen?.().catch(() => {});
}

export function PlayerBar() {
  const cur = useStore((s) => s.queue[s.index]);
  return (
    <footer className="playerbar">
      <div className="pb-left">{cur && <NowInfo />}</div>
      <div className="pb-center">
        <Controls />
        <ProgressRow />
      </div>
      <div className="pb-right">
        <Utilities />
      </div>
    </footer>
  );
}

function NowInfo() {
  const cur = useStore((s) => s.queue[s.index])!;
  const panel = useStore((s) => s.panel);
  const openNow = () => {
    const s = useStore.getState();
    if (s.expanded) s.expanded === 'lyrics' && player.expand('now');
    else if (panel !== 'now') player.setPanel('now');
  };
  return (
    <>
      <button className="pb-thumb" onClick={openNow} title="Now playing view">
        <Thumb id={cur.id} size={56} />
      </button>
      <div className="pb-meta">
        <button className="pb-title" onClick={openNow}>
          <Marquee>{cur.title}</Marquee>
        </button>
        <button className="pb-artist link" onClick={() => navigate(`/search/${encodeURIComponent(cur.artist)}`)}>
          {cur.artist}
        </button>
      </div>
      <LikeButton track={cur} />
    </>
  );
}

export function Controls({ big }: { big?: boolean }) {
  const playing = useStore((s) => s.playing);
  const shuffle = useStore((s) => s.shuffle);
  const repeat = useStore((s) => s.repeat);
  const has = useStore((s) => s.queue.length > 0);
  const buffering = useProgress((s) => s.buffering && playing);
  const sz = big ? 24 : 16;
  return (
    <div className={`controls${big ? ' big' : ''}`}>
      <button className={`icon-btn toggle${shuffle ? ' on' : ''}`} onClick={player.toggleShuffle} title={shuffle ? 'Disable shuffle' : 'Enable shuffle'} disabled={!has}>
        <Shuffle size={sz} />
      </button>
      <button className="icon-btn" onClick={player.prev} title="Previous" disabled={!has}>
        <SkipBack size={sz} fill="currentColor" />
      </button>
      <PlayButton playing={playing} onClick={player.togglePlay} size={big ? 64 : 32} className={`white${buffering ? ' buffering' : ''}${has ? '' : ' disabled'}`} />
      <button className="icon-btn" onClick={() => player.next()} title="Next" disabled={!has}>
        <SkipForward size={sz} fill="currentColor" />
      </button>
      <button
        className={`icon-btn toggle${repeat !== 'off' ? ' on' : ''}`}
        onClick={player.cycleRepeat}
        title={repeat === 'off' ? 'Enable repeat' : repeat === 'all' ? 'Enable repeat one' : 'Disable repeat'}
        disabled={!has}
      >
        {repeat === 'one' ? <Repeat1 size={sz} /> : <Repeat size={sz} />}
      </button>
    </div>
  );
}

export function ProgressRow({ className = '' }: { className?: string }) {
  const time = useProgress((s) => s.time);
  const duration = useProgress((s) => s.duration);
  const has = useStore((s) => s.queue.length > 0);
  const [scrub, setScrub] = useState<number | null>(null);
  return (
    <div className={`progress ${className}${has ? '' : ' disabled'}`}>
      <span className="time">{fmtTime(scrub ?? time)}</span>
      <Slider value={time} max={duration || 1} onCommit={player.seek} onScrub={setScrub} label="Seek" step={5} smooth />
      <span className="time">{fmtTime(duration)}</span>
    </div>
  );
}

export function VolumeControl() {
  const volume = useStore((s) => s.volume);
  const muted = useStore((s) => s.muted);
  const v = muted ? 0 : volume;
  const Icon = v === 0 ? VolumeX : v < 34 ? Volume : v < 67 ? Volume1 : Volume2;
  return (
    <div className="volume">
      <button className="icon-btn" onClick={player.toggleMute} title={muted ? 'Unmute' : 'Mute'}>
        <Icon size={16} />
      </button>
      <Slider value={v} max={100} label="Volume" step={5} onCommit={player.setVolume} onScrub={(n) => n !== null && player.setVolume(n)} />
    </div>
  );
}

const SLEEP = [5, 15, 30, 45, 60];

function SleepTimer() {
  const sleepAt = useStore((s) => s.sleepAt);
  const sleepEnd = useStore((s) => s.sleepEnd);
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const ref = useOutside<HTMLDivElement>(open, () => setOpen(false));
  useEffect(() => {
    if (!sleepAt) return;
    const id = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [sleepAt]);
  const left = sleepAt ? Math.max(1, Math.ceil((sleepAt - Date.now()) / 60_000)) : 0;
  const active = !!sleepAt || sleepEnd;
  const pick = (m: number | 'end' | null) => {
    player.setSleep(m);
    setOpen(false);
  };
  return (
    <div className="popover-anchor u-sleep" ref={ref}>
      <button className={`icon-btn toggle${active ? ' on' : ''}`} onClick={() => setOpen(!open)} title="Sleep timer">
        <Moon size={16} />
        {active && <span className="badge">{sleepEnd ? '♪' : left}</span>}
      </button>
      {open && (
        <div className="popover up">
          <div className="popover-title">Sleep timer</div>
          {SLEEP.map((m) => (
            <button key={m} className="menu-item" onClick={() => pick(m)}>
              {m} minutes
            </button>
          ))}
          <button className={`menu-item${sleepEnd ? ' green' : ''}`} onClick={() => pick('end')}>
            End of track
          </button>
          {active && (
            <button className="menu-item" onClick={() => pick(null)}>
              Turn off timer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Utilities() {
  const panel = useStore((s) => s.panel);
  const expanded = useStore((s) => s.expanded);
  const pip = useStore((s) => s.pip);
  const has = useStore((s) => s.queue.length > 0);
  const nowOn = panel === 'now' || (!!expanded && expanded !== 'lyrics');
  const lyrOn = panel === 'lyrics' || expanded === 'lyrics';
  return (
    <>
      <button className={`icon-btn toggle u-now${nowOn ? ' on' : ''}`} onClick={() => player.setPanel('now')} title="Now playing view" disabled={!has}>
        <SquarePlay size={16} />
      </button>
      <button className={`icon-btn toggle${lyrOn ? ' on' : ''}`} onClick={() => player.setPanel('lyrics')} title="Lyrics" disabled={!has}>
        <MicVocal size={16} />
      </button>
      <button className={`icon-btn toggle${panel === 'queue' ? ' on' : ''}`} onClick={() => player.setPanel('queue')} title="Queue">
        <ListMusic size={16} />
      </button>
      <button className={`icon-btn toggle u-pip${pip ? ' on' : ''}`} onClick={player.togglePip} title={pip ? 'Close mini player' : 'Open mini player'} disabled={!has}>
        <PictureInPicture2 size={16} />
      </button>
      <SleepTimer />
      <VolumeControl />
      <button className="icon-btn" onClick={enterFullscreen} title="Full screen" disabled={!has}>
        <Maximize2 size={16} />
      </button>
    </>
  );
}
