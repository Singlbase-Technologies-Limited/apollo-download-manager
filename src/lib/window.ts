import { getCurrentWindow } from '@tauri-apps/api/window';

// The title bar's window buttons (#347). The window draws its own title bar, so these replace the
// system's; closing goes through the native side's close handling, which hides to the tray or quits.

export const minimizeWindow = () => getCurrentWindow().minimize();
export const toggleMaximizeWindow = () => getCurrentWindow().toggleMaximize();
export const closeWindow = () => getCurrentWindow().close();

/** Calls `handler` with whether the window is maximised now and after every resize. */
export async function watchMaximized(handler: (maximized: boolean) => void): Promise<() => void> {
  const win = getCurrentWindow();
  handler(await win.isMaximized());
  return win.onResized(() => {
    void win.isMaximized().then(handler);
  });
}
