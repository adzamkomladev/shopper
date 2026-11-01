/** The label for the Mod shortcut key on this platform. */
export const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";

/** A Mod shortcut as printed on a button: ⌘S on macOS, Ctrl+S elsewhere. */
export const modLabel = (key: string) => (MOD_KEY === "⌘" ? `⌘${key}` : `${MOD_KEY}+${key}`);

/** "Control+K Meta+K" reads as "Ctrl+K" (or "⌘+K" on a Mac): the first combo for this platform. */
export function displayKeys(shortcuts: string) {
  const mac = MOD_KEY === "⌘";
  const combos = shortcuts.split(" ");
  const combo =
    combos.find((each) => (mac ? !each.includes("Control") : !each.includes("Meta"))) ?? combos[0]!;
  return combo.replace(/Control|Meta/, MOD_KEY);
}
