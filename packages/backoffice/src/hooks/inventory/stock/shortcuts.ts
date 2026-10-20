import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** "/" jumps to the search, L toggles low stock, B opens the branch picker. Attach the ref to the screen's root. */
export function useStockShortcuts(actions: {
  focusSearch: () => void;
  toggleLow: () => void;
  pickBranch: () => void;
}) {
  return useShortcuts({ "/": actions.focusSearch, L: actions.toggleLow, B: actions.pickBranch });
}
