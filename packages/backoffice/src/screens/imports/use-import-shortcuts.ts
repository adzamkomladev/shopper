import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** Mod+Enter takes the next step: check the chosen file, then import it. Attach the ref to the screen's root. */
export function useImportShortcuts(actions: { next: () => void }) {
  return useShortcuts({ "Mod+Enter": actions.next });
}
