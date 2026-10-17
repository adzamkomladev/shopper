import type { BrowserWindow } from "electron";

/** Pins a till window to its origin: no popups, no webviews, no navigation away. */
export function lockDown(window: BrowserWindow, origin: string) {
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-attach-webview", (event) => event.preventDefault());
  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== origin) event.preventDefault();
  });
}
