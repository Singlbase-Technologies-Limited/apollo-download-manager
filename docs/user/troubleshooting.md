# Troubleshooting

What to do when a download doesn't go as expected. Every message a download can show, with its cause and what to do, is in the [complete list of download messages](../TROUBLESHOOTING.md#downloads).

## A download waits

| What you see | What it means | What to do |
|---|---|---|
| **Retrying in …** or **Waiting to retry** | The download failed in a way worth retrying | Nothing: Apollo Download Manager tries again by itself. If it ends as Failed, the message says why |
| **Waiting for network** | No connection could be made: no Wi-Fi or cable, or the server's name didn't resolve | Nothing: it continues when the network is back. If the network works and it still waits, check the link and the proxy in Settings, then **Retry** |
| **No data received** | The server stopped sending | Nothing at first: after 30 seconds Apollo Download Manager resets the connection and tries again. If it keeps happening, check your network connection |
| **Queued** | The queue already runs as many downloads as Settings allows (2 by default), or the schedule is outside its hours (the list says **Scheduled: …** with when it starts), or it has its own start time (**Starts …**) | Wait, or raise **Simultaneous downloads** in Settings, Queue and performance |
| **Needs its login** | Apollo Download Manager restarted, and didn't keep the download's login, headers or key | **Resume** it and enter them again. Tick **Remember this login** next time |
| A notice that the transfer engine isn't running | The engine stopped, and the downloads wait for it | Usually nothing: Apollo Download Manager starts it again. If it crashed more than 5 times in 5 minutes, use **Restart transfer engine** in Settings, About and diagnostics |
| **Waiting for peers** (a torrent) | No one is sharing the torrent right now | Wait. A private torrent added before a restart may need to be added again ([Torrents](torrents.md#not-yet-or-different-from-v1)) |

## A download stopped and asks something

| What you see | What to do |
|---|---|
| **Trust this server?** (SFTP) | Check the fingerprint with the server's owner first ([Downloads](downloads.md#sftp-servers)) |
| The server redirected from `https://` to `http://` | The rest would come over an unencrypted connection. **Continue over http** in the details panel goes on for this download only. Choose it only if you trust the network |
| A link from the browser to this computer or the local network | Apollo Download Manager holds links from the browser to addresses such as `127.0.0.1` or `192.168.x.x` before sending anything. **Download anyway** in the details panel goes on |
| A name already taken | **Keep both (rename)** or **Skip**: Apollo Download Manager never replaces a file |

## A download started again

The details panel says "…, so the download started again." when Apollo Download Manager dropped what it had downloaded and began again, with the reason. Most often the file on the server changed: Apollo Download Manager never mixes two versions of a file, so it starts once more with the new one. There's nothing to do; the download continues by itself. If the file changes again while it downloads, the download fails, and you can retry it later.

## A download failed

The details panel shows the message, the server's HTTP status when there is one, and a hint about retrying:

- **"Retrying may help once the cause is fixed."** A network problem, such as a lost connection or a timeout.
- **"The server asked Apollo Download Manager to slow down. Retrying later may help."** The server is busy or limits how many requests it accepts.
- **"Retrying is unlikely to help without changing the request."** For example a missing file, a refused login or a full disk: fix the cause first.

The most common messages:

| Message | What to do |
|---|---|
| "The server name could not be resolved. Check the link's spelling, …" | Check the link's spelling, the proxy's address if you set one in Settings, Proxy, and your internet connection. Some servers can be reached only over IPv6: if your network has no IPv6 internet access, they can't be reached from it. Apollo Download Manager tries a few times on its own before it shows this, then waits for you to **Retry** |
| "This computer has no network connection to the server. …" | Check that Wi-Fi or the cable is connected. Some servers can be reached only over IPv6: if your network has no IPv6 internet access, they can't be reached from it. A download that had already started keeps trying for about 5 minutes on its own, and goes on from where it stopped once the network is back. Otherwise, **Retry** once it's back |
| "The file was not found on the server (404). The link may have expired." | Get a new link from the site |
| "The download link expired (403). Get a fresh link from the browser." | Copy the link again from the site, and add it again |
| "Access was denied by the server (403)." or "The server requires authentication (401)." | The link needs a login: add it again with your user name and password, or get a new link |
| "The server's certificate isn't trusted, so the connection was refused." | Check your computer's date and time, and whether a proxy or security program intercepts connections. Otherwise the site must fix its certificate. Apollo Download Manager never skips this check |
| "The server's host key changed …" (SFTP) | Ask the server's owner whether the key changed, and why. Apollo Download Manager never trusts a changed key: after checking, remove the old entry from the `known_hosts` file in Apollo Download Manager's data folder by hand |
| "The downloaded file doesn't match its SHA-256 checksum …" | Check that the checksum is the one the site gives for this exact file. The unfinished file is kept as `<name>.vdmpart` |
| "There is not enough disk space." | Free some space, then **Retry**: the download goes on from where it stopped |
| "Apollo Download Manager isn't allowed to write to that location." | The folder stopped accepting writes (its permissions changed, or the drive became read-only). Give your user write access again, then **Retry** |
| "The proxy refused the connection. Check its user name and password in Settings, Proxy." | Check the proxy's login, then retry. Ask the proxy's administrator whether it allows that site |
| "The server can't encrypt the connection, and this download requires encryption." | The FTP server doesn't offer FTPS. Ask for an `ftps://` or `https://` link |
| "The destination file already exists; it is never replaced" | A file appeared at the download's name while it downloaded. Apollo Download Manager kept it. Move or rename that file, or add the download again with another name |

After a disk-full or write error, if Apollo Download Manager hadn't saved any progress yet, the retry starts the file over.

## The browser doesn't send downloads

See [Browser integration](browser.md#when-v2-cant-take-a-link). The extension's popup says why: V2 isn't running, or that browser isn't registered in V2's Settings, Browser.

## The diagnostics report

**Settings, About and diagnostics** shows the versions of Apollo Download Manager and its engines, what the download engine supports, and the recent log. **Export diagnostics…** saves a report to a file you choose, to attach to a bug report.

- **Secrets are hidden:** passwords, cookies, tokens, tracker passkeys and keys are removed from the report and from the log before anything is kept.
- **Crash logs** are kept on this computer only, in their own folder, newest first. Apollo Download Manager never sends anything anywhere: no telemetry, no automatic reports.
- **Restart transfer engine** and **Restart torrent helper** are there too, and ask first.

## If Apollo Download Manager closes suddenly

After a crash, a forced quit or a power cut, the downloads come back when Apollo Download Manager starts again and continue from their last saved progress.
