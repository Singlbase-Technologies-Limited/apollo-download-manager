//! The window's settings (#29): how it looks, the first-run setup, and the sections the shell
//! reads. Their screen is #30's.

use super::Manager;
use crate::app_settings::{AppearanceSettings, OnboardingSettings, ShellSettings};
use crate::database::settings::Section;
use crate::destination::{check_folder, system_downloads, FolderSettings};
use crate::domain::ErrorCode;
use crate::fs_safety::is_link;

impl Manager {
    /// A section of the saved settings, or its defaults before it was saved.
    pub fn settings_section<S: Section>(&self) -> Result<S, ErrorCode> {
        self.database.section::<S>().map_err(|e| e.code)
    }

    /// What the window starts with: how it looks, whether the first-run setup is needed, and
    /// the folder downloads go to now.
    pub fn shell_settings(&self) -> Result<ShellSettings, ErrorCode> {
        let folders = self.settings_section::<FolderSettings>()?;
        let default_directory = match folders.default_directory.as_str() {
            "" => system_downloads().map(|p| p.to_string_lossy().into_owned()),
            dir => Some(dir.to_owned()),
        };
        Ok(ShellSettings {
            appearance: self.settings_section()?,
            onboarding_completed: self.settings_section::<OnboardingSettings>()?.completed,
            default_directory,
        })
    }

    /// Saves how the window looks, as checked.
    pub fn set_appearance(
        &mut self,
        appearance: &AppearanceSettings,
        now_ms: u64,
    ) -> Result<AppearanceSettings, ErrorCode> {
        self.database
            .save_section(appearance, now_ms)
            .map_err(|e| e.code)
    }

    /// Finishes the first-run setup with the folder the user chose for downloads, which must be
    /// an existing folder, not a link: `InvalidPath`, or `DestinationMissing` when it doesn't
    /// exist. Creating one is left to the user, as for every chosen folder (FILE_NAMING.md).
    pub fn complete_onboarding(
        &mut self,
        directory: &str,
        now_ms: u64,
    ) -> Result<ShellSettings, ErrorCode> {
        let folder = check_folder(directory.trim())?;
        // Never through a link: the folder is checked as itself.
        match std::fs::symlink_metadata(&folder) {
            Ok(meta) if meta.is_dir() && !is_link(&meta) => {}
            Ok(_) => return Err(ErrorCode::InvalidPath),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                return Err(ErrorCode::DestinationMissing)
            }
            Err(_) => return Err(ErrorCode::InvalidPath),
        }
        let folders = FolderSettings {
            default_directory: folder.to_string_lossy().into_owned(),
            ..self.settings_section()?
        };
        self.database
            .save_section(&folders, now_ms)
            .map_err(|e| e.code)?;
        if first_run_starts_at_login(crate::branding::Branding::RELEASE) {
            // The setup finishes even when the start-up list refuses; the setting then stays off,
            // as the list is, and Settings can try again.
            let on = match self.sync_startup(true) {
                Ok(()) => true,
                Err(code) => {
                    tracing::warn!(?code, "the app couldn't add itself to the start-up list");
                    false
                }
            };
            let general = crate::app_settings::GeneralSettings {
                start_at_login: on,
                ..self.settings_section()?
            };
            self.database
                .save_section(&general, now_ms)
                .map_err(|e| e.code)?;
        }
        self.database
            .save_section(&OnboardingSettings { completed: true }, now_ms)
            .map_err(|e| e.code)?;
        self.shell_settings()
    }
}

/// Whether finishing the first-run setup turns on starting at sign-in (#321, PO decision): in a
/// released build only, so a development build never adds itself to the user's start-up list.
fn first_run_starts_at_login(release: bool) -> bool {
    release
}

/// Starting the app when the user signs in (#321).
impl Manager {
    /// Gives the manager the user's start-up list and this app's entry, so the
    /// `general.start_at_login` setting is kept in step with it.
    pub fn with_startup(
        mut self,
        list: crate::autostart::StartupList,
        entry: crate::autostart::Entry,
    ) -> Self {
        self.startup = Some((list, entry));
        self
    }

    /// Puts this app's entry in the start-up list with `on`, or takes it out. An entry for a
    /// program that moved is replaced. Without a list, there is nothing to do.
    fn sync_startup(&self, on: bool) -> Result<(), ErrorCode> {
        let Some((list, entry)) = &self.startup else {
            return Ok(());
        };
        if on && list.has(entry) {
            return Ok(());
        }
        list.set(entry, on)
    }
}

/// What the transfer engine learned about servers (#325).
impl Manager {
    /// Forgets everything learned about servers: the Settings button (PO decision on #325). The
    /// engine forgets it too, or is told when it next starts.
    pub fn forget_learned_servers(&mut self) -> Result<(), ErrorCode> {
        self.database.forget_hosts().map_err(|e| e.code)?;
        match self.engine.set_host_memory(Vec::new()) {
            Ok(()) | Err(ErrorCode::EngineUnavailable) => Ok(()),
            Err(code) => Err(code),
        }
    }

    /// Gives the engine the servers remembered at `now_ms`, and drops the ones no longer kept.
    fn give_host_memory(&mut self, now_ms: u64) -> Result<(), ErrorCode> {
        self.database.forget_old_hosts(now_ms).map_err(|e| e.code)?;
        let hosts = self.database.hosts(now_ms).map_err(|e| e.code)?;
        match self.engine.set_host_memory(hosts) {
            Ok(()) | Err(ErrorCode::EngineUnavailable) => Ok(()),
            Err(code) => Err(code),
        }
    }
}

/// The Settings screen's settings (#30): read, saved whole and applied at once.
impl Manager {
    /// Every setting the Settings screen edits, as saved, or the defaults of those never saved.
    pub fn settings(&self) -> Result<crate::settings::Settings, ErrorCode> {
        Ok(crate::settings::Settings {
            general: self.settings_section()?,
            notifications: self.settings_section()?,
            downloads: self.settings_section()?,
            queue: self.settings_section()?,
            performance: self.settings_section()?,
            engine: self.settings_section()?,
            advanced: self.settings_section()?,
            torrent: self.settings_section()?,
            new_torrents: self.settings_section()?,
            storage: self.settings_section()?,
            browser: self.settings_section()?,
            proxy: self.settings_section()?,
        })
    }

    /// Checks every section, saves them in one write, and applies them at once. Nothing is saved
    /// or applied when one is refused (`InvalidInput`). An engine that isn't running gets them when
    /// it next starts. Returns the settings as saved.
    pub fn set_settings(
        &mut self,
        settings: &crate::settings::Settings,
        now_ms: u64,
    ) -> Result<crate::settings::Settings, ErrorCode> {
        let settings = settings.checked()?;
        // First, so a start-up list that refuses leaves the setting as the list is (#321).
        self.sync_startup(settings.general.start_at_login)?;
        let proxy_before = self.settings_section::<crate::proxy::ProxySettings>()?;
        self.database
            .save_sections(settings.sections()?, now_ms)
            .map_err(|e| e.code)?;
        self.apply_settings(&settings, now_ms)?;
        // Saved and applied whatever the keychain says; its refusal is then the error (#192).
        self.proxy_remembering_changed(&proxy_before, &settings.proxy)?;
        Ok(settings)
    }

    /// Back to the defaults, keeping the folder downloads go to (V1's `reset_settings`).
    pub fn reset_settings(&mut self, now_ms: u64) -> Result<crate::settings::Settings, ErrorCode> {
        let mut defaults = crate::settings::Settings::default();
        defaults.downloads.default_directory = self.settings()?.downloads.default_directory;
        self.set_settings(&defaults, now_ms)
    }

    /// Applies the saved settings, when the app starts, with the proxy's remembered password.
    pub fn apply_saved_settings(&mut self, now_ms: u64) -> Result<(), ErrorCode> {
        let settings = self.settings()?;
        self.load_proxy_password(&settings.proxy);
        // An entry taken out, or left behind by a moved app, is put right; a refusal only warns.
        if let Err(code) = self.sync_startup(settings.general.start_at_login) {
            tracing::warn!(?code, "the start-up list couldn't be updated");
        }
        // What was learned about servers (#325): downloads start faster without it, never fail.
        if let Err(code) = self.give_host_memory(now_ms) {
            tracing::warn!(
                ?code,
                "what was learned about servers couldn't be given to the engine"
            );
        }
        self.apply_settings(&settings, now_ms)
    }

    /// Gives each part of the app its settings. The engines may be unavailable: they get them when
    /// they start (the supervisors keep the last ones they were given).
    fn apply_settings(
        &mut self,
        s: &crate::settings::Settings,
        now_ms: u64,
    ) -> Result<(), ErrorCode> {
        self.set_queue_settings(s.queue.clone())?;
        self.metalink_enabled = s.advanced.enable_metalink;
        self.torrents_enabled = s.advanced.enable_bittorrent;
        self.user_agent = s.advanced.user_agent.clone();
        let global = crate::transfer::Limits::from_kib(s.advanced.global_download_limit_kib)?;
        let engine = [
            self.set_performance(s.performance),
            self.engine.set_engine_settings(s.engine),
            self.engine.set_global_limits(global),
            self.torrents.set_settings(s.torrent.clone()),
        ];
        for result in engine {
            match result {
                Ok(()) | Err(ErrorCode::EngineUnavailable) => {}
                Err(code) => return Err(code),
            }
        }
        self.apply_proxy(&s.proxy)?;
        self.apply_retention(now_ms)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;
    use crate::app_settings::{GeneralSettings, LayoutSettings, Theme};
    use crate::database::Database;
    use crate::transfer::fake::FakeTransfer;

    const T0: u64 = 1_792_600_000_000;

    fn remembered(host: &str, connections: u32) -> crate::transfer::HostMemory {
        crate::transfer::HostMemory {
            host: host.to_owned(),
            connections: Some(connections),
            throttled_to: None,
        }
    }

    /// #325: what the engine learns about a server is kept, and given back to the engine when
    /// the app starts again; a server not seen for 7 days isn't.
    #[test]
    fn what_the_engine_learned_about_servers_outlives_a_restart() {
        let db = Arc::new(Database::open_in_memory().unwrap());
        {
            let fake = FakeTransfer::new();
            let control = fake.control();
            let mut m = Manager::open(Box::new(fake), Arc::clone(&db)).unwrap();
            control.emit(crate::transfer::TransferEvent::HostLearned {
                memory: remembered("example.com:443", 3),
            });
            m.pump(T0);
        }
        db.save_host(
            &remembered("old.example:443", 2),
            T0 - 8 * 24 * 60 * 60 * 1000,
        )
        .unwrap();
        let fake = FakeTransfer::new();
        let control = fake.control();
        let mut m = Manager::open(Box::new(fake), Arc::clone(&db)).unwrap();
        m.apply_saved_settings(T0 + 1).unwrap();
        assert_eq!(control.host_memory(), [remembered("example.com:443", 3)]);
    }

    #[test]
    fn forgetting_learned_servers_clears_them_and_tells_the_engine() {
        let db = Arc::new(Database::open_in_memory().unwrap());
        db.save_host(&remembered("example.com:443", 3), T0).unwrap();
        let fake = FakeTransfer::new();
        let control = fake.control();
        let mut m = Manager::open(Box::new(fake), Arc::clone(&db)).unwrap();
        m.apply_saved_settings(T0).unwrap();
        m.forget_learned_servers().unwrap();
        assert_eq!(db.hosts(T0).unwrap(), []);
        assert_eq!(control.host_memory(), []);
        assert_eq!(
            control.log().last().map(String::as_str),
            Some("set_host_memory 0")
        );
    }

    fn startup_entry() -> crate::autostart::Entry {
        crate::autostart::Entry {
            identifier: "dev.velocity.downloadmanager.v2".to_owned(),
            name: "Apollo Download Manager".to_owned(),
            program: std::env::temp_dir()
                .join("Apollo Download Manager")
                .join("apollo"),
        }
    }

    #[test]
    fn starting_at_sign_in_follows_the_setting() {
        let list = crate::autostart::test_list::Fixture::new("manager-setting");
        let (m, _db) = manager();
        let mut m = m.with_startup(list.list.clone(), startup_entry());
        let mut settings = m.settings().unwrap();
        assert!(!settings.general.start_at_login, "off until set");
        settings.general.start_at_login = true;
        m.set_settings(&settings, T0).unwrap();
        assert!(list.list.has(&startup_entry()));
        assert!(m.settings().unwrap().general.start_at_login);
        settings.general.start_at_login = false;
        m.set_settings(&settings, T0).unwrap();
        assert!(!list.list.has(&startup_entry()));
    }

    #[test]
    fn a_missing_entry_comes_back_when_the_app_starts_with_the_setting_on() {
        let list = crate::autostart::test_list::Fixture::new("manager-restart");
        let (m, db) = manager();
        let mut m = m.with_startup(list.list.clone(), startup_entry());
        let mut settings = m.settings().unwrap();
        settings.general.start_at_login = true;
        m.set_settings(&settings, T0).unwrap();
        // Taken out behind the app's back, or the app moved.
        list.list.set(&startup_entry(), false).unwrap();
        drop(m);
        let mut m = Manager::open(Box::new(FakeTransfer::new()), db)
            .unwrap()
            .with_startup(list.list.clone(), startup_entry());
        m.apply_saved_settings(T0).unwrap();
        assert!(list.list.has(&startup_entry()));
    }

    #[test]
    fn the_first_run_turns_it_on_only_in_a_released_build() {
        assert!(super::first_run_starts_at_login(true));
        assert!(!super::first_run_starts_at_login(false));
        let list = crate::autostart::test_list::Fixture::new("manager-first-run");
        let (m, _db) = manager();
        let mut m = m.with_startup(list.list.clone(), startup_entry());
        let dir = std::env::temp_dir();
        m.complete_onboarding(&dir.to_string_lossy(), T0).unwrap();
        // Tests run as a development build.
        assert!(!m.settings().unwrap().general.start_at_login);
        assert!(!list.list.has(&startup_entry()));
    }

    fn manager() -> (Manager, Arc<Database>) {
        let db = Arc::new(Database::open_in_memory().unwrap());
        let m = Manager::open(Box::new(FakeTransfer::new()), Arc::clone(&db)).unwrap();
        (m, db)
    }

    #[test]
    fn a_new_install_needs_the_first_run_setup_and_offers_the_systems_downloads_folder() {
        let (m, _) = manager();
        let s = m.shell_settings().unwrap();
        assert!(!s.onboarding_completed);
        assert_eq!(s.appearance, AppearanceSettings::default());
        assert_eq!(
            s.default_directory,
            system_downloads().map(|p| p.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn finishing_the_setup_saves_the_folder_and_is_remembered() {
        let (mut m, db) = manager();
        let dir = std::env::temp_dir();
        let dir = dir.to_string_lossy();
        let s = m.complete_onboarding(&format!(" {dir} "), T0).unwrap();
        assert!(s.onboarding_completed);
        let saved = check_folder(&dir).unwrap().to_string_lossy().into_owned();
        assert_eq!(s.default_directory.as_deref(), Some(saved.as_str()));
        assert_eq!(
            db.section::<FolderSettings>().unwrap().default_directory,
            saved
        );
        assert_eq!(m.shell_settings(), Ok(s), "read back");
    }

    #[test]
    fn the_setup_refuses_a_folder_that_isnt_one_and_saves_nothing() {
        let (mut m, db) = manager();
        let missing = std::env::temp_dir().join("velocity-no-such-folder-29");
        let file = std::env::temp_dir().join("velocity-onboarding-file-29.txt");
        std::fs::write(&file, b"x").unwrap();
        for (dir, code) in [
            ("relative".to_owned(), ErrorCode::InvalidPath),
            (String::new(), ErrorCode::InvalidPath),
            (
                missing.to_string_lossy().into_owned(),
                ErrorCode::DestinationMissing,
            ),
            (file.to_string_lossy().into_owned(), ErrorCode::InvalidPath),
        ] {
            assert_eq!(m.complete_onboarding(&dir, T0), Err(code), "{dir}");
        }
        std::fs::remove_file(&file).unwrap();
        assert_eq!(db.settings(), Ok(None), "nothing saved");
    }

    #[cfg(unix)]
    #[test]
    fn the_setup_refuses_a_link_to_a_folder() {
        let (mut m, _) = manager();
        let base = std::env::temp_dir().join(format!("velocity-29-link-{}", std::process::id()));
        std::fs::create_dir_all(base.join("real")).unwrap();
        let link = base.join("link");
        let _ = std::fs::remove_file(&link);
        std::os::unix::fs::symlink(base.join("real"), &link).unwrap();
        let result = m.complete_onboarding(&link.to_string_lossy(), T0);
        std::fs::remove_dir_all(&base).unwrap();
        assert_eq!(result, Err(ErrorCode::InvalidPath));
    }

    #[test]
    fn the_appearance_is_saved_as_checked_and_kept_apart_from_other_settings() {
        let (mut m, db) = manager();
        let quiet = GeneralSettings {
            confirm_exit_with_active: false,
            ..GeneralSettings::default()
        };
        db.save_section(&quiet, T0).unwrap();
        let dark = AppearanceSettings {
            theme: Theme::Dark,
            layout: LayoutSettings {
                sidebar_width: Some(250),
                ..LayoutSettings::default()
            },
            ..AppearanceSettings::default()
        };
        assert_eq!(m.set_appearance(&dark, T0), Ok(dark.clone()));
        assert_eq!(m.shell_settings().unwrap().appearance, dark);
        assert_eq!(m.settings_section::<GeneralSettings>(), Ok(quiet));
        let wide = AppearanceSettings {
            layout: LayoutSettings {
                sidebar_width: Some(5000),
                ..LayoutSettings::default()
            },
            ..AppearanceSettings::default()
        };
        assert_eq!(m.set_appearance(&wide, T0), Err(ErrorCode::InvalidInput));
        assert_eq!(m.shell_settings().unwrap().appearance, dark, "kept");
    }
}
