//! Logins saved in the system keychain, with the user's consent (#70, ADR-0015): Windows
//! Credential Manager, and on Linux the Secret Service (GNOME Keyring, KWallet), through the
//! `keyring` crate (PO decision on #70). Only a download whose login the user asked to remember is
//! saved, as one entry under V2's own service name, never V1's; removing the download deletes it.
//! Nothing else about a login is ever stored (docs/SECURITY.md#secrets-70).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use zeroize::Zeroizing;

use crate::branding::branding;
use crate::domain::ErrorCode;
use crate::manager::SensitiveOptions;

/// Where a download's remembered login is kept, by its app id.
pub trait Keychain: Send {
    /// Saves `login` for the download `id`, replacing any saved before. `KeychainUnavailable`
    /// when there is no keychain, or it refused.
    fn save(&self, id: &str, login: &SensitiveOptions) -> Result<(), ErrorCode>;
    /// The login saved for `id`, or `None` when there is none.
    fn load(&self, id: &str) -> Result<Option<SensitiveOptions>, ErrorCode>;
    /// Deletes the login saved for `id`; one that isn't there is fine.
    fn delete(&self, id: &str) -> Result<(), ErrorCode>;

    /// Saves `secret` in the entry `key`, replacing any before. `KeychainUnavailable` when there
    /// is no keychain, it refused, or the secret is more than one entry keeps.
    fn put_secret(&self, key: &str, secret: &str) -> Result<(), ErrorCode>;
    /// The secret in the entry `key`, or `None` when there is none.
    fn get_secret(&self, key: &str) -> Result<Option<Zeroizing<String>>, ErrorCode>;
    /// Deletes the entry `key`; one that isn't there is fine.
    fn drop_secret(&self, key: &str) -> Result<(), ErrorCode>;

    /// Saves a torrent's tracker addresses for the download `id` (#472, ADR-0021), replacing any
    /// saved before: the list as JSON in parts of at most [`TRACKER_PART_CHARS`], one entry each
    /// (`<id>.trackers.<n>`), then their count (`<id>.trackers`). Saved whole or not at all.
    fn save_trackers(&self, id: &str, trackers: &[String]) -> Result<(), ErrorCode> {
        self.delete_trackers(id)?;
        let json =
            Zeroizing::new(serde_json::to_string(trackers).map_err(|_| ErrorCode::Internal)?);
        let chars: Vec<char> = json.chars().collect();
        let parts: Vec<Zeroizing<String>> = chars
            .chunks(TRACKER_PART_CHARS)
            .map(|c| Zeroizing::new(c.iter().collect()))
            .collect();
        for (n, part) in parts.iter().enumerate() {
            if let Err(code) = self.put_secret(&tracker_part(id, n), part) {
                for written in 0..n {
                    let _ = self.drop_secret(&tracker_part(id, written));
                }
                return Err(code);
            }
        }
        if let Err(code) = self.put_secret(&tracker_count(id), &parts.len().to_string()) {
            for written in 0..parts.len() {
                let _ = self.drop_secret(&tracker_part(id, written));
            }
            return Err(code);
        }
        Ok(())
    }

    /// The tracker addresses saved for `id`, or `None` when there are none, or they can't be read
    /// whole (a part gone, or not this build's).
    fn load_trackers(&self, id: &str) -> Result<Option<Vec<String>>, ErrorCode> {
        let Some(parts) = self.tracker_parts(id)? else {
            return Ok(None);
        };
        let mut json = Zeroizing::new(String::new());
        for n in 0..parts {
            match self.get_secret(&tracker_part(id, n))? {
                Some(part) => json.push_str(&part),
                None => return Ok(None),
            }
        }
        Ok(serde_json::from_str(&json).ok())
    }

    /// Deletes every entry of the trackers saved for `id`; none saved is fine.
    fn delete_trackers(&self, id: &str) -> Result<(), ErrorCode> {
        let parts = self.tracker_parts(id)?.unwrap_or(0);
        for n in 0..parts {
            self.drop_secret(&tracker_part(id, n))?;
        }
        self.drop_secret(&tracker_count(id))
    }

    /// How many parts the trackers saved for `id` are in; `None` for none, or a count that isn't one.
    fn tracker_parts(&self, id: &str) -> Result<Option<usize>, ErrorCode> {
        Ok(self
            .get_secret(&tracker_count(id))?
            .and_then(|n| n.parse::<usize>().ok())
            .filter(|&n| n <= MAX_TRACKER_PARTS))
    }
}

/// The most characters of a tracker list in one keychain entry: under Windows' 1,280.
pub const TRACKER_PART_CHARS: usize = 1000;
/// What one Windows Credential Manager entry keeps: 2,560 bytes, 1,280 characters as UTF-16
/// (measured on Windows 11: 1,270 kept, 1,320 refused).
pub const WINDOWS_ENTRY_CHARS: usize = 1280;
/// The most parts a tracker list is in: 64 trackers of up to 2,048 characters each.
const MAX_TRACKER_PARTS: usize = 140;

fn tracker_count(id: &str) -> String {
    format!("{id}.trackers")
}

fn tracker_part(id: &str, n: usize) -> String {
    format!("{id}.trackers.{n}")
}

/// No keychain: nothing can be remembered.
#[derive(Debug, Default, Clone, Copy)]
pub struct NoKeychain;

impl Keychain for NoKeychain {
    fn save(&self, _id: &str, _login: &SensitiveOptions) -> Result<(), ErrorCode> {
        Err(ErrorCode::KeychainUnavailable)
    }

    fn load(&self, _id: &str) -> Result<Option<SensitiveOptions>, ErrorCode> {
        Ok(None)
    }

    fn delete(&self, _id: &str) -> Result<(), ErrorCode> {
        Ok(())
    }

    fn put_secret(&self, _key: &str, _secret: &str) -> Result<(), ErrorCode> {
        Err(ErrorCode::KeychainUnavailable)
    }

    fn get_secret(&self, _key: &str) -> Result<Option<Zeroizing<String>>, ErrorCode> {
        Ok(None)
    }

    fn drop_secret(&self, _key: &str) -> Result<(), ErrorCode> {
        Ok(())
    }
}

/// The system's keychain, each login a JSON string under V2's service name.
#[derive(Debug, Clone)]
pub struct SystemKeychain {
    service: String,
}

impl SystemKeychain {
    /// V2's: `<identifier>.logins`, so V1's and V2's, and development and release builds, never
    /// share an entry.
    pub fn new() -> Self {
        Self::with_service(&format!("{}.logins", branding().app_identifier()))
    }

    /// Under another service name, for tests.
    pub fn with_service(service: &str) -> Self {
        Self {
            service: service.to_owned(),
        }
    }

    fn entry(&self, id: &str) -> Result<keyring::Entry, ErrorCode> {
        keyring::Entry::new(&self.service, id).map_err(|_| ErrorCode::KeychainUnavailable)
    }
}

impl Default for SystemKeychain {
    fn default() -> Self {
        Self::new()
    }
}

impl Keychain for SystemKeychain {
    fn save(&self, id: &str, login: &SensitiveOptions) -> Result<(), ErrorCode> {
        let json = Zeroizing::new(serde_json::to_string(login).map_err(|_| ErrorCode::Internal)?);
        self.entry(id)?
            .set_password(&json)
            .map_err(|_| ErrorCode::KeychainUnavailable)
    }

    fn load(&self, id: &str) -> Result<Option<SensitiveOptions>, ErrorCode> {
        match self.entry(id)?.get_password() {
            Ok(json) => {
                let json = Zeroizing::new(json);
                // A saved login this build can't read is as good as none: the user is asked.
                Ok(serde_json::from_str(&json).ok())
            }
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(ErrorCode::KeychainUnavailable),
        }
    }

    fn delete(&self, id: &str) -> Result<(), ErrorCode> {
        self.drop_secret(id)
    }

    fn put_secret(&self, key: &str, secret: &str) -> Result<(), ErrorCode> {
        self.entry(key)?
            .set_password(secret)
            .map_err(|_| ErrorCode::KeychainUnavailable)
    }

    fn get_secret(&self, key: &str) -> Result<Option<Zeroizing<String>>, ErrorCode> {
        match self.entry(key)?.get_password() {
            Ok(secret) => Ok(Some(Zeroizing::new(secret))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(ErrorCode::KeychainUnavailable),
        }
    }

    fn drop_secret(&self, key: &str) -> Result<(), ErrorCode> {
        match self.entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(ErrorCode::KeychainUnavailable),
        }
    }
}

/// A keychain in memory, for tests: what was saved, as the system one would keep it.
#[derive(Debug, Default, Clone)]
pub struct MemoryKeychain {
    entries: Arc<Mutex<HashMap<String, Zeroizing<String>>>>,
    refuse: bool,
    /// The most characters one entry keeps, as Windows' (#472); `None` for no limit.
    limit: Option<usize>,
}

impl MemoryKeychain {
    /// One that refuses every save, as an unavailable keychain does.
    pub fn refusing() -> Self {
        Self {
            refuse: true,
            ..Self::default()
        }
    }

    /// One that keeps at most `chars` characters in an entry, as Windows Credential Manager
    /// keeps 1,280 ([`WINDOWS_ENTRY_CHARS`]).
    pub fn with_limit(chars: usize) -> Self {
        Self {
            limit: Some(chars),
            ..Self::default()
        }
    }

    /// The keys with something saved: a login's is its download's id.
    pub fn ids(&self) -> Vec<String> {
        let mut ids: Vec<_> = self.lock().keys().cloned().collect();
        ids.sort();
        ids
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, Zeroizing<String>>> {
        self.entries.lock().unwrap_or_else(|e| e.into_inner())
    }
}

impl Keychain for MemoryKeychain {
    fn save(&self, id: &str, login: &SensitiveOptions) -> Result<(), ErrorCode> {
        let json = Zeroizing::new(serde_json::to_string(login).map_err(|_| ErrorCode::Internal)?);
        self.put_secret(id, &json)
    }

    fn load(&self, id: &str) -> Result<Option<SensitiveOptions>, ErrorCode> {
        Ok(self
            .lock()
            .get(id)
            .and_then(|json| serde_json::from_str(json).ok()))
    }

    fn delete(&self, id: &str) -> Result<(), ErrorCode> {
        self.drop_secret(id)
    }

    fn put_secret(&self, key: &str, secret: &str) -> Result<(), ErrorCode> {
        if self.refuse || self.limit.is_some_and(|max| secret.chars().count() > max) {
            return Err(ErrorCode::KeychainUnavailable);
        }
        self.lock()
            .insert(key.to_owned(), Zeroizing::new(secret.to_owned()));
        Ok(())
    }

    fn get_secret(&self, key: &str) -> Result<Option<Zeroizing<String>>, ErrorCode> {
        Ok(self.lock().get(key).cloned())
    }

    fn drop_secret(&self, key: &str) -> Result<(), ErrorCode> {
        self.lock().remove(key);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transfer::{Credentials, Header, SshKey};

    fn login() -> SensitiveOptions {
        SensitiveOptions {
            credentials: Some(Credentials {
                user_name: "alice".to_owned(),
                password: "KEYCHAIN-SECRET-70".into(),
            }),
            ssh_key: Some(SshKey {
                path: std::env::temp_dir().join("id_ed25519"),
                passphrase: Some("PHRASE-70".into()),
            }),
            headers: vec![Header {
                name: "Cookie".to_owned(),
                value: "session=COOKIE-70".into(),
            }],
        }
    }

    #[test]
    fn without_a_keychain_nothing_is_remembered() {
        assert_eq!(
            NoKeychain.save("d-1", &login()),
            Err(ErrorCode::KeychainUnavailable)
        );
        assert_eq!(NoKeychain.load("d-1"), Ok(None));
        assert_eq!(NoKeychain.delete("d-1"), Ok(()));
    }

    #[test]
    fn v2s_service_name_is_its_own() {
        let k = SystemKeychain::new();
        assert_eq!(k.service, format!("{}.logins", branding().app_identifier()));
        assert!(!k.service.starts_with("com.velocity.downloadmanager."));
        assert_ne!(k.service, "com.velocity.downloadmanager.logins");
    }

    /// The real keychain of the machine the test runs on, under a service of the test's own. Where
    /// it is unavailable (a Linux session without a Secret Service), saving says so, and that is
    /// what is checked; otherwise the login goes in and comes back whole, and is deleted.
    #[test]
    fn the_system_keychain_keeps_a_login_whole_or_says_it_cant() {
        let k = SystemKeychain::with_service(&format!(
            "{}.tests.{}",
            branding().app_identifier(),
            std::process::id()
        ));
        let id = "d-test-70";
        match k.save(id, &login()) {
            Ok(()) => {
                assert_eq!(k.load(id), Ok(Some(login())));
                k.delete(id).unwrap();
                assert_eq!(k.load(id), Ok(None));
                k.delete(id).unwrap();
            }
            Err(code) => {
                eprintln!("the system keychain is unavailable here: {code:?}");
                assert_eq!(code, ErrorCode::KeychainUnavailable);
            }
        }
    }

    /// 64 trackers, each with a long passkey: far more than one Windows entry keeps.
    fn trackers() -> Vec<String> {
        (0..64)
            .map(|i| {
                format!(
                    "https://tracker{i}.example.org/announce.php?passkey={}",
                    "k".repeat(120)
                )
            })
            .collect()
    }

    /// Tracker addresses (#472, ADR-0021): split into parts one entry each keeps, since Windows
    /// keeps at most 1,280 characters in one (measured on Windows 11).
    #[test]
    fn a_torrents_trackers_come_back_whole_however_long() {
        let k = MemoryKeychain::with_limit(WINDOWS_ENTRY_CHARS);
        k.save_trackers("d-2", &trackers()).unwrap();
        assert_eq!(k.load_trackers("d-2"), Ok(Some(trackers())));
        assert!(k.ids().len() > 2, "in several parts: {:?}", k.ids());
        assert!(k.ids().iter().all(|id| id.starts_with("d-2.trackers")));
        // Saved again, shorter: no part of the longer list is left.
        k.save_trackers("d-2", &trackers()[..1]).unwrap();
        assert_eq!(k.load_trackers("d-2"), Ok(Some(trackers()[..1].to_vec())));
        assert_eq!(k.ids(), ["d-2.trackers", "d-2.trackers.0"]);
        k.delete_trackers("d-2").unwrap();
        assert!(k.ids().is_empty());
        assert_eq!(k.load_trackers("d-2"), Ok(None));
    }

    #[test]
    fn trackers_not_saved_whole_leave_nothing_behind() {
        // A limit no part fits: the first part is refused, so nothing is kept.
        let k = MemoryKeychain::with_limit(10);
        assert_eq!(
            k.save_trackers("d-3", &trackers()),
            Err(ErrorCode::KeychainUnavailable)
        );
        assert!(k.ids().is_empty());
        assert_eq!(
            NoKeychain.save_trackers("d-3", &trackers()),
            Err(ErrorCode::KeychainUnavailable)
        );
        assert_eq!(NoKeychain.load_trackers("d-3"), Ok(None));
        // A count without its parts, as a keychain edited by hand: none, not a part list.
        let k = MemoryKeychain::default();
        k.save_trackers("d-4", &trackers()).unwrap();
        k.drop_secret("d-4.trackers.1").unwrap();
        assert_eq!(k.load_trackers("d-4"), Ok(None));
    }

    /// The real keychain, as above: 64 long trackers in and back, or it says it can't.
    #[test]
    fn the_system_keychain_keeps_a_torrents_trackers_or_says_it_cant() {
        let k = SystemKeychain::with_service(&format!(
            "{}.tests.{}",
            branding().app_identifier(),
            std::process::id()
        ));
        match k.save_trackers("d-test-472", &trackers()) {
            Ok(()) => {
                assert_eq!(k.load_trackers("d-test-472"), Ok(Some(trackers())));
                k.delete_trackers("d-test-472").unwrap();
                assert_eq!(k.load_trackers("d-test-472"), Ok(None));
            }
            Err(code) => {
                eprintln!("the system keychain is unavailable here: {code:?}");
                assert_eq!(code, ErrorCode::KeychainUnavailable);
            }
        }
    }

    #[test]
    fn the_memory_keychain_behaves_like_one() {
        let k = MemoryKeychain::default();
        k.save("d-1", &login()).unwrap();
        assert_eq!(k.load("d-1"), Ok(Some(login())));
        assert_eq!(k.ids(), ["d-1"]);
        k.delete("d-1").unwrap();
        assert_eq!(k.load("d-1"), Ok(None));
        assert_eq!(
            MemoryKeychain::refusing().save("d-1", &login()),
            Err(ErrorCode::KeychainUnavailable)
        );
    }
}
