export function fmtTime(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60);
  const m = Math.floor((sec / 60) % 60);
  const h = Math.floor(sec / 3600);
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export function parseDuration(text: string) {
  return text.split(':').reduce((acc, p) => acc * 60 + (parseInt(p, 10) || 0), 0);
}

export function fmtTotal(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h} hr ${m} min`;
  return `${m} min ${Math.floor(sec % 60)} sec`;
}

const DAY = 86_400_000;
export function fmtAdded(ts?: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < DAY) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 30 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} day${d > 1 ? 's' : ''} ago`;
  }
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export type ThumbQuality = 'mq' | 'hq' | 'maxres';
export const thumb = (id: string, q: ThumbQuality = 'mq') => `https://i.ytimg.com/vi/${id}/${q}default.jpg`;

export const greeting = () => {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? 'Good morning' : h >= 12 && h < 18 ? 'Good afternoon' : 'Good evening';
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const songs = (n: number) => `${n} song${n === 1 ? '' : 's'}`;
