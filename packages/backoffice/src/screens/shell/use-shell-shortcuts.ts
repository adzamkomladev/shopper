import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** Mod+K opens the palette; "/" focuses the search field. Attach the returned ref to the nav. */
export function useShellShortcuts(actions: { openPalette: () => void; focusSearch: () => void }) {
  return useShortcuts({ "Mod+K": actions.openPalette, "/": actions.focusSearch });
}
