# Add a download

How to add links, files and series to Apollo Download Manager, and what the Add dialog shows before anything starts. Torrents have their own [guide](torrents.md).

## Opening the Add dialog

Choose **Add download** at the top of the navigation, or press **Ctrl+N**. It also opens when you:

- **drop `.torrent` files** on the window (other dropped files are ignored, and the window says so);
- **paste a magnet or `.torrent` link** anywhere outside a text field, with the link filled in;
- **send a link from your browser,** with the extension ([Use with your browser](browser.md)).

## What you can add

- **Links,** one per line, up to 500 at once: `http://`, `https://`, `ftp://`, `ftps://` and `sftp://` ([Protocols and limits](protocols.md)).
- **Numbered series, with a pattern:** a range in square brackets in a link's path adds one link per value. The dialog shows how many links it makes, and the first and last, before you add them.
  - `file[1-10].zip` adds `file1.zip` to `file10.zip`.
  - `file[001-100].zip` keeps the zeros: `file001.zip` to `file100.zip`.
  - `img[0-100:5].png` counts in steps of 5: `img0.png`, `img5.png` and so on, to `img100.png`.
  - `part-[a-e].rar` adds `part-a.rar` to `part-e.rar`; `[A-Z]` works for capitals.
  - One range per link, from the smaller end. All the links together still count toward the 500.
- **Magnet links,** and **links to `.torrent` files**: Apollo Download Manager downloads the `.torrent` file first, for up to 60 seconds, then adds the torrent.
- **`.torrent` files** on your computer, with **Choose .torrent files…**.
- **Metalink files** (`.metalink`, `.meta4`) on your computer, with **Choose Metalink files…**: each adds every file it lists, in its subfolders inside the chosen folder. Metalink must be on in Settings, Advanced; while it's off, the file is refused with the reason ([Protocols and limits](protocols.md#metalink)).

A link Apollo Download Manager can't download is refused in the dialog, with the reason, for example "Only http, https, ftp, ftps, sftp and magnet links are supported." Links with spaces or control characters are refused too.

## Before you add

The dialog shows:

- **The file's name.** You can type another one; Apollo Download Manager keeps the link's file type at the end.
- **The category and folder** Apollo Download Manager chooses from the file type ([Categories](categories.md)). You can choose others.
- **A folder that doesn't exist yet:** **Create this folder** makes it.
- **A name already taken** in that folder, as a warning.

**Options for the download,** under **Advanced options**:

| Option | What it does |
|---|---|
| Connections | The most connections this download may use. Apollo Download Manager starts with all of them and keeps those that make it faster |
| Speed limit | This download's own limit, on top of the global one in Settings. Under a limit, Apollo Download Manager uses only the connections that reach it, and the details say so |
| Referrer, extra headers | Sent to the server, for sites that need them |
| User name and password | The login for the server. For an `sftp://` link, which always needs one, the login fields show without opening the options |
| SSH key and its passphrase | For SFTP servers that use keys |
| Checksum | Written like `sha-256=…` (also MD5, SHA-1, SHA-224, SHA-384, SHA-512). The finished file is checked against it |
| Require encryption (FTPS) | For a plain `ftp://` link: refuse to download unless the server encrypts. Without it, the dialog warns that the login and the file can be read on the network |
| Remember this login in the system keychain | Off by default. See [Files, folders and logins](files-and-logins.md#logins-headers-and-keys) |
| Mirrors | Other servers with the same file, for one link: see [Mirrors](#mirrors) |
| Start at a chosen time | The download waits until a date and time you choose ([Queue and schedule](queue-and-schedule.md#a-start-time-of-its-own)) |

## Starting it

**Start download** adds the download to the queue, which starts it as soon as it may ([Queue and schedule](queue-and-schedule.md)); **Add paused** adds it without starting it.

Then:

- **A name already taken:** choose **Keep both (rename)** or **Skip**. Apollo Download Manager never replaces a file that is already there.
- **A link added before:** **Add anyway** starts a separate download, and **Show download** selects the one already in the list.
- **Links that failed** are listed, each with the reason.

The download then shows in [the download list](download-list.md).

## SFTP servers

The first download from an SFTP server stops before logging in and asks **Trust this server?**, with the server's key fingerprint (`SHA256:…`). Nothing has been sent yet: no login, no file name.

- **Check the fingerprint** with the server's owner before trusting it. On the server, `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` prints it. Choose **Trust and continue** only if they match.
- **Cancel** leaves the download failed. **Retry** connects again and asks again. If you close Apollo Download Manager without answering, it doesn't ask at the next start: **Retry** the download to see the question again.
- **"The server's host key changed"** means the server shows another key than the one you trusted. A reinstalled server does that, and so does an attacker. Apollo Download Manager refuses it every time. Ask the server's owner whether and why the key changed ([Download messages](download-messages.md#logins-and-servers)).

## Mirrors

A mirror is another server with the same file. With mirrors, a download can take parts of the file from several servers, and carry on when one is slow or down.

- **Find mirrors,** under **Advanced options** in the Add dialog for one link, or **Mirrors…** in a download's right-click menu or the details panel's menu, reads the official mirror list of the link's project. It works for links on Ubuntu, Debian, Fedora, Apache, Arch Linux, Linux Mint, openSUSE and GNU servers. Nothing is fetched until you click.
- **Mirrors the server names** are offered too, once the download has started.
- **Tick up to 8,** or paste a mirror's link and choose **Add**. Each shows where it came from and, when the list says, its country.
- **A mirror is used only if it serves exactly the same file;** one that doesn't is left out, and the download goes on from the others. Your login and custom headers are never sent to a mirror on another server.
- **Changing a download's mirrors:** pause it first. It then continues from where it stopped, with the mirrors you chose.
