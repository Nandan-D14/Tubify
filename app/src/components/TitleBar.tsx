import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export const isTauri = '__TAURI_INTERNALS__' in window;

/** Windows-style caption buttons for the frameless window (they live at the end of the global bar). */
export function WindowControls() {
  const [max, setMax] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    const sync = () => win.isMaximized().then(setMax).catch(() => {});
    sync();
    const off = win.onResized(sync);
    return () => void off.then((f) => f());
  }, []);

  const win = getCurrentWindow();
  return (
    <div className="wc">
      <button onClick={() => win.minimize()} title="Minimize" aria-label="Minimize">&#xE921;</button>
      <button onClick={() => win.toggleMaximize()} title={max ? 'Restore' : 'Maximize'} aria-label={max ? 'Restore' : 'Maximize'}>
        {max ? '\uE923' : '\uE922'}
      </button>
      <button className="wc-close" onClick={() => win.close()} title="Close" aria-label="Close">&#xE8BB;</button>
    </div>
  );
}
