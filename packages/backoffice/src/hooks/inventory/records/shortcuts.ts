import { useNavigate } from "@tanstack/react-router";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";

/** R opens Receive and A opens Adjust (members who can write stock only); B opens the branch picker. */
export function useRecordShortcuts(branchId: string, canWrite: boolean, pickBranch: () => void) {
  const navigate = useNavigate();
  const go = (to: "/stock/receive" | "/stock/adjust") => () =>
    void navigate({ to, search: { branch: branchId } });
  return useShortcuts({
    B: pickBranch,
    ...(canWrite && { R: go("/stock/receive"), A: go("/stock/adjust") }),
  });
}
