//! The computer's power (#467): keeping it awake while downloads run, and sleeping or shutting it
//! down when they finish, once the user asked for it.
//!
//! - **Awake:** the system doesn't sleep on its own while a request is held; the screen may still
//!   turn off. Windows: a power request (`PowerCreateRequest`, `PowerRequestSystemRequired`), the
//!   way media players and browsers keep it awake. Linux: a logind "sleep" inhibitor, held as the
//!   file descriptor logind returns (PO decision on #467: zbus, directly).
//! - **Sleep or shut down:** the system's own call, never a program run through a shell. Windows:
//!   `SetSuspendState` and `ExitWindowsEx`, with the user's shut-down privilege switched on for this
//!   process. Linux: logind's `Suspend` and `PowerOff`, interactive, so logind may ask the user.
//!   Programs with unsaved work can still stop a shut-down: it is never forced.

use serde::{Deserialize, Serialize};

use crate::domain::ErrorCode;

/// What the computer does once the downloads finish (#467). Closing the app instead is the
/// window's own `quit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FinishAction {
    Sleep,
    ShutDown,
}

/// The computer's power, as Apollo Download Manager uses it: [`SystemPower`], or a fake in tests.
pub trait Power: Send {
    /// Holds or releases the request that keeps the system awake. Asking again for what is already
    /// held, or released, does nothing.
    fn keep_awake(&mut self, on: bool) -> Result<(), ErrorCode>;
    /// Sleeps or shuts down now. `PermissionDenied` when the system refuses; `Unsupported` where
    /// there is no way to ask.
    fn finish(&mut self, action: FinishAction) -> Result<(), ErrorCode>;
}

/// Whether the system should be kept awake: the setting is on and a download is active.
pub fn wants_awake(setting: bool, active_downloads: usize) -> bool {
    setting && active_downloads > 0
}

/// This computer's power.
#[derive(Default)]
pub struct SystemPower {
    held: Option<platform::Request>,
}

impl SystemPower {
    pub fn new() -> Self {
        SystemPower::default()
    }
}

impl Power for SystemPower {
    fn keep_awake(&mut self, on: bool) -> Result<(), ErrorCode> {
        match (on, self.held.is_some()) {
            (true, false) => self.held = Some(platform::Request::hold()?),
            // Dropping the request releases it.
            (false, true) => self.held = None,
            _ => {}
        }
        Ok(())
    }

    fn finish(&mut self, action: FinishAction) -> Result<(), ErrorCode> {
        platform::finish(action)
    }
}

#[cfg(windows)]
mod platform {
    use super::FinishAction;
    use crate::domain::ErrorCode;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE, LUID};
    use windows_sys::Win32::Security::{
        AdjustTokenPrivileges, LookupPrivilegeValueW, LUID_AND_ATTRIBUTES, SE_PRIVILEGE_ENABLED,
        SE_SHUTDOWN_NAME, TOKEN_ADJUST_PRIVILEGES, TOKEN_PRIVILEGES, TOKEN_QUERY,
    };
    use windows_sys::Win32::System::Power::{
        PowerClearRequest, PowerCreateRequest, PowerRequestSystemRequired, PowerSetRequest,
        SetSuspendState,
    };
    use windows_sys::Win32::System::Shutdown::{
        ExitWindowsEx, EWX_POWEROFF, SHTDN_REASON_FLAG_PLANNED, SHTDN_REASON_MAJOR_APPLICATION,
    };
    use windows_sys::Win32::System::SystemServices::POWER_REQUEST_CONTEXT_VERSION;
    use windows_sys::Win32::System::Threading::{
        GetCurrentProcess, OpenProcessToken, POWER_REQUEST_CONTEXT_SIMPLE_STRING, REASON_CONTEXT,
        REASON_CONTEXT_0,
    };

    /// A held power request; dropping it clears and closes it.
    pub struct Request(HANDLE);

    // SAFETY: the handle is a kernel object handle, usable from any thread.
    unsafe impl Send for Request {}

    impl Request {
        pub fn hold() -> Result<Request, ErrorCode> {
            // The reason Windows shows in `powercfg /requests`.
            let mut reason: Vec<u16> = "Apollo Download Manager is downloading"
                .encode_utf16()
                .chain([0])
                .collect();
            let context = REASON_CONTEXT {
                Version: POWER_REQUEST_CONTEXT_VERSION,
                Flags: POWER_REQUEST_CONTEXT_SIMPLE_STRING,
                Reason: REASON_CONTEXT_0 {
                    SimpleReasonString: reason.as_mut_ptr(),
                },
            };
            // SAFETY: `context` and the string it points to live across the call, which copies them.
            let handle = unsafe { PowerCreateRequest(&context) };
            if handle == INVALID_HANDLE_VALUE || handle.is_null() {
                return Err(ErrorCode::Io);
            }
            let request = Request(handle);
            // SAFETY: `handle` is the request just created, open until `request` drops.
            if unsafe { PowerSetRequest(handle, PowerRequestSystemRequired) } == 0 {
                return Err(ErrorCode::Io);
            }
            Ok(request)
        }
    }

    impl Drop for Request {
        fn drop(&mut self) {
            // SAFETY: the handle came from `PowerCreateRequest` and is closed only here, once.
            unsafe {
                PowerClearRequest(self.0, PowerRequestSystemRequired);
                CloseHandle(self.0);
            }
        }
    }

    /// Switches on the shut-down privilege every user has but no process holds switched on.
    fn allow_shut_down() -> Result<(), ErrorCode> {
        let mut token: HANDLE = std::ptr::null_mut();
        // SAFETY: `token` receives a handle that is closed below; the pseudo-handle of the current
        // process needs no closing.
        if unsafe {
            OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
                &mut token,
            )
        } == 0
        {
            return Err(ErrorCode::PermissionDenied);
        }
        let mut luid = LUID::default();
        // SAFETY: `SE_SHUTDOWN_NAME` is a static wide string; `luid` is written by the call.
        let found = unsafe { LookupPrivilegeValueW(std::ptr::null(), SE_SHUTDOWN_NAME, &mut luid) };
        let privileges = TOKEN_PRIVILEGES {
            PrivilegeCount: 1,
            Privileges: [LUID_AND_ATTRIBUTES {
                Luid: luid,
                Attributes: SE_PRIVILEGE_ENABLED,
            }],
        };
        // SAFETY: `token` was opened with TOKEN_ADJUST_PRIVILEGES; `privileges` lives across the
        // call; the previous state isn't asked for.
        let adjusted = found != 0
            && unsafe {
                AdjustTokenPrivileges(
                    token,
                    0,
                    &privileges,
                    0,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                )
            } != 0;
        // SAFETY: `token` was opened above and is closed once.
        unsafe { CloseHandle(token) };
        if adjusted {
            Ok(())
        } else {
            Err(ErrorCode::PermissionDenied)
        }
    }

    pub fn finish(action: FinishAction) -> Result<(), ErrorCode> {
        allow_shut_down()?;
        let done = match action {
            // SAFETY: plain values; sleep, not hibernate, and not forced.
            FinishAction::Sleep => unsafe { SetSuspendState(false, false, false) },
            // SAFETY: plain values; power off, not forced, so programs with unsaved work can stop it.
            FinishAction::ShutDown => unsafe {
                ExitWindowsEx(
                    EWX_POWEROFF,
                    SHTDN_REASON_MAJOR_APPLICATION | SHTDN_REASON_FLAG_PLANNED,
                ) != 0
            },
        };
        if done {
            Ok(())
        } else {
            Err(ErrorCode::PermissionDenied)
        }
    }
}

#[cfg(target_os = "linux")]
mod platform {
    use super::FinishAction;
    use crate::domain::ErrorCode;
    use zbus::blocking::Connection;
    use zbus::zvariant::OwnedFd;

    const LOGIND: &str = "org.freedesktop.login1";
    const PATH: &str = "/org/freedesktop/login1";
    const MANAGER: &str = "org.freedesktop.login1.Manager";

    fn system_bus() -> Result<Connection, ErrorCode> {
        Connection::system().map_err(|_| ErrorCode::Unsupported)
    }

    /// A held logind inhibitor: logind keeps it while this file descriptor is open.
    pub struct Request(#[allow(dead_code)] OwnedFd);

    impl Request {
        pub fn hold() -> Result<Request, ErrorCode> {
            let reply = system_bus()?
                .call_method(
                    Some(LOGIND),
                    PATH,
                    Some(MANAGER),
                    "Inhibit",
                    &("sleep", "Apollo Download Manager", "Downloading", "block"),
                )
                .map_err(|_| ErrorCode::Unsupported)?;
            let fd: OwnedFd = reply.body().deserialize().map_err(|_| ErrorCode::Io)?;
            Ok(Request(fd))
        }
    }

    pub fn finish(action: FinishAction) -> Result<(), ErrorCode> {
        let method = match action {
            FinishAction::Sleep => "Suspend",
            FinishAction::ShutDown => "PowerOff",
        };
        // Interactive: logind may ask the user for permission, as the desktop's own menu does.
        system_bus()?
            .call_method(Some(LOGIND), PATH, Some(MANAGER), method, &(true,))
            .map(|_| ())
            .map_err(|_| ErrorCode::PermissionDenied)
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
mod platform {
    use super::FinishAction;
    use crate::domain::ErrorCode;

    pub struct Request;

    impl Request {
        pub fn hold() -> Result<Request, ErrorCode> {
            Err(ErrorCode::Unsupported)
        }
    }

    pub fn finish(_: FinishAction) -> Result<(), ErrorCode> {
        Err(ErrorCode::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_computer_is_kept_awake_only_while_downloads_are_active_and_the_setting_is_on() {
        assert!(wants_awake(true, 1));
        assert!(!wants_awake(true, 0));
        assert!(!wants_awake(false, 3));
    }

    #[test]
    fn the_finish_action_is_sent_in_camel_case() {
        assert_eq!(
            serde_json::to_string(&FinishAction::ShutDown).unwrap(),
            "\"shutDown\""
        );
        assert_eq!(
            serde_json::from_str::<FinishAction>("\"sleep\"").unwrap(),
            FinishAction::Sleep
        );
    }

    /// The real request, held and released on this computer. Windows only: CI's Linux runners
    /// have no logind session to ask.
    #[cfg(windows)]
    #[test]
    fn a_power_request_is_held_and_released() {
        let mut power = SystemPower::new();
        power.keep_awake(true).unwrap();
        assert!(power.held.is_some());
        power.keep_awake(true).unwrap();
        power.keep_awake(false).unwrap();
        assert!(power.held.is_none());
    }
}
