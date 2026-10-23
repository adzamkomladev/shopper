import { useShortcuts, type ShortcutMap } from "@shopper/ui/hooks/shortcuts";

/**
 * The sale screen's keys. `enabled` is false while a dialog owns the keyboard or a receipt shows, so an
 * empty map stands in and nothing underneath fires.
 */
export function useSaleShortcuts(enabled: boolean, keys: ShortcutMap) {
  const register = useShortcuts(enabled ? keys : {});
  // With the scan field disabled nothing else takes focus, so the screen holds it for its keys.
  return (node: HTMLElement | null) => {
    const cleanup = register(node);
    if (node && document.activeElement === document.body) node.focus();
    return cleanup;
  };
}
