import { create } from 'zustand';
import type { MouseEvent } from 'react';
import type { Track } from '../types';

export interface MenuState {
  x: number;
  y: number;
  track: Track;
  playlistId?: string;
  index?: number; // position inside playlistId
}

interface Page {
  color: string;
  title: string;
  playing?: boolean;
  onPlay?: (() => void) | null;
}

interface UI {
  menu: MenuState | null;
  shortcuts: boolean;
  auth: boolean; // log in / sign up dialog
  stats: boolean;
  page: Page;
  focusSearch: number; // bump to focus the search input
  homeFilter: HomeFilter;
}

export type HomeFilter = 'all' | 'music' | 'mixes' | 'playlists';

export const useUI = create<UI>(() => ({
  menu: null,
  shortcuts: false,
  auth: false,
  stats: false,
  page: { color: '#535353', title: '' },
  focusSearch: 0,
  homeFilter: 'all',
}));

export function openMenu(e: MouseEvent, track: Track, extra?: Pick<MenuState, 'playlistId' | 'index'>) {
  e.preventDefault();
  e.stopPropagation();
  useUI.setState({ menu: { x: e.clientX, y: e.clientY, track, ...extra } });
}

export const closeMenu = () => useUI.setState({ menu: null });
