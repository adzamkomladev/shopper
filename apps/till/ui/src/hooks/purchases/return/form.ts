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
import {
  askRemote,
  refuseRemote,
  resetRemote,
  useRemoteApproval,
} from "../../../sale/remote/state";
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
  const [mode, setModeState] = useState<"pin" | "remote">("pin");
  const remote = useRemoteApproval();
  const manager = useApprovalForm(approvers, eligibility.approvalRequired && mode === "pin");
  const selected = eligibility.lines.flatMap(({ lineId }) => {
    const quantityThousandths = lines.quantities[lineId] ?? 0;
    return quantityThousandths > 0 ? [{ lineId, quantityThousandths }] : [];
  });
  const preview = previewRefund(purchase, lines.quantities);
  // The manager approved one sale and total; a changed refund needs asking again.
  const remoteApproved =
    remote.status === "approved" &&
    remote.saleId === purchase.id &&
    remote.amount === (preview?.gross ?? null);
  const needsReference = kind !== "cash";
  const block =
    selected.length === 0
      ? "Enter a quantity to return"
      : !reason.trim()
        ? "Add a reason for the return"
        : needsReference && !reference.trim()
          ? `Enter the ${kind === "card" ? "card" : "MoMo"} reference`
          : eligibility.approvalRequired && mode === "remote" && !remoteApproved
            ? "Wait for a manager to approve this refund"
            : !manager.ready
              ? "Choose a manager and enter their PIN"
              : null;

  function setMode(next: "pin" | "remote") {
    setModeState(next);
    if (next === "pin") resetRemote();
  }
  function ask() {
    if (!preview || !reason.trim() || selected.length === 0) return;
    void askRemote({
      saleId: purchase.id,
      receiptNumber: purchase.receiptNumber ?? undefined,
      amount: preview.gross,
      reason: reason.trim(),
    });
  }
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
        ...(mode === "remote" && remote.id && { approval: { approvalId: remote.id } }),
      });
      // The PIN tab is hidden while asking remotely, so a refusal shows in the remote panel.
      if (!outcome.ok && mode === "remote" && outcome.code.startsWith("APPROVAL"))
        refuseRemote(outcome.message);
      if (outcome.ok) {
        resetRemote();
        toast.success(`Refund of ${formatGHS(money(outcome.total))} recorded`);
      }
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
    remote: { mode, setMode, state: remote, approved: remoteApproved, ask },
    preview,
    count: selected.length,
    block,
    submit,
  };
}
