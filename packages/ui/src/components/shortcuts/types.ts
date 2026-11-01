/** One key and what it does, such as { keys: "F1", label: "Open Help" }. */
export type Shortcut = { keys: string; label: string };

export type ShortcutGroup = { label: string; items: readonly Shortcut[] };
