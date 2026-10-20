import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** N starts a take (members who can write stock, online); B opens the branch picker. */
export function useTakesShortcuts(canStart: boolean, start: () => void, pickBranch: () => void) {
  return useShortcuts({ B: pickBranch, ...(canStart && { N: start }) });
}
