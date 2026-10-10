# Tubify — Architecture & Implementation Plan

A high-performance, low-RAM desktop music player inspired by Spotify, powered by **Tauri v2** and streaming audio from **YouTube / Custom Audio Sources**.

---

## 1. Project Goals & Target Metrics

| Metric | Target | Traditional Electron App |
| :--- | :--- | :--- |
| **Idle RAM Usage** | **40 MB – 70 MB** | 350 MB – 800 MB |
| **Active Playback CPU** | **< 1%** (Hardware accelerated) | 3% – 8% |
| **Installer Size** | **< 15 MB** | 80 MB – 150 MB |
| **UI Frame Rate** | **Locked 60 / 120 FPS** (Smooth scrolling) | Variable |
| **Startup Time** | **< 400 ms** | 1.5 s – 3.5 s |

---

## 2. Tech Stack Selection

```
┌────────────────────────────────────────────────────────┐
│                   Tubify Architecture                  │
└────────────────────────────────────────────────────────┘
                           │
       ┌───────────────────┴───────────────────┐
       ▼                                       ▼
┌───────────────┐                       ┌───────────────┐
│ Frontend UI   │                       │ Rust Backend  │
│ (WebView2)    │                       │ (Tauri v2)    │
└───────┬───────┘                       └───────┬───────┘
        │                                       │
        ├─ Svelte 5 / React + TypeScript        ├─ Audio Stream Extraction (YouTube)
        ├─ Tailwind CSS + Lucide Icons          ├─ Background Disk Caching
        ├─ Virtualized Lists (TanStack Virtual) ├─ System Tray & Minimize-to-tray
        ├─ HTML5 Audio (Hardware Decoded)       ├─ Windows SMTC / Media Key Hooks
        └─ State: Lightweight Reactive Store    └─ Discord Rich Presence (RPC)
```

- **Core Shell:** Tauri v2 (Rust)
- **Frontend Framework:** React or Svelte 5 + TypeScript + Vite
- **Styling:** Tailwind CSS (Dark Spotify theme)
- **Audio Decoding:** HTML5 Audio / Web Audio (OS-level hardware acceleration)
- **Stream Source:** Invidious / Piped API / Rust-based YouTube stream resolver
- **OS Controls:** Windows System Media Transport Controls (SMTC) & System Tray

---

## 3. High-Performance Architectural Principles

1. **Virtual DOM Minimization / Virtualized Playlists:**
   - Playlists can have 500+ items. Only the visible ~15 items are mounted to the DOM using `@tanstack/virtual` to keep memory near zero.
2. **Heavy Lifting Offloaded to Rust:**
   - Network requests for stream resolution and disk caching run in Rust worker threads, never blocking the UI event loop.
3. **Throttled Thumbnail Memory:**
   - Cache low-res thumbnails (`hqdefault`, 300x300) for lists; only load high-res covers for full-screen / Now Playing view.
4. **Hardware-Decoded Audio Pipeline:**
   - Rely on OS media decoders (AAC/Opus via WebView2 Windows Media Foundation) for sub-1% CPU usage during playback.

---

## 4. Phase-by-Phase Roadmap

### Phase 1: Project Scaffolding & Setup
- [ ] Initialize Tauri v2 project structure with Vite & TypeScript
- [ ] Configure Tailwind CSS with Spotify dark theme tokens (bg, surface, accent `#1DB954`)
- [ ] Set up `.gitignore` (ensure `.env` and Rust `target/` build artifacts are ignored)
- [ ] Configure Lucide icons for media controls (Play, Pause, Skip, Shuffle, Repeat, Volume)

### Phase 2: Core UI Layout (Spotify-grade Look & Feel)
- [ ] **Left Sidebar:** Navigation (Home, Search, Library), Playlist list, Tubify branding
- [ ] **Top Bar:** History navigation (Back/Forward), Search bar, Window controls (custom titlebar)
- [ ] **Main Content Area:**
  - Hero banner with dynamic ambient gradient
  - Grid view for Albums / Playlists
  - Virtualized table view for Track lists (Title, Artist, Duration, Actions)
- [ ] **Bottom Persistent Player Bar:**
  - Track info & thumbnail (left)
  - Playback controls & scrub bar with smooth progress interpolation (center)
  - Volume slider, mute toggle, queue toggle, lyrics toggle (right)

### Phase 3: Audio Extraction & Playback Engine
- [ ] Implement Rust Tauri command `get_audio_stream(video_id)`:
  - Resolves highest-quality audio stream (Opus / M4A)
  - Implements fast in-memory URL caching
- [ ] Build Frontend Audio Controller:
  - Play, Pause, Next, Previous, Seek, Volume, Mute
  - Queue management (Play Next, Add to Queue, Shuffle, Repeat All, Repeat One)
  - Local playback persistence (saves last playing song and volume across restarts)

### Phase 4: Search & Music Discovery
- [ ] Integrate YouTube / Piped music search API
- [ ] Parse tracks, artists, albums, playlists, and durations cleanly
- [ ] Implement debounced search input (300ms) with instant suggestions
- [ ] Implement "Trending / Top Music" home screen feeds

### Phase 5: Library & Local Playlists
- [ ] Local storage / SQLite database for user data:
  - "Liked Songs"
  - Custom user playlists (create, rename, add/remove tracks, reorder)
  - Play history
- [ ] Import / Export playlist support (JSON / Spotify URL importer)

### Phase 6: Desktop & OS Integrations
- [ ] **System Tray:** Close-to-tray, toggle playback, skip track from tray icon menu
- [ ] **Global Media Keys:** Hook keyboard Play/Pause/Skip keys
- [ ] **Windows SMTC:** Display current track name, artist, and album art in Windows volume pop-up
- [ ] **Discord Rich Presence (RPC):** Show "Listening to [Song] on Tubify" on Discord profile

### Phase 7: Optimization, Polish & Distribution
- [ ] Measure and tune memory footprint (ensure RAM < 70 MB)
- [ ] Verify 60/120 FPS scrolling on large lists
- [ ] Production build packaging (`.exe` / `.msi`)

---

## 5. File Structure Preview

```
Tubify/
├── plan.md
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── src/
│       ├── main.rs
│       ├── audio_extractor.rs
│       ├── smtc.rs
│       └── tray.rs
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── layout/          (Sidebar, TopBar, PlayerBar)
│   │   ├── player/          (AudioController, ProgressBar, VolumeControl)
│   │   ├── track/           (TrackRow, TrackGrid, VirtualTrackList)
│   │   └── ui/              (Buttons, Modals, Sliders)
│   ├── hooks/ / stores/     (usePlayer, useQueue, useLibrary)
│   ├── services/            (api.ts, tauriCommands.ts)
│   ├── types/               (track.d.ts, playlist.d.ts)
│   ├── App.tsx / App.svelte
│   └── index.css
├── package.json
└── vite.config.ts
```
