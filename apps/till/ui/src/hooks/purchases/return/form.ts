import { useState } from "react";
import { formatGHS, money } from "@shopper/money";
import { toast } from "@shopper/ui/components/sonner";
import { previewRefund } from "../../../purchases/preview";
import type {
  ApproverState,
  EligibilityView,
  PurchaseActions,
  PurchaseDetails,
  RefundKind,
} from "../../../sale/types";
import { useApprovalForm } from "../../approval/form";
import { useReturnLines } from "./lines";

/** Everything the return screen has typed so far, what that refunds, and the one thing still missing. */
export function useReturnForm(
  purchase: PurchaseDetails,
  eligibility: EligibilityView,
  approvers: ApproverState,
  actions: PurchaseActions,
) {
  const lines = useReturnLines(purchase, eligibility);
  const [reason, setReason] = useState("");
  const [kind, setKindState] = useState<RefundKind>("cash");
  const [reference, setReference] = useState("");
  const manager = useApprovalForm(approvers, eligibility.approvalRequired);
  const selected = eligibility.lines.flatMap(({ lineId }) => {
    const quantityThousandths = lines.quantities[lineId] ?? 0;
    return quantityThousandths > 0 ? [{ lineId, quantityThousandths }] : [];
  });
  const needsReference = kind !== "cash";
  const block =
    selected.length === 0
      ? "Enter a quantity to return"
      : !reason.trim()
        ? "Add a reason for the return"
        : needsReference && !reference.trim()
          ? `Enter the ${kind === "card" ? "card" : "MoMo"} reference`
          : !manager.ready
            ? "Choose a manager and enter their PIN"
            : null;

  function setKind(next: RefundKind) {
    setKindState(next);
    setReference("");
  }
  async function submit() {
    if (block || manager.pending) return;
    await manager.submit(async (approval) => {
      const outcome = await actions.refund(purchase, {
        lines: selected,
        reason: reason.trim(),
        tender: kind === "cash" ? { kind } : { kind, reference: reference.trim() },
        ...(approval && { approval }),
      });
      if (outcome.ok) toast.success(`Refund of ${formatGHS(money(outcome.total))} recorded`);
      return outcome;
    });
  }
  return {
    lines,
    reason,
    setReason,
    kind,
    setKind,
    reference,
    setReference,
    manager,
    preview: previewRefund(purchase, lines.quantities),
    count: selected.length,
    block,
    submit,
  };
}
