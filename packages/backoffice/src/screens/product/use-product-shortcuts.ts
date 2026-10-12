import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** Mod+S saves the details; P opens the set-price dialog. Attach the ref to the screen's root. */
export function useProductShortcuts(actions: { save: () => void; setPrice: () => void }) {
  return useShortcuts({ "Mod+S": actions.save, P: actions.setPrice });
}
