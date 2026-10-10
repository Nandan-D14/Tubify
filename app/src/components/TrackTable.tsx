import { Clock, Ellipsis, Pause, Play } from 'lucide-react';
import type { Track } from '../types';
import { player, useStore, type Context } from '../lib/store';
import { fmtAdded, fmtTime } from '../lib/format';
import { navigate } from '../lib/router';
import { openMenu } from '../lib/ui';
import { useReorder } from '../lib/hooks';
import { Equalizer, LikeButton, Thumb } from './common';

interface Props {
  tracks: Track[];
  context: Context;
  listId: string; // lowercase id used to scope drag-reorder
  playlistId?: string;
  indexMap?: number[]; // displayed row -> index in the playlist (when filtered)
  onMove?: (from: number, to: number) => void;
  third?: 'added' | 'views';
  header?: boolean;
  start?: number; // row number offset
  queueFrom?: { list: Track[]; offset: number }; // play from a bigger list than the rows shown
}

export function TrackTable({ tracks, context, listId, playlistId, indexMap, onMove, third, header = true, start = 0, queueFrom }: Props) {
  const curId = useStore((s) => s.queue[s.index]?.id);
  const playing = useStore((s) => s.playing);
  const ctxKey = useStore((s) => s.context.key);
  const { rowProps, over } = useReorder(listId, onMove);

  const play = (i: number) => {
    if (tracks[i].id === curId && ctxKey === context.key) player.togglePlay();
    else player.playList(queueFrom?.list ?? tracks, (queueFrom?.offset ?? 0) + i, context);
  };
  const menuExtra = (i: number) => (playlistId ? { playlistId, index: indexMap?.[i] ?? i } : undefined);

  return (
    <div className={`tracks${third ? ' has-third' : ''}`}>
      {header && (
        <div className="tracks-head">
          <span className="center">#</span>
          <span>Title</span>
          {third && <span className="third">{third === 'added' ? 'Date added' : 'Views'}</span>}
          <span className="dur-head">
            <Clock size={16} />
          </span>
        </div>
      )}
      {tracks.map((t, i) => {
        const isCur = t.id === curId;
        const drop = over?.i === i ? (over.after ? ' drop-after' : ' drop-before') : '';
        return (
          <div
            key={`${t.id}-${i}`}
            className={`track${isCur ? ' current' : ''}${drop}`}
            onClick={() => !(isCur && playing) && play(i)}
            onContextMenu={(e) => openMenu(e, t, menuExtra(i))}
            {...rowProps(i, t)}
          >
            <span className="track-num">
              {isCur && playing ? <Equalizer /> : <span className="n">{start + i + 1}</span>}
              <button className="track-play" onClick={(e) => (e.stopPropagation(), play(i))} aria-label={isCur && playing ? 'Pause' : `Play ${t.title}`}>
                {isCur && playing ? <Pause size={16} fill="currentColor" strokeWidth={0} /> : <Play size={16} fill="currentColor" strokeWidth={0} />}
              </button>
            </span>
            <div className="track-title">
              <Thumb id={t.id} size={40} />
              <div className="track-meta">
                <span className="t">{t.title}</span>
                <button
                  className="a link"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/search/${encodeURIComponent(t.artist)}`);
                  }}
                >
                  {t.artist}
                </button>
              </div>
            </div>
            {third && <span className="track-third">{third === 'added' ? fmtAdded(t.addedAt) : [t.views, t.published].filter(Boolean).join(' • ')}</span>}
            <span className="track-end">
              <LikeButton track={t} className="row-like" />
              <span className="dur">{fmtTime(t.duration)}</span>
              <button className="icon-btn more" onClick={(e) => openMenu(e, t, menuExtra(i))} aria-label="More options">
                <Ellipsis size={16} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Compact row used in the right panel and search "Songs" list. */
export function MiniRow({ t, onPlay, active, right, dragProps, className = '' }: {
  t: Track;
  onPlay: () => void;
  active?: boolean;
  right?: React.ReactNode;
  dragProps?: object;
  className?: string;
}) {
  const playing = useStore((s) => s.playing);
  return (
    <div className={`mini-row${active ? ' current' : ''} ${className}`} onClick={() => !active && onPlay()} onContextMenu={(e) => openMenu(e, t)} {...dragProps}>
      <button className="mini-thumb" onClick={(e) => (e.stopPropagation(), onPlay())} aria-label={`Play ${t.title}`}>
        <Thumb id={t.id} size={48} />
        <span className="mini-overlay">{active && playing ? <Equalizer /> : <Play size={18} fill="currentColor" strokeWidth={0} />}</span>
      </button>
      <div className="track-meta">
        <span className="t">{t.title}</span>
        <span className="a">{t.artist}</span>
      </div>
      {right && (
        <span className="mini-right" onClick={(e) => e.stopPropagation()}>
          {right}
        </span>
      )}
    </div>
  );
}
