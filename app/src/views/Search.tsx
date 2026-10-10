import { AudioLines, Disc3, Dumbbell, Flame, Guitar, Headphones, Heart, Mic2, Moon, Music, PartyPopper, Piano, Radio, Sparkles, Sun, Waves, X } from 'lucide-react';
import type { Track } from '../types';
import { navigate } from '../lib/router';
import { player, useStore } from '../lib/store';
import { useSearch, usePage } from '../lib/hooks';
import { fmtTime } from '../lib/format';
import { openMenu } from '../lib/ui';
import { PlayButton, Thumb } from '../components/common';
import { TrackTable } from '../components/TrackTable';
import { SearchInput } from '../components/TopBar';
import { useIsMobile } from '../lib/hooks';

const GENRES = [
  { name: 'Pop', color: '#dc148c', Icon: Sparkles },
  { name: 'Hip-Hop', color: '#ba5d07', Icon: Mic2 },
  { name: 'Bollywood', color: '#e8115b', Icon: Flame },
  { name: 'Punjabi', color: '#148a08', Icon: Disc3 },
  { name: 'Tamil', color: '#8d67ab', Icon: Music },
  { name: 'K-Pop', color: '#e1118c', Icon: Heart },
  { name: 'Rock', color: '#e91429', Icon: Guitar },
  { name: 'Indie', color: '#608108', Icon: Radio },
  { name: 'Workout', color: '#777777', Icon: Dumbbell },
  { name: 'Focus', color: '#503750', Icon: Headphones },
  { name: 'Chill', color: '#477d95', Icon: Waves },
  { name: 'Lo-fi', color: '#2d46b9', Icon: AudioLines },
  { name: 'Party', color: '#af2896', Icon: PartyPopper },
  { name: 'Romance', color: '#8c1932', Icon: Heart },
  { name: 'Jazz', color: '#7358ff', Icon: Piano },
  { name: 'Sleep', color: '#1e3264', Icon: Moon },
  { name: 'Summer', color: '#d84000', Icon: Sun },
];

const go = (q: string) => navigate(`/search/${encodeURIComponent(q)}`);

function Browse() {
  const searches = useStore((s) => s.searches);
  return (
    <>
      {searches.length > 0 && (
        <section className="section">
          <h2>Recent searches</h2>
          <div className="chips wrap">
            {searches.map((q) => (
              <span key={q} className="chip big">
                <button onClick={() => go(q)}>{q}</button>
                <button className="chip-x" onClick={() => player.removeSearch(q)} aria-label={`Remove ${q}`}>
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
      <section className="section">
        <h2>Browse all</h2>
        <div className="genres">
          {GENRES.map(({ name, color, Icon }) => (
            <button key={name} className="genre" style={{ background: color }} onClick={() => go(`${name} songs`)}>
              <span>{name}</span>
              <Icon className="genre-icon" size={64} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function TopResult({ t, q, list, index }: { t: Track; q: string; list: Track[]; index: number }) {
  const curId = useStore((s) => s.queue[s.index]?.id);
  const playing = useStore((s) => s.playing);
  const isCur = curId === t.id;
  const play = () => {
    if (isCur) return player.togglePlay();
    player.addSearch(q);
    player.playList(list, index, { key: `search:${q}`, name: `“${q}”` });
  };
  return (
    <div className="top-result" onClick={play} onContextMenu={(e) => openMenu(e, t)}>
      <Thumb id={t.id} size={92} />
      <div className="tr-title">{t.title}</div>
      <div className="tr-sub">
        <span className="pill">Song</span>
        <span>{t.artist}</span>
        <span className="muted">• {fmtTime(t.duration)}</span>
      </div>
      <PlayButton className="card-play" playing={isCur && playing} onClick={play} />
    </div>
  );
}

export function Search({ q }: { q: string }) {
  const mobile = useIsMobile();
  const { data, loading, error, retry } = useSearch(q);
  usePage('#121212', q ? `“${q}”` : 'Search');
  const ctx = { key: `search:${q}`, name: `“${q}”` };
  const remember = () => q && player.addSearch(q);
  // Prefer actual songs over hour-long jukeboxes, both for the Top result and the Songs list.
  const isSong = (t: Track) => t.duration <= 600;
  const topIdx = Math.max(0, data.findIndex(isSong));
  const rest = data.filter((_, i) => i !== topIdx);
  const songs = [...rest.filter(isSong), ...rest.filter((t) => !isSong(t))];

  return (
    <div className="view search-view">
      <div className="view-pad">
        {mobile && (
          <div className="mobile-search">
            <h1>Search</h1>
            <SearchInput q={q} mountFocus />
          </div>
        )}
        {!q ? (
          <Browse />
        ) : error ? (
          <div className="empty-state">
            <h2>Couldn't reach YouTube</h2>
            <p className="muted">{error}</p>
            <button className="pill-btn" onClick={retry}>Try again</button>
          </div>
        ) : loading && !data.length ? (
          <div className="search-loading">
            <div className="sk top" />
            <div className="sk-list">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="sk-line" />
              ))}
            </div>
          </div>
        ) : !data.length ? (
          <div className="empty-state">
            <h2>No results found for “{q}”</h2>
            <p className="muted">Check the spelling, or try different keywords.</p>
          </div>
        ) : (
          <div onClickCapture={remember}>
            <div className="search-top">
              <section>
                <h2>Top result</h2>
                <TopResult t={data[topIdx]} q={q} list={[data[topIdx], ...songs]} index={0} />
              </section>
              <section className="search-songs">
                <h2>Songs</h2>
                <TrackTable tracks={songs.slice(0, 4)} context={ctx} listId="search-top" header={false} queueFrom={{ list: songs, offset: 0 }} />
              </section>
            </div>
            {songs.length > 4 && (
              <section className="section">
                <h2>More results</h2>
                <TrackTable tracks={songs.slice(4)} context={ctx} listId="search-all" third="views" start={4} queueFrom={{ list: songs, offset: 4 }} />
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
