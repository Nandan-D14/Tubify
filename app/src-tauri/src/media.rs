//! Windows media integration: a proper "Tubify" session in the system media
//! flyout (media keys, lock screen, volume popup) and Prev / Play / Next
//! buttons on the taskbar thumbnail. Everything here lives on the UI thread.

use std::cell::RefCell;
use std::ffi::c_void;
use std::sync::OnceLock;
use std::time::Duration;

use souvlaki::{MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, MediaPosition, PlatformConfig, SeekDirection};
use tauri::{AppHandle, Emitter, WebviewWindow};
use windows::core::w;
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED};
use windows::Win32::UI::Shell::{
    DefSubclassProc, ITaskbarList3, SetWindowSubclass, TaskbarList, THBF_ENABLED, THB_FLAGS, THB_ICON, THB_TOOLTIP, THUMBBUTTON,
};
use windows::Win32::UI::WindowsAndMessaging::{CreateIcon, GetSystemMetrics, RegisterWindowMessageW, HICON, SM_CXSMICON, WM_COMMAND};

use crate::NowPlaying;

const THBN_CLICKED: usize = 0x1800;
const ID_PREV: u32 = 1;
const ID_PLAY: u32 = 2;
const ID_NEXT: u32 = 3;

#[derive(Clone, Copy)]
enum Glyph {
    Prev,
    Play,
    Pause,
    Next,
}

struct Media {
    controls: Option<MediaControls>,
    meta_id: String,
    taskbar: Option<ITaskbarList3>,
    hwnd: HWND,
    icons: [HICON; 4],
    added: bool,
    playing: bool,
}

thread_local! {
    static MEDIA: RefCell<Option<Media>> = const { RefCell::new(None) };
}
static APP: OnceLock<AppHandle> = OnceLock::new();
static TASKBAR_CREATED: OnceLock<u32> = OnceLock::new();

fn emit(cmd: impl Into<String>) {
    if let Some(app) = APP.get() {
        let _ = app.emit("media-cmd", cmd.into());
    }
}

pub fn init(app: &AppHandle, window: &WebviewWindow) {
    let _ = APP.set(app.clone());
    let Ok(hwnd) = window.hwnd() else { return };

    let controls = MediaControls::new(PlatformConfig { display_name: "Tubify", dbus_name: "tubify", hwnd: Some(hwnd.0 as *mut c_void) })
        .ok()
        .and_then(|mut c| {
            c.attach(|e| match e {
                MediaControlEvent::Play => emit("play"),
                MediaControlEvent::Pause | MediaControlEvent::Stop => emit("pause"),
                MediaControlEvent::Toggle => emit("toggle"),
                MediaControlEvent::Next => emit("next"),
                MediaControlEvent::Previous => emit("prev"),
                MediaControlEvent::Seek(SeekDirection::Forward) => emit("seekby:10"),
                MediaControlEvent::Seek(SeekDirection::Backward) => emit("seekby:-10"),
                MediaControlEvent::SetPosition(MediaPosition(d)) => emit(format!("seek:{}", d.as_secs_f64())),
                _ => {}
            })
            .ok()?;
            Some(c)
        });

    let taskbar: Option<ITaskbarList3> = unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED); // no-op if the UI thread already has COM
        CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER).ok()
    };
    if let Some(tb) = &taskbar {
        let _ = unsafe { tb.HrInit() };
    }

    let size = unsafe { GetSystemMetrics(SM_CXSMICON) }.max(16);
    let icons = [Glyph::Prev, Glyph::Play, Glyph::Pause, Glyph::Next].map(|g| icon(g, size));
    let _ = TASKBAR_CREATED.set(unsafe { RegisterWindowMessageW(w!("TaskbarButtonCreated")) });

    MEDIA.with(|m| {
        *m.borrow_mut() = Some(Media { controls, meta_id: String::new(), taskbar, hwnd, icons, added: false, playing: false });
    });
    unsafe {
        let _ = SetWindowSubclass(hwnd, Some(subclass), 1, 0);
    }
    with_media(Media::add_buttons); // the taskbar button may already exist
}

fn with_media(f: impl FnOnce(&mut Media)) {
    MEDIA.with(|m| {
        if let Ok(mut m) = m.try_borrow_mut() {
            if let Some(m) = m.as_mut() {
                f(m);
            }
        }
    });
}

pub fn update(np: NowPlaying) {
    with_media(|m| m.update(np));
}

impl Media {
    fn update(&mut self, np: NowPlaying) {
        if let Some(c) = self.controls.as_mut() {
            if np.id.is_empty() {
                let _ = c.set_playback(MediaPlayback::Stopped);
                self.meta_id.clear();
            } else {
                if np.id != self.meta_id {
                    self.meta_id = np.id.clone();
                    let _ = c.set_metadata(MediaMetadata {
                        title: Some(&np.title),
                        artist: Some(&np.artist),
                        album: Some(&np.album),
                        cover_url: Some(&np.cover),
                        duration: Some(Duration::from_secs_f64(np.duration.max(0.0))),
                    });
                }
                let progress = Some(MediaPosition(Duration::from_secs_f64(np.position.max(0.0))));
                let _ = c.set_playback(if np.playing { MediaPlayback::Playing { progress } } else { MediaPlayback::Paused { progress } });
            }
        }
        if np.playing != self.playing {
            self.playing = np.playing;
            if self.added {
                if let Some(tb) = &self.taskbar {
                    let _ = unsafe { tb.ThumbBarUpdateButtons(self.hwnd, &[self.play_button()]) };
                }
            }
        }
    }

    fn play_button(&self) -> THUMBBUTTON {
        if self.playing {
            button(ID_PLAY, self.icons[2], "Pause")
        } else {
            button(ID_PLAY, self.icons[1], "Play")
        }
    }

    fn add_buttons(&mut self) {
        let Some(tb) = &self.taskbar else { return };
        let buttons = [button(ID_PREV, self.icons[0], "Previous"), self.play_button(), button(ID_NEXT, self.icons[3], "Next")];
        // Can only be called once per taskbar button; afterwards use ThumbBarUpdateButtons.
        let ok = if self.added { unsafe { tb.ThumbBarUpdateButtons(self.hwnd, &buttons) } } else { unsafe { tb.ThumbBarAddButtons(self.hwnd, &buttons) } };
        self.added |= ok.is_ok();
    }
}

fn button(id: u32, icon: HICON, tip: &str) -> THUMBBUTTON {
    let mut sz_tip = [0u16; 260];
    for (d, s) in sz_tip.iter_mut().zip(tip.encode_utf16()) {
        *d = s;
    }
    THUMBBUTTON { dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS, iId: id, iBitmap: 0, hIcon: icon, szTip: sz_tip, dwFlags: THBF_ENABLED }
}

unsafe extern "system" fn subclass(hwnd: HWND, msg: u32, wp: WPARAM, lp: LPARAM, _id: usize, _data: usize) -> LRESULT {
    if msg == WM_COMMAND && (wp.0 >> 16) & 0xffff == THBN_CLICKED {
        match (wp.0 & 0xffff) as u32 {
            ID_PREV => emit("prev"),
            ID_PLAY => emit("toggle"),
            ID_NEXT => emit("next"),
            _ => {}
        }
        return LRESULT(0);
    }
    if Some(&msg) == TASKBAR_CREATED.get() {
        // Explorer (re)created our taskbar button — the old buttons are gone.
        with_media(|m| {
            m.added = false;
            m.add_buttons();
        });
    }
    DefSubclassProc(hwnd, msg, wp, lp)
}

/// White media glyph, anti-aliased with 4x4 supersampling.
fn icon(g: Glyph, size: i32) -> HICON {
    let n = size as usize;
    let tri = |p: (f32, f32), a: (f32, f32), b: (f32, f32), c: (f32, f32)| {
        let s = |p: (f32, f32), q: (f32, f32), r: (f32, f32)| (p.0 - r.0) * (q.1 - r.1) - (q.0 - r.0) * (p.1 - r.1);
        let (d1, d2, d3) = (s(p, a, b), s(p, b, c), s(p, c, a));
        !((d1 < 0.0 || d2 < 0.0 || d3 < 0.0) && (d1 > 0.0 || d2 > 0.0 || d3 > 0.0))
    };
    let rect = |p: (f32, f32), x0: f32, x1: f32| p.0 >= x0 && p.0 <= x1 && p.1 >= 0.18 && p.1 <= 0.82;
    let inside = |p: (f32, f32)| match g {
        Glyph::Play => tri(p, (0.26, 0.16), (0.26, 0.84), (0.84, 0.5)),
        Glyph::Pause => rect(p, 0.24, 0.42) || rect(p, 0.58, 0.76),
        Glyph::Next => tri(p, (0.16, 0.18), (0.16, 0.82), (0.66, 0.5)) || rect(p, 0.68, 0.82),
        Glyph::Prev => tri(p, (0.84, 0.18), (0.84, 0.82), (0.34, 0.5)) || rect(p, 0.18, 0.32),
    };

    let mut bgra = vec![0u8; n * n * 4];
    for y in 0..n {
        for x in 0..n {
            let mut hits = 0u32;
            for sy in 0..4 {
                for sx in 0..4 {
                    let p = ((x as f32 + (sx as f32 + 0.5) / 4.0) / n as f32, (y as f32 + (sy as f32 + 0.5) / 4.0) / n as f32);
                    hits += inside(p) as u32;
                }
            }
            let a = (hits * 255 / 16) as u8;
            let i = (y * n + x) * 4;
            bgra[i..i + 4].copy_from_slice(&[a, a, a, a]); // premultiplied white
        }
    }
    let mask = vec![0u8; n.div_ceil(16) * 2 * n]; // 1bpp AND mask, word-aligned rows; alpha does the work
    unsafe { CreateIcon(None, size, size, 1, 32, mask.as_ptr(), bgra.as_ptr()) }.unwrap_or_default()
}
