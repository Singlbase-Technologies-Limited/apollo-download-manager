# Troubleshooting

What to do when a download doesn't go as expected. Every message a download can show, with what it means and what to do, is in [Download messages](download-messages.md). What happens after a pause, a crash, a lost network or an expired link is in [Resume after a break](resume.md).

See also, for developers: [diagnostics and logs](../DIAGNOSTICS.md).

## A download waits

| What you see | What it means | What to do |
|---|---|---|
| **Retrying in …** or **Waiting to retry** | The download failed in a way worth retrying | Nothing: Apollo Download Manager tries again by itself. If it ends as Failed, the message says why |
| **Waiting for network** | No connection could be made: no Wi-Fi or cable, or the server's name didn't resolve | Nothing: it continues when the network is back. If the network works and it still waits, check the link and the proxy in Settings, then **Retry** |
| **No data received** | The server stopped sending | Nothing at first: after 30 seconds Apollo Download Manager resets the connection and tries again. If it keeps happening, check your network connection |
| **Queued** | The queue already runs as many downloads as Settings allows (2 by default), or the schedule is outside its hours (the list says **Scheduled: …** with when it starts), or it has its own start time (**Starts …**) | Wait, or raise **Simultaneous downloads** ([Queue and schedule](queue-and-schedule.md)) |
| **Needs its login** | Apollo Download Manager restarted, and didn't keep the download's login, headers or key | **Resume** it and enter them again. Tick **Remember this login** next time |
| A notice that the transfer engine isn't running | The engine stopped, and the downloads wait | Usually nothing: Apollo Download Manager starts it again. If it crashed more than 5 times in 5 minutes, use **Restart transfer engine** in Settings, About and diagnostics |
| **Waiting for peers** (a torrent) | No one is sharing the torrent right now | Wait. A private torrent finds its peers again after a restart only if its trackers were remembered ([Torrents](torrents.md#different-from-v1)) |

## A download stopped and asks something

| What you see | What to do |
|---|---|
| **Trust this server?** (SFTP) | Check the fingerprint with the server's owner first ([Add a download](add-a-download.md#sftp-servers)) |
| The server redirected from `https://` to `http://` | The rest would come over an unencrypted connection. **Continue over http** in the details panel goes on for this download only. Choose it only if you trust the network |
| A link from the browser to this computer or the local network | Apollo Download Manager holds links from the browser to addresses such as `127.0.0.1` or `192.168.x.x` before sending anything. **Download anyway** in the details panel goes on |
| A name already taken | **Keep both (rename)** or **Skip**: Apollo Download Manager never replaces a file |

## A download failed

The details panel shows the message, the server's HTTP status when there is one, and a hint about retrying:

- **"Retrying may help once the cause is fixed."** A network problem, such as a lost connection or a timeout.
- **"The server asked Apollo Download Manager to slow down. Retrying later may help."** The server is busy or limits how many requests it accepts.
- **"Retrying is unlikely to help without changing the request."** For example a missing file, a refused login or a full disk: fix the cause first.

Look the message up in [Download messages](download-messages.md).

## The browser doesn't send downloads

See [Use with your browser](browser.md#when-apollo-download-manager-cant-take-a-link). The extension's popup says why: Apollo Download Manager isn't running, or that browser isn't registered in Apollo Download Manager's Settings, Browser.

## The diagnostics report

**Settings, About and diagnostics** shows the versions of Apollo Download Manager and its engines, what the download engine supports, and the recent log. **Export diagnostics…** saves a report to a file you choose, to attach to a bug report. A bug report on GitHub is public, and so is what you attach: read the file first, and leave out names, folders and screenshots with personal details. For a report you'd rather not make public, e-mail support@singlbase.com.

- **Secrets are hidden:** passwords, cookies, tokens, tracker passkeys and keys are removed from the report and from the log before anything is kept.
- **Crash logs** are kept on this computer only, in their own folder, newest first. Apollo Download Manager never sends anything anywhere: no telemetry, no automatic reports.
- **Restart transfer engine** and **Restart torrent helper** are there too, and ask first.
