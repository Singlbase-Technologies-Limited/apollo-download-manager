# Store listings

The text for the extension's listings in the Chrome Web Store, Microsoft Edge Add-ons and addons.mozilla.org (#356). Publishing them is #240. The permission reasons come from [the extension's permissions](../../docs/BROWSER_EXTENSION.md#permissions); change them there first.

## Name

Apollo Download Manager

## Short description

Up to 132 characters (the Chrome Web Store's limit):

> Send your browser's downloads to the Apollo Download Manager desktop app, where they resume after a break and sort into categories.

## Long description

> Apollo Download Manager's browser extension hands your downloads to the Apollo Download Manager desktop app on Windows or Linux.
>
> - Matching downloads go to the app, with the file name, size and type the browser knows. You choose which file types and sites, or have the browser ask you each time.
> - Right-click any link, image, video or audio to download it with Apollo Download Manager.
> - On a page with many files, a button lists them so you can send several at once. It is on from the start, and one click hides it on a site or everywhere.
> - Magnet links and .torrent downloads can go to the app too. This is off by default, and the app always asks before adding a torrent.
> - When the app isn't running or can't take a download, the browser simply downloads it.
>
> The extension talks only to the app on your computer, through the browser's native messaging. It sends no cookies, logins or page content, and it has no analytics. It keeps its settings and your last 5 sends (file name and site only) in the browser.
>
> It needs the Apollo Download Manager desktop app. In the app, open Settings, Browser, and register your browser.

## Single purpose

> Hands the browser's downloads to the Apollo Download Manager desktop app on the same computer.

## Permission reasons

| Permission | Reason |
|---|---|
| `downloads` | Sees a download the browser starts, pauses it while the app takes it, then removes the browser's copy, or resumes it when the app can't take it. |
| `nativeMessaging` | Passes links to the Apollo Download Manager desktop app on this computer. It is the only channel to the app. |
| `storage` | Keeps the extension's settings, the popup's last 5 sends (file name and site only) and pending "ask first" prompts. |
| `contextMenus` | Adds "Download with Apollo Download Manager" to the right-click menu on links and media. It can be turned off. |
| `scripting` | Registers the magnet-link script and the script that finds the files on a page, each only while it is on and page access was granted, and puts them into the pages already open when they start. |
| Optional access to all sites | Asked for only when you turn on magnet capture or the button for pages with files, so magnet link clicks reach the app and the button can find the files a page links to. |

## Privacy

What the extension handles, declared in each store's own terms ([ADR-0023](../../docs/decisions/0023-extension-declares-browsing-activity.md), #522; the policies read on 2026-11-25):

- **What it handles:** web browsing activity. The link of each download you send, the page it came from, and the file name, size and type, passed only to Apollo Download Manager on your own computer, to download them. Kept in the browser: the extension's settings and the popup's last 5 sends (file name, site, sent or failed, time). Nothing is sent off your computer, sold or shared.
- **Chrome Web Store, privacy practices:**
  - **Single purpose:** "Sends the downloads you choose to Apollo Download Manager, the desktop download manager on this computer."
  - **Data:** Web history (web browsing activity), for the extension's single purpose; not sold, not used for anything else, not transferred except to the app on this computer.
  - **Limited Use:** "The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements."
- **Edge Add-ons, data usage:** the same: web browsing activity, used only to send downloads to the app on this computer ([developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies) §1.5.1).
- **Firefox Add-ons:** the manifest declares `data_collection_permissions: { required: ["browsingActivity"] }`, since AMO's policy covers data sent to a native application. Firefox 140 and later show it at install. Before submitting, read the policy revised for 2026-12-01.
- **Privacy policy:** <https://singlbase-technologies-limited.github.io/apollo-download-manager/privacy/>, the website's page for [PRIVACY.md](../../docs/PRIVACY.md).

## Images

- **Icon:** 128 × 128 px, `dist/<target>/icons/icon-128.png` from the build.
- **Screenshots:** 1280 × 800 px, in [`screenshots/`](screenshots/): the popup and the settings page, light and dark, from the release build against the installed app.
