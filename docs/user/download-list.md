# The download list

How to follow your downloads, act on them, and find them again later.

## The lists

**The lists** in the navigation are All Downloads, Downloading, Queued, Completed, Seeding and Failed, each with its count. Choose a category below them to show only its downloads. **Search** (**Ctrl+F**) looks in the name, the link and the folder. To make room, collapse the navigation to icons with the button at its bottom; the same button, or a drag of its edge, opens it again.

**Hovering a download** shows a name, folder or category that doesn't fit its column in full, and hovering its status says what the status means and what to do, such as why it failed, or that a double-click opens it. A screen reader reads the same help with the row.

**Columns:** click a column's name to sort by it, and again to reverse. **Choose columns** shows or hides any of the 13 columns; Name is always shown, and **Reset to default columns** brings back the default eight. Drag a column's edge to resize it, or focus the edge and use the arrow keys; **Home** or a double-click restores its width. Widths are kept.

Speed and time left show only while data arrives. **Avg. speed** is the average while the download ran, shown once data has arrived, and **Started** is when it first ran. A notice above the list says when the transfer engine isn't running, so waiting downloads aren't mistaken for stuck ones.

## Selecting and acting

**Selecting:** click, **Ctrl+click** and **Shift+click**, or the checkboxes; the top checkbox selects every download shown.

**Acting:** the toolbar and the right-click menu offer what the selected downloads allow: Resume, Pause, Cancel, Retry, Stop seeding, Move to top, up, down or bottom of the queue, Copy link, Copy name, Open file, Open folder, Details, Remove from list and Delete files.

- **Removing** a download still in progress, and **deleting files**, ask first.
- When an action can't apply to every selected download, a message says how many it changed and why the rest weren't.

**Keys in the list:**

| Key | Does |
|---|---|
| ↑, ↓, Home, End | Move; with Shift, extend the selection |
| Ctrl+A, Escape | Select all, select none |
| Space | Pause or resume |
| Enter | Open the details |
| Delete | Remove from the list (asks first for a running download) |
| Shift+Delete | Delete the files (asks first) |

The right-click menu needs a pointer, as in V1. Its actions are also on the toolbar, in the details panel and on the keys above.

## What the statuses mean

| Status | Meaning |
|---|---|
| Queued | Waiting for its turn, the schedule or its own start time ([Queue and schedule](queue-and-schedule.md)) |
| Retrying in 1m 30s | The download failed in a way worth retrying; Apollo Download Manager tries again by itself at that time. **Waiting to retry** when the time isn't known. A server that asks Apollo Download Manager to slow down for 30 s or less isn't shown here: the download stays Downloading, and the details' Connections line says the server asked Apollo Download Manager to slow down |
| No data received | The server stopped sending. Apollo Download Manager resets the connection and tries again |
| Waiting for network | The network went away; it continues by itself when the network is back ([Resume after a break](resume.md#when-the-network-drops)) |
| Needs its login | After a restart, the download waits for a login it didn't remember ([Resume after a break](resume.md#when-it-needs-its-login-again)) |
| Waiting for peers | A torrent with no one to download from yet |
| Choose files | A torrent waiting for you to choose its files ([Torrents](torrents.md)) |
| Failed | It stopped, and says why in the details panel ([Download messages](download-messages.md)) |

## The details panel

Open it by double-clicking a download that isn't finished, pressing **Enter**, the panel button on the toolbar, or **Details** in the right-click menu. It stays open, at its width, until you close it.

- **What it shows:** progress, speed and time left; the connections in use, how many the download may use and what holds it back; the error and what to do about it; whether the file was verified against a checksum; when it was added, started and finished; for a torrent, its peers, seeds, upload and time seeding.
- **It stays on its download:** if the search hides it, or it leaves the list, the panel says so rather than switch to another one.
- **Changing a download:** its category, its speed limit, and its connections, which change while it runs, with no restart.
- **Open file** and **Open folder,** for a finished download. Double-clicking a finished download opens its file. Opening a program (an `.exe`, or an executable file on Linux) asks first. **Open folder** selects the file, or opens the folder if the file is gone.

## The history

**History**, in the navigation's Library, lists every finished download, newest first, 100 a page, including those removed from the list: how each ended and, for a failure, why.

- **Search** it, and **filter** it by completed, failed or cancelled.
- **Again** opens the Add dialog with the entry's link.
- **Remove selected** and **Clear history** (which asks first) forget entries only. Files on disk are never touched, and a download still in the list stays there.
- **How long entries are kept** is in Settings, History and storage: 90 days and 10,000 entries by default; 0 days keeps them forever.
