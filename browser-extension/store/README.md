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
| `scripting` | Registers the magnet-link script, only while torrent capture is on and page access was granted. |
| Optional access to all sites | Asked for only when you turn on magnet capture, so magnet link clicks on pages reach the app. |

## Privacy

- **Data collected:** none. Nothing is sent anywhere except the links you send to the app on your own computer.
- **Privacy policy:** the project's [privacy document](../../docs/PRIVACY.md). Once the website (#353) is live, its privacy page is the listing's link.

## Images

- **Icon:** 128 × 128 px, `dist/<target>/icons/icon-128.png` from the build.
- **Screenshots:** 1280 × 800 px of the popup and the settings page, light and dark. Not yet taken; they come with #240, from an installed release build.
