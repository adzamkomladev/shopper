import type { Dispatch, SetStateAction } from "react";
import type {
  Approval,
  ApprovalPermission,
  ApproverState,
  SaleActions,
  SaleOutcome,
  SaleSnapshot,
} from "../src/sale/types";
import { emptyView, id } from "./fixtures";
import { priceView } from "./sale/price";

/** The PIN every manager in the harness accepts; anything else is a wrong PIN. */
export const managerPin = "4321";
const managers = [
  { userId: id("20"), name: "Kofi Mensah" },
  { userId: id("21"), name: "Abena Owusu" },
];
const tries = 5;
let wrong = 0;

/** What the host would answer to `approvers.list` in this scenario. */
export function approversFor(scenario: string, permission: ApprovalPermission): ApproverState {
  const ready: ApproverState = { permission, status: "ready", approvers: managers, stale: false };
  if (scenario === "void-no-approvers") return { ...ready, approvers: [] };
  if (scenario === "void-stale-approvers") return { ...ready, approvers: [], stale: true };
  if (scenario === "void-approvers-loading") return { ...ready, status: "loading", approvers: [] };
  if (scenario === "void-approvers-failed") return { ...ready, status: "failed", approvers: [] };
  return ready;
}

/** The host's answer to a change that may carry a manager's PIN, with the host's own words. */
export function judge(scenario: string, approval: Approval | undefined): SaleOutcome {
  if (!approval) return { ok: true };
  if (scenario === "void-locked")
    return {
      ok: false,
      code: "APPROVAL_LOCKED",
      message: "Too many attempts. Try again in 15 minutes.",
    };
  if (scenario === "void-forbidden")
    return { ok: false, code: "APPROVAL_FORBIDDEN", message: "This person cannot approve that" };
  if (approval.pin === managerPin) return { ok: true };
  wrong += 1;
  return {
    ok: false,
    code: "APPROVAL_INVALID",
    message: `Wrong PIN. ${Math.max(tries - wrong, 0)} tries left`,
  };
}

type Recorder = (type: string) => (...args: unknown[]) => unknown;

/** The approval-bearing sale actions: they record the call, then answer the way the host would. */
export function approvalActions(
  scenario: string,
  record: Recorder,
  setSnapshot: Dispatch<SetStateAction<SaleSnapshot>>,
): Pick<SaleActions, "voidSale" | "priceLine" | "loadApprovers"> {
  return {
    voidSale: async (reason, draftId, revision, approval) => {
      // Arguments the caller left out are not recorded, so a call reads the way it was made.
      record("voidSale")(
        ...[reason, draftId, revision, approval].slice(0, approval ? 4 : draftId ? 3 : 1),
      );
      const outcome = judge(scenario, approval);
      if (!outcome.ok) return outcome;
      setSnapshot((current) =>
        draftId
          ? { ...current, held: current.held.filter((view) => view.draft?.id !== draftId) }
          : { ...current, view: emptyView },
      );
      return outcome;
    },
    priceLine: async (input) => {
      record("priceLine")(input);
      const outcome = judge(scenario, input.approval);
      if (outcome.ok) setSnapshot((current) => ({ ...current, view: priceView(input) }));
      return outcome;
    },
    loadApprovers: (permission) => {
      record("loadApprovers")(permission);
      setSnapshot((current) => ({ ...current, approvers: approversFor(scenario, permission) }));
    },
  };
}
