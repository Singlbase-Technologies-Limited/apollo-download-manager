# Download messages

Every message a download can show, what it means, and what to do. The details panel shows the message, the server's HTTP status when there is one, and whether retrying may help. When there is more to say, such as a library's own error, **Technical details** under the message shows it, with a button to copy it for a bug report.

What to do when something doesn't go as expected, in general, is in [Troubleshooting](troubleshooting.md).

## Waiting and retrying

| Message or status | What it means | What to do |
|---|---|---|
| Retrying, with "Trying again (2 of 5)." | A request failed, for the reason shown, and is tried again after a wait. A start gives up after 5 tries | Nothing. If the server can't be reached at all, the download fails after those tries: check the link and your connection, then **Retry** |
| Retrying, with "Retrying automatically (1 of 2)." | The download failed in a way worth retrying, and waits before starting again | Nothing. If it ends as Failed, the message says why |
| No data received | No data has come from the server for 15 seconds | Nothing at first: after 30 seconds the connection is reset and tried again. If it keeps happening, check your network connection |
| "The server is rate limiting requests. …" (HTTP 429) or "The server is temporarily unavailable or overloaded." (HTTP 503) | The server asked for fewer requests | Nothing: Apollo Download Manager waits as long as the server asks, up to 10 minutes, and uses fewer connections with that server until it quits. If it still fails, try again later |
| "The file changed on the server during download, twice: …" | The file on the server was replaced while it downloaded, and again after the download started over | Retry later, when the site has finished updating the file |

## Links and servers

| Message | What it means | What to do |
|---|---|---|
| "The server name could not be resolved. Check the link's spelling, …" | No network, a name that doesn't exist (in the link or the proxy's), or a server reachable only over IPv6 on a network without IPv6 internet | Check the link's spelling, the proxy's address if you set one, and your internet connection. Apollo Download Manager tries a few times first, then waits for you to **Retry** |
| "This computer has no network connection to the server. …" | Wi-Fi off, a cable out, or an IPv6-only server on a network without IPv6 | Check that Wi-Fi or the cable is connected. A download that had started keeps trying for about 5 minutes, and goes on from where it stopped once the network is back |
| "The file was not found on the server. The link may have expired." (HTTP 404) | The address is wrong or no longer valid | Get a new link from the site |
| "The file wasn't found on the server." (FTP) | The FTP server has no file at that path | Check the path in the link; FTP paths are often case-sensitive |
| "The download link expired. …" | The link worked when the download started, then the server refused it. Signed links, such as cloud storage's, expire after a set time | Copy the link again, then choose **Use a new link…**: the download continues from where it stopped ([Resume after a break](resume.md#when-the-link-expired)) |
| "The server denied access to the file. …" (HTTP 403) | Refused, or the link expired | Get a new link from the site |
| "The server redirected to an insecure http:// address, …" | A secure link redirected to an unencrypted address | The download stops and asks: **Continue over http** in its details panel goes on for this download only. Choose it only if you trust the network. Otherwise ask the site for an `https://` link |
| "The address, or a redirect, uses a protocol that is not allowed. …" | The link redirected to another kind of address, such as `ftp://` or `file://` | Use the address the redirect named directly, if Apollo Download Manager downloads it |
| "The server redirected too many times. …" | The link redirects in a loop, or through more than 10 addresses | Open the link in a browser to see where it ends, and use that address |

## Logins and servers

| Message | What it means | What to do |
|---|---|---|
| "The server requires a user name and password." (HTTP 401), or "The server refused the login. Check the user name and password." | The server wants a login, or refused the one sent | The login window opens on its own: enter the right login and choose **Log in and retry**. Without a login, FTP uses `anonymous`, which many servers refuse |
| "The server doesn't let this user read the file." | You're logged in, but this user may not read the file | Ask the server's owner for access; a new password won't help |
| "The server's identity isn't confirmed yet. …" (SFTP) | The first download from this SFTP server | Check the fingerprint with the server's owner, then choose **Trust and continue** only if it matches ([Add a download](add-a-download.md#sftp-servers)) |
| "The server's host key changed …" (SFTP) | The server shows another key than the one you trusted. A reinstalled server does this, and so does an attacker | Ask the server's owner whether the key changed, and why. Apollo Download Manager never trusts a changed key: after checking, remove the old entry from the `known_hosts` file in Apollo Download Manager's data folder by hand |
| "The server can't encrypt the connection, and this download requires encryption." | The FTP server doesn't offer FTPS. Nothing was sent | Ask for an `ftps://` or `https://` link |
| "The proxy refused the connection. Check its user name and password in Settings, Proxy." | The proxy refused its login, or refused to connect to that site | Check the proxy's login, then retry. Ask the proxy's administrator whether it allows that site |
| "…SFTP can't go through an HTTPS proxy…" or "Torrents can't go through an HTTPS proxy." | An HTTPS proxy is set, and SFTP and torrents can't use one | Choose an HTTP or SOCKS5 proxy in Settings, Proxy |
| "Apollo Download Manager doesn't keep logins, custom headers or SSH keys after it closes. …" | The download had a login that wasn't remembered | **Resume** it and enter the login again ([Resume after a break](resume.md#when-it-needs-its-login-again)) |
| "The system keychain couldn't be read, …" | The login was remembered, but the keychain didn't answer: on Linux, no Secret Service is running, or it is locked | Unlock or start your keyring (GNOME Keyring, KWallet), then restart Apollo Download Manager; or resume and enter the login again |
| "The login wasn't remembered: The system keychain isn't available…" | This system has no keychain Apollo Download Manager can use | The download works until Apollo Download Manager closes. Add it again later with the keyring running |

## Security certificates

Apollo Download Manager always checks a website's certificate, and never skips the check.

| Message | What it means | What to do |
|---|---|---|
| "The website's security certificate has expired, …" | The certificate is out of date | The site's owner must renew it. For your own server, also check this computer's date and time |
| "The website's security certificate is for another website, …" | The certificate doesn't name the link's server | Check the link's address: a mistyped name, or a link to a server under another name |
| "The website's security certificate isn't trusted on this computer, …" | Self-signed, or from an authority this computer doesn't know | Check whether a proxy or security program intercepts connections. For your own server, add its certificate authority to the system's trusted certificates |
| "The website's security certificate was refused, …" | Revoked, or not meant for a website | Only the site's owner can fix it |

## Files, checksums and Metalink

| Message | What it means | What to do |
|---|---|---|
| "The destination file already exists; it is never replaced" | A file appeared at the download's name while it downloaded. Apollo Download Manager kept it | Move or rename that file, or add the download again with another name |
| "The downloaded file doesn't match its SHA-256 checksum …" (or MD5, SHA-1, SHA-224, SHA-384, SHA-512) | The file that arrived isn't the one the checksum describes: a wrong checksum, another version, or damage on the way | Check that the checksum is the one the site gives for this exact file. The unfinished file is kept as `<name>.vdmpart`; retrying downloads it again |
| "The downloaded file's piece n of m doesn't match its trusted hash, …" | A server or mirror keeps sending wrong data for part of the file | Retry later, or from another mirror |
| "The file's trusted piece list doesn't fit it: …" | The Metalink file describes a file of another size than the server sends | Get the Metalink file and the download from the same place and version |
| "Apollo Download Manager downloaded this Metalink file but couldn't add its files: …" | The download was a Metalink file it can't use, for the reason that follows | The Metalink file is kept. Download the files another way, or ask the site for a correct Metalink file |
| "The Metalink file names a file Apollo Download Manager won't create: …" or "… declares a document type, which Apollo Download Manager refuses: …" | The Metalink file is unsafe: a file name that leaves the folder, or content that could harm this computer | Don't use this Metalink file. Ask the site for a correct one |
| "There is not enough disk space." | The disk filled up. What was downloaded is kept | Free some space, then **Retry**: the download goes on from where it stopped |
| "Apollo Download Manager isn't allowed to write to that location." | The folder stopped accepting writes: its permissions changed, or the drive became read-only | Give your user write access again, then **Retry** |

## Torrents

| Message | What it means | What to do |
|---|---|---|
| "A file or folder of the torrent is no longer there." | A torrent's file or folder was moved or deleted while it downloaded or seeded | Put it back, or remove the torrent and add it again |
| "The torrent stopped because of an error." | The torrent engine reported a problem Apollo Download Manager has no plain words for | **Technical details** shows its own message; include it when you report the problem |
| A private torrent finds no peers after a restart | Its trackers weren't remembered | Add it again from its `.torrent` file or magnet link, and tick **Remember this torrent's trackers in the system keychain** ([Torrents](torrents.md#different-from-v1)) |

## Apollo Download Manager's engines and the browser

| Message | What it means | What to do |
|---|---|---|
| "the transfer engine stopped unexpectedly", "… stopped responding and was restarted" or "… was restarted", on a queued download | The download engine crashed, hung or was restarted. The download waits, and resumes once it runs again | Nothing. If it happens again, export the diagnostics report and report it ([Troubleshooting](troubleshooting.md#the-diagnostics-report)) |
| A notice that the transfer engine isn't running, and downloads wait | It crashed more than 5 times in 5 minutes, so it isn't started again on its own | **Restart transfer engine** in Settings, About and diagnostics. If it keeps crashing, report it |
| The engine or the torrent helper is missing, or doesn't match the app | A program is missing beside Apollo Download Manager, or is from another version | Reinstall Apollo Download Manager |
| The extension says "The connection to Apollo DM is not set up" | That browser isn't registered, or was registered for another copy | Settings, Browser: **Register** that browser, then reload the extension ([Use with your browser](browser.md#connecting-it-to-apollo-download-manager)) |
| The extension says "Apollo Download Manager is not running" or "was started but didn't answer in time" | Apollo Download Manager couldn't be started within 10 seconds, so the browser downloaded the file itself | Try the link again once Apollo Download Manager is open. If it never starts, reinstall it |
| Settings, Browser says the browser connection program isn't installed | A program is missing beside Apollo Download Manager | Reinstall Apollo Download Manager |
