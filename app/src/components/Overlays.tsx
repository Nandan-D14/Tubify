import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ChevronRight, Copy, Heart, ListEnd, ListStart, MicVocal, Plus, Radio, Trash2, X } from 'lucide-react';
import { closeMenu, useUI } from '../lib/ui';
import { player, useStore } from '../lib/store';
import { useToasts, toast } from '../lib/toast';
import { navigate } from '../lib/router';
import { inTauri } from '../lib/youtube';
import { signIn, signUp } from '../lib/sync';

export function ContextMenu() {
  const menu = useUI((s) => s.menu);
  const playlists = useStore((s) => s.playlists);
  const liked = useStore((s) => !!menu && s.liked.some((t) => t.id === menu.track.id));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, flip: false });
  const [sub, setSub] = useState(false);

  useLayoutEffect(() => {
    if (!menu) return;
    const el = ref.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.min(menu.x, innerWidth - w - 8);
    setPos({ x, y: Math.max(8, Math.min(menu.y, innerHeight - h - 8)), flip: x + w * 2 > innerWidth });
    setSub(false);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const down = (e: Event) => !ref.current?.contains(e.target as Node) && closeMenu();
    // Close when the page scrolls under the menu — but not for lyrics following the song.
    const scroll = (e: Event) => !(e.target as Element).closest?.('.lyrics') && down(e);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closeMenu();
    addEventListener('pointerdown', down);
    addEventListener('keydown', key);
    addEventListener('resize', closeMenu);
    addEventListener('scroll', scroll, true);
    addEventListener('blur', closeMenu);
    return () => {
      removeEventListener('pointerdown', down);
      removeEventListener('keydown', key);
      removeEventListener('resize', closeMenu);
      removeEventListener('scroll', scroll, true);
      removeEventListener('blur', closeMenu);
    };
  }, [menu]);

  if (!menu) return null;
  const t = menu.track;
  const act = (fn: () => void) => () => {
    fn();
    closeMenu();
  };

  return (
    <div ref={ref} className="ctx" style={{ left: pos.x, top: pos.y }} onContextMenu={(e) => e.preventDefault()}>
      <button className="menu-item" onClick={act(() => player.addToQueue(t))}>
        <ListEnd size={16} /> Add to queue
      </button>
      <button className="menu-item" onClick={act(() => player.playNext(t))}>
        <ListStart size={16} /> Play next
      </button>
      <hr />
      <div className="ctx-sub-anchor" onMouseEnter={() => setSub(true)} onMouseLeave={() => setSub(false)}>
        <button className="menu-item" onClick={() => setSub(!sub)}>
          <Plus size={16} /> Add to playlist <ChevronRight size={16} className="push" />
        </button>
        {sub && (
          <div className={`ctx ctx-sub${pos.flip ? ' flip' : ''}`}>
            <button
              className="menu-item"
              onClick={act(() => {
                navigate(`/playlist/${player.createPlaylist(undefined, [t])}`);
                toast('Playlist created');
              })}
            >
              <Plus size={16} /> New playlist
            </button>
            {playlists.length > 0 && <hr />}
            <div className="ctx-scroll">
              {playlists.map((p) => (
                <button key={p.id} className="menu-item" onClick={act(() => player.addToPlaylist(p.id, t))}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {menu.playlistId && menu.index !== undefined && (
        <button className="menu-item" onClick={act(() => player.removeFromPlaylist(menu.playlistId!, menu.index!))}>
          <Trash2 size={16} /> Remove from this playlist
        </button>
      )}
      <button className="menu-item" onClick={act(() => player.toggleLike(t))}>
        <Heart size={16} fill={liked ? 'currentColor' : 'none'} className={liked ? 'green' : ''} />
        {liked ? 'Remove from your Liked Songs' : 'Save to your Liked Songs'}
      </button>
      <hr />
      <button className="menu-item" onClick={act(() => player.startRadio(t))}>
        <Radio size={16} /> Go to song radio
      </button>
      <button className="menu-item" onClick={act(() => navigate(`/search/${encodeURIComponent(t.artist)}`))}>
        <MicVocal size={16} /> Go to artist
      </button>
      <button className="menu-item" onClick={act(() => navigator.clipboard.writeText(`https://youtu.be/${t.id}`).then(() => toast('Link copied to clipboard')))}>
        <Copy size={16} /> Copy song link
      </button>
    </div>
  );
}

export function Toasts() {
  const items = useToasts((s) => s.items);
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          {t.msg}
        </div>
      ))}
    </div>
  );
}

const KEYS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['→ / ←', 'Seek 5 seconds'],
  ['Ctrl + → / ←', 'Next / previous track'],
  ['Ctrl + ↑ / ↓', 'Volume up / down'],
  ['M', 'Mute'],
  ['L', 'Like current song'],
  ['S', 'Shuffle'],
  ['R', 'Repeat (off / all / one)'],
  ['Q', 'Queue'],
  ['N', 'Now playing view'],
  ['V', 'Toggle cover art / video'],
  ['P', 'Mini player'],
  ['F', 'Full screen'],
  ['/ or Ctrl + K', 'Search'],
  ['?', 'This help'],
];

export function Shortcuts() {
  const open = useUI((s) => s.shortcuts);
  if (!open) return null;
  const close = () => useUI.setState({ shortcuts: false });
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Keyboard shortcuts</h2>
          <button className="icon-btn round" onClick={close} title="Close">
            <X size={18} />
          </button>
        </header>
        <dl className="keys">
          {KEYS.map(([k, d]) => (
            <div key={k}>
              <dt>{d}</dt>
              <dd>
                {k.split(' ').map((p, i) => (p === '+' || p === '/' || p === 'or' ? <span key={i}>{p}</span> : <kbd key={i}>{p}</kbd>))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** Email + password log in / sign up — an account syncs the library and listening history across devices. */
export function AuthDialog() {
  const open = useUI((s) => s.auth);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!open) return null;

  const close = () => {
    useUI.setState({ auth: false });
    setPw('');
    setErr('');
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      if (mode === 'in') {
        await signIn(email.trim(), pw);
        toast('Logged in — syncing your library');
        close();
      } else if (await signUp(email.trim(), pw)) {
        toast('Account created — syncing your library');
        close();
      } else {
        setMode('in');
        setErr('Check your inbox to confirm your email, then log in.');
      }
    } catch (e) {
      setErr((e as Error).message || 'Something went wrong — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={close}>
      <form className="modal auth" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <header>
          <h2>{mode === 'in' ? 'Log in to Tubify' : 'Sign up for Tubify'}</h2>
          <button type="button" className="icon-btn round" onClick={close} title="Close">
            <X size={18} />
          </button>
        </header>
        <p className="auth-sub">Sync your liked songs, playlists and recommendations across devices.</p>
        <label className="field">
          <span>Email</span>
          <input type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        {err && <p className="auth-err">{err}</p>}
        <button className="pill-btn primary wide" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'in' ? 'Log in' : 'Sign up'}
        </button>
        <p className="auth-switch">
          {mode === 'in' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'in' ? 'up' : 'in');
              setErr('');
            }}
          >
            {mode === 'in' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}

type ProcStats = { cpu: number; ram_mb: number; processes: number };

/** Ctrl+Shift+P — live CPU/RAM of Tubify + its WebView2 processes (desktop only). */
export function StatsOverlay() {
  const on = useUI((s) => s.stats);
  const [s, setS] = useState<ProcStats | null>(null);
  useEffect(() => {
    if (!on || !inTauri) return;
    const tick = () => invoke<ProcStats>('get_stats').then(setS).catch(() => {});
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [on]);
  if (!on) return null;
  return (
    <div className="stats" onClick={() => useUI.setState({ stats: false })} title="Click to hide">
      <span>CPU {s ? s.cpu.toFixed(1) : '–'}%</span>
      <span>RAM {s ? Math.round(s.ram_mb) : '–'} MB</span>
      <span>{s?.processes ?? '–'} procs</span>
    </div>
  );
}
