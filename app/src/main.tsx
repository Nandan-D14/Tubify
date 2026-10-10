import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initMedia } from './lib/media';
import { initStats } from './lib/stats';
import { initSync } from './lib/sync';
import './styles.css';

initMedia();
initStats();
initSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
