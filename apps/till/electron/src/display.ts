import { BrowserWindow, screen } from "electron";
import { lockDown } from "./window";

/**
 * Keeps a frameless fullscreen customer-display window on the first non-primary monitor: opens it
 * when one appears, closes it when it goes, nothing with a single monitor. Closes with `main`.
 * Reports the window's bounds (or null) to the parent over IPC after every change.
 */
export function openDisplay(main: BrowserWindow, url: string, capability: string) {
  const target = new URL(url);
  target.search = "?display";
  target.hash = capability;
  let shown: { id: number; window: BrowserWindow } | undefined;
  const sync = () => {
    const primary = screen.getPrimaryDisplay().id;
    const display = screen.getAllDisplays().find((candidate) => candidate.id !== primary);
    if (shown && shown.id !== display?.id) shown.window.close();
    if (display && !shown) {
      const window = new BrowserWindow({
        ...display.bounds,
        frame: false,
        fullscreen: true,
        focusable: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      });
      lockDown(window, target.origin);
      window.on("closed", () => (shown = undefined));
      void window.loadURL(target.href);
      shown = { id: display.id, window };
    }
    process.send?.({ type: "display", bounds: shown?.window.getBounds() ?? null });
  };
  screen.on("display-added", sync);
  screen.on("display-removed", sync);
  main.on("closed", () => {
    screen.off("display-added", sync);
    screen.off("display-removed", sync);
    shown?.window.close();
  });
  sync();
}
