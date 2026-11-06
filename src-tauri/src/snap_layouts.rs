//! Windows 11's snap layouts on the title bar's maximise button (#359). The window draws its own
//! title bar, and Windows only offers the layouts over a window that answers `HTMAXBUTTON`. The web
//! view covers the whole window, so a small child window sits over the button and answers for it.
//! It takes the mouse there, so it also does the click and tells the page what to draw. Keyboard and
//! screen-reader users still use the page's button, under it. Elsewhere the command does nothing.

use serde::Deserialize;
use velocity_core::domain::ErrorCode;

/// Where the page's maximise button is, in CSS pixels from the window's top left.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct ButtonRect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

/// The same place in the window's physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PhysicalRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

/// No window is bigger than this, in CSS pixels.
const MAX_COORDINATE: f64 = 100_000.0;
/// A title bar button is far smaller than this.
const MAX_BUTTON: f64 = 512.0;

impl ButtonRect {
    /// The page's numbers are checked before they place a window; `scale` is the window's own.
    pub fn physical(&self, scale: f64) -> Result<PhysicalRect, ErrorCode> {
        let place = |n: f64| (0.0..=MAX_COORDINATE).contains(&n);
        let size = |n: f64| n > 0.0 && n <= MAX_BUTTON;
        if !place(self.x) || !place(self.y) || !size(self.width) || !size(self.height) {
            return Err(ErrorCode::InvalidInput);
        }
        if !scale.is_finite() || scale <= 0.0 || scale > 16.0 {
            return Err(ErrorCode::InvalidInput);
        }
        // The checks above bound every product well inside an i32.
        let px = |n: f64| (n * scale).round() as i32;
        Ok(PhysicalRect {
            x: px(self.x),
            y: px(self.y),
            width: px(self.width),
            height: px(self.height),
        })
    }
}

/// What the page draws on the button, sent in the `maximize-button` event.
#[cfg(any(windows, test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ButtonState {
    Idle,
    Hover,
    Pressed,
}

#[cfg(any(windows, test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MouseInput {
    Move,
    Down,
    Up,
    Leave,
}

/// The next state, and whether this was a click: a press released over the button.
#[cfg(any(windows, test))]
fn next(state: ButtonState, input: MouseInput) -> (ButtonState, bool) {
    match (state, input) {
        (_, MouseInput::Leave) => (ButtonState::Idle, false),
        (_, MouseInput::Down) => (ButtonState::Pressed, false),
        (ButtonState::Pressed, MouseInput::Up) => (ButtonState::Hover, true),
        (ButtonState::Pressed, MouseInput::Move) => (ButtonState::Pressed, false),
        (_, MouseInput::Move | MouseInput::Up) => (ButtonState::Hover, false),
    }
}

/// Runs on the main thread, as a command that isn't `async` does, like the window it places.
#[tauri::command]
pub fn set_maximize_button_rect(
    window: tauri::WebviewWindow,
    rect: ButtonRect,
) -> Result<(), ErrorCode> {
    let scale = window.scale_factor().map_err(|_| ErrorCode::InvalidState)?;
    let area = rect.physical(scale)?;
    #[cfg(windows)]
    native::place(&window, area);
    #[cfg(not(windows))]
    let _ = area;
    Ok(())
}

#[cfg(windows)]
mod native {
    use super::{next, ButtonState, MouseInput, PhysicalRect};
    use std::sync::{Mutex, OnceLock};
    use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        TrackMouseEvent, TME_LEAVE, TME_NONCLIENT, TRACKMOUSEEVENT,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, IsZoomed, LoadCursorW, PostMessageW, RegisterClassW,
        SetWindowPos, HTMAXBUTTON, HWND_TOP, IDC_HAND, SC_MAXIMIZE, SC_RESTORE, SWP_NOACTIVATE,
        SWP_SHOWWINDOW, WM_ERASEBKGND, WM_NCHITTEST, WM_NCLBUTTONDOWN, WM_NCLBUTTONUP,
        WM_NCMOUSELEAVE, WM_NCMOUSEMOVE, WM_SYSCOMMAND, WNDCLASSW, WS_CHILD, WS_EX_NOACTIVATE,
        WS_VISIBLE,
    };

    const EVENT: &str = "maximize-button";

    struct Overlay {
        /// Window handles as integers, since a raw pointer can't be shared between threads.
        hwnd: isize,
        parent: isize,
        app: AppHandle,
        state: Mutex<ButtonState>,
    }

    /// `None` once making it failed: the page's own button then keeps working, without the layouts.
    static OVERLAY: OnceLock<Option<Overlay>> = OnceLock::new();

    fn create(window: &WebviewWindow) -> Option<Overlay> {
        let parent = match window.hwnd() {
            Ok(hwnd) => hwnd.0,
            Err(e) => {
                tracing::warn!("snap layouts are off: no window handle: {e}");
                return None;
            }
        };
        let class: Vec<u16> = "ApolloMaximizeButton\0".encode_utf16().collect();
        // SAFETY: `class` is NUL-terminated and outlives both calls, which copy it; `proc` is a
        // function with the signature Windows calls; `parent` is the live main window, and this
        // runs on its thread. A plain child: Windows refuses a layered one here, measured on #359.
        let hwnd = unsafe {
            let module = GetModuleHandleW(std::ptr::null());
            let description = WNDCLASSW {
                style: 0,
                lpfnWndProc: Some(proc),
                cbClsExtra: 0,
                cbWndExtra: 0,
                hInstance: module,
                hIcon: std::ptr::null_mut(),
                hCursor: LoadCursorW(std::ptr::null_mut(), IDC_HAND),
                hbrBackground: std::ptr::null_mut(),
                lpszMenuName: std::ptr::null(),
                lpszClassName: class.as_ptr(),
            };
            if RegisterClassW(&description) == 0 {
                let e = std::io::Error::last_os_error();
                tracing::warn!("snap layouts are off: the window class failed: {e}");
                return None;
            }
            CreateWindowExW(
                WS_EX_NOACTIVATE,
                class.as_ptr(),
                std::ptr::null(),
                WS_CHILD | WS_VISIBLE,
                0,
                0,
                0,
                0,
                parent,
                std::ptr::null_mut(),
                module,
                std::ptr::null(),
            )
        };
        if hwnd.is_null() {
            let e = std::io::Error::last_os_error();
            tracing::warn!("snap layouts are off: the window failed: {e}");
            return None;
        }
        Some(Overlay {
            hwnd: hwnd as isize,
            parent: parent as isize,
            app: window.app_handle().clone(),
            state: Mutex::new(ButtonState::Idle),
        })
    }

    /// Makes the overlay the first time, and moves it over the button, above the web view.
    pub fn place(window: &WebviewWindow, area: PhysicalRect) {
        let Some(overlay) = OVERLAY.get_or_init(|| create(window)) else {
            return;
        };
        // SAFETY: the overlay is a live child of the main window, which lasts as long as the app.
        let placed = unsafe {
            SetWindowPos(
                overlay.hwnd as HWND,
                HWND_TOP,
                area.x,
                area.y,
                area.width,
                area.height,
                SWP_NOACTIVATE | SWP_SHOWWINDOW,
            )
        };
        if placed == 0 {
            let e = std::io::Error::last_os_error();
            tracing::warn!("the maximise button's overlay didn't move: {e}");
        }
    }

    fn state_name(state: ButtonState) -> &'static str {
        match state {
            ButtonState::Idle => "idle",
            ButtonState::Hover => "hover",
            ButtonState::Pressed => "pressed",
        }
    }

    fn mouse(input: MouseInput) {
        let Some(Some(overlay)) = OVERLAY.get() else {
            return;
        };
        let Ok(mut state) = overlay.state.lock() else {
            return;
        };
        let before = *state;
        let (after, clicked) = next(before, input);
        *state = after;
        drop(state);
        if before == ButtonState::Idle && after != ButtonState::Idle {
            let mut leave = TRACKMOUSEEVENT {
                cbSize: size_of::<TRACKMOUSEEVENT>() as u32,
                dwFlags: TME_LEAVE | TME_NONCLIENT,
                hwndTrack: overlay.hwnd as HWND,
                dwHoverTime: 0,
            };
            // SAFETY: `leave` is a valid, fully set structure for this call, and the overlay lives.
            if unsafe { TrackMouseEvent(&mut leave) } == 0 {
                let e = std::io::Error::last_os_error();
                tracing::warn!("the maximise button can't see the mouse leave: {e}");
            }
        }
        if before != after {
            if let Err(e) = overlay.app.emit(EVENT, state_name(after)) {
                tracing::warn!("the maximise button's state wasn't sent: {e}");
            }
        }
        if clicked {
            let parent = overlay.parent as HWND;
            // SAFETY: the main window lives as long as the app, and both calls only read or post.
            let posted = unsafe {
                let command = if IsZoomed(parent) != 0 {
                    SC_RESTORE
                } else {
                    SC_MAXIMIZE
                };
                PostMessageW(parent, WM_SYSCOMMAND, command as WPARAM, 0)
            };
            if posted == 0 {
                let e = std::io::Error::last_os_error();
                tracing::warn!("the maximise button's click wasn't sent: {e}");
            }
        }
    }

    /// The overlay's messages: Windows shows the layouts over a window that answers `HTMAXBUTTON`.
    /// Pressing is handled here, since Windows' own handling would maximise this child window.
    unsafe extern "system" fn proc(hwnd: HWND, msg: u32, w: WPARAM, l: LPARAM) -> LRESULT {
        match msg {
            WM_NCHITTEST => HTMAXBUTTON as LRESULT,
            // Moves and leaves go on to Windows too, as they did when the layouts were first shown here.
            WM_NCMOUSEMOVE => {
                mouse(MouseInput::Move);
                // SAFETY: the arguments are the ones Windows passed to this window procedure.
                unsafe { DefWindowProcW(hwnd, msg, w, l) }
            }
            WM_NCLBUTTONDOWN => {
                mouse(MouseInput::Down);
                0
            }
            WM_NCLBUTTONUP => {
                mouse(MouseInput::Up);
                0
            }
            WM_NCMOUSELEAVE => {
                mouse(MouseInput::Leave);
                // SAFETY: the arguments are the ones Windows passed to this window procedure.
                unsafe { DefWindowProcW(hwnd, msg, w, l) }
            }
            // Nothing to draw: the page's button shows through.
            WM_ERASEBKGND => 1,
            // SAFETY: the arguments are the ones Windows passed to this window procedure.
            _ => unsafe { DefWindowProcW(hwnd, msg, w, l) },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BUTTON: ButtonRect = ButtonRect {
        x: 1000.0,
        y: 0.0,
        width: 44.0,
        height: 32.0,
    };

    #[test]
    fn scales_the_button_to_the_window_s_pixels() {
        let at = |scale| BUTTON.physical(scale).unwrap();
        assert_eq!(
            at(1.0),
            PhysicalRect {
                x: 1000,
                y: 0,
                width: 44,
                height: 32
            }
        );
        assert_eq!(
            at(1.5),
            PhysicalRect {
                x: 1500,
                y: 0,
                width: 66,
                height: 48
            }
        );
    }

    #[test]
    fn refuses_numbers_no_button_could_have() {
        for bad in [
            ButtonRect {
                x: f64::NAN,
                ..BUTTON
            },
            ButtonRect {
                y: f64::INFINITY,
                ..BUTTON
            },
            ButtonRect { x: -1.0, ..BUTTON },
            ButtonRect { x: 1e9, ..BUTTON },
            ButtonRect {
                width: 0.0,
                ..BUTTON
            },
            ButtonRect {
                height: -4.0,
                ..BUTTON
            },
            ButtonRect {
                width: 5000.0,
                ..BUTTON
            },
        ] {
            assert_eq!(bad.physical(1.0), Err(ErrorCode::InvalidInput), "{bad:?}");
        }
        assert_eq!(BUTTON.physical(0.0), Err(ErrorCode::InvalidInput));
        assert_eq!(BUTTON.physical(f64::NAN), Err(ErrorCode::InvalidInput));
    }

    #[test]
    fn a_click_is_a_press_released_over_the_button() {
        use ButtonState::{Hover, Idle, Pressed};
        use MouseInput::{Down, Leave, Move, Up};
        assert_eq!(next(Idle, Move), (Hover, false));
        assert_eq!(next(Hover, Down), (Pressed, false));
        assert_eq!(next(Pressed, Move), (Pressed, false));
        assert_eq!(next(Pressed, Up), (Hover, true));
        assert_eq!(next(Hover, Leave), (Idle, false));
    }

    #[test]
    fn a_press_dragged_away_is_no_click() {
        use ButtonState::{Hover, Idle, Pressed};
        use MouseInput::{Leave, Up};
        assert_eq!(next(Pressed, Leave), (Idle, false));
        assert_eq!(next(Idle, Up), (Hover, false));
    }
}
