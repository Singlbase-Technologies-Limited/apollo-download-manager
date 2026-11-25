# Resume after a break

A download doesn't have to finish in one go. This page says what happens when you pause it, when Apollo Download Manager or the computer stops, when the network drops, and when a link stops working, and what, if anything, you need to do.

## Pause and resume

**Pause** (or **Space** in the list) stops a download and keeps what it has. **Resume** goes on from there, not from the start. Apollo Download Manager saves a download's progress every 2 seconds or 16 MiB, and when you pause.

Before resuming, it checks that the file on the server is still the same one. If it changed, the download starts again (below).

## After a crash or a power cut

After a crash, a forced quit or a power cut, the downloads come back when Apollo Download Manager starts again, and continue from their last saved progress. **Start Apollo Download Manager when I sign in** (Settings, General) lets queued downloads and seeding carry on after a restart of the computer.

## When the network drops

A download that fails because there is no network, or because the server's name doesn't resolve, shows **Waiting for network**. It keeps what it has, takes no place among the downloads running at once, and starts again by itself when the network comes back, however long that takes. It's listed under Queued.

- **Retry** starts it now; **Cancel** stops it.
- **Restart downloads when the network is back** (Settings, Queue and performance) turns this off: the download then shows Failed, and you retry it.
- A short cut while a download runs doesn't stop it: it keeps trying for about 5 minutes, then goes on from where it stopped.

## When it needs its login again

Apollo Download Manager never saves passwords, custom headers or SSH keys on its own. After it restarts, a download that had one comes back paused, as **Needs its login**: **Resume** or **Retry** asks for it again.

To skip that, tick **Remember this login in the system keychain** when you add the download ([Files, folders and logins](files-and-logins.md#logins-headers-and-keys)).

## When the link expired

Links from file hosts and download sites often stop working after a while. The download then fails with "The download link expired". Get a fresh link for the same file, for example by clicking the download again on the site, and copy it. Then choose **Use a new link…** in the download's right-click menu or in the details panel's menu, and paste it.

- **It continues from where it stopped,** if the new link is for a file of the same size. Since a new link can't prove it's exactly the same file, the download is shown as not verified, unless you gave a checksum.
- **A file of another size is refused:** nothing is changed, and the download says so. Use another link, or choose **Start as a new download** in the same window.
- **Logins go only to their own server:** if the new link is on another server, the download's login, custom headers and SSH key aren't sent there, and a login saved in the keychain is deleted.
- **For a failed or paused download** from a link, not for a torrent.

## When a download starts again

The details panel says "…, so the download started again." when Apollo Download Manager dropped what it had downloaded and began again, with the reason. Most often the file on the server changed: Apollo Download Manager never mixes two versions of a file, so it starts once more with the new one. There's nothing to do; the download continues by itself. If the file changes again while it downloads, the download fails, and you can retry it later.

After a disk-full or write error, if Apollo Download Manager hadn't saved any progress yet, the retry starts the file over.

## Torrents

A torrent picks up where it was after a restart. A private torrent needs its trackers to find peers again: tick **Remember this torrent's trackers in the system keychain** ([Torrents](torrents.md#different-from-v1)).
