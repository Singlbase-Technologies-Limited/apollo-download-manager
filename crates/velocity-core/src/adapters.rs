//! This computer's network adapters, for binding torrents to one (#471): a VPN's, so nothing
//! leaks over another adapter if the VPN drops. Each adapter has the id libtorrent binds to and a
//! name to show.
//!
//! - **Windows:** `GetAdaptersAddresses` from the IP Helper API. libtorrent binds to an adapter's
//!   GUID (`{…}`), not to its friendly name such as "Wi-Fi": tried on Windows 11 with libtorrent
//!   2.0, a friendly name, like a name that doesn't exist, listened nowhere and said nothing.
//! - **Linux:** `getifaddrs`; an interface's name (`tun0`, `wg0`) is its id.
//!
//! The loopback adapter is left out: binding torrents to it would reach no peer.

use crate::domain::ErrorCode;

/// One network adapter.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct NetworkAdapter {
    /// What libtorrent binds to, and the setting stores: a GUID on Windows, a name on Linux.
    pub id: String,
    /// The name to show, such as "Wi-Fi" or "tun0".
    pub name: String,
    /// It is connected now.
    pub up: bool,
}

/// The longest adapter id accepted: Windows' GUIDs are 38 bytes, Linux names at most 15.
pub const MAX_ADAPTER_ID: usize = 256;

/// An adapter's id as libtorrent reads it in `listen_interfaces` and `outgoing_interfaces`: no
/// separator of those lists (`,` `:`), no space, control character or bracket, letters, digits,
/// `{` `}` `-` `_` `.` only, and at most [`MAX_ADAPTER_ID`] bytes.
pub fn is_adapter_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_ADAPTER_ID
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '{' | '}' | '-' | '_' | '.'))
}

/// This computer's adapters, connected or not, in the system's order, without loopback and
/// without any whose id libtorrent couldn't read. `Unsupported` on another system; `Io` when the
/// system refuses the list.
pub fn network_adapters() -> Result<Vec<NetworkAdapter>, ErrorCode> {
    let adapters = imp::list()?;
    Ok(adapters
        .into_iter()
        .filter(|a| is_adapter_id(&a.id))
        .collect())
}

#[cfg(windows)]
mod imp {
    use super::NetworkAdapter;
    use crate::domain::ErrorCode;
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        GetAdaptersAddresses, GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_DNS_SERVER,
        GAA_FLAG_SKIP_MULTICAST, IP_ADAPTER_ADDRESSES_LH,
    };
    use windows_sys::Win32::Networking::WinSock::AF_UNSPEC;

    const NO_ERROR: u32 = 0;
    const ERROR_BUFFER_OVERFLOW: u32 = 111;
    /// `IF_TYPE_SOFTWARE_LOOPBACK`.
    const LOOPBACK: u32 = 24;
    /// `IfOperStatusUp`.
    const UP: i32 = 1;
    /// Asked again at most this many times when the list grows between the size and the read.
    const TRIES: usize = 4;

    pub(super) fn list() -> Result<Vec<NetworkAdapter>, ErrorCode> {
        let flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER;
        let mut size: u32 = 16 * 1024;
        for _ in 0..TRIES {
            // u64s, so the buffer is aligned for the structures written into it.
            let mut buffer = vec![0u64; (size as usize).div_ceil(8)];
            let first = buffer.as_mut_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
            // SAFETY: `first` points to `size` writable bytes, aligned for the structure; the
            // system writes at most `size` bytes, and sets `size` to what it needs when that is
            // more. The reserved argument is null, as documented.
            let code = unsafe {
                GetAdaptersAddresses(
                    u32::from(AF_UNSPEC),
                    flags,
                    std::ptr::null(),
                    first,
                    &mut size,
                )
            };
            match code {
                NO_ERROR => return Ok(read(first)),
                ERROR_BUFFER_OVERFLOW => continue,
                _ => return Err(ErrorCode::Io),
            }
        }
        Err(ErrorCode::Io)
    }

    /// The adapters in the list the system wrote at `first`.
    fn read(first: *const IP_ADAPTER_ADDRESSES_LH) -> Vec<NetworkAdapter> {
        let mut out = Vec::new();
        let mut at = first;
        while !at.is_null() {
            // SAFETY: `at` is `first` or a `Next` link of the list `GetAdaptersAddresses` just
            // wrote into a buffer that outlives this function's caller's use of it; each entry
            // and its strings stay valid until that buffer is dropped.
            let a = unsafe { &*at };
            if a.IfType != LOOPBACK {
                // SAFETY: `AdapterName` is a NUL-terminated ANSI string, `FriendlyName` a
                // NUL-terminated wide string, both in the same buffer.
                let id = unsafe { ansi(a.AdapterName) };
                let name = unsafe { wide(a.FriendlyName) };
                if let (Some(id), Some(name)) = (id, name) {
                    out.push(NetworkAdapter {
                        id,
                        name,
                        up: a.OperStatus == UP,
                    });
                }
            }
            at = a.Next;
        }
        out
    }

    /// # Safety
    /// `p` is null or a NUL-terminated byte string.
    unsafe fn ansi(p: *const u8) -> Option<String> {
        if p.is_null() {
            return None;
        }
        // SAFETY: the caller's promise.
        let bytes = unsafe { std::ffi::CStr::from_ptr(p.cast()) }.to_bytes();
        String::from_utf8(bytes.to_vec()).ok()
    }

    /// # Safety
    /// `p` is null or a NUL-terminated UTF-16 string.
    unsafe fn wide(p: *const u16) -> Option<String> {
        if p.is_null() {
            return None;
        }
        let mut len = 0;
        // SAFETY: the caller's promise: every unit up to the NUL is readable.
        while unsafe { *p.add(len) } != 0 {
            len += 1;
        }
        // SAFETY: the `len` units before the NUL, as counted above.
        let units = unsafe { std::slice::from_raw_parts(p, len) };
        String::from_utf16(units).ok()
    }
}

#[cfg(target_os = "linux")]
mod imp {
    use super::NetworkAdapter;
    use crate::domain::ErrorCode;

    pub(super) fn list() -> Result<Vec<NetworkAdapter>, ErrorCode> {
        let mut head: *mut libc::ifaddrs = std::ptr::null_mut();
        // SAFETY: `head` is a valid place for the list's address; freed with `freeifaddrs` below.
        if unsafe { libc::getifaddrs(&mut head) } != 0 {
            return Err(ErrorCode::Io);
        }
        let mut out: Vec<NetworkAdapter> = Vec::new();
        let mut at = head;
        while !at.is_null() {
            // SAFETY: `at` is `head` or an `ifa_next` link of the list `getifaddrs` returned,
            // valid until `freeifaddrs`.
            let a = unsafe { &*at };
            if !a.ifa_name.is_null() {
                // SAFETY: `ifa_name` is a NUL-terminated string in the same list.
                let name = unsafe { std::ffi::CStr::from_ptr(a.ifa_name) }
                    .to_string_lossy()
                    .into_owned();
                let loopback = a.ifa_flags & libc::IFF_LOOPBACK as u32 != 0;
                let up = a.ifa_flags & (libc::IFF_UP | libc::IFF_RUNNING) as u32
                    == (libc::IFF_UP | libc::IFF_RUNNING) as u32;
                // One entry per address: an adapter is listed once, up if any entry says so.
                match out.iter_mut().find(|n| n.id == name) {
                    Some(known) => known.up |= up,
                    None if !loopback => out.push(NetworkAdapter {
                        id: name.clone(),
                        name,
                        up,
                    }),
                    None => {}
                }
            }
            at = a.ifa_next;
        }
        // SAFETY: `head` came from `getifaddrs` and is freed once.
        unsafe { libc::freeifaddrs(head) };
        Ok(out)
    }
}

#[cfg(not(any(windows, target_os = "linux")))]
mod imp {
    use super::NetworkAdapter;
    use crate::domain::ErrorCode;

    pub(super) fn list() -> Result<Vec<NetworkAdapter>, ErrorCode> {
        Err(ErrorCode::Unsupported)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_adapter_id_is_one_libtorrent_reads() {
        for id in [
            "{921A8483-F16D-4CC1-959B-8A85B6BFEC1C}",
            "tun0",
            "wg0",
            "enp3s0",
            "eth0.100",
        ] {
            assert!(is_adapter_id(id), "{id}");
        }
        for bad in [
            "",
            " ",
            "a,b",
            "a:b",
            "tun0\n",
            "[x]",
            "Wi-Fi 2",
            &"a".repeat(MAX_ADAPTER_ID + 1),
        ] {
            assert!(!is_adapter_id(bad), "{bad:?}");
        }
    }

    /// The real list: every computer that runs the tests has an adapter besides loopback.
    #[cfg(any(windows, target_os = "linux"))]
    #[test]
    fn this_computer_lists_its_adapters_with_ids_libtorrent_reads() {
        let adapters = network_adapters().unwrap();
        assert!(!adapters.is_empty(), "no adapter listed");
        for a in &adapters {
            assert!(is_adapter_id(&a.id), "{a:?}");
            assert!(!a.name.is_empty(), "{a:?}");
            assert_ne!(a.name, "lo", "loopback is left out");
        }
        #[cfg(windows)]
        assert!(
            adapters.iter().all(|a| a.id.starts_with('{')),
            "{adapters:?}"
        );
        let mut ids: Vec<_> = adapters.iter().map(|a| &a.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), adapters.len(), "each once");
    }
}
