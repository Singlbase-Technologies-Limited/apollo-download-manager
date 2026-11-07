/**
 * Optional content script, registered only while "Send magnet links and .torrent
 * downloads to Apollo Download Manager" is on and the user granted access to pages, and put into the
 * pages already open when capture starts (#416). It catches plain clicks on magnet links and hands
 * the link to the background. It reads nothing else from the page, and Apollo Download Manager
 * always asks before adding the torrent.
 */
import { ext } from './shared/ext';
import { installMagnetClicks } from './shared/magnet-capture';

installMagnetClicks(globalThis, document, (url) => {
  void ext.runtime.sendMessage({ type: 'magnet', url }).catch(() => undefined);
});
