import { useSyncExternalStore } from "react";
import type { Theme } from "./types";

const KEY = "shopper.theme";
const listeners = new Set<(theme: Theme) => void>();

/**
 * Runs in each app's HTML head before first paint, so a saved theme never flashes the other one.
 * Kept in step with `setTheme` below; System leaves the attribute off and the CSS follows the OS.
 */
export const themeScript = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** The viewer's saved theme, kept in step across tabs. */
export function useTheme() {
  return useSyncExternalStore(subscribeTheme, readTheme, () => "system" as const);
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    // Storage can be blocked (private window); the choice still applies to this page.
  }
  apply(theme);
}

/** Calls back on every change, from this tab or another; Electron forwards it to the title bar. */
export function subscribeTheme(listener: (theme: Theme) => void) {
  listeners.add(listener);
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === KEY) apply(readTheme());
  };
  addEventListener("storage", fromOtherTab);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", fromOtherTab);
  };
}

export function readTheme(): Theme {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

function apply(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  for (const listener of listeners) listener(theme);
}
