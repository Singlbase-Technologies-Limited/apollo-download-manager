//! Core domain logic for Apollo Download Manager.
//!
//! The application identity and the engine-neutral domain types shared with the UI
//! (`domain`, docs/CONTRACTS.md).

pub mod app_settings;
pub mod autostart;
pub mod branding;
pub mod browser;
pub mod category;
pub mod crash;
pub mod database;
pub mod destination;
pub mod diagnostics;
pub mod domain;
pub mod file_move;
pub mod fs_safety;
pub mod history;
pub mod keychain;
pub mod logs;
pub mod manager;
pub mod metalink;
pub mod naming;
pub mod network_watch;
pub mod notices;
pub mod paths;
pub mod performance;
pub mod power;
pub mod proxy;
pub mod queue;
pub mod redact;
pub mod request;
pub mod secret;
pub mod seeding;
pub mod settings;
pub mod torrent;
pub mod torrent_engine;
pub mod torrent_files;
pub mod transfer;

use serde::Serialize;

/// Version of the command contract between the UI and the native side (docs/CONTRACTS.md).
/// Raise it whenever a command or a shared type changes incompatibly; the UI refuses to start
/// against a native side with a different version (`COMMAND_API_VERSION` in `src/contract.ts`).
/// Version 2 (#47) added [`domain::Progress::connection_detail`].
/// Version 3 (#46) added [`domain::DownloadRecord::verification`].
/// Version 4 (#57) gave [`domain::Capabilities`] what each protocol does
/// ([`domain::ProtocolCapabilities`]), in place of a list of kinds and one `validatorResume`.
/// Version 5 (#51) added [`domain::ProtocolCapabilities::encryption`].
/// Version 6 (#53) added [`domain::TransferError::host_key`].
/// Version 7 (#58) added the downloads commands and their types: [`domain::DownloadsSnapshot`],
/// [`domain::EngineHealth`] and [`domain::BatchResult`].
/// Version 8 (#58, torrents) added [`domain::DownloadsSnapshot::torrent_engine`].
/// Version 9 (#31) added the category commands, `set_download_category` and
/// `check_destination`, their types ([`category::Category`], [`domain::DestinationCheck`]) and
/// [`domain::ErrorCode::NameTaken`].
/// Version 10 (#29) added the window's commands (`get_shell_settings`, `set_appearance`,
/// `complete_onboarding`, `choose_directory`, `quit_app`), [`app_settings::ShellSettings`]
/// and the `quit-requested` event.
/// Version 11 (#60) added the Add dialog's commands (`add_downloads`, `get_capabilities`,
/// `choose_torrents`, `choose_ssh_key`), their types ([`manager::AddRequest`],
/// [`manager::AddResult`]) and the `torrents-dropped` event.
/// Version 12 (#59) added [`domain::DownloadRecord::retry_at_ms`].
/// Version 22 (#222) added [`manager::AddRequest::metalink_files`], the `metalinkAdded` outcome
/// and `choose_metalinks`; versions 13 to 21 are in docs/CONTRACTS.md.
/// Version 23 (#257) added [`domain::DownloadRecord::started_over`].
/// Version 24 (#274) added [`domain::ConnectionLimit::NoRanges`].
/// Version 25 (#277) added [`domain::DestinationCheck::path`].
/// Version 26 (#278) added [`domain::ConnectionLimit::SpeedLimit`].
/// Version 27 (#313) added [`domain::DownloadRecord::file_count`].
/// Version 28 (#318) added [`domain::DownloadStatus::WaitingForNetwork`],
/// [`domain::TransferError::no_network`] and [`queue::QueueSettings::restart_on_network`].
/// Version 29 (#350) added [`domain::DownloadRecord::waits_until`],
/// [`domain::DownloadsSnapshot::schedule`], [`manager::AddRequest::start_at`] and `set_start_at`.
/// Version 30 (#252, #249) added [`domain::TransferError::detail`] and
/// [`domain::TransferError::login_required`].
/// Version 31 (#366): `set_download_category` answers a [`domain::CategoryMove`], since changing
/// a download's category moves its file; and (#321) [`app_settings::GeneralSettings::start_at_login`].
/// Version 32 (#325) added `forget_learned_servers`.
/// Version 33 (#241): each browser's registration says whether it is installed and gives its
/// store page; `open_extension_page`.
/// Version 34 (#415): the `browser-request` event only says a link waits; the window takes the
/// waiting links with `take_browser_requests`.
/// Version 35 (#466) added `use_new_link`: a failed or paused download continues with a new link.
/// Version 36 (#470) added `set_torrent_order`, `inOrder` and `endsFirst` in the Add request and
/// in `TorrentDetails`: a torrent downloads in order, its files' ends first.
pub const COMMAND_API_VERSION: u32 = 36;

/// Name, version and contract version of the running application.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: &'static str,
    pub version: &'static str,
    pub command_api_version: u32,
}

/// Returns the application's identity.
pub fn app_info() -> AppInfo {
    AppInfo {
        // "Apollo Download Manager" (ADR-0018); development builds add "(dev)" (branding.json).
        name: branding::branding().app_product_name(),
        version: env!("CARGO_PKG_VERSION"),
        command_api_version: COMMAND_API_VERSION,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_the_command_api_version_in_camel_case() {
        let json = serde_json::to_value(app_info()).unwrap();
        assert_eq!(json["commandApiVersion"], COMMAND_API_VERSION);
    }

    #[test]
    fn app_info_reports_the_crate_version() {
        assert_eq!(app_info().version, env!("CARGO_PKG_VERSION"));
    }

    /// The product name is "Apollo Download Manager" (ADR-0018). Development builds carry a
    /// "(dev)" suffix so they can be told apart from an installed release. Separation from V1
    /// comes from distinct identifiers, not the name.
    #[test]
    fn development_builds_use_the_product_name_with_a_dev_suffix() {
        assert_eq!(app_info().name, "Apollo Download Manager (dev)");
    }
}
