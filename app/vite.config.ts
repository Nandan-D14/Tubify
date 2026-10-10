import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
    // Browser / phone mode: forward YouTube search through the dev server (avoids CORS).
    // Inside Tauri the Rust `yt_search` command is used instead.
    proxy: {
      '/youtubei': {
        target: 'https://www.youtube.com',
        changeOrigin: true,
        configure: (proxy) =>
          proxy.on('proxyReq', (req) => {
            req.removeHeader('origin');
            req.removeHeader('referer');
          }),
      },
    },
  },
});
