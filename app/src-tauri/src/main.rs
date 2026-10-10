#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::{Pid, System};
#[cfg(windows)]
use tauri::Manager;

#[cfg(windows)]
mod media;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

struct Monitor(Mutex<System>);
struct Http(reqwest::Client);

#[derive(Serialize)]
struct Stats {
    cpu: f32,
    ram_mb: f64,
    processes: usize,
}

/// CPU % (of whole machine) and working-set RAM for Tubify plus every
/// WebView2 child process it spawned — the same total Task Manager groups.
#[tauri::command]
fn get_stats(state: tauri::State<Monitor>) -> Stats {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_processes();

    let mut tree = vec![Pid::from_u32(std::process::id())];
    let mut i = 0;
    while i < tree.len() {
        let parent = tree[i];
        for (pid, p) in sys.processes() {
            if p.parent() == Some(parent) && !tree.contains(pid) {
                tree.push(*pid);
            }
        }
        i += 1;
    }

    let (mut cpu, mut mem) = (0f32, 0u64);
    for pid in &tree {
        if let Some(p) = sys.process(*pid) {
            cpu += p.cpu_usage();
            mem += p.memory();
        }
    }

    Stats {
        cpu: cpu / sys.cpus().len().max(1) as f32,
        ram_mb: mem as f64 / 1_048_576.0,
        processes: tree.len(),
    }
}

/// YouTube InnerTube (no API key): `search` for results, `next` for song radio.
/// The WebView can't call it directly because of CORS, so Rust forwards the JSON
/// body — only to these two fixed endpoints.
#[tauri::command]
async fn yt(http: tauri::State<'_, Http>, endpoint: String, body: String) -> Result<String, String> {
    if endpoint != "search" && endpoint != "next" {
        return Err(format!("unsupported endpoint: {endpoint}"));
    }
    http.0
        .post(format!("https://www.youtube.com/youtubei/v1/{endpoint}?prettyPrint=false"))
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}

/// What's playing — mirrored to the Windows media flyout and taskbar buttons.
#[derive(Deserialize)]
pub struct NowPlaying {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub cover: String,
    pub duration: f64,
    pub position: f64,
    pub playing: bool,
}

#[tauri::command]
fn media_update(app: tauri::AppHandle, np: NowPlaying) {
    #[cfg(windows)]
    let _ = app.run_on_main_thread(move || media::update(np));
    #[cfg(not(windows))]
    let _ = (app, np);
}

fn main() {
    let http = reqwest::Client::builder()
        .user_agent(UA)
        .build()
        .expect("failed to build HTTP client");

    tauri::Builder::default()
        .manage(Monitor(Mutex::new(System::new_all())))
        .manage(Http(http))
        .setup(|_app| {
            #[cfg(windows)]
            if let Some(w) = _app.get_webview_window("main") {
                media::init(_app.handle(), &w);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_stats, yt, media_update])
        .run(tauri::generate_context!())
        .expect("error while running Tubify");
}
