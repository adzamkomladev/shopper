import { useRef, useState } from "react";
import type { Approval, ApproverState, SaleOutcome } from "../../sale/types";

const isPin = (pin: string) => /^\d{4,8}$/.test(pin);
const fromApproval = (code: string) => code.startsWith("APPROVAL_");

/**
 * The manager choice, PIN and refusal for one dialog. Mount it inside the dialog content so closing the
 * dialog drops the PIN. `required` is false when the cashier may act alone.
 */
export function useApprovalForm(approvers: ApproverState, required: boolean) {
  const [chosen, setChosen] = useState("");
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Extract<SaleOutcome, { ok: false }> | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const list = approvers.approvers;
  // A single manager is chosen for the cashier.
  const approverId = list.some((approver) => approver.userId === chosen)
    ? chosen
    : list.length === 1
      ? list[0]!.userId
      : "";
  const approval: Approval | undefined = required ? { approverId, pin } : undefined;

  /** Runs `act`; on a refusal keeps the dialog open, clears a wrong PIN and puts focus back on it. */
  async function submit(act: (approval?: Approval) => Promise<SaleOutcome>) {
    if (pending || (required && !(approverId && isPin(pin)))) return;
    setPending(true);
    setFailure(null);
    const outcome = await act(approval);
    setPending(false);
    if (outcome.ok) return;
    setFailure(outcome);
    if (fromApproval(outcome.code)) {
      setPin("");
      pinRef.current?.focus();
    }
  }

  return {
    approverId,
    pin,
    pinRef,
    pending,
    /** The approval fields are complete (or not needed). */
    ready: !required || (approverId !== "" && isPin(pin)),
    /** A refusal about the manager or PIN, shown beside the PIN field. */
    pinError: failure && fromApproval(failure.code) ? failure.message : null,
    /** Any other refusal, shown above the buttons. */
    problem: failure && !fromApproval(failure.code) ? failure.message : null,
    setApprover: setChosen,
    setPin,
    submit,
  };
}
