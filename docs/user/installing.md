# Installing

Apollo Download Manager installs beside the original Velocity Download Manager (V1): each has its own programs, menu entries and data, and installing or removing one never changes the other ([V1 and Apollo Download Manager](v1-and-v2.md)).

**No signed release yet:** Apollo Download Manager's installers are test builds, made by its CI and not signed.

## Windows

The installer is `Apollo Download Manager_<version>_x64-setup.exe`.

- **For your user only:** it installs without an administrator prompt, into `%LOCALAPPDATA%\Apollo Download Manager`, with a Start menu entry and an Apps & features entry, all named "Apollo Download Manager".
- **Unsigned:** Windows SmartScreen warns the first time ("Windows protected your PC"). Choose **More info**, then **Run anyway**.
- **WebView2:** if the PC lacks Microsoft's WebView2, the installer downloads it. Windows 10 and 11 normally have it.
- **Your data** is kept in `%APPDATA%\com.velocity.downloadmanager.v2`, apart from V1's.
- **Licences:** Apollo Download Manager is free software under the GNU General Public License, version 3 only, in `LICENSE` in the install folder. The third-party licences are in `THIRD_PARTY_NOTICES.md` beside it.

## Linux

Two packages, for 64-bit PCs:

| Package | For |
|---|---|
| `.deb` | Ubuntu 22.04 and newer, Debian 12 and newer, and distributions based on them |
| `.rpm` | Fedora, openSUSE and similar distributions of the same age or newer |

Install it with your package manager, which also installs the WebKitGTK, GTK and AppIndicator libraries Apollo Download Manager needs:

```sh
sudo apt install "./Apollo Download Manager_<version>_amd64.deb"   # Ubuntu, Debian
sudo dnf install "./Apollo Download Manager-<version>-1.x86_64.rpm" # Fedora
```

Use the file name of the package you have, in quotes because it has spaces. A release candidate's files have other names, such as `apollo-download-manager-0.2.0-rc.1-<commit>-<date>-linux-amd64.deb`. Apollo Download Manager then appears in your applications menu as "Apollo Download Manager". Its data is kept in `~/.local/share/com.velocity.downloadmanager.v2`, apart from V1's, and its licence and the third-party licences are in `/usr/lib/Apollo Download Manager/` (`LICENSE`, `THIRD_PARTY_NOTICES.md`).

No AppImage is made for now.

## Upgrading

Install a newer version over the old one: run the newer Windows installer, or install the newer Linux package. Your downloads, settings, history and browser registrations are kept.

**From 0.1.x,** which was named "Velocity Download Manager V2": install the new version the same way. It replaces the old one, so you have one Apollo Download Manager in Apps & features or in your package manager, and it keeps everything above. On Windows the browsers keep working: the app points them at its new folder the first time it starts. V1 isn't changed.

## Removing Apollo Download Manager

- **Windows:** remove "Apollo Download Manager" in Apps & features. That removes the program and Apollo Download Manager's browser registrations. Your downloads, settings and history stay unless you tick **Delete the application data**.
- **Linux:** `sudo apt remove apollo-download-manager`, or `sudo dnf remove apollo-download-manager`. That removes the programs, the menu entry and the icons. Your downloads, settings and history stay in your home folder. **First unregister the browsers** in Settings, Browser: a package can't reach the registrations in your home folder, so they would stay, pointing to a program that is gone.

Downloaded files are never removed, on either system. Removing Apollo Download Manager never changes V1.
