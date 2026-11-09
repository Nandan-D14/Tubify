# 🎵 Tubify

<p align="center">
  <img src="app/src-tauri/icons/128x128.png" alt="Tubify Logo" width="128" height="128" />
</p>

<p align="center">
  <strong>An ultra-lightweight, high-performance desktop music player inspired by Spotify.</strong><br>
  Built with <strong>Tauri v2 (Rust)</strong> and <strong>React 19 + TypeScript</strong> for maximum speed and minimal memory footprint.
</p>

<p align="center">
  <a href="https://github.com/Nandan-D14/Tudify/releases/latest"><img src="https://img.shields.io/github/v/release/Nandan-D14/Tudify?style=flat-square&color=1DB954" alt="Release"></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20x64-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/RAM-~50MB%20Idle-brightgreen?style=flat-square" alt="RAM">
  <img src="https://img.shields.io/badge/License-MIT-orange?style=flat-square" alt="License">
</p>

---

## 🚀 Download & Installation

Get the latest build for **Windows (64-bit)**:

| Distribution | Download Link | Description |
| :--- | :--- | :--- |
| **Windows Installer (`.exe`)** | [**Download Installer**](https://github.com/Nandan-D14/Tudify/releases/download/v0.1.0/Tubify_0.1.0_x64-setup.exe) | Standard NSIS installer with desktop shortcuts & uninstaller. |
| **Portable Package (`.zip`)** | [**Download ZIP**](https://github.com/Nandan-D14/Tudify/releases/download/v0.1.0/Tubify-v0.1.0-windows-x64.zip) | Standalone package containing both the installer and portable `.exe`. |

> [!NOTE]
> **Windows SmartScreen Prompt:**  
> Because this is an independent open-source project without an expensive commercial code-signing certificate, Windows Defender SmartScreen may display:  
> *"Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognized app from starting."*  
> 👉 Simply click **"More info"** followed by **"Run anyway"**.

---

## ⚡ Why Tubify?

Traditional desktop music streaming apps run on heavy Electron shells that often consume 400 MB to 1 GB of RAM just sitting idle. **Tubify** is engineered with Tauri v2 and native Rust bindings, decoupling the UI from heavyweight runtimes to deliver exceptional efficiency.

| Metric | Tubify (Tauri v2 + Rust) | Typical Electron App |
| :--- | :--- | :--- |
| **Idle RAM Usage** | **~40 MB – 65 MB** | 400 MB – 850 MB |
| **Playback CPU** | **< 1%** (Hardware Decoded) | 3% – 8% |
| **Installer Size** | **~1.7 MB** | 80 MB – 150 MB |
| **Startup Time** | **< 400 ms** | 1.8 s – 4.0 s |

---

## ✨ Features

- 🎧 **Spotify-Grade Interface:** Slick dark-mode UI with ambient gradient accents, customizable sidebars, and fluid navigation.
- ⚡ **Lightning Fast Search:** Real-time music lookup powered by high-speed background streaming endpoints.
- 📜 **Synced Lyrics:** Dynamic, synchronized lyrics view for currently playing tracks.
- 🎛️ **Full Player Controls:** Scrub bar with smooth interpolation, queue management, volume control, shuffle, and repeat modes.
- 🪟 **Native Windows SMTC:** Complete integration with Windows Media Transport Controls (hardware keyboard media keys, volume flyout, and taskbar buttons).
- 📊 **Built-in System Stats Monitor:** Live display tracking working-set RAM and CPU consumption for Tubify and WebView2 processes.
- ☁️ **Cloud Sync & Playlists:** Create and manage playlists with Supabase database synchronization.

---

## 🛠️ Tech Stack

- **Desktop Framework:** [Tauri v2](https://tauri.app/) (Rust)
- **Frontend Framework:** [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [Lucide Icons](https://lucide.dev/)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand)
- **List Virtualization:** [@tanstack/react-virtual](https://tanstack.com/virtual/latest)
- **Cloud Backend:** [Supabase](https://supabase.com/)

---

## 💻 Development & Building from Source

### Prerequisites

1. **Node.js** (v18 or higher) and `npm`
2. **Rust** and `cargo` installed via [rustup.rs](https://rustup.rs/)
3. **Microsoft C++ Build Tools** (Visual Studio Build Tools)
4. **WebView2** (included by default on Windows 10 / 11)

### Setup & Run Locally

```bash
# 1. Clone repository
git clone https://github.com/Nandan-D14/Tudify.git
cd Tudify/app

# 2. Install frontend dependencies
npm install

# 3. Start development server with Tauri desktop window
npm run tauri dev
```

### Packaging for Release

```bash
cd app
npm run tauri build
```
The compiled installer will be generated in:
`app/src-tauri/target/release/bundle/nsis/Tubify_0.1.0_x64-setup.exe`

---

## 📁 Repository Structure

```
Tubify/
├── README.md                          # Project documentation
├── plan.md                            # Architecture & feature roadmap
├── Tubify-v0.1.0-windows-x64.zip      # Release package for Windows
└── app/
    ├── package.json                   # Frontend dependencies & scripts
    ├── vite.config.ts                 # Vite bundler configuration
    ├── index.html                     # HTML entry point
    ├── src/                           # React UI source code
    │   ├── components/                # Layout, PlayerBar, Sidebar, TopBar, Overlays
    │   ├── views/                     # Home, Search, Playlist, Mix views
    │   ├── lib/                       # Supabase client & utilities
    │   ├── App.tsx                    # Main app coordinator
    │   └── main.tsx                   # React root mount
    └── src-tauri/                     # Tauri Rust backend
        ├── Cargo.toml                 # Rust dependencies
        ├── tauri.conf.json            # Tauri v2 configuration
        └── src/
            ├── main.rs                # App setup, system monitor, YouTube streamer
            └── media.rs               # Windows SMTC & media key controller
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
