import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/**
 * "/" jumps to the search, L toggles low stock, Z stock below zero, B opens the branch picker. Attach the ref to
 * the screen's root.
 */
export function useStockShortcuts(actions: {
  focusSearch: () => void;
  toggleLow: () => void;
  toggleNegative: () => void;
  pickBranch: () => void;
}) {
  return useShortcuts({
    "/": actions.focusSearch,
    L: actions.toggleLow,
    Z: actions.toggleNegative,
    B: actions.pickBranch,
  });
}
