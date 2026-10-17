/** The label for the Mod shortcut key on this platform. */
export const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";

/** A Mod shortcut as printed on a button: ⌘S on macOS, Ctrl+S elsewhere. */
export const modLabel = (key: string) => (MOD_KEY === "⌘" ? `⌘${key}` : `${MOD_KEY}+${key}`);
