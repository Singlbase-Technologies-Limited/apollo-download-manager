//! Watches the system's network, so downloads waiting for it start again when it changes (#318,
//! ADR-0019; PO decision: watch the system, not try again on a timer). It raises a signal on
//! every change of this computer's addresses: one appears when Wi-Fi or a cable connects, or a
//! router gives a new lease. The manager takes the signal at its next tick
//! ([`crate::manager::Manager::with_network_signal`]).
//!
//! - **Windows:** `NotifyUnicastIpAddressChange` from the IP Helper API (Windows Vista and later).
//! - **Linux:** a netlink route socket subscribed to link and address changes.
//!
//! No other platform has a watcher yet: [`NetworkWatch::start`] says so, and the downloads
//! waiting for the network start again when the app starts, or by hand.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::domain::ErrorCode;

/// A running watcher. Dropping it stops the watch.
pub struct NetworkWatch {
    // Held only to be dropped: dropping it stops the watch.
    #[cfg(windows)]
    _watch: windows::Watch,
    #[cfg(target_os = "linux")]
    _watch: linux::Watch,
}

impl NetworkWatch {
    /// Starts watching; each change raises `signal`. `Unsupported` where there is no watcher, or
    /// the OS's reason it couldn't start.
    pub fn start(signal: Arc<AtomicBool>) -> Result<Self, ErrorCode> {
        #[cfg(windows)]
        {
            Ok(NetworkWatch {
                _watch: windows::Watch::start(signal)?,
            })
        }
        #[cfg(target_os = "linux")]
        {
            Ok(NetworkWatch {
                _watch: linux::Watch::start(signal)?,
            })
        }
        #[cfg(not(any(windows, target_os = "linux")))]
        {
            let _ = signal;
            Err(ErrorCode::Unsupported)
        }
    }
}

impl std::fmt::Debug for NetworkWatch {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("NetworkWatch")
    }
}

/// Raises the signal: the manager takes it at its next tick.
fn raise(signal: &AtomicBool) {
    signal.store(true, Ordering::SeqCst);
}

#[cfg(windows)]
mod windows {
    use std::ffi::c_void;
    use std::sync::atomic::AtomicBool;
    use std::sync::Arc;

    use windows_sys::Win32::Foundation::{HANDLE, NO_ERROR};
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        CancelMibChangeNotify2, NotifyUnicastIpAddressChange, MIB_NOTIFICATION_TYPE,
        MIB_UNICASTIPADDRESS_ROW,
    };
    use windows_sys::Win32::Networking::WinSock::AF_UNSPEC;

    use crate::domain::ErrorCode;

    pub(super) struct Watch {
        handle: HANDLE,
        /// The callback's context: a leaked `Arc`, freed once the watch is cancelled.
        context: *const AtomicBool,
    }

    // SAFETY: `handle` is only passed to `CancelMibChangeNotify2`, which may be called from any
    // thread, and `context` points to an `AtomicBool`, which is `Sync`.
    unsafe impl Send for Watch {}
    unsafe impl Sync for Watch {}

    impl Watch {
        pub(super) fn start(signal: Arc<AtomicBool>) -> Result<Self, ErrorCode> {
            let context = Arc::into_raw(signal);
            let mut handle: HANDLE = std::ptr::null_mut();
            // SAFETY: `changed` has the callback's C signature; `context` stays valid until
            // `CancelMibChangeNotify2` returns in `drop`, which waits for running callbacks; and
            // `handle` is a valid place for the handle.
            let code = unsafe {
                NotifyUnicastIpAddressChange(
                    AF_UNSPEC,
                    Some(changed),
                    context.cast::<c_void>(),
                    false,
                    &mut handle,
                )
            };
            if code != NO_ERROR {
                // SAFETY: the watch didn't start, so nothing else holds `context`.
                drop(unsafe { Arc::from_raw(context) });
                tracing::warn!("the network watch couldn't start: Windows error {code}");
                return Err(ErrorCode::Internal);
            }
            Ok(Watch { handle, context })
        }
    }

    impl Drop for Watch {
        fn drop(&mut self) {
            // SAFETY: `handle` came from `NotifyUnicastIpAddressChange`. Once this returns, no
            // callback runs or will run, so `context` can be freed.
            unsafe {
                CancelMibChangeNotify2(self.handle);
                drop(Arc::from_raw(self.context));
            }
        }
    }

    /// Called by Windows on a thread of its own for each address change.
    unsafe extern "system" fn changed(
        context: *const c_void,
        _row: *const MIB_UNICASTIPADDRESS_ROW,
        _kind: MIB_NOTIFICATION_TYPE,
    ) {
        // SAFETY: `context` is the `AtomicBool` given in `start`, alive until the watch is
        // cancelled.
        let signal = unsafe { &*context.cast::<AtomicBool>() };
        super::raise(signal);
    }
}

#[cfg(target_os = "linux")]
mod linux {
    use std::io;
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::thread::JoinHandle;

    use crate::domain::ErrorCode;

    /// How often the watching thread checks whether it should stop.
    const STOP_CHECK_SECS: libc::time_t = 1;

    pub(super) struct Watch {
        stop: Arc<AtomicBool>,
        thread: Option<JoinHandle<()>>,
    }

    impl Watch {
        pub(super) fn start(signal: Arc<AtomicBool>) -> Result<Self, ErrorCode> {
            let socket = open().map_err(|e| {
                tracing::warn!("the network watch couldn't start: {e}");
                ErrorCode::Internal
            })?;
            let stop = Arc::new(AtomicBool::new(false));
            let stopping = Arc::clone(&stop);
            let thread = std::thread::Builder::new()
                .name("velocity-network-watch".to_owned())
                .spawn(move || watch(&socket, &signal, &stopping))
                .map_err(|_| ErrorCode::Internal)?;
            Ok(Watch {
                stop,
                thread: Some(thread),
            })
        }
    }

    impl Drop for Watch {
        fn drop(&mut self) {
            self.stop.store(true, Ordering::SeqCst);
            if let Some(thread) = self.thread.take() {
                let _ = thread.join();
            }
        }
    }

    /// A netlink route socket subscribed to link and address changes, whose reads time out so
    /// the thread can stop.
    fn open() -> io::Result<OwnedFd> {
        // SAFETY: plain socket calls on a descriptor this function owns; every pointer passed is
        // to a local of the type and size the call expects.
        unsafe {
            let fd = libc::socket(
                libc::AF_NETLINK,
                libc::SOCK_RAW | libc::SOCK_CLOEXEC,
                libc::NETLINK_ROUTE,
            );
            if fd < 0 {
                return Err(io::Error::last_os_error());
            }
            let socket = OwnedFd::from_raw_fd(fd);
            let mut address: libc::sockaddr_nl = std::mem::zeroed();
            address.nl_family = libc::AF_NETLINK as libc::sa_family_t;
            address.nl_groups =
                (libc::RTMGRP_LINK | libc::RTMGRP_IPV4_IFADDR | libc::RTMGRP_IPV6_IFADDR) as u32;
            if libc::bind(
                socket.as_raw_fd(),
                (&raw const address).cast::<libc::sockaddr>(),
                std::mem::size_of::<libc::sockaddr_nl>() as libc::socklen_t,
            ) < 0
            {
                return Err(io::Error::last_os_error());
            }
            let timeout = libc::timeval {
                tv_sec: STOP_CHECK_SECS,
                tv_usec: 0,
            };
            if libc::setsockopt(
                socket.as_raw_fd(),
                libc::SOL_SOCKET,
                libc::SO_RCVTIMEO,
                (&raw const timeout).cast::<libc::c_void>(),
                std::mem::size_of::<libc::timeval>() as libc::socklen_t,
            ) < 0
            {
                return Err(io::Error::last_os_error());
            }
            Ok(socket)
        }
    }

    /// Raises `signal` for each message the kernel sends, until `stop`.
    fn watch(socket: &OwnedFd, signal: &AtomicBool, stop: &AtomicBool) {
        let mut buffer = [0u8; 8192];
        while !stop.load(Ordering::SeqCst) {
            // SAFETY: `buffer` is a live local of the length passed.
            let read = unsafe {
                libc::recv(
                    socket.as_raw_fd(),
                    buffer.as_mut_ptr().cast::<libc::c_void>(),
                    buffer.len(),
                    0,
                )
            };
            if read > 0 {
                super::raise(signal);
                continue;
            }
            let e = io::Error::last_os_error();
            match e.kind() {
                io::ErrorKind::WouldBlock
                | io::ErrorKind::TimedOut
                | io::ErrorKind::Interrupted => {}
                // The kernel dropped messages: something changed.
                _ if e.raw_os_error() == Some(libc::ENOBUFS) => super::raise(signal),
                _ => {
                    tracing::warn!("the network watch stopped: {e}");
                    return;
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The watch starts and stops cleanly on the platforms it supports. A real network change
    /// can't be made in a test; the field check covers it (docs/TESTING.md).
    #[test]
    fn the_watch_starts_and_stops() {
        let signal = Arc::new(AtomicBool::new(false));
        let watch = NetworkWatch::start(Arc::clone(&signal));
        if cfg!(any(windows, target_os = "linux")) {
            let watch = watch.expect("it starts");
            drop(watch);
        } else {
            assert_eq!(watch.err(), Some(ErrorCode::Unsupported));
        }
        assert_eq!(
            Arc::strong_count(&signal),
            1,
            "nothing keeps the signal after a stop"
        );
    }
}
