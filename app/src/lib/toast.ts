import { create } from 'zustand';

interface Toast {
  id: number;
  msg: string;
}

export const useToasts = create<{ items: Toast[] }>(() => ({ items: [] }));

let n = 0;
export function toast(msg: string) {
  const id = ++n;
  useToasts.setState((s) => ({ items: [...s.items.slice(-2), { id, msg }] }));
  setTimeout(() => useToasts.setState((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2800);
}
