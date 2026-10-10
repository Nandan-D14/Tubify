import { useEffect, useState } from 'react';
import { thumb } from './format';

const cache = new Map<string, string>();

export function hashColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(h) % 360} 45% 30%)`;
}

/** Dominant, saturation-weighted color of a video thumbnail; falls back to a stable hash color. */
function extract(id: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(hashColor(id));
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 9;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0, 16, 9);
        const d = g.getImageData(0, 0, 16, 9).data;
        let r = 0, gr = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]);
          const min = Math.min(d[i], d[i + 1], d[i + 2]);
          const wt = 1 + ((max - min) ** 2) / 64;
          r += d[i] * wt;
          gr += d[i + 1] * wt;
          b += d[i + 2] * wt;
          w += wt;
        }
        resolve(toTone(r / w, gr / w, b / w));
      } catch {
        resolve(hashColor(id)); // canvas tainted (no CORS)
      }
    };
    img.src = thumb(id, 'mq');
  });
}

// Normalise to a rich, dark tone so white text always stays readable.
function toTone(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round(h)} ${Math.round(Math.max(s, 0.35) * 70)}% ${Math.round(Math.min(Math.max(l, 0.22), 0.36) * 100)}%)`;
}

export function getColor(id: string): Promise<string> {
  const hit = cache.get(id);
  if (hit) return Promise.resolve(hit);
  return extract(id).then((c) => (cache.set(id, c), c));
}

export function useColor(id?: string, fallback = '#535353') {
  const [color, setColor] = useState(() => (id && cache.get(id)) || fallback);
  useEffect(() => {
    if (!id) return setColor(fallback);
    let live = true;
    getColor(id).then((c) => live && setColor(c));
    return () => {
      live = false;
    };
  }, [id, fallback]);
  return color;
}
