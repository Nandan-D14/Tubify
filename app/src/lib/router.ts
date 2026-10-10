import { create } from 'zustand';
import type { Route } from '../types';

function parse(hash: string): Route {
  const [name = 'home', ...rest] = hash.replace(/^#\/?/, '').split('/');
  const arg = decodeURIComponent(rest.join('/'));
  switch (name) {
    case 'search': return { name: 'search', q: arg };
    case 'playlist': return arg ? { name: 'playlist', id: arg } : { name: 'library' };
    case 'mix': return arg ? { name: 'mix', id: arg } : { name: 'home' };
    case 'liked': return { name: 'liked' };
    case 'recent': return { name: 'recent' };
    case 'library': return { name: 'library' };
    default: return { name: 'home' };
  }
}

interface RouterState {
  route: Route;
  idx: number;
  max: number;
}

if (!location.hash) history.replaceState({ i: 0 }, '', '#/home');
const startIdx = (history.state?.i as number) ?? 0;

export const useRouter = create<RouterState>(() => ({ route: parse(location.hash), idx: startIdx, max: startIdx }));

/** Hash routing so back/forward (and mouse side buttons) just work. */
export function navigate(path: string, replace = false) {
  const { idx, route } = useRouter.getState();
  const next = parse('#' + path);
  if (replace) {
    history.replaceState({ i: idx }, '', '#' + path);
    useRouter.setState({ route: next });
    return;
  }
  if (JSON.stringify(next) === JSON.stringify(route)) return;
  const i = idx + 1;
  history.pushState({ i }, '', '#' + path);
  useRouter.setState({ route: next, idx: i, max: i });
}

window.addEventListener('popstate', (e) => {
  useRouter.setState({ route: parse(location.hash), idx: (e.state?.i as number) ?? 0 });
});

export const back = () => history.back();
export const forward = () => history.forward();
