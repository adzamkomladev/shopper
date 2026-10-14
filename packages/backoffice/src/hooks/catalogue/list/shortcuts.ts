import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** N starts a new product; "/" jumps to the product search. Attach the ref to the screen's root. */
export function useProductsShortcuts(actions: { newProduct: () => void; focusSearch: () => void }) {
  return useShortcuts({ N: actions.newProduct, "/": actions.focusSearch });
}
