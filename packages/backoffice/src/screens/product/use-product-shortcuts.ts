import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/**
 * Mod+Enter saves the details (Mod+S is an alias); P opens the set-price dialog. Pass only the
 * actions that apply: while the price dialog is open it owns Mod+Enter, so the screen gives it up.
 */
export function useProductShortcuts(actions: { save?: () => void; setPrice?: () => void }) {
  return useShortcuts({
    ...(actions.save && { "Mod+Enter": actions.save, "Mod+S": actions.save }),
    ...(actions.setPrice && { P: actions.setPrice }),
  });
}
