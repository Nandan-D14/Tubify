export interface Track {
  id: string; // YouTube video id
  title: string;
  artist: string;
  duration: number; // seconds
  views?: string;
  published?: string;
  addedAt?: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  createdAt: number;
}

export type Repeat = 'off' | 'all' | 'one';

export type Route =
  | { name: 'home' }
  | { name: 'search'; q: string }
  | { name: 'playlist'; id: string }
  | { name: 'mix'; id: string }
  | { name: 'liked' }
  | { name: 'recent' }
  | { name: 'library' };
