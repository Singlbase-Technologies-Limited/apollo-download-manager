# Queue and schedule

When your downloads run: how many at once, in what order, at which hours, and what the computer does when they finish. The settings named here are in [Settings, Queue and performance](settings.md#queue-and-performance), with their defaults.

## How many run at once

**Simultaneous downloads** (2 by default, up to 32) sets how many download at the same time. The others wait as **Queued** and start, in the list's order, as running ones finish. Paused downloads, torrents choosing their files and seeding torrents don't count.

- **The order:** **Move to top**, **up**, **down** and **bottom**, in the right-click menu or the toolbar, change which queued download starts next.
- **Start new downloads at once** (on by default): off, new downloads wait in the queue until you start them. **Add paused** in the Add dialog does the same for one download.
- **Speed:** a limit for all direct downloads together is in the same settings; torrents have their own, under BitTorrent. A download can have its own limit too ([Add a download](add-a-download.md#before-you-add)).

## The schedule

**Use the schedule** (off by default) lets the downloads you add while it's on run only between a start and a stop time (02:00 to 07:00 by default), on the days you choose. Outside those hours they wait, and the list says when they start, such as **Scheduled: tomorrow 02:00**.

- **The times:** a stop of 00:00 runs to midnight; a stop before the start runs past midnight. Under the switch, a line says what it does: **Next: tomorrow 02:00 to 07:00**, **Open now, until …**, or **Off**.
- **Turning it on** lets downloads already running carry on; **turning it off** lets the waiting ones start.
- **If Apollo Download Manager was closed** when the hours began, its downloads start as soon as it opens inside them; outside them, they wait for the next window.

## A start time of its own

Tick **Start at a chosen time** in the Add dialog, then choose a date and a time, or later right-click a waiting download (queued or paused) and choose **Start at…**. The download waits until then, even outside the schedule's hours, and the list says **Starts Sat 03:00**.

- A time that passed while Apollo Download Manager was closed starts it as soon as it opens, within the number of downloads that run at once.
- It starts once. **Start at…** then **Clear the time** takes the time away, so it starts as soon as it may.

## When the downloads finish

The power button in the status bar (at the bottom right) can put the computer to sleep, shut it down, or close Apollo Download Manager once the running downloads have all finished.

- Before it does, a window counts down 60 seconds, with **Cancel**; then the choice goes back to **Do nothing**.
- Paused, failed and seeding downloads don't count as running.
- A shut-down is never forced: a program with unsaved work can still stop it.

**Keep the computer awake while downloading** (Settings, General; on by default) stops the computer from going to sleep on its own while downloads are active. The screen can still turn off.
