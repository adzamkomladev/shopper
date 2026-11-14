import type { ShortcutMap } from "./types";
export type { ShortcutMap } from "./types";
import { createContext, use, useState, type KeyboardEvent } from "react";

/**
 * Combos look like "Mod+K", "Mod+Shift+K", "Mod+Enter", "N", "/" or "Escape". Mod is Ctrl or Cmd.
 * Keep combos unique per screen. When two registered maps share one, the most recently
 * mounted owner wins.
 */

type Entry = { map: ShortcutMap; attach: (node: HTMLElement | null) => (() => void) | undefined };
type Registry = Set<Entry>;

const ShortcutContext = createContext<Registry | null>(null);

// tabIndex -1 lets a click on blank space focus the root, so keys still reach it instead of <body>.
export function ShortcutRoot({ children, ...props }: React.ComponentProps<"div">) {
  const [registry] = useState<Registry>(() => new Set());
  function onKeyDownCapture(event: KeyboardEvent<HTMLDivElement>) {
    const combo = describe(event);
    if (isPlainKey(combo) && isTyping(event.target)) return;
    for (const entry of [...registry].reverse()) {
      const handler = entry.map[combo];
      if (!handler) continue;
      event.preventDefault();
      handler(event);
      return;
    }
  }
  return (
    <ShortcutContext value={registry}>
      <div tabIndex={-1} onKeyDownCapture={onKeyDownCapture} className="outline-none" {...props}>
        {children}
      </div>
    </ShortcutContext>
  );
}

/** Attach the returned ref to the element that owns the shortcuts. They live while it is mounted. */
export function useShortcuts(map: ShortcutMap) {
  const registry = use(ShortcutContext);
  if (!registry) throw new Error("useShortcuts needs a ShortcutRoot above it");
  // One stable entry per owner, registered once: a re-render swaps in the new handlers but keeps the entry's place,
  // so a shell part that re-renders late (the header, when a query lands) never takes a combo back from the page.
  const [entry] = useState(() => {
    const created: Entry = {
      map,
      attach: (node) => {
        if (!node) return;
        registry.add(created);
        return () => {
          registry.delete(created);
        };
      },
    };
    return created;
  });
  entry.map = map;
  return entry.attach;
}

function describe(event: KeyboardEvent) {
  const printable = event.key.length === 1;
  const key = printable ? event.key.toUpperCase() : event.key;
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
  const modifiers = [
    event.ctrlKey || event.metaKey ? "Mod" : "",
    event.altKey ? "Alt" : "",
    event.shiftKey && (!printable || hasModifier) ? "Shift" : "",
  ];
  return [...modifiers.filter(Boolean), key].join("+");
}

// A bare letter or symbol must not fire while the cashier is typing into a field.
const isPlainKey = (combo: string) => combo.length === 1;

function isTyping(target: EventTarget) {
  return (
    target instanceof HTMLElement &&
    target.matches(
      'input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"], [role="option"]',
    )
  );
}
