//! Mirrors for a link (#324): the ones its server announces, and the ones its project publishes in
//! an official list, offered to the user, who chooses which a download uses (PO decisions on #324,
//! 2026-11-17 and 2026-11-25).
//!
//! - **Announced:** `Link: <…>; rel=duplicate` headers on the file's response (RFC 6249); Metalink
//!   files are #54's.
//! - **Official lists,** fetched only when the user asks, for links on eight projects' servers:
//!   Ubuntu, Debian, Fedora, Apache, Arch Linux, Linux Mint, openSUSE and GNU. [`official_list`]
//!   says where a link's list is, and [`MirrorList::candidates`] reads it into the file's address
//!   on each mirror.
//! - **Every mirror is checked** by [`check_mirror`], a typed one too: `http`, `https` or `ftp`,
//!   with a host and no login. The engine then uses one only if it serves the same file (#55).

use serde::Serialize;

use crate::domain::ErrorCode;
use crate::request::{normalize_link, split_login, MAX_URL_BYTES};

/// The largest official list read (Arch Linux's is about 0.5 MiB).
pub const MAX_LIST_BYTES: usize = 4 << 20;
/// The most candidates offered for one link.
pub const MAX_CANDIDATES: usize = 50;
/// The most mirrors one download may use besides its own link (PO decision on #324).
pub const MAX_MIRRORS: usize = 8;

/// A project whose official mirror list Apollo Download Manager reads.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum MirrorProject {
    Ubuntu,
    Debian,
    Fedora,
    Apache,
    ArchLinux,
    LinuxMint,
    OpenSuse,
    Gnu,
}

/// Where a candidate came from.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum MirrorSource {
    /// The file's server named it (`Link: rel=duplicate`).
    Announced,
    /// The project's official list.
    Official { project: MirrorProject },
}

/// A mirror offered for a link: the file's address there.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MirrorCandidate {
    pub url: String,
    pub source: MirrorSource,
    /// The mirror's country, as two letters, when the list says.
    pub country: Option<String>,
}

/// How a list is read.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Format {
    /// Launchpad's RSS: each item's `<link>` is a mirror's root, with its country code.
    UbuntuRss,
    /// Debian's CD page: the links in the list under the "mirrors" heading are roots.
    DebianHtml,
    /// MirrorManager's list: each line that isn't a `#` comment is the file on a mirror.
    FedoraText,
    /// `closer.lua`'s JSON: `preferred`, `http` and `backup` are roots.
    ApacheJson,
    /// Arch Linux's mirror status: the active `http` or `https` mirrors with ISOs, best score first.
    ArchJson,
    /// Linux Mint's page: the links of the table under "Download mirrors" are roots.
    MintHtml,
    /// MirrorCache's Metalink 4: each `<url>` is the file on a mirror, with its country.
    Meta4,
    /// GNU's page: the links between the mirror list's heading and the special mirrors are roots,
    /// but the alpha mirrors'.
    GnuHtml,
}

/// A link's official mirror list: where it is, and how the file's address on a mirror is made.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MirrorList {
    pub project: MirrorProject,
    /// The list's own address, fetched when the user asks.
    pub list_url: String,
    format: Format,
    /// The file's path below a mirror's root, as the link has it (percent-encoded).
    rest: String,
}

const UBUNTU_LIST: &str = "https://launchpad.net/ubuntu/+cdmirrors-rss";
const DEBIAN_LIST: &str = "https://www.debian.org/CD/http-ftp/";
const ARCH_LIST: &str = "https://archlinux.org/mirrors/status/json/";
const MINT_LIST: &str = "https://www.linuxmint.com/mirrors.php";
const GNU_LIST: &str = "https://www.gnu.org/prep/ftp.html";

/// A Linux Mint image's path below a mirror's root, whatever the mirror: `stable/<version>/…` or
/// `debian/<version>/…` (LMDE).
static MINT_IMAGE: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
    regex::Regex::new(r"/((?:stable|debian)/[^/]+/(?:linuxmint|lmde)-[^/]+\.iso)$")
        .expect("a valid pattern")
});

/// `path` for a query: its characters other than unreserved ones, `/` and an existing `%`
/// escape are percent-encoded.
fn query_path(path: &str) -> String {
    path.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' | b'/' | b'%' => {
                (b as char).to_string()
            }
            b => format!("%{b:02X}"),
        })
        .collect()
}

/// The official list for `link`, if its server is one of a known project's and it names a file.
pub fn official_list(link: &str) -> Option<MirrorList> {
    use MirrorProject as P;
    let url = url::Url::parse(link).ok()?;
    if !matches!(url.scheme(), "http" | "https") {
        return None;
    }
    let host = url.host_str()?.to_ascii_lowercase();
    let path = url.path();
    let list = |project, list_url: String, format, rest: &str| {
        let rest = rest.trim_start_matches('/');
        (!rest.is_empty() && !rest.ends_with('/')).then(|| MirrorList {
            project,
            list_url,
            format,
            rest: rest.to_owned(),
        })
    };
    let apache = |rest: &str| {
        let rest = rest.trim_start_matches('/');
        list(
            P::Apache,
            format!(
                "https://www.apache.org/dyn/closer.lua?path={}&as_json=1",
                query_path(rest)
            ),
            Format::ApacheJson,
            rest,
        )
    };
    match host.as_str() {
        "releases.ubuntu.com" => list(P::Ubuntu, UBUNTU_LIST.into(), Format::UbuntuRss, path),
        "cdimage.debian.org" => list(
            P::Debian,
            DEBIAN_LIST.into(),
            Format::DebianHtml,
            path.strip_prefix("/debian-cd/")?,
        ),
        "download.fedoraproject.org" | "dl.fedoraproject.org" => {
            path.strip_prefix("/pub/")?;
            let rest = &path[1..];
            list(
                P::Fedora,
                format!(
                    "https://mirrors.fedoraproject.org/mirrorlist?path={}",
                    query_path(rest)
                ),
                Format::FedoraText,
                rest,
            )
        }
        "downloads.apache.org" | "dlcdn.apache.org" => apache(path),
        "archive.apache.org" => apache(path.strip_prefix("/dist/")?),
        "geo.mirror.pkgbuild.com" | "archlinux.org" => list(
            P::ArchLinux,
            ARCH_LIST.into(),
            Format::ArchJson,
            path.strip_prefix("/iso/")?,
        ),
        "download.opensuse.org" => list(
            P::OpenSuse,
            format!("{}://{host}{path}.meta4", url.scheme()),
            Format::Meta4,
            path,
        ),
        "ftp.gnu.org" => list(
            P::Gnu,
            GNU_LIST.into(),
            Format::GnuHtml,
            path.strip_prefix("/gnu/")?,
        ),
        "ftpmirror.gnu.org" => list(P::Gnu, GNU_LIST.into(), Format::GnuHtml, path),
        _ => {
            let rest = MINT_IMAGE.captures(path)?.get(1)?.as_str();
            list(P::LinuxMint, MINT_LIST.into(), Format::MintHtml, rest)
        }
    }
}

impl MirrorList {
    /// The file's address on each mirror in `list`, at most [`MAX_CANDIDATES`], each checked by
    /// [`check_mirror`], without `link` itself. `InvalidInput` when the list can't be read.
    pub fn candidates(&self, list: &[u8], link: &str) -> Result<Vec<MirrorCandidate>, ErrorCode> {
        if list.len() > MAX_LIST_BYTES {
            return Err(ErrorCode::InvalidInput);
        }
        let text = std::str::from_utf8(list).map_err(|_| ErrorCode::InvalidInput)?;
        let text = text.strip_prefix('\u{feff}').unwrap_or(text);
        let below = |roots: Vec<(String, Option<String>)>| -> Vec<(String, Option<String>)> {
            roots
                .into_iter()
                .map(|(root, country)| (join(&root, &self.rest), country))
                .collect()
        };
        let found = match self.format {
            Format::UbuntuRss => below(ubuntu_roots(text)?),
            Format::DebianHtml => below(html_roots(text, Format::DebianHtml)),
            Format::FedoraText => text
                .lines()
                .map(str::trim)
                .filter(|l| !l.is_empty() && !l.starts_with('#'))
                .map(|l| (l.to_owned(), None))
                .collect(),
            Format::ApacheJson => below(apache_roots(text)?),
            Format::ArchJson => below(arch_roots(text)?),
            Format::MintHtml => below(html_roots(text, Format::MintHtml)),
            Format::Meta4 => meta4_urls(text)?,
            Format::GnuHtml => below(html_roots(text, Format::GnuHtml)),
        };
        let source = MirrorSource::Official {
            project: self.project,
        };
        let mut out: Vec<MirrorCandidate> = Vec::new();
        for (url, country) in found {
            let Ok(url) = check_mirror(&url, link) else {
                continue;
            };
            if out.iter().any(|c| c.url == url) {
                continue;
            }
            let country = country
                .filter(|c| c.len() == 2 && c.bytes().all(|b| b.is_ascii_alphabetic()))
                .map(|c| c.to_ascii_uppercase());
            out.push(MirrorCandidate {
                url,
                source: source.clone(),
                country,
            });
            if out.len() == MAX_CANDIDATES {
                break;
            }
        }
        Ok(out)
    }
}

/// `rest` below the mirror root `root`.
fn join(root: &str, rest: &str) -> String {
    if root.ends_with('/') {
        format!("{root}{rest}")
    } else {
        format!("{root}/{rest}")
    }
}

/// The text of `document`'s elements named in `wanted`, record by record: a record starts at each
/// `record` element. Each `<url>`'s `location` attribute is kept as `location`. With no document
/// type, so no entity can expand; only XML's predefined references are resolved.
fn xml_records(
    document: &str,
    record: &str,
    wanted: &[&str],
) -> Result<Vec<Vec<(String, String)>>, ErrorCode> {
    use quick_xml::events::Event;
    let bad = |_| ErrorCode::InvalidInput;
    let mut reader = quick_xml::Reader::from_str(document);
    let mut records: Vec<Vec<(String, String)>> = Vec::new();
    let mut open: Option<String> = None;
    let mut text = String::new();
    loop {
        match reader.read_event().map_err(bad)? {
            Event::DocType(_) => return Err(ErrorCode::InvalidInput),
            Event::Start(element) => {
                let local = element.local_name();
                let name: String = AsRef::<str>::as_ref(&local).to_owned();
                if name == record {
                    records.push(Vec::new());
                }
                if wanted.contains(&name.as_str()) && !records.is_empty() {
                    if name == "url" {
                        for attribute in element.attributes().flatten() {
                            let key = attribute.key.local_name();
                            if AsRef::<str>::as_ref(&key) == "location" {
                                let value = attribute
                                    .normalized_value(quick_xml::XmlVersion::Implicit1_0)
                                    .map_err(|_| ErrorCode::InvalidInput)?;
                                records
                                    .last_mut()
                                    .expect("a record")
                                    .push(("location".to_owned(), value.into_owned()));
                            }
                        }
                    }
                    open = Some(name);
                    text.clear();
                }
            }
            Event::Text(t) if open.is_some() => text.push_str(&t.xml10_content()),
            Event::CData(t) if open.is_some() => text.push_str(&t.xml10_content()),
            Event::GeneralRef(r) if open.is_some() => {
                let name = r.xml10_content();
                text.push_str(match name.as_ref() {
                    "lt" => "<",
                    "gt" => ">",
                    "amp" => "&",
                    "apos" => "'",
                    "quot" => "\"",
                    _ => return Err(ErrorCode::InvalidInput),
                });
            }
            Event::End(element) => {
                let local = element.local_name();
                let name: String = AsRef::<str>::as_ref(&local).to_owned();
                if open.as_deref() == Some(name.as_str()) {
                    if let Some(current) = records.last_mut() {
                        current.push((name, text.trim().to_owned()));
                    }
                    open = None;
                }
            }
            Event::Eof => break,
            _ => {}
        }
    }
    Ok(records)
}

fn field<'a>(record: &'a [(String, String)], name: &str) -> Option<&'a str> {
    record
        .iter()
        .find(|(k, _)| k == name)
        .map(|(_, v)| v.as_str())
}

fn ubuntu_roots(text: &str) -> Result<Vec<(String, Option<String>)>, ErrorCode> {
    let records = xml_records(text, "item", &["link", "countrycode"])?;
    if !text.trim_start().starts_with("<?xml") && !text.trim_start().starts_with("<rss") {
        return Err(ErrorCode::InvalidInput);
    }
    Ok(records
        .iter()
        .filter_map(|r| {
            Some((
                field(r, "link")?.to_owned(),
                field(r, "countrycode").map(str::to_owned),
            ))
        })
        .collect())
}

fn meta4_urls(text: &str) -> Result<Vec<(String, Option<String>)>, ErrorCode> {
    let records = xml_records(text, "file", &["url"])?;
    let first = records.first().ok_or(ErrorCode::InvalidInput)?;
    let mut out = Vec::new();
    let mut location = None;
    for (k, v) in first {
        match k.as_str() {
            "location" => location = Some(v.clone()),
            "url" => out.push((v.clone(), location.take())),
            _ => {}
        }
    }
    Ok(out)
}

fn apache_roots(text: &str) -> Result<Vec<(String, Option<String>)>, ErrorCode> {
    let json: serde_json::Value =
        serde_json::from_str(text).map_err(|_| ErrorCode::InvalidInput)?;
    let one = json.get("preferred").and_then(|v| v.as_str()).into_iter();
    let lists = ["http", "backup"].into_iter().flat_map(|k| {
        json.get(k)
            .and_then(|v| v.as_array())
            .into_iter()
            .flatten()
            .filter_map(|v| v.as_str())
    });
    Ok(one.chain(lists).map(|r| (r.to_owned(), None)).collect())
}

fn arch_roots(text: &str) -> Result<Vec<(String, Option<String>)>, ErrorCode> {
    let json: serde_json::Value =
        serde_json::from_str(text).map_err(|_| ErrorCode::InvalidInput)?;
    let urls = json
        .get("urls")
        .and_then(|v| v.as_array())
        .ok_or(ErrorCode::InvalidInput)?;
    let mut usable: Vec<(f64, String, Option<String>)> = urls
        .iter()
        .filter(|m| m.get("active").and_then(|v| v.as_bool()) == Some(true))
        .filter(|m| m.get("isos").and_then(|v| v.as_bool()) == Some(true))
        .filter(|m| {
            matches!(
                m.get("protocol").and_then(|v| v.as_str()),
                Some("http" | "https")
            )
        })
        .filter(|m| m.get("completion_pct").and_then(|v| v.as_f64()) == Some(1.0))
        .filter_map(|m| {
            let url = m.get("url")?.as_str()?.to_owned();
            // A lower score is better; one without a score goes last.
            let score = m.get("score").and_then(|v| v.as_f64()).unwrap_or(f64::MAX);
            Some((
                score,
                format!(
                    "{}iso/",
                    if url.ends_with('/') {
                        url
                    } else {
                        format!("{url}/")
                    }
                ),
                m.get("country_code")
                    .and_then(|v| v.as_str())
                    .map(str::to_owned),
            ))
        })
        .collect();
    usable.sort_by(|a, b| a.0.total_cmp(&b.0));
    Ok(usable
        .into_iter()
        .map(|(_, root, country)| (root, country))
        .collect())
}

/// The mirror roots an HTML page lists, in the part of the page `format` says.
fn html_roots(text: &str, format: Format) -> Vec<(String, Option<String>)> {
    let document = dom_query::Document::from(text);
    let mut inside = false;
    let mut roots = Vec::new();
    let selector = match format {
        Format::DebianHtml => "h2, li > a[href]",
        Format::MintHtml => "h2, td > a[href]",
        _ => "h3, li > a[href]",
    };
    for node in document.select(selector).nodes() {
        if !node.is("a") {
            let id = node.attr("id").map(|s| s.to_string()).unwrap_or_default();
            inside = match format {
                Format::DebianHtml => node.is(":has(a[name=\"mirrors\"])"),
                Format::MintHtml => node.text().trim() == "Download mirrors",
                _ => match id.as_str() {
                    "gnu_mirror_list" => true,
                    "special_mirrors" => false,
                    _ => inside,
                },
            };
            continue;
        }
        if !inside {
            continue;
        }
        // GNU's alpha mirrors hold test releases, not ftp.gnu.org's files.
        if format == Format::GnuHtml
            && node
                .parent()
                .is_some_and(|li| li.text().contains("(alpha)"))
        {
            continue;
        }
        if let Some(href) = node.attr("href") {
            roots.push((href.to_string(), None));
        }
    }
    roots
}

/// `mirror`, as a download stores it, if it may be one for `link`: an `http`, `https` or `ftp`
/// link with a host, no login and no space, within [`MAX_URL_BYTES`], not a Tor address (which an
/// ordinary connection can't reach), and not `link` itself. `UnsupportedScheme` for another
/// scheme, `InvalidInput` for `link` itself, and `InvalidUrl` otherwise.
pub fn check_mirror(mirror: &str, link: &str) -> Result<String, ErrorCode> {
    let mirror = normalize_link(mirror.trim())?;
    if mirror.len() > MAX_URL_BYTES {
        return Err(ErrorCode::InvalidUrl);
    }
    let scheme = mirror
        .split_once("://")
        .map(|(scheme, _)| scheme.to_ascii_lowercase());
    if !matches!(scheme.as_deref(), Some("http" | "https" | "ftp")) {
        return Err(if scheme.is_some() || mirror.contains(':') {
            ErrorCode::UnsupportedScheme
        } else {
            ErrorCode::InvalidUrl
        });
    }
    // The URL parser would read `https:///a.iso`'s path as its host: an empty host is refused here.
    if mirror
        .split_once("://")
        .is_some_and(|(_, rest)| rest.starts_with('/'))
    {
        return Err(ErrorCode::InvalidUrl);
    }
    let url = url::Url::parse(&mirror).map_err(|_| ErrorCode::InvalidUrl)?;
    if !matches!(url.scheme(), "http" | "https" | "ftp") {
        return Err(ErrorCode::UnsupportedScheme);
    }
    let host = url
        .host_str()
        .filter(|h| !h.is_empty())
        .ok_or(ErrorCode::InvalidUrl)?;
    if host.to_ascii_lowercase().ends_with(".onion")
        || split_login(&mirror).1.is_some()
        || !url.username().is_empty()
    {
        return Err(ErrorCode::InvalidUrl);
    }
    if mirror == link.trim() {
        return Err(ErrorCode::InvalidInput);
    }
    Ok(mirror)
}

/// The mirrors a response's `Link` header values announce for `link` (RFC 6249): each `rel`
/// with `duplicate`, resolved against `link`, checked by [`check_mirror`], best `pri` first and
/// at most [`MAX_CANDIDATES`]. A malformed value is skipped.
pub fn announced_mirrors(links: &[&str], link: &str) -> Vec<String> {
    let Ok(base) = url::Url::parse(link) else {
        return Vec::new();
    };
    let mut found: Vec<(u64, String)> = Vec::new();
    for value in links {
        for item in link_values(value) {
            let Some((target, params)) = item
                .trim()
                .strip_prefix('<')
                .and_then(|rest| rest.split_once('>'))
            else {
                continue;
            };
            let mut duplicate = false;
            let mut pri = u64::MAX;
            for param in params.split(';').map(str::trim).filter(|p| !p.is_empty()) {
                let (name, value) = param.split_once('=').unwrap_or((param, ""));
                let value = value.trim().trim_matches('"');
                match name.trim().to_ascii_lowercase().as_str() {
                    "rel" => {
                        duplicate = value
                            .split_ascii_whitespace()
                            .any(|r| r.eq_ignore_ascii_case("duplicate"))
                    }
                    "pri" => pri = value.parse().unwrap_or(u64::MAX),
                    _ => {}
                }
            }
            let Some(resolved) = duplicate.then(|| base.join(target).ok()).flatten() else {
                continue;
            };
            if let Ok(mirror) = check_mirror(resolved.as_str(), link) {
                if !found.iter().any(|(_, m)| *m == mirror) {
                    found.push((pri, mirror));
                }
            }
        }
    }
    found.sort_by_key(|(pri, _)| *pri);
    found
        .into_iter()
        .take(MAX_CANDIDATES)
        .map(|(_, m)| m)
        .collect()
}

/// A `Link` header value's link-values: split at commas outside `<…>` and quotes.
fn link_values(value: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let (mut start, mut in_uri, mut in_quote) = (0, false, false);
    for (i, c) in value.char_indices() {
        match c {
            '<' if !in_quote => in_uri = true,
            '>' if !in_quote => in_uri = false,
            '"' if !in_uri => in_quote = !in_quote,
            ',' if !in_uri && !in_quote => {
                out.push(&value[start..i]);
                start = i + 1;
            }
            _ => {}
        }
    }
    out.push(&value[start..]);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture(name: &str) -> Vec<u8> {
        std::fs::read(format!(
            "{}/../../tests/fixtures/mirrors/{name}",
            env!("CARGO_MANIFEST_DIR")
        ))
        .unwrap()
    }

    fn urls(list: &MirrorList, fixture_name: &str, link: &str) -> Vec<String> {
        list.candidates(&fixture(fixture_name), link)
            .unwrap()
            .into_iter()
            .map(|c| c.url)
            .collect()
    }

    #[test]
    fn knows_each_projects_list_from_its_links() {
        let list = |link: &str| official_list(link).map(|l| (l.project, l.list_url));
        assert_eq!(
            list("https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso"),
            Some((
                MirrorProject::Ubuntu,
                "https://launchpad.net/ubuntu/+cdmirrors-rss".into()
            ))
        );
        assert_eq!(
            list("https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-13.2.0-amd64-netinst.iso"),
            Some((MirrorProject::Debian, "https://www.debian.org/CD/http-ftp/".into()))
        );
        assert_eq!(
            list("https://download.fedoraproject.org/pub/fedora/linux/releases/41/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-41-1.4.iso"),
            Some((MirrorProject::Fedora, "https://mirrors.fedoraproject.org/mirrorlist?path=pub/fedora/linux/releases/41/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-41-1.4.iso".into()))
        );
        assert_eq!(
            list("https://downloads.apache.org/httpd/httpd-2.4.62.tar.gz"),
            Some((
                MirrorProject::Apache,
                "https://www.apache.org/dyn/closer.lua?path=httpd/httpd-2.4.62.tar.gz&as_json=1"
                    .into()
            ))
        );
        assert_eq!(
            list("https://archive.apache.org/dist/httpd/httpd-2.4.62.tar.gz").map(|l| l.1),
            Some(
                "https://www.apache.org/dyn/closer.lua?path=httpd/httpd-2.4.62.tar.gz&as_json=1"
                    .into()
            )
        );
        assert_eq!(
            list("https://geo.mirror.pkgbuild.com/iso/2026.11.01/archlinux-2026.11.01-x86_64.iso"),
            Some((
                MirrorProject::ArchLinux,
                "https://archlinux.org/mirrors/status/json/".into()
            ))
        );
        assert_eq!(
            list("https://mirrors.kernel.org/linuxmint/stable/22.1/linuxmint-22.1-cinnamon-64bit.iso"),
            Some((MirrorProject::LinuxMint, "https://www.linuxmint.com/mirrors.php".into()))
        );
        assert_eq!(
            list("https://download.opensuse.org/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Media.iso"),
            Some((MirrorProject::OpenSuse, "https://download.opensuse.org/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Media.iso.meta4".into()))
        );
        assert_eq!(
            list("https://ftp.gnu.org/gnu/emacs/emacs-30.1.tar.xz"),
            Some((
                MirrorProject::Gnu,
                "https://www.gnu.org/prep/ftp.html".into()
            ))
        );
        assert_eq!(
            list("https://ftpmirror.gnu.org/emacs/emacs-30.1.tar.xz").map(|l| l.0),
            Some(MirrorProject::Gnu)
        );
        // A path with characters a query must escape keeps its slashes.
        assert_eq!(
            list("https://downloads.apache.org/a%20b/c d&e.tgz").map(|l| l.1),
            Some("https://www.apache.org/dyn/closer.lua?path=a%20b/c%20d%26e.tgz&as_json=1".into())
        );
    }

    #[test]
    fn knows_no_list_for_other_links_or_for_a_folder() {
        for link in [
            "https://example.org/ubuntu-26.04-desktop-amd64.iso",
            "https://releases.ubuntu.com/26.04/",
            "https://cdimage.debian.org/cdimage/weekly-builds/x.iso",
            "https://download.fedoraproject.org/other/x.iso",
            "ftp://ftp.gnu.org/gnu/emacs/emacs-30.1.tar.xz",
            "https://ftp.gnu.org/old-gnu/x.tar.gz",
            "magnet:?xt=urn:btih:aaaa",
            "not a link",
        ] {
            assert_eq!(official_list(link), None, "{link}");
        }
    }

    #[test]
    fn reads_ubuntus_cd_mirror_feed() {
        let link = "https://releases.ubuntu.com/26.04/ubuntu-26.04-desktop-amd64.iso";
        let list = official_list(link).unwrap();
        let found = list
            .candidates(&fixture("ubuntu-cdmirrors.rss"), link)
            .unwrap();
        assert_eq!(
            found.iter().map(|c| (c.url.as_str(), c.country.as_deref())).collect::<Vec<_>>(),
            [
                ("https://dtw-mirror.rackgenius.com/ubuntu-releases/26.04/ubuntu-26.04-desktop-amd64.iso", Some("US")),
                ("https://ftp.udx.icscoe.jp/Linux/ubuntu-releases/26.04/ubuntu-26.04-desktop-amd64.iso", Some("JP")),
                ("https://gsl-syd.mm.fcix.net/ubuntu-releases/26.04/ubuntu-26.04-desktop-amd64.iso", Some("AU")),
                ("https://mirror.aarnet.edu.au/pub/ubuntu/releases/26.04/ubuntu-26.04-desktop-amd64.iso", Some("AU")),
            ]
        );
        assert_eq!(
            found[0].source,
            MirrorSource::Official {
                project: MirrorProject::Ubuntu
            }
        );
    }

    #[test]
    fn reads_debians_cd_mirror_page() {
        let link = "https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-13.2.0-amd64-netinst.iso";
        assert_eq!(
            urls(&official_list(link).unwrap(), "debian-cd-mirrors.html", link),
            [
                "http://debian.xfree.com.ar/debian-cd/current/amd64/iso-cd/debian-13.2.0-amd64-netinst.iso",
                "http://mirror.overthewire.com.au/debian-cd/current/amd64/iso-cd/debian-13.2.0-amd64-netinst.iso",
                "http://debian.anexia.at/debian-cd/current/amd64/iso-cd/debian-13.2.0-amd64-netinst.iso",
                "http://ftp.byfly.by/debian-cd/current/amd64/iso-cd/debian-13.2.0-amd64-netinst.iso",
            ]
        );
    }

    #[test]
    fn reads_fedoras_mirror_list_without_the_link_itself() {
        let link = "https://dl.fedoraproject.org/pub/fedora/linux/releases/41/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-41-1.4.iso";
        let found = urls(&official_list(link).unwrap(), "fedora-mirrorlist.txt", link);
        assert_eq!(found.len(), 6);
        assert_eq!(found[0], "http://mirror.xenyth.net/fedora/linux/releases/41/Workstation/x86_64/iso/Fedora-Workstation-Live-x86_64-41-1.4.iso");
        assert!(!found.contains(&link.to_owned()));
    }

    #[test]
    fn reads_apaches_closer_answer() {
        let link = "https://downloads.apache.org/httpd/httpd-2.4.62.tar.gz";
        assert_eq!(
            urls(&official_list(link).unwrap(), "apache-closer.json", link),
            ["https://dlcdn.apache.org/httpd/httpd-2.4.62.tar.gz"]
        );
    }

    #[test]
    fn reads_arch_linuxs_mirror_status_best_first_and_only_mirrors_with_isos() {
        let link = "https://geo.mirror.pkgbuild.com/iso/2026.11.01/archlinux-2026.11.01-x86_64.iso";
        let found = official_list(link)
            .unwrap()
            .candidates(&fixture("arch-mirrors.json"), link)
            .unwrap();
        assert_eq!(
            found.iter().map(|c| (c.url.as_str(), c.country.as_deref())).collect::<Vec<_>>(),
            [
                ("https://mirrors.rit.edu/archlinux/iso/2026.11.01/archlinux-2026.11.01-x86_64.iso", Some("US")),
                ("https://mirror.aarnet.edu.au/pub/archlinux/iso/2026.11.01/archlinux-2026.11.01-x86_64.iso", Some("AU")),
                ("https://ftp.tu-chemnitz.de/pub/linux/archlinux/iso/2026.11.01/archlinux-2026.11.01-x86_64.iso", Some("DE")),
            ]
        );
    }

    #[test]
    fn reads_linux_mints_download_mirrors_and_not_its_package_mirrors() {
        let link =
            "https://mirrors.kernel.org/linuxmint/stable/22.1/linuxmint-22.1-cinnamon-64bit.iso";
        assert_eq!(
            urls(&official_list(link).unwrap(), "mint-mirrors.html", link),
            [
                "https://mirrors.cicku.me/linuxmint/iso/stable/22.1/linuxmint-22.1-cinnamon-64bit.iso",
                "https://pub.linuxmint.io/stable/22.1/linuxmint-22.1-cinnamon-64bit.iso",
                "https://muug.ca/mirror/linuxmint/iso/stable/22.1/linuxmint-22.1-cinnamon-64bit.iso",
                "https://mirror.cpsc.ucalgary.ca/mirror/linuxmint.com/releases/stable/22.1/linuxmint-22.1-cinnamon-64bit.iso",
            ]
        );
    }

    #[test]
    fn reads_opensuses_metalink_with_each_mirrors_country() {
        let link = "https://download.opensuse.org/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Media.iso";
        let found = official_list(link)
            .unwrap()
            .candidates(&fixture("opensuse.meta4"), link)
            .unwrap();
        assert_eq!(
            found.iter().map(|c| (c.url.as_str(), c.country.as_deref())).collect::<Vec<_>>(),
            [
                ("https://opensuse.mirror.liquidtelecom.com/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Build710.3-Media.iso", Some("KE")),
                ("https://opensuse.mirror.net.za/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Build710.3-Media.iso", Some("ZA")),
                ("https://mirror.africloud.com/opensuse/distribution/leap/15.6/iso/openSUSE-Leap-15.6-DVD-x86_64-Build710.3-Media.iso", Some("ZA")),
            ]
        );
    }

    #[test]
    fn reads_gnus_mirror_page_without_alpha_rsync_or_special_mirrors() {
        let link = "https://ftp.gnu.org/gnu/emacs/emacs-30.1.tar.xz";
        assert_eq!(
            urls(&official_list(link).unwrap(), "gnu-ftp.html", link),
            [
                "https://mirror.csclub.uwaterloo.ca/gnu/emacs/emacs-30.1.tar.xz",
                "http://mirror.csclub.uwaterloo.ca/gnu/emacs/emacs-30.1.tar.xz",
                "ftp://mirror.csclub.uwaterloo.ca/gnu/emacs/emacs-30.1.tar.xz",
                "https://mirror2.evolution-host.com/gnu/emacs/emacs-30.1.tar.xz",
                "http://mirror2.evolution-host.com/gnu/emacs/emacs-30.1.tar.xz",
            ]
        );
    }

    #[test]
    fn refuses_a_list_it_cant_read() {
        let link = "https://geo.mirror.pkgbuild.com/iso/2026.11.01/archlinux-2026.11.01-x86_64.iso";
        assert_eq!(
            official_list(link)
                .unwrap()
                .candidates(b"<html>busy</html>", link),
            Err(ErrorCode::InvalidInput)
        );
        let link = "https://releases.ubuntu.com/26.04/x.iso";
        assert_eq!(
            official_list(link)
                .unwrap()
                .candidates(b"\xff\xfe not xml", link),
            Err(ErrorCode::InvalidInput)
        );
    }

    #[test]
    fn offers_at_most_its_limit() {
        let link = "https://dl.fedoraproject.org/pub/f/x.iso";
        let list: String = (0..80)
            .map(|i| format!("https://m{i}.example.org/pub/f/x.iso\n"))
            .collect();
        assert_eq!(
            official_list(link)
                .unwrap()
                .candidates(list.as_bytes(), link)
                .unwrap()
                .len(),
            MAX_CANDIDATES
        );
    }

    #[test]
    fn checks_a_mirror_as_it_would_a_link() {
        let link = "https://example.org/a.iso";
        assert_eq!(
            check_mirror("https://mirror.example.net/a.iso", link),
            Ok("https://mirror.example.net/a.iso".into())
        );
        assert_eq!(
            check_mirror("ftp://mirror.example.net/a.iso", link),
            Ok("ftp://mirror.example.net/a.iso".into())
        );
        assert_eq!(
            check_mirror("https://bücher.example/a.iso", link),
            Ok("https://xn--bcher-kva.example/a.iso".into())
        );
        assert_eq!(
            check_mirror("rsync://mirror.example.net/a.iso", link),
            Err(ErrorCode::UnsupportedScheme)
        );
        assert_eq!(
            check_mirror("file:///etc/passwd", link),
            Err(ErrorCode::UnsupportedScheme)
        );
        assert_eq!(
            check_mirror("https://user:pw@mirror.example.net/a.iso", link),
            Err(ErrorCode::InvalidUrl)
        );
        assert_eq!(
            check_mirror("https://mirror.example.net/a b.iso", link),
            Err(ErrorCode::InvalidUrl)
        );
        assert_eq!(
            check_mirror("https:///a.iso", link),
            Err(ErrorCode::InvalidUrl)
        );
        assert_eq!(
            check_mirror("http://abcdefghijklmnop.onion/a.iso", link),
            Err(ErrorCode::InvalidUrl)
        );
        assert_eq!(check_mirror(link, link), Err(ErrorCode::InvalidInput));
        assert_eq!(
            check_mirror(&format!("https://m.example.net/{}", "a".repeat(9000)), link),
            Err(ErrorCode::InvalidUrl)
        );
    }

    #[test]
    fn reads_the_mirrors_a_server_announces_best_first() {
        let link = "https://example.org/files/a.iso";
        assert_eq!(
            announced_mirrors(
                &[
                    "<https://m2.example.net/a.iso>; rel=duplicate; pri=2, <https://example.org/files/a.iso.meta4>; rel=describedby",
                    "</mirror/a.iso>; rel=\"duplicate\"; pri=1; geo=de",
                    "<ftp://m3.example.net/a.iso>; rel=duplicate",
                    "<rsync://m4.example.net/a.iso>; rel=duplicate; pri=0",
                    "<https://example.org/files/a.iso>; rel=duplicate",
                    "garbage, <https://m5.example.net/a.iso; rel=duplicate",
                ],
                link,
            ),
            ["https://example.org/mirror/a.iso", "https://m2.example.net/a.iso", "ftp://m3.example.net/a.iso"]
        );
        assert!(
            announced_mirrors(
                &["<https://m.example.net/a.iso>; rel=\"describedby duplicate\""],
                link
            )
            .len()
                == 1
        );
        assert!(announced_mirrors(&[], link).is_empty());
    }
}
