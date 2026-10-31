import { readTheme, subscribeTheme } from "@shopper/ui/hooks/theme";
import type { Theme } from "@shopper/ui/hooks/types";

/**
 * Figma "Application title bar". In Electron the window is frameless: this bar drags it and the OS
 * draws the window controls over its right edge. In a browser it is a plain header.
 */
export function TitleBar() {
  return (
    <div className="app-drag flex h-10 shrink-0 items-center gap-3 border-b bg-card px-4 select-none">
      <span aria-hidden="true" className="size-6 rounded-full bg-border" />
      <p className="text-sm font-semibold tracking-tight">Shopper App</p>
    </div>
  );
}

// Electron reads the page's theme-color to colour its window controls (apps/till/electron/src/main.ts).
const TITLE_BAR = { dark: "#0b1220", light: "#ffffff", system: "" } satisfies Record<Theme, string>;

/** Keeps Electron's window controls on the theme the cashier picked. Call once at start-up. */
export function followThemeInTitleBar() {
  const meta = document.head.appendChild(document.createElement("meta"));
  meta.name = "theme-color";
  const apply = (theme: Theme) => {
    meta.content = TITLE_BAR[theme];
  };
  apply(readTheme());
  subscribeTheme(apply);
}
